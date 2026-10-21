import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AppState,
  Task,
  Course,
  AcademicEvent,
  Settings,
} from "../models/schema";
import { acquireWriter } from "./tab-lock";
import { bindCloudIdentity } from "./cloud";
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
import {
  accountState,
  blankAccount,
  canUseLocal,
  claimLocal,
  localOwner,
} from "./accounts";
import type { AccountPreset } from "./accounts";
import { loadConfig } from "./config";
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
  mode: "local" | "cloud" | "setup";
  status: SyncStatus;
  error: string;
  revision: number;
  verifiedCounts: Record<string, number> | null;
  writable: boolean;
};
type ContextValue = {
  cloud: CloudView;
  editConflict: { base: AppState; mine: AppState; remote: AppState } | null;
  keepEditConflict: (base: AppState, mine: AppState, remote: AppState) => void;
  dismissEditConflict: () => void;
  workspaceId: string;
  workspaceToken: string;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  migrateLocal: () => Promise<void>;
  startCloud: (name?: string, preset?: AccountPreset) => Promise<void>;
  localAccess: boolean;
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
  replace: (data: AppState, workspaceToken?: string) => boolean;
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
  const [loaded, setLoaded] = useState(() =>
    localOwner() ? { data: blankAccount(), error: null } : loadState(),
  );
  const [cloud, setCloud] = useState<CloudView>({
    user: null,
    mode: "local",
    status: "local",
    error: "",
    revision: 0,
    verifiedCounts: null,
    writable: true,
  });
  const cloudRef = useRef(cloud);
  cloudRef.current = cloud;
  const stateRef = useRef(loaded.data);
  stateRef.current = loaded.data;
  const [editConflict, setEditConflict] = useState<{
    base: AppState;
    mine: AppState;
    remote: AppState;
  } | null>(null);
  const releaseWriter = useRef<(() => void) | null>(null);
  const writerKey = useRef<string | null>(null);
  const attaching = useRef<{ id: string; operation: Promise<void> } | null>(
    null,
  );
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
    setEditConflict(null);
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
      !localOwner() &&
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
        if (cloudRef.current.mode === "local" && !localOwner()) {
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
    if (c.mode === "setup" || (c.mode === "local" && localOwner()))
      throw new Error(
        "Inicia sesión y termina la configuración de tu cuenta antes de editar.",
      );
    if (c.mode === "cloud" && c.user) {
      if (!c.writable)
        throw new Error(
          "Otra pestaña está editando esta cuenta, o este navegador no admite bloqueo seguro. Esta vista es de consulta.",
        );
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
  function replace(data: AppState, workspaceToken?: string) {
    try {
      if (workspaceToken && workspaceToken !== String(epoch.current))
        throw new Error(
          "La cuenta cambió durante la importación. No se reemplazó nada.",
        );
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
      // The joint calendar has no per-activity privacy setting.
      // Normalize older records whenever this workspace is saved.
      for (const item of [...draft.tasks, ...draft.events, ...draft.scheduledSessions]) {
        item.visibility = "details";
      }
      draft.settings.calendarDefaultVisibility = "details";
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
    if (c.mode === "setup" && c.user) {
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
    if (!c.writable) {
      await attach(c.user);
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
        ? await writeCloud(snapshot, c.revision, mutation, user)
        : await readCloud(user);
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
        window.dispatchEvent(new Event("studyspace:calendar"));
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
      if (generation === epoch.current) sending.current = false;
    }
  }
  function attach(user: { id: string; email?: string }) {
    // OTP verification and the SDK event can refer to the same in-flight
    // attachment. Share it instead of cancelling and competing for our lock.
    if (
      attaching.current?.id === user.id &&
      cloudRef.current.user?.id === user.id &&
      cloudRef.current.status === "loading"
    )
      return attaching.current.operation;
    const operation = attachWorkspace(user);
    attaching.current = { id: user.id, operation };
    return operation;
  }
  async function attachWorkspace(user: { id: string; email?: string }) {
    const key = cacheKey(user.id);
    const heldWriter = writerKey.current === key ? releaseWriter.current : null;
    changedWorkspace();
    bindCloudIdentity(user.id);
    if (!heldWriter) releaseWriter.current?.();
    releaseWriter.current = heldWriter;
    writerKey.current = heldWriter ? key : null;
    sending.current = false;
    const generation = epoch.current;
    pending.current = null;
    switchData(blankAccount());
    showCloud({
      user: { id: user.id, email: user.email ?? "" },
      mode: "setup",
      writable: false,
      status: "loading",
      error: "",
    });
    try {
      // Keep our own lock during same-account retries. Releasing and acquiring
      // immediately can race the browser's asynchronous release completion.
      const release = await (heldWriter ?? acquireWriter(key));
      if (generation !== epoch.current) {
        release?.();
        return;
      }
      releaseWriter.current = release;
      writerKey.current = release ? key : null;
      const writable = !!release;
      showCloud({ writable });
      const remote = await readCloud(user.id);
      if (generation !== epoch.current) return;
      const cache = writable ? readCache(user.id) : null;
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
          if (writable)
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
            "Cuenta nueva. Configura tu nombre y tus cursos; no se importarán datos de otra persona automáticamente.",
        });
    } catch (e) {
      if (generation !== epoch.current) return;
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
  async function migrate(data: AppState, fromLocal = false) {
    const c = cloudRef.current;
    const generation = epoch.current;
    if (!c.user || c.mode === "cloud")
      throw new Error("Inicia sesión en una cuenta vacía para importar.");
    if (!c.writable)
      throw new Error(
        "Abre esta cuenta en una sola pestaña con un navegador compatible antes de inicializarla.",
      );
    if (!navigator.onLine) throw new Error("La migración necesita conexión.");
    if (fromLocal && !canUseLocal(c.user.id, loadConfig().supabaseUrl))
      throw new Error(
        "Esta copia local pertenece a otra cuenta. No se importó nada.",
      );
    const raw = fromLocal ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      parseBackup(raw);
      localStorage.setItem(
        PHASE3_BACKUP_KEY,
        localStorage.getItem(PHASE3_BACKUP_KEY) ?? raw,
      );
      if (!localStorage.getItem(PHASE3_BACKUP_KEY))
        throw new Error("No se pudo verificar la copia local.");
    }
    const normalized = stateSchema.parse({
      ...data,
      activeTimer: data.activeTimer
        ? recoverTimer(data.activeTimer, data.activeTimer.lastSeenAt)
        : null,
    });
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
    if (generation !== epoch.current)
      throw new Error("La cuenta cambió durante la inicialización.");
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
      if (generation !== epoch.current)
        throw new Error("La cuenta cambió durante la inicialización.");
      const result = await writeCloud(normalized, 0, mutation, c.user.id);
      if (generation !== epoch.current)
        throw new Error(
          "La cuenta cambió. No se mostraron sus datos en otro espacio.",
        );
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
      if (fromLocal) claimLocal(c.user.id, loadConfig().supabaseUrl);
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
      notify(
        fromLocal
          ? "Importación verificada. Los datos locales se conservaron."
          : "Espacio creado y verificado. No se copiaron datos de otra cuenta.",
      );
    } catch (e) {
      if (generation === epoch.current)
        showCloud({ status: "error", error: (e as Error).message });
      throw e;
    }
  }
  function restoreLocalSession() {
    bindCloudIdentity(null);
    releaseWriter.current?.();
    releaseWriter.current = null;
    writerKey.current = null;
    sending.current = false;
    changedWorkspace();
    pending.current = null;
    const original = localOwner()
      ? { data: blankAccount(), error: null }
      : loadState();
    stateRef.current = original.data;
    setLoaded(original);
    showCloud({
      user: null,
      mode: "local",
      status: "local",
      error: "",
      revision: 0,
      verifiedCounts: null,
      writable: true,
    });
  }
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    function listen() {
      unsubscribe?.();
      try {
        const client = cloudClient();
        let active = true;
        let firstEvent = true;
        const restoreSubscription = !!cloudRef.current.user;
        const listener = client.auth.onAuthStateChange?.((event, session) => {
          if (!active) return;
          const first = firstEvent;
          firstEvent = false;
          const user = session?.user;
          if (
            event === "SIGNED_OUT" ||
            (!user && event === "INITIAL_SESSION")
          ) {
            if (cloudRef.current.user) restoreLocalSession();
            return;
          }
          if (
            user &&
            ((first && restoreSubscription) ||
              user.id !== cloudRef.current.user?.id)
          ) {
            // Clear the old workspace synchronously. attach yields at the lock
            // before querying auth/RPC, so the auth callback cannot deadlock.
            void attach(user).catch((e) => notify((e as Error).message));
          } else if (
            user &&
            event === "TOKEN_REFRESHED" &&
            ["error", "offline"].includes(cloudRef.current.status)
          ) {
            // A new credential can recover a failed initial load or sync.
            // syncNow keeps pending changes and suppresses concurrent retries.
            void syncNow().catch((e) => notify((e as Error).message));
          }
        });
        unsubscribe = () => {
          active = false;
          listener?.data.subscription.unsubscribe();
        };
      } catch {
        /* Sin configuración todavía. */
      }
    }
    listen();
    window.addEventListener("studyspace:config", listen);
    return () => {
      unsubscribe?.();
      // Invalidate even an acquisition/read which has not completed yet.
      epoch.current++;
      attaching.current = null;
      releaseWriter.current?.();
      releaseWriter.current = null;
      writerKey.current = null;
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
    const generation = epoch.current;
    if (!c.user) return;
    if (sending.current || !c.writable)
      throw new Error(
        "Espera al guardado activo o cierra la otra pestaña antes de reemplazar la caché.",
      );
    const remote = await readCloud(c.user.id);
    if (generation !== epoch.current)
      throw new Error("La cuenta cambió durante la consulta.");
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
        document.visibilityState !== "hidden" &&
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
    editConflict,
    keepEditConflict: (base, mine, remote) =>
      setEditConflict(structuredClone({ base, mine, remote })),
    dismissEditConflict: () => setEditConflict(null),
    workspaceId: cloud.user ? `${cloud.mode}:${cloud.user.id}` : "local",
    localAccess: canUseLocal(cloud.user?.id ?? null, loadConfig().supabaseUrl),
    workspaceToken: String(epoch.current),
    sendCode: async (email) => {
      const { error } = await cloudClient().auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: "https://fabrizio-rda.github.io/studyspace/",
        },
      });
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
      if (cloudRef.current.user?.id !== data.user.id) await attach(data.user);
      else if (cloudRef.current.status === "loading") await attach(data.user);
    },
    signOut,
    syncNow,
    migrateLocal: async () => {
      const local = loadState();
      if (local.error) throw new Error(local.error);
      await migrate(local.data, true);
    },
    startCloud: async (name = "Fabrizio", preset = "fabrizio") => {
      const user = cloudRef.current.user;
      if (!user || cloudRef.current.mode !== "setup")
        throw new Error("Solo una cuenta vacía puede inicializarse.");
      const key = cacheKey(user.id) + ":initialization";
      const raw = localStorage.getItem(key);
      const previous = raw ? parseBackup(raw) : null;
      const draft =
        previous &&
        previous.settings.name === name.trim() &&
        previous.settings.academicPreset === preset
          ? previous
          : accountState(name, preset);
      localStorage.setItem(key, JSON.stringify(draft));
      await migrate(draft);
    },
    useRemote,
    storageError: loaded.error,
    notice,
    notify,
    commit,
    replace,
    reset: () =>
      replace(
        cloudRef.current.mode === "cloud"
          ? accountState(
              stateRef.current.settings.name,
              stateRef.current.settings.academicPreset ?? "fabrizio",
            )
          : initialState(),
      ),
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
