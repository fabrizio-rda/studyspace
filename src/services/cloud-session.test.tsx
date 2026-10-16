import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StoreProvider, useStore } from "./store";
import { cloudClient, cacheKey } from "./cloud";
import { accountState } from "./accounts";

// Real Supabase SDK and StoreProvider; only HTTP is substituted. No external
// request is allowed. These tokens and users exist solely in this test process.
const owner = "10000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const user = (id = owner) => ({
  id,
  email: `${id}@example.test`,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
});
function jwt(id: string, exp: number) {
  const encode = (v: unknown) =>
    btoa(JSON.stringify(v))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  // HS256 follows SDK's server-verification path: the /user response below
  // stands in for Auth's signature check, not a local cryptographic claim.
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, exp, aud: "authenticated", role: "authenticated" })}.dGVzdA`;
}
let refreshCalls: number,
  reads: number,
  refreshUser: string,
  rejectRefresh: boolean;
let client: ReturnType<typeof cloudClient>;
let freshToken: string;
beforeEach(() => {
  localStorage.clear();
  refreshCalls = reads = 0;
  refreshUser = owner;
  rejectRefresh = false;
  const project = `session-${crypto.randomUUID()}`;
  localStorage.setItem(
    "studyspace:public-config:v1",
    JSON.stringify({
      supabaseUrl: `https://${project}.supabase.co`,
      supabaseKey: "sb_publishable_test_only",
    }),
  );
  const exp = Math.floor(Date.now() / 1000) - 3600;
  localStorage.setItem(
    `sb-${project}-auth-token`,
    JSON.stringify({
      access_token: jwt(owner, exp),
      refresh_token: "expired-test-session-refresh",
      expires_at: exp,
      expires_in: 3600,
      token_type: "bearer",
      user: user(),
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/token?grant_type=refresh_token")) {
        refreshCalls++;
        if (rejectRefresh)
          return new Response(
            JSON.stringify({
              code: "refresh_token_not_found",
              message: "Invalid Refresh Token: Refresh Token Not Found",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        freshToken = jwt(refreshUser, Math.floor(Date.now() / 1000) + 3600);
        return Response.json({
          access_token: freshToken,
          refresh_token: "renewed-test-session-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: user(refreshUser),
        });
      }
      if (url.endsWith("/auth/v1/user")) {
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          `Bearer ${freshToken}`,
        );
        return Response.json(user(refreshUser));
      }
      if (url.endsWith("/rest/v1/rpc/studyspace_read")) {
        reads++;
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          `Bearer ${freshToken}`,
        );
        return Response.json({
          revision: 1,
          mutation_id: "test",
          state: accountState(
            refreshUser === owner ? "Cuenta A" : "Cuenta B",
            "catalina",
          ),
        });
      }
      throw Error(`Unexpected HTTP request: ${url}`);
    }),
  );
});
afterEach(async () => {
  await client?.auth.dispose();
  vi.unstubAllGlobals();
});
it("renueva una sesión vencida con el SDK real y restaura el espacio una sola vez", async () => {
  client = cloudClient();
  const a = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(a.result.current.cloud.status).toBe("synced"));
  expect(a.result.current.cloud.user?.id).toBe(owner);
  expect(a.result.current.data.settings.name).toBe("Cuenta A");
  expect(refreshCalls).toBe(1);
  expect(reads).toBe(1);
  await act(async () => {
    await client.auth.getSession();
    await client.auth.getSession();
  });
  expect(refreshCalls).toBe(1);
  expect(reads).toBe(1);
  a.unmount();
});
it("un refresh token revocado termina sin RPC académicos ni reintentos en cascada", async () => {
  rejectRefresh = true;
  client = cloudClient();
  const a = renderHook(() => useStore(), { wrapper: StoreProvider });
  await act(async () => {
    await client.auth.getSession();
  });
  expect(a.result.current.cloud.user).toBeNull();
  expect(refreshCalls).toBe(1);
  expect(reads).toBe(0);
  await act(async () => {
    await client.auth.getSession();
    await client.auth.getSession();
  });
  expect(refreshCalls).toBe(1);
  expect(localStorage.getItem(cacheKey(owner))).toBeNull();
  a.unmount();
});
it("si la renovación devuelve otro UUID utiliza esa identidad y nunca la caché anterior", async () => {
  refreshUser = other;
  client = cloudClient();
  const original = JSON.stringify({
    revision: 3,
    pending: "pending-a",
    state: accountState("Privado A", "fabrizio"),
  });
  localStorage.setItem(cacheKey(owner), original);
  const a = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(a.result.current.cloud.status).toBe("synced"));
  expect(a.result.current.cloud.user?.id).toBe(other);
  expect(a.result.current.data.settings.name).toBe("Cuenta B");
  expect(localStorage.getItem(cacheKey(owner))).toBe(original);
  expect(refreshCalls).toBe(1);
  expect(reads).toBe(1);
  a.unmount();
});
