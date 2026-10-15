import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AppState,
  Task,
  Course,
  AcademicEvent,
  Settings,
} from "../models/schema";
import { initialState } from "../models/schema";
import { loadState, saveState, STORAGE_KEY } from "./storage";
type ContextValue = {
  data: AppState;
  storageError: string | null;
  notice: string;
  notify: (text: string) => void;
  commit: (mutate: (draft: AppState) => void, message?: string) => boolean;
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
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function notify(text: string) {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 5000);
  }
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setLoaded(loadState());
        notify("Se actualizaron los datos desde otra pestaña.");
      }
    };
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener("storage", listener);
      clearTimeout(timer.current);
    };
  }, []);
  function replace(data: AppState) {
    try {
      saveState(data);
      setLoaded({ data, error: null });
      notify("Datos guardados en este navegador.");
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  function commit(
    mutate: (draft: AppState) => void,
    message = "Cambios guardados",
  ) {
    const current = loadState();
    if (current.error) {
      setLoaded(current);
      notify("Primero recupera los datos desde Configuración.");
      return false;
    }
    try {
      const draft = structuredClone(current.data);
      mutate(draft);
      saveState(draft);
      setLoaded({ data: draft, error: null });
      notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  const value: ContextValue = {
    data: loaded.data,
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
