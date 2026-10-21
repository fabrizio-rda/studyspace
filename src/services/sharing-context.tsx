import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "./store";
import { emptySharing, sharingStatus, calendarFeed, ownCalendarEvents } from "./sharing";
import type { SharingStatus, SharedEvent } from "./sharing";
const Context = createContext<null | {
  status: SharingStatus;
  error: string;
  loading: boolean;
  refresh: () => Promise<void>;
  userId: string | null;
}>(null);
export function SharingProvider({ children }: { children: ReactNode }) {
  const { cloud, workspaceToken } = useStore();
  const active = cloud.mode === "cloud" && cloud.user ? cloud.user.id : null;
  const [state, setState] = useState<{
    key: string | null;
    status: SharingStatus;
    error: string;
    loading: boolean;
  }>({ key: null, status: emptySharing, error: "", loading: false });
  const keyRef = useRef(active);
  keyRef.current = active;
  const request = useRef(0);
  const busy = useRef(false);
  const last = useRef(0);
  async function refresh() {
    if (!active || !navigator.onLine) {
      setState({
        key: active,
        status: emptySharing,
        error: active
          ? "Sin conexión. El calendario compartido necesita una consulta actualizada."
          : "",
        loading: false,
      });
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const n = ++request.current;
    const key = active;
    try {
      const status = await sharingStatus();
      if (keyRef.current === key && request.current === n) {
        last.current = Date.now();
        setState({ key, status, error: "", loading: false });
      }
    } catch (e) {
      if (keyRef.current === key && request.current === n)
        setState({
          key,
          status: emptySharing,
          error: (e as Error).message,
          loading: false,
        });
    } finally {
      if (request.current === n) busy.current = false;
    }
  }
  useEffect(() => {
    request.current++;
    busy.current = false;
    setState({
      key: active,
      status: emptySharing,
      error: "",
      loading: !!active,
    });
    void refresh();
    const tick = setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, 30000);
    const focus = () => {
      if (Date.now() - last.current > 1000) void refresh();
    };
    const online = () => void refresh();
    const offline = () => {
      request.current++;
      busy.current = false;
      setState({
        key: active,
        status: emptySharing,
        error:
          "Sin conexión. Datos compartidos ocultos hasta volver a consultar.",
        loading: false,
      });
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      request.current++;
      clearInterval(tick);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [active, workspaceToken]);
  const current =
    state.key === active
      ? state
      : { key: active, status: emptySharing, error: "", loading: !!active };
  return (
    <Context.Provider
      value={{
        status: current.status,
        error: current.error,
        loading: current.loading,
        refresh,
        userId: active,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSharing() {
  const v = useContext(Context);
  if (!v) throw new Error("Falta SharingProvider");
  return v;
}
export function useSharedFeed(start: string, end: string) {
  const { data, cloud } = useStore();
  const sharing = useSharing();
  const key = sharing.status.connection
    ? `${sharing.userId}:${sharing.status.connection.id}:${start}:${end}:${data.settings.timezone}`
    : null;
  const ref = useRef(key);
  ref.current = key;
  const [state, setState] = useState<{
    key: string | null;
    events: SharedEvent[];
    error: string;
    updated: number;
    loading: boolean;
  }>({ key: null, events: [], error: "", updated: 0, loading: false });
  const busy = useRef(false);
  const serial = useRef(0);
  const last = useRef(0);
  async function refresh() {
    if (!key) return;
    if (!navigator.onLine) {
      setState({
        key,
        events: [],
        error:
          "Sin conexión. No mostramos una copia antigua del calendario compartido.",
        updated: 0,
        loading: false,
      });
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const run = ++serial.current;
    try {
      const result = await calendarFeed(start, end, data.settings.timezone);
      if (ref.current === key && run === serial.current) {
        last.current = Date.now();
        setState({
          key,
          events: result.connected ? result.events : [],
          error: result.connected ? "" : "La vinculación ya no está activa.",
          updated: Date.now(),
          loading: false,
        });
        if (!result.connected) void sharing.refresh();
      }
    } catch (e) {
      if (ref.current === key && run === serial.current)
        setState({
          key,
          events: [],
          error: (e as Error).message,
          updated: 0,
          loading: false,
        });
    } finally {
      if (serial.current === run) busy.current = false;
    }
  }
  useEffect(() => {
    serial.current++;
    busy.current = false;
    setState({ key, events: [], error: "", updated: 0, loading: !!key });
    if (key) void refresh();
    const interval = setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, 30000);
    const focus = () => {
      if (Date.now() - last.current > 1000) void refresh();
    };
    const online = () => void refresh();
    const offline = () => {
      serial.current++;
      busy.current = false;
      setState({
        key,
        events: [],
        error: "Sin conexión. La información compartida queda oculta.",
        updated: 0,
        loading: false,
      });
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("studyspace:calendar", focus);
    return () => {
      serial.current++;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("studyspace:calendar", focus);
    };
  }, [key]);
  const current = state.key === key
    ? state
    : { events: [] as SharedEvent[], error: "", updated: 0, loading: !!key };
  // Own activities always appear, even before a second account is linked.
  // Drop remote copies of the owner to prevent duplicate calendar entries.
  const mine =
    cloud.mode === "cloud" && cloud.user
      ? ownCalendarEvents(data, cloud.user.id, start, end)
      : [];
  const peer = current.events.filter(
    (event) => event.ownerId !== sharing.userId,
  );
  return {
    ...current,
    events: [...mine, ...peer].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.ownerName.localeCompare(b.ownerName),
    ),
    refresh,
  };
}
