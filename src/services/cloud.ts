import { createClient } from "@supabase/supabase-js";
import { loadConfig, validateConfig } from "./config";
import { recoverTimer } from "./study";
import { parseBackup } from "./storage";
import { stateSchema } from "../models/schema";
import type { AppState } from "../models/schema";
type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      studyspace_read: { Args: Record<string, never>; Returns: unknown };
      studyspace_save: {
        Args: {
          p_state: AppState;
          p_expected_revision: number;
          p_mutation_id: string;
        };
        Returns: unknown;
      };
    };
  };
};
let cached: ReturnType<typeof createClient<Database>> | null = null;
let fingerprint = "";
export function cloudClient() {
  const c = validateConfig(loadConfig());
  if (!c.supabaseUrl || !c.supabaseKey)
    throw new Error("Primero configura Supabase en Integraciones.");
  const next = c.supabaseUrl + c.supabaseKey;
  if (!cached || next !== fingerprint) {
    cached?.auth.stopAutoRefresh();
    cached = createClient<Database>(c.supabaseUrl, c.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(30000),
          }),
      },
    });
    fingerprint = next;
  }
  return cached;
}
export type CloudSnapshot = {
  revision: number;
  state: AppState | null;
  mutation_id: string | null;
};
export function decodeSnapshot(value: unknown): CloudSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("Respuesta de nube inválida.");
  const v = value as Record<string, unknown>;
  if (!Number.isSafeInteger(v.revision) || Number(v.revision) < 0)
    throw new Error("Revisión de nube inválida.");
  return {
    revision: Number(v.revision),
    state: v.state ? parseBackup(JSON.stringify(v.state)) : null,
    mutation_id: typeof v.mutation_id === "string" ? v.mutation_id : null,
  };
}
export async function readCloud() {
  const { data, error } = await cloudClient().rpc("studyspace_read");
  if (error) throw new Error(error.message);
  return decodeSnapshot(data);
}
export function cloudSnapshot(state: AppState): AppState {
  return {
    ...state,
    activeTimer: state.activeTimer
      ? recoverTimer(state.activeTimer, state.activeTimer.lastSeenAt)
      : null,
  };
}
export async function writeCloud(
  state: AppState,
  revision: number,
  mutation: string,
) {
  const validated = stateSchema.parse(cloudSnapshot(state));
  const { data, error } = await cloudClient().rpc("studyspace_save", {
    p_state: validated,
    p_expected_revision: revision,
    p_mutation_id: mutation,
  });
  if (error)
    throw new Error(
      error.message.includes("REVISION_CONFLICT")
        ? "REVISION_CONFLICT"
        : error.message,
    );
  return decodeSnapshot(data);
}
export function cacheKey(user: string) {
  return `studyspace:cloud:${new URL(loadConfig().supabaseUrl).hostname}:${user}`;
}
export type CloudCache = {
  revision: number;
  state: AppState;
  pending: string | null;
};
export function readCache(user: string): CloudCache | null {
  const raw = localStorage.getItem(cacheKey(user));
  if (!raw) return null;
  const v = JSON.parse(raw);
  if (
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    (v.pending !== null && typeof v.pending !== "string")
  )
    throw new Error("Caché de nube inválida.");
  return { ...v, state: parseBackup(JSON.stringify(v.state)) };
}
export function saveCache(user: string, cache: CloudCache) {
  stateSchema.parse(cache.state);
  localStorage.setItem(cacheKey(user), JSON.stringify(cache));
}
export function recordCounts(d: AppState) {
  return Object.fromEntries(
    Object.entries(d)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, (v as unknown[]).length]),
  );
}
export function sameContent(a: AppState, b: AppState) {
  return (
    JSON.stringify(stateSchema.parse(cloudSnapshot(a))) ===
    JSON.stringify(stateSchema.parse(cloudSnapshot(b)))
  );
}
