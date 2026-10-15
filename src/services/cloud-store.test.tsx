import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreProvider, useStore } from "./store";
import { initialState } from "../models/schema";
import { STORAGE_KEY, saveState } from "./storage";
import {
  cloudClient,
  readCloud,
  writeCloud,
  cacheKey,
  readCache,
} from "./cloud";
vi.mock("./cloud", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cloud")>()),
  cloudClient: vi.fn(),
  readCloud: vi.fn(),
  writeCloud: vi.fn(),
}));
const account = { id: "owner-a", email: "owner@example.com" };
const state = () => {
  const d = initialState();
  d.settings.name = "Nube";
  return d;
};
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.mocked(readCloud).mockReset();
  vi.mocked(writeCloud).mockReset();
  localStorage.setItem(
    "studyspace:public-config:v1",
    JSON.stringify({ supabaseUrl: "https://demo.supabase.co" }),
  );
  vi.mocked(cloudClient).mockReturnValue({
    auth: {
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ data: { user: account }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  } as unknown as ReturnType<typeof cloudClient>);
  Object.defineProperty(navigator, "onLine", {
    get: () => true,
    configurable: true,
  });
});
const mount = () => renderHook(() => useStore(), { wrapper: StoreProvider });
describe("Cuenta, sincronización y migración (API sustituida en pruebas)", () => {
  it("mantiene separada la copia local, verifica el guardado y vuelve al modo local al salir", async () => {
    const local = initialState();
    local.settings.name = "Local";
    saveState(local);
    const original = localStorage.getItem(STORAGE_KEY);
    const remote = state();
    vi.mocked(readCloud).mockResolvedValue({
      revision: 1,
      state: remote,
      mutation_id: "initial",
    });
    vi.mocked(writeCloud).mockImplementation(async (s, rev, m) => ({
      state: s,
      revision: rev + 1,
      mutation_id: m,
    }));
    const { result } = mount();
    await act(() => result.current.verifyCode(account.email, "123456"));
    expect(result.current.data.settings.name).toBe("Nube");
    act(() => {
      expect(
        result.current.commit((d) => {
          d.settings.name = "Cambio";
        }),
      ).toBe(true);
    });
    expect(readCache(account.id)?.pending).toBeTruthy();
    await act(() => result.current.syncNow());
    expect(result.current.cloud.status).toBe("synced");
    expect(readCache(account.id)?.pending).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    await act(() => result.current.signOut());
    expect(result.current.data.settings.name).toBe("Local");
    expect(result.current.cloud.user).toBeNull();
  });
  it("no sobrescribe una revisión más nueva y conserva los cambios pendientes hasta resolverlos", async () => {
    vi.mocked(readCloud).mockResolvedValue({
      state: state(),
      revision: 4,
      mutation_id: "other",
    });
    vi.mocked(writeCloud).mockRejectedValue(Error("REVISION_CONFLICT"));
    const { result } = mount();
    await act(() => result.current.verifyCode(account.email, "123456"));
    act(() =>
      result.current.commit((d) => {
        d.settings.name = "Mi cambio";
      }),
    );
    await act(() => result.current.syncNow());
    expect(result.current.cloud.status).toBe("conflict");
    expect(result.current.data.settings.name).toBe("Mi cambio");
    expect(readCache(account.id)?.pending).toBeTruthy();
    act(() => {
      expect(
        result.current.commit((d) => {
          d.settings.name = "No permitido";
        }),
      ).toBe(false);
    });
    await act(() => result.current.useRemote());
    expect(result.current.data.settings.name).toBe("Nube");
    expect(readCache(account.id)?.pending).toBeNull();
  });
  it("bloquea la edición offline y permite consultar una caché solo después de autenticar", async () => {
    vi.mocked(readCloud).mockResolvedValue({
      state: state(),
      revision: 2,
      mutation_id: "saved",
    });
    const first = mount();
    await act(() => first.result.current.verifyCode(account.email, "123456"));
    first.unmount();
    vi.mocked(readCloud).mockRejectedValue(Error("Network"));
    Object.defineProperty(navigator, "onLine", {
      get: () => false,
      configurable: true,
    });
    const second = mount();
    expect(second.result.current.data.settings.name).not.toBe("Nube");
    expect(second.result.current.cloud.user).toBeNull();
    await act(() => second.result.current.verifyCode(account.email, "123456"));
    expect(second.result.current.data.settings.name).toBe("Nube");
    expect(second.result.current.cloud.status).toBe("offline");
    act(() => {
      expect(
        second.result.current.commit((d) => {
          d.settings.name = "Offline";
        }),
      ).toBe(false);
    });
    expect(vi.mocked(writeCloud)).not.toHaveBeenCalled();
  });
  it("migra a una cuenta vacía, verifica los registros y conserva la copia local", async () => {
    const local = initialState();
    local.folders.push({
      id: "f",
      name: "Mis apuntes",
      courseId: "course-1",
      parentId: null,
      color: "#83A8EB",
      icon: "folder",
      createdAt: new Date().toISOString(),
    });
    saveState(local);
    const raw = localStorage.getItem(STORAGE_KEY);
    vi.mocked(readCloud).mockResolvedValue({
      state: null,
      revision: 0,
      mutation_id: null,
    });
    vi.mocked(writeCloud).mockImplementation(async (s, rev, m) => ({
      state: s,
      revision: rev + 1,
      mutation_id: m,
    }));
    const { result } = mount();
    await act(() => result.current.verifyCode(account.email, "123456"));
    await act(() => result.current.migrateLocal());
    expect(result.current.cloud.mode).toBe("cloud");
    expect(result.current.cloud.verifiedCounts?.folders).toBe(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(vi.mocked(writeCloud).mock.calls[0][1]).toBe(0);
    await expect(result.current.migrateLocal()).rejects.toThrow("cuenta vacía");
  });
  it("reintenta una migración con el mismo identificador tras una respuesta perdida", async () => {
    saveState(initialState());
    vi.mocked(readCloud).mockResolvedValue({
      state: null,
      revision: 0,
      mutation_id: null,
    });
    vi.mocked(writeCloud)
      .mockRejectedValueOnce(Error("Respuesta perdida"))
      .mockImplementation(async (s, rev, m) => ({
        state: s,
        revision: rev + 1,
        mutation_id: m,
      }));
    const { result } = mount();
    await act(() => result.current.verifyCode(account.email, "123456"));
    await act(async () => {
      await expect(result.current.migrateLocal()).rejects.toThrow(
        "Respuesta perdida",
      );
    });
    await act(() => result.current.migrateLocal());
    const calls = vi.mocked(writeCloud).mock.calls;
    expect(calls[0][2]).toBe(calls[1][2]);
    expect(result.current.cloud.status).toBe("synced");
  });
  it("recupera un guardado pendiente tras recargar y rechaza operaciones de un espacio anterior", async () => {
    vi.mocked(readCloud).mockResolvedValue({
      state: state(),
      revision: 1,
      mutation_id: "initial",
    });
    const first = mount();
    const token = first.result.current.workspaceToken;
    await act(() => first.result.current.verifyCode(account.email, "123456"));
    act(() => {
      expect(
        first.result.current.commit(
          (d) => {
            d.settings.name = "No";
          },
          null,
          token,
        ),
      ).toBe(false);
      first.result.current.commit((d) => {
        d.settings.name = "Pendiente";
      });
    });
    const pending = readCache(account.id)!.pending;
    first.unmount();
    const second = mount();
    expect(second.result.current.data.settings.name).not.toBe("Pendiente");
    await act(() => second.result.current.verifyCode(account.email, "123456"));
    expect(second.result.current.data.settings.name).toBe("Pendiente");
    vi.mocked(writeCloud).mockImplementation(async (s, rev, m) => ({
      state: s,
      revision: rev + 1,
      mutation_id: m,
    }));
    await act(() => second.result.current.syncNow());
    expect(vi.mocked(writeCloud).mock.calls[0][2]).toBe(pending);
    expect(cacheKey(account.id)).not.toContain("token");
  });
});
