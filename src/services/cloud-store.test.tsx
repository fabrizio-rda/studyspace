import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreProvider, useStore } from "./store";
import { initialState } from "../models/schema";
import { accountState } from "./accounts";
import { createTimer } from "./study";
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
let authEvent: (
  event: string,
  session: { user: typeof account } | null,
) => void;
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
      onAuthStateChange: vi.fn((callback) => {
        authEvent = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
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
  it("una cuenta nueva no ve tareas locales y crea los diez cursos de Catalina una sola vez", async () => {
    const local = initialState();
    local.settings.name = "Fabrizio local";
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
    expect(result.current.cloud.mode).toBe("setup");
    expect(result.current.data.courses).toEqual([]);
    expect(result.current.data.settings.name).toBe("Mi cuenta");
    act(() => {
      expect(
        result.current.commit((d) => {
          d.settings.name = "No";
        }),
      ).toBe(false);
    });
    await act(() => result.current.startCloud("Catalina", "catalina"));
    expect(result.current.data.courses).toHaveLength(10);
    expect(
      result.current.data.courses.some((c) =>
        /Física|Química|AP Physics/.test(c.name),
      ),
    ).toBe(false);
    expect(result.current.data.settings.name).toBe("Catalina");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await expect(
      result.current.startCloud("Catalina", "catalina"),
    ).rejects.toThrow("vacía");
    expect(writeCloud).toHaveBeenCalledTimes(1);
  });
  it("reintenta la inicialización con los mismos cursos e identificador si se pierde la respuesta", async () => {
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
      await expect(
        result.current.startCloud("Catalina", "catalina"),
      ).rejects.toThrow("Respuesta perdida");
    });
    await act(() => result.current.startCloud("Catalina", "catalina"));
    const calls = vi.mocked(writeCloud).mock.calls;
    expect(calls[0][0].courses).toEqual(calls[1][0].courses);
    expect(calls[0][2]).toBe(calls[1][2]);
  });
  it("tras migrar, oculta la copia local al salir y no permite importarla a otra cuenta", async () => {
    saveState(initialState());
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
    await act(() => result.current.signOut());
    expect(result.current.data.courses).toEqual([]);
    expect(result.current.localAccess).toBe(false);
    vi.mocked(cloudClient().auth.verifyOtp).mockResolvedValue({
      data: { user: { id: "owner-b", email: "c@example.test" }, session: null },
      error: null,
    } as unknown as Awaited<
      ReturnType<ReturnType<typeof cloudClient>["auth"]["verifyOtp"]>
    >);
    await act(() => result.current.verifyCode("c@example.test", "123456"));
    expect(result.current.localAccess).toBe(false);
    await expect(result.current.migrateLocal()).rejects.toThrow("otra cuenta");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(writeCloud).toHaveBeenCalledTimes(1);
  });
  it("no vuelve a mostrar datos de una autenticación que terminó después de cerrar sesión", async () => {
    let resolveRead!: (value: Awaited<ReturnType<typeof readCloud>>) => void;
    vi.mocked(readCloud).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    const { result } = mount();
    let login!: Promise<void>;
    await act(async () => {
      login = result.current.verifyCode(account.email, "123456");
      await Promise.resolve();
    });
    expect(result.current.cloud.user?.id).toBe(account.id);
    await act(() => result.current.signOut());
    await act(async () => {
      resolveRead({ state: state(), revision: 1, mutation_id: "old" });
      await login;
    });
    expect(result.current.cloud.user).toBeNull();
    expect(result.current.data.settings.name).not.toBe("Nube");
  });
});

describe("Fase 4: eventos, pestañas y operaciones tardías", () => {
  it("restaura INITIAL_SESSION y TOKEN_REFRESHED sin depender de SIGNED_IN", async () => {
    vi.mocked(readCloud).mockResolvedValue({
      state: state(),
      revision: 1,
      mutation_id: "m",
    });
    const { result } = mount();
    await act(async () => {
      authEvent("TOKEN_REFRESHED", { user: account });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.cloud.user?.id).toBe(account.id);
    expect(result.current.data.settings.name).toBe("Nube");
    const reads = vi.mocked(readCloud).mock.calls.length;
    await act(async () => authEvent("INITIAL_SESSION", { user: account }));
    expect(readCloud).toHaveBeenCalledTimes(reads);
  });
  it("oculta de inmediato la identidad anterior y rechaza respuestas antiguas", async () => {
    let resolve!: (v: Awaited<ReturnType<typeof readCloud>>) => void;
    vi.mocked(readCloud).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = mount();
    act(() => authEvent("SIGNED_IN", { user: account }));
    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(readCloud).mockResolvedValue({
      state: {
        ...state(),
        settings: { ...state().settings, name: "Catalina" },
      },
      revision: 1,
      mutation_id: "b",
    });
    const other = { id: "owner-b", email: "b@example.test" };
    await act(async () => {
      authEvent("SIGNED_IN", { user: other });
      await new Promise((r) => setTimeout(r, 10));
    });
    await act(async () =>
      resolve({ state: state(), revision: 1, mutation_id: "a" }),
    );
    expect(result.current.cloud.user?.id).toBe("owner-b");
    expect(result.current.data.settings.name).toBe("Catalina");
    await act(async () => authEvent("SIGNED_OUT", null));
    expect(result.current.cloud.user).toBeNull();
    expect(result.current.data.settings.name).not.toBe("Catalina");
  });
  it("una segunda pestaña no escribe ni reemplaza pendientes y toma el bloqueo al cerrar la primera", async () => {
    vi.mocked(readCloud).mockResolvedValue({
      state: state(),
      revision: 1,
      mutation_id: "m",
    });
    const a = mount(),
      b = mount();
    await act(() => a.result.current.verifyCode(account.email, "123456"));
    act(() => {
      a.result.current.commit((d) => {
        d.settings.name = "Pendiente A";
      });
    });
    const original = localStorage.getItem(cacheKey(account.id));
    await act(() => b.result.current.verifyCode(account.email, "123456"));
    expect(b.result.current.cloud.writable).toBe(false);
    act(() =>
      expect(
        b.result.current.commit((d) => {
          d.settings.name = "No";
        }),
      ).toBe(false),
    );
    expect(localStorage.getItem(cacheKey(account.id))).toBe(original);
    await act(async () => {
      a.unmount();
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(() => b.result.current.syncNow());
    expect(b.result.current.cloud.writable).toBe(true);
    expect(b.result.current.data.settings.name).toBe("Pendiente A");
  });
});

it("restablece el perfil Catalina con diez cursos y Cambridge propio", async () => {
  const remote = accountState("Catalina", "catalina");
  vi.mocked(readCloud).mockResolvedValue({
    state: remote,
    revision: 1,
    mutation_id: "c",
  });
  const { result } = mount();
  await act(() => result.current.verifyCode(account.email, "123456"));
  act(() => expect(result.current.reset()).toBe(true));
  expect(result.current.data.settings.name).toBe("Catalina");
  expect(result.current.data.courses).toHaveLength(10);
  expect(
    result.current.data.courses.filter(
      (c) => c.name === "Cambridge C1 Advanced",
    ),
  ).toHaveLength(1);
  expect(
    result.current.data.courses.some((c) => c.name.includes("Physics")),
  ).toBe(false);
});

it("comparte la carga de cuenta entre el evento SIGNED_IN y la verificación OTP", async () => {
  vi.mocked(readCloud).mockResolvedValue({
    state: state(),
    revision: 1,
    mutation_id: "m",
  });
  vi.mocked(cloudClient().auth.verifyOtp).mockImplementation(async () => {
    authEvent("SIGNED_IN", { user: account });
    return { data: { user: account }, error: null } as Awaited<
      ReturnType<ReturnType<typeof cloudClient>["auth"]["verifyOtp"]>
    >;
  });
  const { result } = mount();
  await act(() => result.current.verifyCode(account.email, "123456"));
  expect(result.current.cloud.writable).toBe(true);
  expect(result.current.cloud.status).toBe("synced");
  expect(readCloud).toHaveBeenCalledTimes(1);
});

describe("Validación final: restauración, exclusión y reintentos acotados", () => {
  const snapshot = () => ({ state: state(), revision: 1, mutation_id: "m" });
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  it("restaura INITIAL_SESSION por sí solo y una sesión ausente no consulta la nube", async () => {
    vi.mocked(readCloud).mockResolvedValue(snapshot());
    const a = mount();
    await act(async () => {
      authEvent("INITIAL_SESSION", null);
      await flush();
    });
    expect(readCloud).not.toHaveBeenCalled();
    await act(async () => {
      authEvent("INITIAL_SESSION", { user: account });
      await flush();
    });
    expect(a.result.current.cloud.status).toBe("synced");
    expect(a.result.current.data.settings.name).toBe("Nube");
    expect(readCloud).toHaveBeenCalledTimes(1);
  });
  it("TOKEN_REFRESHED recupera una carga inicial fallida sin caché ni recarga manual", async () => {
    vi.mocked(readCloud).mockRejectedValueOnce(Error("JWT expired"));
    const a = mount();
    await act(async () => {
      authEvent("INITIAL_SESSION", { user: account });
      await flush();
    });
    expect(a.result.current.cloud.status).toBe("error");
    expect(a.result.current.cloud.mode).toBe("setup");
    vi.mocked(readCloud).mockResolvedValue(snapshot());
    await act(async () => {
      authEvent("TOKEN_REFRESHED", { user: account });
      await flush();
    });
    expect(a.result.current.cloud.status).toBe("synced");
    expect(a.result.current.cloud.writable).toBe(true);
    expect(readCloud).toHaveBeenCalledTimes(2);
  });
  it.each(["INITIAL_SESSION", "TOKEN_REFRESHED"])(
    "%s con otro UUID oculta el espacio y descarta una lectura tardía",
    async (event) => {
      vi.mocked(readCloud).mockResolvedValue(snapshot());
      const a = mount();
      await act(() => a.result.current.verifyCode(account.email, "123456"));
      let finish!: (v: ReturnType<typeof snapshot>) => void;
      vi.mocked(readCloud).mockReturnValueOnce(
        new Promise((r) => {
          finish = r;
        }),
      );
      let old!: Promise<void>;
      act(() => {
        old = a.result.current.syncNow();
      });
      const other = { id: "owner-b", email: "other@example.test" };
      act(() => authEvent(event, { user: other }));
      expect(a.result.current.data.settings.name).not.toBe("Nube");
      expect(a.result.current.cloud.writable).toBe(false);
      act(() =>
        expect(
          a.result.current.commit((d) => {
            d.settings.name = "No";
          }),
        ).toBe(false),
      );
      await act(async () => {
        await flush();
        finish({
          ...snapshot(),
          state: {
            ...state(),
            settings: { ...state().settings, name: "Respuesta anterior" },
          },
        });
        await old;
      });
      expect(a.result.current.cloud.user?.id).toBe(other.id);
      expect(a.result.current.data.settings.name).not.toBe(
        "Respuesta anterior",
      );
      expect(localStorage.getItem(cacheKey(account.id))).not.toContain(
        "Respuesta anterior",
      );
    },
  );
  it("no repite cargas por ráfagas de eventos y solo consulta una vez por intervalo", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(readCloud).mockResolvedValue(snapshot());
      const a = mount();
      await act(async () => {
        authEvent("INITIAL_SESSION", { user: account });
        await flush();
      });
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          authEvent(i % 2 ? "TOKEN_REFRESHED" : "SIGNED_IN", { user: account });
          await flush();
        });
      }
      expect(readCloud).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29999);
      });
      expect(readCloud).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(readCloud).toHaveBeenCalledTimes(2);
      expect(a.result.current.cloud.status).toBe("synced");
    } finally {
      vi.useRealTimers();
    }
  });
  it("la pestaña secundaria no modifica la copia pendiente al desconectarse con un temporizador", async () => {
    const remote = snapshot();
    remote.state.activeTimer = createTimer(remote.state, {
      courseId: null,
      topicId: null,
      planId: null,
      minutes: 25,
      mode: "continuous",
    });
    vi.mocked(readCloud).mockResolvedValue(remote);
    const a = mount(),
      b = mount();
    await act(() => a.result.current.verifyCode(account.email, "123456"));
    await act(() => b.result.current.verifyCode(account.email, "123456"));
    act(() =>
      expect(
        a.result.current.commit((d) => {
          d.settings.name = "Pendiente A";
        }),
      ).toBe(true),
    );
    const before = localStorage.getItem(cacheKey(account.id));
    // Only the secondary receives this event, as in two independent documents.
    a.unmount();
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
      await flush();
    });
    expect(b.result.current.cloud.writable).toBe(false);
    expect(localStorage.getItem(cacheKey(account.id))).toBe(before);
    await act(() => b.result.current.syncNow());
    expect(b.result.current.data.settings.name).toBe("Pendiente A");
  });
  it("un desmontaje durante la concesión del bloqueo no deja un escritor huérfano", async () => {
    vi.mocked(readCloud).mockResolvedValue(snapshot());
    const a = mount();
    act(() => authEvent("INITIAL_SESSION", { user: account }));
    // Lock acquisition resumes in a microtask, after this unmount.
    a.unmount();
    await act(flush);
    const b = mount();
    await act(() => b.result.current.verifyCode(account.email, "123456"));
    expect(b.result.current.cloud.writable).toBe(true);
  });
  it("solo una pestaña puede guardar y la secundaria recupera edición tras cerrar sesión en la primera", async () => {
    vi.mocked(readCloud).mockResolvedValue(snapshot());
    vi.mocked(writeCloud).mockImplementation(
      async (data, revision, mutation_id) => ({
        state: data,
        revision: revision + 1,
        mutation_id,
      }),
    );
    const a = mount(),
      b = mount();
    await act(() => a.result.current.verifyCode(account.email, "123456"));
    await act(() => b.result.current.verifyCode(account.email, "123456"));
    act(() => {
      expect(
        a.result.current.commit((d) => {
          d.settings.name = "A";
        }),
      ).toBe(true);
      expect(
        b.result.current.commit((d) => {
          d.settings.name = "B";
        }),
      ).toBe(false);
    });
    await act(async () => {
      await Promise.all([
        a.result.current.syncNow(),
        b.result.current.syncNow(),
      ]);
    });
    expect(writeCloud).toHaveBeenCalledTimes(1);
    expect(b.result.current.cloud.writable).toBe(false);
    await act(() => a.result.current.signOut());
    await act(flush);
    await act(() => b.result.current.syncNow());
    expect(b.result.current.cloud.writable).toBe(true);
    act(() =>
      expect(
        b.result.current.commit((d) => {
          d.settings.name = "B";
        }),
      ).toBe(true),
    );
    await act(() => b.result.current.syncNow());
    expect(writeCloud).toHaveBeenCalledTimes(2);
    expect(b.result.current.cloud.status).toBe("synced");
  });
  it("TOKEN_REFRESHED reintenta el mismo guardado pendiente sin duplicarlo", async () => {
    vi.mocked(readCloud).mockResolvedValue(snapshot());
    vi.mocked(writeCloud).mockRejectedValueOnce(Error("JWT expired"));
    const a = mount();
    await act(() => a.result.current.verifyCode(account.email, "123456"));
    act(() =>
      expect(
        a.result.current.commit((d) => {
          d.settings.name = "Mi cambio";
        }),
      ).toBe(true),
    );
    await act(() => a.result.current.syncNow());
    expect(a.result.current.cloud.status).toBe("error");
    const pending = readCache(account.id)!.pending;
    vi.mocked(writeCloud).mockImplementation(
      async (data, revision, mutation_id) => ({
        state: data,
        revision: revision + 1,
        mutation_id,
      }),
    );
    await act(async () => {
      for (let i = 0; i < 20; i++)
        authEvent("TOKEN_REFRESHED", { user: account });
      await flush();
    });
    expect(writeCloud).toHaveBeenCalledTimes(2);
    expect(vi.mocked(writeCloud).mock.calls[1][2]).toBe(pending);
    expect(a.result.current.data.settings.name).toBe("Mi cambio");
    expect(a.result.current.cloud.status).toBe("synced");
    expect(readCache(account.id)?.pending).toBeNull();
  });
  it("acota los reintentos al reconectar y al intervalo, incluso si la red sigue fallando", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(readCloud).mockResolvedValueOnce(snapshot());
      const a = mount();
      await act(() => a.result.current.verifyCode(account.email, "123456"));
      vi.mocked(readCloud).mockRejectedValue(Error("Network"));
      await act(async () => {
        window.dispatchEvent(new Event("offline"));
        for (let i = 0; i < 20; i++) window.dispatchEvent(new Event("online"));
        await flush();
      });
      expect(readCloud).toHaveBeenCalledTimes(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29999);
      });
      expect(readCloud).toHaveBeenCalledTimes(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(readCloud).toHaveBeenCalledTimes(3);
      expect(a.result.current.cloud.status).toBe("error");
      vi.mocked(readCloud).mockResolvedValue(snapshot());
      await act(async () => {
        authEvent("TOKEN_REFRESHED", { user: account });
        await flush();
      });
      expect(a.result.current.cloud.status).toBe("synced");
      expect(readCloud).toHaveBeenCalledTimes(4);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29999);
      });
      expect(readCloud).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
  it("StrictMode cancela la suscripción antigua y conserva un único escritor", async () => {
    vi.mocked(readCloud).mockResolvedValue(snapshot());
    vi.mocked(cloudClient().auth.onAuthStateChange).mockImplementation(
      (callback) => {
        queueMicrotask(() => {
          void callback("INITIAL_SESSION", { user: account } as never);
        });
        return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
      },
    );
    const a = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <StoreProvider>{children}</StoreProvider>
        </StrictMode>
      ),
    });
    await act(flush);
    expect(a.result.current.cloud.status).toBe("synced");
    expect(a.result.current.cloud.writable).toBe(true);
    expect(readCloud).toHaveBeenCalledTimes(1);
  });
});

it("guarda la paleta en el espacio autenticado y la recupera al volver a entrar", async () => {
  const remote = accountState("Catalina", "catalina");
  vi.mocked(readCloud).mockImplementation(async () => ({
    state: remote,
    revision: 1,
    mutation_id: "initial",
  }));
  vi.mocked(writeCloud).mockImplementation(
    async (state, revision, mutation_id) => {
      Object.assign(remote, structuredClone(state));
      return { state, revision: revision + 1, mutation_id };
    },
  );
  const first = mount();
  await act(() => first.result.current.verifyCode(account.email, "123456"));
  act(() => first.result.current.updateSettings({ interfacePalette: "blue" }));
  await act(() => first.result.current.syncNow());
  expect(remote.settings.interfacePalette).toBe("blue");
  expect(vi.mocked(writeCloud).mock.calls.at(-1)?.[3]).toBe(account.id);
  first.unmount();
  const next = mount();
  await act(() => next.result.current.verifyCode(account.email, "123456"));
  expect(next.result.current.data.settings.interfacePalette).toBe("blue");
  expect(next.result.current.data.settings.academicPreset).toBe("catalina");
});
