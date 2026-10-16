import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SharingProvider, useSharing, useSharedFeed } from "./services/sharing-context";
import SharedCalendar from "./components/SharedCalendar";
import SharingSettings from "./components/SharingSettings";
import AccountSetup from "./components/AccountSetup";
import { accountState } from "./services/accounts";
import {
  sharingStatus,
  calendarFeed,
  inviteCalendar,
  acceptCalendar,
  cancelCalendar,
  revokeCalendar,
} from "./services/sharing";
import type { SharingStatus, SharedEvent } from "./services/sharing";
const mockedStore = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
vi.mock("./services/store", () => ({ useStore: () => mockedStore.current }));
vi.mock("./services/sharing", async (original) => ({
  ...(await original<typeof import("./services/sharing")>()),
  sharingStatus: vi.fn(),
  calendarFeed: vi.fn(),
  inviteCalendar: vi.fn(),
  acceptCalendar: vi.fn(),
  cancelCalendar: vi.fn(),
  revokeCalendar: vi.fn(),
}));
const a = "10000000-0000-4000-8000-000000000001",
  b = "20000000-0000-4000-8000-000000000002",
  link = "40000000-0000-4000-8000-000000000004",
  invite = "50000000-0000-4000-8000-000000000005";
let status: SharingStatus;
let events: SharedEvent[];
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <SharingProvider>{children}</SharingProvider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", {
    get: () => true,
    configurable: true,
  });
  mockedStore.current = {
    data: accountState("Fabrizio", "fabrizio"),
    cloud: { mode: "cloud", user: { id: a, email: "f@example.test" } },
    workspaceToken: "1",
    commit: vi.fn(() => true),
    notify: vi.fn(),
    updateSettings: vi.fn(),
    startCloud: vi.fn(async () => {}),
  };
  status = {
    connection: {
      id: link,
      peerId: b,
      peerName: "Catalina",
      peerEmail: "catalina@example.test",
      peerAccent: "pink",
    },
    outgoing: [],
    incoming: [],
  };
  const common = {
    sourceTimezone: "America/Lima",
    date: "2026-10-19",
    time: "16:00",
    minutes: null,
    courseColor: "#74B8A3",
    type: "examen",
    kind: "event" as const,
    visibility: "details" as const,
  };
  events = [
    {
      ...common,
      id: "one",
      ownerId: a,
      ownerName: "Fabrizio",
      ownerAccent: "blue",
      title: "Examen de Gestión",
      courseName: "Gestión Empresarial",
      own: true,
    },
    {
      ...common,
      id: "two",
      ownerId: b,
      ownerName: "Catalina",
      ownerAccent: "pink",
      title: "Evaluación Biology",
      courseName: "Biology",
      own: false,
    },
    {
      ...common,
      id: "busy",
      ownerId: b,
      ownerName: "Catalina",
      ownerAccent: "pink",
      title: "Ocupado",
      courseName: null,
      courseColor: null,
      type: "busy",
      kind: "busy",
      visibility: "busy",
      own: false,
    },
  ];
  vi.mocked(sharingStatus).mockImplementation(async () =>
    structuredClone(status),
  );
  vi.mocked(calendarFeed).mockImplementation(async () => ({
    connected: !!status.connection,
    events: structuredClone(events),
  }));
  vi.mocked(inviteCalendar).mockResolvedValue({ id: invite });
  vi.mocked(acceptCalendar).mockImplementation(async () => {
    status = {
      ...status,
      incoming: [],
      connection: {
        id: link,
        peerId: b,
        peerName: "Catalina",
        peerEmail: "catalina@example.test",
        peerAccent: "pink",
      },
    };
    return status;
  });
  vi.mocked(cancelCalendar).mockImplementation(async () => {
    status.incoming = [];
    return status;
  });
  vi.mocked(revokeCalendar).mockImplementation(async () => {
    status.connection = null;
    return status;
  });
});
afterEach(() => vi.restoreAllMocks());
describe("Calendario e invitaciones con backend controlado", () => {
  it("muestra Ambos por defecto, filtra inmediatamente y abre detalles ajenos en solo lectura", async () => {
    const user = userEvent.setup();
    render(<SharedCalendar initialDate="2026-10-19" />, { wrapper: Wrapper });
    await screen.findAllByRole("button", {
      name: "Evaluación Biology · Catalina · 16:00",
    });
    expect(screen.getByRole("button", { name: "Ambos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getAllByRole("button", {
        name: "Examen de Gestión · Fabrizio · 16:00",
      }).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Catalina" }));
    expect(
      screen.queryByRole("button", {
        name: "Examen de Gestión · Fabrizio · 16:00",
      }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", {
        name: "Evaluación Biology · Catalina · 16:00",
      })[0],
    );
    const modal = await screen.findByRole("dialog", {
      name: "Evaluación Biology",
    });
    expect(within(modal).getByText(/solo lectura/)).toBeInTheDocument();
    expect(
      within(modal).queryByRole("button", { name: /Editar|Eliminar/ }),
    ).not.toBeInTheDocument();
    await user.click(within(modal).getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Fabrizio" }));
    expect(
      screen.queryByRole("button", {
        name: "Evaluación Biology · Catalina · 16:00",
      }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ambos" }));
    await user.click(screen.getByRole("button", { name: "Semana" }));
    expect(
      screen.getAllByRole("button", {
        name: "Evaluación Biology · Catalina · 16:00",
      }).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Día" }));
    expect(
      screen.getAllByRole("button", { name: "Ocupado · Catalina · 16:00" }),
    ).toHaveLength(1);
  });
  it("el calendario compacto usa el mismo feed autorizado y no almacena datos ajenos", async () => {
    render(<SharedCalendar compact initialDate="2026-10-19" />, {
      wrapper: Wrapper,
    });
    expect(
      await screen.findByRole("button", { name: "Ocupado · Catalina · 16:00" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute(
      "href",
      "/calendario?compartido=1",
    );
    expect(localStorage.length).toBe(0);
  });
  it("oculta el feed y cierra detalles cuando se revoca la conexión en la siguiente consulta", async () => {
    const user = userEvent.setup();
    render(<SharedCalendar initialDate="2026-10-19" />, { wrapper: Wrapper });
    await user.click(
      (
        await screen.findAllByRole("button", {
          name: "Evaluación Biology · Catalina · 16:00",
        })
      )[0],
    );
    status.connection = null;
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("link", {
        name: "Configurar calendario compartido",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Evaluación Biology")).not.toBeInTheDocument();
  });
  it("crea una invitación individual, muestra su enlace y requiere aceptación autenticada", async () => {
    status.connection = null;
    const user = userEvent.setup();
    render(<SharingSettings />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Crear invitación" }),
      ).toBeEnabled(),
    );
    await user.type(
      screen.getByLabelText("Email de la persona invitada"),
      "catalina@example.test",
    );
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));
    expect(inviteCalendar).toHaveBeenCalledWith("catalina@example.test");
    expect(
      (
        (await screen.findByLabelText(
          "Enlace de invitación",
        )) as HTMLInputElement
      ).value,
    ).toContain(`invitacion=${invite}`);
    expect(
      screen.getByText(/No se envía un correo automáticamente/),
    ).toBeInTheDocument();
  });
  it("permite aceptar y revocar con consentimiento sin exponer un selector de cuentas", async () => {
    status.connection = null;
    status.incoming = [
      {
        id: invite,
        fromName: "Catalina",
        fromEmail: "catalina@example.test",
        expiresAt: "2026-10-22T12:00:00Z",
      },
    ];
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SharingSettings />, { wrapper: Wrapper });
    await user.click(
      await screen.findByRole("button", { name: "Aceptar invitación" }),
    );
    expect(acceptCalendar).toHaveBeenCalledWith(invite);
    expect(
      await screen.findByText("Vinculado con Catalina"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revocar acceso" }));
    expect(revokeCalendar).toHaveBeenCalled();
    await screen.findByRole("button", { name: "Crear invitación" });
    expect(
      screen.queryByText("Vinculado con Catalina"),
    ).not.toBeInTheDocument();
  });
  it("ofrece diez cursos al configurar una cuenta nueva y usa el nombre elegido", async () => {
    mockedStore.current.cloud = {
      mode: "setup",
      user: { id: b, email: "c@example.test" },
      status: "local",
    };
    const user = userEvent.setup();
    render(<AccountSetup />);
    await user.type(screen.getByLabelText("Tu nombre"), "Catalina");
    expect(screen.getByLabelText("Cursos iniciales")).toHaveValue("catalina");
    await user.click(screen.getByRole("button", { name: "Crear mi espacio" }));
    expect(mockedStore.current.startCloud).toHaveBeenCalledWith(
      "Catalina",
      "catalina",
    );
  });
  it("al perder conexión elimina los datos compartidos de la vista", async () => {
    render(<SharedCalendar initialDate="2026-10-19" />, { wrapper: Wrapper });
    await screen.findAllByRole("button", {
      name: "Evaluación Biology · Catalina · 16:00",
    });
    Object.defineProperty(navigator, "onLine", {
      get: () => false,
      configurable: true,
    });
    act(() => window.dispatchEvent(new Event("offline")));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Evaluación Biology · Catalina · 16:00",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: "Configurar calendario compartido" }),
    ).toBeInTheDocument();
  });
});

it("recupera estado y feed después de desconectar durante solicitudes pendientes", async()=>{
 let resolveStatus!: (v: SharingStatus)=>void;
 vi.mocked(sharingStatus).mockImplementationOnce(()=>new Promise(r=>{resolveStatus=r}));
 const first=renderHook(()=>useSharing(),{wrapper:Wrapper});
 act(()=>window.dispatchEvent(new Event("offline")));
 await act(async()=>resolveStatus(status));
 await act(()=>first.result.current.refresh());
 expect(first.result.current.status.connection?.id).toBe(link);
 first.unmount();
 let resolveFeed!: (v: {connected:boolean;events:SharedEvent[]})=>void;
 vi.mocked(calendarFeed).mockImplementationOnce(()=>new Promise(r=>{resolveFeed=r}));
 const second=renderHook(()=>useSharedFeed("2026-10-01","2026-10-31"),{wrapper:Wrapper});
 await waitFor(()=>expect(second.result.current.loading).toBe(true));
 act(()=>window.dispatchEvent(new Event("offline")));
 await act(async()=>resolveFeed({connected:true,events}));
 await act(async()=>window.dispatchEvent(new Event("online")));
 await waitFor(()=>expect(second.result.current.events.length).toBe(3));
});
