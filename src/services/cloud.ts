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
      studyspace_calendar_status: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      studyspace_calendar_invite: {
        Args: { p_email: string };
        Returns: unknown;
      };
      studyspace_calendar_accept: {
        Args: { p_invite_id: string };
        Returns: unknown;
      };
      studyspace_calendar_cancel: {
        Args: { p_invite_id: string };
        Returns: unknown;
      };
      studyspace_calendar_revoke: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      studyspace_calendar_feed: {
        Args: { p_start: string; p_end: string };
        Returns: unknown;
      };
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
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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
let identity: string | null = null;
let requests = new AbortController();
export function bindCloudIdentity(user: string | null) {
  requests.abort();
  requests = new AbortController();
  identity = user;
}
async function credentials(
  expected: string | undefined = identity ?? undefined,
) {
  const scope = requests;
  const client = cloudClient();
  const { data, error } = await client.auth.getSession();
  if (
    error ||
    !data.session ||
    (expected && data.session.user.id !== expected) ||
    (identity && data.session.user.id !== identity) ||
    scope.signal.aborted
  )
    throw new Error(
      "La sesión cambió. Vuelve a abrir tu espacio antes de guardar.",
    );
  // Verify the signed token's subject, not only the persisted user object.
  const verified = await client.auth.getClaims(data.session.access_token);
  if (
    verified.error ||
    verified.data?.claims.sub !== data.session.user.id ||
    (expected && verified.data?.claims.sub !== expected) ||
    scope.signal.aborted
  )
    throw new Error("No se pudo comprobar la identidad de esta sesión.");
  return { client, token: data.session.access_token, signal: scope.signal };
}
export async function cloudRpc<N extends keyof Database["public"]["Functions"]>(
  name: N,
  args?: Database["public"]["Functions"][N]["Args"],
) {
  const { client, token, signal } = await credentials();
  return client
    .rpc(name, args as never)
    .setHeader("Authorization", `Bearer ${token}`)
    .abortSignal(signal);
}
export async function readCloud(expected?: string) {
  const { client, token, signal } = await credentials(expected);
  const { data, error } = await client
    .rpc("studyspace_read")
    .setHeader("Authorization", `Bearer ${token}`)
    .abortSignal(signal);
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
  expected?: string,
) {
  const validated = stateSchema.parse(cloudSnapshot(state));
  const { client, token, signal } = await credentials(expected);
  const { data, error } = await client
    .rpc("studyspace_save", {
      p_state: validated,
      p_expected_revision: revision,
      p_mutation_id: mutation,
    })
    .setHeader("Authorization", `Bearer ${token}`)
    .abortSignal(signal);
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
