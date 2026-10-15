import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AppState,
  Task,
  Course,
  AcademicEvent,
  Settings,
} from "../models/schema";
import { recoverTimer, timerElapsed } from "./study";
import { stateSchema } from "../models/schema";
import {
  cacheKey,
  cloudClient,
  readCloud,
  writeCloud,
  readCache,
  saveCache,
  sameContent,
} from "./cloud";
import { parseBackup, PHASE3_BACKUP_KEY } from "./storage";
import { initialState } from "../models/schema";
import { loadState, saveState, STORAGE_KEY } from "./storage";
export type SyncStatus =
  | "local"
  | "loading"
  | "synced"
  | "saving"
  | "pending"
  | "offline"
  | "conflict"
  | "error";
export type CloudView = {
  user: { id: string; email: string } | null;
  mode: "local" | "cloud";
  status: SyncStatus;
  error: string;
  revision: number;
  verifiedCounts: Record<string, number> | null;
};
type ContextValue = {
  cloud: CloudView;
  workspaceId: string;
  workspaceToken: string;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  migrateLocal: () => Promise<void>;
  startCloud: () => Promise<void>;
  useRemote: () => Promise<void>;

  data: AppState;
  storageError: string | null;
  notice: string;
  notify: (text: string) => void;
  commit: (
    mutate: (draft: AppState) => void,
    message?: string | null,
    workspaceToken?: string,
  ) => boolean;
  replace: (data: AppState) => boolean;
  reset: () => boolean;
  saveTask: (task: Task) => boolean;
  saveEvent: (event: AcademicEvent) => boolean;
  saveCourse: (course: Course) => boolean;
  toggleTask: (id: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  deleteCourse: (id: string) => boolean;
};
const Context = createContext<ContextValue | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(loadState);
  const [cloud, setCloud] = useState<CloudView>({
    user: null,
    mode: "local",
    status: "local",
    error: "",
    revision: 0,
    verifiedCounts: null,
  });
  const cloudRef = useRef(cloud);
  cloudRef.current = cloud;
  const stateRef = useRef(loaded.data);
  stateRef.current = loaded.data;
  const pending = useRef<string | null>(null);
  const sending = useRef(false);
  const epoch = useRef(0);
  function showCloud(patch: Partial<CloudView>) {
    cloudRef.current = { ...cloudRef.current, ...patch };
    setCloud(cloudRef.current);
  }
  function switchData(data: AppState) {
    stateRef.current = data;
    setLoaded({ data, error: null });
  }
  function changedWorkspace() {
    epoch.current++;
    window.dispatchEvent(new Event("studyspace:workspace"));
  }
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function notify(text: string) {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 5000);
  }
  useEffect(() => {
    const current = loadState();
    if (
      !current.error &&
      current.data.activeTimer?.runningSince !== null &&
      current.data.activeTimer
    ) {
      current.data.activeTimer = recoverTimer(current.data.activeTimer);
      try {
        saveState(current.data);
        setLoaded(current);
        notify(
          "Hay una sesión interrumpida. Puedes recuperarla o descartarla en Sesiones.",
        );
      } catch (e) {
        notify((e as Error).message);
      }
    }
    const listener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        if (cloudRef.current.mode === "local") {
          setLoaded(loadState());
          notify("Se actualizaron los datos desde otra pestaña.");
        }
      }
    };
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener("storage", listener);
      clearTimeout(timer.current);
    };
  }, []);
  function persist(data: AppState) {
    const validated = stateSchema.parse(data);
    const c = cloudRef.current;
    if (c.mode === "cloud" && c.user) {
      if (
        !navigator.onLine ||
        ["loading", "conflict", "offline", "error"].includes(c.status)
      )
        throw new Error(
          "La nube está en consulta. Sincroniza o resuelve el conflicto antes de editar.",
        );
      const mutation = crypto.randomUUID();
      saveCache(c.user.id, {
        state: validated,
        revision: c.revision,
        pending: mutation,
      });
      pending.current = mutation;
      switchData(validated);
      showCloud({ status: "pending", error: "" });
    } else {
      saveState(validated);
      switchData(validated);
    }
  }
  function replace(data: AppState) {
    try {
      if (data.activeTimer)
        data = { ...data, activeTimer: recoverTimer(data.activeTimer) };
      persist(data);
      notify(
        cloudRef.current.mode === "cloud"
          ? "Cambios pendientes de sincronización."
          : "Datos guardados en este navegador.",
      );
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  function commit(
    mutate: (draft: AppState) => void,
    message: string | null = "Cambios guardados",
    workspaceToken?: string,
  ) {
    if (workspaceToken && workspaceToken !== String(epoch.current)) {
      notify("El espacio cambió durante la operación. Vuelve a intentar.");
      return false;
    }
    const current =
      cloudRef.current.mode === "cloud"
        ? { data: stateRef.current, error: null }
        : loadState();
    if (current.error) {
      setLoaded(current);
      notify("Primero recupera los datos desde Configuración.");
      return false;
    }
    try {
      const draft = structuredClone(current.data);
      mutate(draft);
      persist(draft);
      if (message !== null) notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  async function syncNow() {
    const c = cloudRef.current;
    if (c.mode === "local" && c.user) {
      await attach(c.user);
      return;
    }
    if (c.mode !== "cloud" || !c.user || sending.current) return;
    if (!navigator.onLine) {
      showCloud({
        status: "offline",
        error: "Sin conexión. La caché está disponible para consulta.",
      });
      return;
    }
    if (c.status === "conflict") return;
    sending.current = true;
    const generation = epoch.current;
    const user = c.user.id;
    const mutation = pending.current;
    const snapshot = structuredClone(stateRef.current);
    showCloud({ status: mutation ? "saving" : "loading", error: "" });
    try {
      const remote = mutation
        ? await writeCloud(snapshot, c.revision, mutation)
        : await readCloud();
      if (generation !== epoch.current) return;
      if (!remote.state)
        throw new Error(
          "No hay datos en la nube. Usa el asistente de migración.",
        );
      if (mutation) {
        if (!sameContent(snapshot, remote.state))
          throw new Error(
            "La verificación del guardado no coincide. Exporta una copia antes de reintentar.",
          );
        const next = pending.current === mutation ? null : pending.current;
        saveCache(user, {
          state: next ? stateRef.current : remote.state,
          revision: remote.revision,
          pending: next,
        });
        pending.current = next;
        showCloud({
          revision: remote.revision,
          status: next ? "pending" : "synced",
          error: "",
        });
      } else if (!pending.current) {
        const normalized =
          remote.revision === c.revision
            ? stateRef.current
            : {
                ...remote.state,
                activeTimer: remote.state.activeTimer
                  ? recoverTimer(remote.state.activeTimer)
                  : null,
              };
        saveCache(user, {
          state: normalized,
          revision: remote.revision,
          pending: null,
        });
        switchData(normalized);
        showCloud({ revision: remote.revision, status: "synced", error: "" });
      }
    } catch (e) {
      if (generation === epoch.current) {
        const message = (e as Error).message;
        showCloud({
          status:
            message === "REVISION_CONFLICT"
              ? "conflict"
              : navigator.onLine
                ? "error"
                : "offline",
          error:
            message === "REVISION_CONFLICT"
              ? "Hay cambios más recientes en otro dispositivo. Exporta tus cambios y elige cargar la nube. No se sobrescribió nada."
              : message,
        });
      }
    } finally {
      sending.current = false;
    }
  }
  async function attach(user: { id: string; email?: string }) {
    changedWorkspace();
    pending.current = null;
    showCloud({
      user: { id: user.id, email: user.email ?? "" },
      mode: "local",
      status: "loading",
      error: "",
    });
    try {
      const remote = await readCloud();
      const cache = readCache(user.id);
      if (remote.state) {
        if (cache?.pending) {
          saveCache(user.id, cache);
          pending.current = cache.pending;
          switchData({
            ...cache.state,
            activeTimer: cache.state.activeTimer
              ? recoverTimer(
                  cache.state.activeTimer,
                  cache.state.activeTimer.lastSeenAt,
                )
              : null,
          });
          showCloud({
            mode: "cloud",
            revision: cache.revision,
            status: "pending",
          });
        } else {
          const normalized = {
            ...remote.state,
            activeTimer: remote.state.activeTimer
              ? recoverTimer(remote.state.activeTimer)
              : null,
          };
          saveCache(user.id, {
            state: normalized,
            revision: remote.revision,
            pending: null,
          });
          switchData(normalized);
          showCloud({
            mode: "cloud",
            revision: remote.revision,
            status: "synced",
          });
        }
      } else
        showCloud({
          status: "local",
          revision: 0,
          error:
            "Cuenta vacía. Revisa e importa los datos locales o empieza con los cursos iniciales.",
        });
    } catch (e) {
      let cache = null;
      try {
        cache = readCache(user.id);
      } catch {
        /* Se conserva la caché original para recuperación. */
      }
      if (cache) {
        pending.current = cache.pending;
        switchData({
          ...cache.state,
          activeTimer: cache.state.activeTimer
            ? recoverTimer(
                cache.state.activeTimer,
                cache.state.activeTimer.lastSeenAt,
              )
            : null,
        });
        showCloud({
          mode: "cloud",
          revision: cache.revision,
          status: "offline",
          error:
            "No se pudo consultar la nube. Solo consulta de la caché de esta cuenta.",
        });
      } else showCloud({ status: "error", error: (e as Error).message });
    }
  }
  async function migrate(data: AppState) {
    const c = cloudRef.current;
    if (!c.user || c.mode === "cloud")
      throw new Error("Inicia sesión en una cuenta vacía para importar.");
    if (!navigator.onLine) throw new Error("La migración necesita conexión.");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      parseBackup(raw);
      localStorage.setItem(
        PHASE3_BACKUP_KEY,
        localStorage.getItem(PHASE3_BACKUP_KEY) ?? raw,
      );
      if (!localStorage.getItem(PHASE3_BACKUP_KEY))
        throw new Error("No se pudo verificar la copia local.");
    }
    const normalized = {
      ...data,
      activeTimer: data.activeTimer
        ? recoverTimer(data.activeTimer, data.activeTimer.lastSeenAt)
        : null,
    };
    const migrationKey = cacheKey(c.user.id) + ":migration";
    if (raw) {
      const backupKey = migrationKey + ":backup";
      if (!localStorage.getItem(backupKey))
        localStorage.setItem(backupKey, raw);
      parseBackup(localStorage.getItem(backupKey)!);
    }

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(normalized)),
    );
    const fingerprint = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const receiptRaw = localStorage.getItem(migrationKey);
    const receipt = receiptRaw ? JSON.parse(receiptRaw) : null;
    const mutation =
      receipt?.fingerprint === fingerprint
        ? receipt.mutation
        : crypto.randomUUID();
    localStorage.setItem(
      migrationKey,
      JSON.stringify({ fingerprint, mutation, complete: false }),
    );
    showCloud({ status: "loading", error: "" });
    try {
      const result = await writeCloud(normalized, 0, mutation);
      if (!result.state || !sameContent(normalized, result.state))
        throw new Error(
          "La importación no superó la verificación de integridad.",
        );
      saveCache(c.user.id, {
        state: result.state,
        revision: result.revision,
        pending: null,
      });
      localStorage.setItem(
        migrationKey,
        JSON.stringify({ fingerprint, mutation, complete: true }),
      );
      changedWorkspace();
      switchData(result.state);
      showCloud({
        mode: "cloud",
        revision: result.revision,
        status: "synced",
        verifiedCounts: Object.fromEntries(
          Object.entries(result.state)
            .filter(([, v]) => Array.isArray(v))
            .map(([k, v]) => [k, (v as unknown[]).length]),
        ),
      });
      notify("Importación verificada. Los datos locales se conservaron.");
    } catch (e) {
      showCloud({ status: "error", error: (e as Error).message });
      throw e;
    }
  }
  function restoreLocalSession() {
    changedWorkspace();
    pending.current = null;
    const original = loadState();
    stateRef.current = original.data;
    setLoaded(original);
    showCloud({
      user: null,
      mode: "local",
      status: "local",
      error: "",
      revision: 0,
      verifiedCounts: null,
    });
  }
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    function listen() {
      unsubscribe?.();
      try {
        const client = cloudClient();
        const listener = client.auth.onAuthStateChange?.((event) => {
          if (event === "SIGNED_OUT" && cloudRef.current.user) {
            restoreLocalSession();
            notify("Sesión cerrada. Los datos de nube quedan ocultos.");
          }
        });
        unsubscribe = () => listener?.data.subscription.unsubscribe();
      } catch {
        /* Sin configuración todavía. */
      }
    }
    listen();
    window.addEventListener("studyspace:config", listen);
    return () => {
      unsubscribe?.();
      window.removeEventListener("studyspace:config", listen);
    };
  }, []);
  async function signOut() {
    if (
      cloudRef.current.mode === "cloud" &&
      stateRef.current.activeTimer?.runningSince !== null &&
      stateRef.current.activeTimer
    ) {
      const ok = commit((d) => {
        if (d.activeTimer) {
          d.activeTimer.elapsedSeconds = timerElapsed(d.activeTimer);
          d.activeTimer.runningSince = null;
          d.activeTimer.lastSeenAt = Date.now();
        }
      }, null);
      if (!ok)
        throw new Error(
          "Resuelve la sincronización y pausa la sesión antes de salir.",
        );
      await syncNow();
    }

    if (pending.current)
      throw new Error(
        "Hay cambios sin sincronizar. Exporta una copia y carga la nube antes de cerrar sesión.",
      );
    const { error } = await cloudClient().auth.signOut();
    if (error) throw error;
    if (cloudRef.current.user) restoreLocalSession();
  }
  async function useRemote() {
    const c = cloudRef.current;
    if (!c.user) return;
    const remote = await readCloud();
    if (!remote.state) throw new Error("La cuenta está vacía.");
    const normalized = {
      ...remote.state,
      activeTimer: remote.state.activeTimer
        ? recoverTimer(remote.state.activeTimer)
        : null,
    };
    saveCache(c.user.id, {
      state: normalized,
      revision: remote.revision,
      pending: null,
    });
    pending.current = null;
    switchData(normalized);
    showCloud({
      mode: "cloud",
      revision: remote.revision,
      status: "synced",
      error: "",
    });
  }
  useEffect(() => {
    const tick = setInterval(() => {
      if (
        cloudRef.current.mode === "cloud" &&
        cloudRef.current.status !== "conflict"
      )
        void syncNow();
    }, 30000);
    const online = () => void syncNow();
    const offline = () => {
      if (cloudRef.current.mode === "cloud") {
        const current = stateRef.current;
        if (current.activeTimer?.runningSince !== null && current.activeTimer) {
          const paused = {
            ...current,
            activeTimer: recoverTimer(
              current.activeTimer,
              current.activeTimer.lastSeenAt,
            ),
          };
          switchData(paused);
          try {
            saveCache(cloudRef.current.user!.id, {
              state: paused,
              revision: cloudRef.current.revision,
              pending: pending.current,
            });
          } catch {
            /* La caché anterior se conserva. */
          }
        }
        showCloud({
          status: "offline",
          error: "Sin conexión. Datos en consulta.",
        });
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  useEffect(() => {
    if (cloud.status === "pending") {
      const t = setTimeout(() => void syncNow(), 750);
      return () => clearTimeout(t);
    }
  }, [cloud.status, loaded.data]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);
  const value: ContextValue = {
    data: loaded.data,
    cloud,
    workspaceId: cloud.mode === "cloud" ? cloud.user!.id : "local",
    workspaceToken: String(epoch.current),
    sendCode: async (email) => {
      const { error } = await cloudClient().auth.signInWithOtp({ email });
      if (error) throw error;
    },
    verifyCode: async (email, token) => {
      const { data, error } = await cloudClient().auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw error;
      if (!data.user) throw new Error("No se inició sesión.");
      await attach(data.user);
    },
    signOut,
    syncNow,
    migrateLocal: async () => {
      const local = loadState();
      if (local.error) throw new Error(local.error);
      await migrate(local.data);
    },
    startCloud: () => migrate(initialState()),
    useRemote,
    storageError: loaded.error,
    notice,
    notify,
    commit,
    replace,
    reset: () => replace(initialState()),
    saveTask: (task) =>
      commit((d) => {
        const i = d.tasks.findIndex((x) => x.id === task.id);
        if (i < 0) d.tasks.push(task);
        else d.tasks[i] = task;
      }, "Tarea guardada"),
    saveEvent: (event) =>
      commit((d) => {
        const i = d.events.findIndex((x) => x.id === event.id);
        if (i < 0) d.events.push(event);
        else d.events[i] = event;
      }, "Actividad guardada"),
    saveCourse: (course) =>
      commit((d) => {
        const i = d.courses.findIndex((x) => x.id === course.id);
        if (i < 0) d.courses.push(course);
        else d.courses[i] = course;
      }, "Curso guardado"),
    toggleTask: (id) =>
      commit((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (t) {
          t.status = t.status === "completada" ? "pendiente" : "completada";
          t.completedAt =
            t.status === "completada" ? new Date().toISOString() : null;
        }
      }, "Estado actualizado"),
    updateSettings: (settings) => {
      commit((d) => {
        Object.assign(d.settings, settings);
      }, "Preferencias guardadas");
    },
    deleteCourse: (id) => {
      return commit((d) => {
        d.courses = d.courses.filter((x) => x.id !== id);
        d.tasks.forEach((t) => {
          if (t.courseId === id) t.courseId = null;
        });
        d.events.forEach((e) => {
          if (e.courseId === id) e.courseId = null;
        });
        for (const collection of [
          d.units,
          d.folders,
          d.documents,
          d.classroomLinks,
          d.plans,
          d.scheduledSessions,
          d.studyLogs,
        ])
          for (const item of collection)
            if (item.courseId === id) item.courseId = null;
        if (d.activeTimer?.courseId === id) d.activeTimer.courseId = null;
      }, "Curso eliminado. Las actividades se conservaron sin curso.");
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Falta StoreProvider");
  return ctx;
}
