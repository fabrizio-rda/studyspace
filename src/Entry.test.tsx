import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import {
  cloudClient,
  readCloud,
  writeCloud,
  saveCache,
} from "./services/cloud";
import { sharingStatus, calendarFeed, emptySharing } from "./services/sharing";
import { bindEntry, entryBindings, ENTRY_GRANT_KEY } from "./services/entry";
import { accountState } from "./services/accounts";
import { saveState } from "./services/storage";
import { todayIn } from "./services/dates";
vi.mock("./services/cloud", async (original) => ({
  ...(await original<typeof import("./services/cloud")>()),
  cloudClient: vi.fn(),
  readCloud: vi.fn(),
  writeCloud: vi.fn(),
}));
vi.mock("./services/sharing", async (original) => ({
  ...(await original<typeof import("./services/sharing")>()),
  sharingStatus: vi.fn(),
  calendarFeed: vi.fn(),
}));
const a = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "f@example.test",
};
const b = {
  id: "20000000-0000-4000-8000-000000000002",
  email: "c@example.test",
};
let session: typeof a | null;
let authEvent: (event: string, value: { user: typeof a } | null) => void;
function workspace(person: "fabrizio" | "catalina") {
  const d = accountState(
    person === "fabrizio" ? "Fabrizio" : "Catalina",
    person,
  );
  d.tasks.push({
    id: `private-${person}`,
    title: `Tarea privada de ${person}`,
    description: "",
    courseId: null,
    type: "tarea",
    dueDate: todayIn(d.settings.timezone),
    time: "",
    priority: "media",
    status: "pendiente",
    createdAt: new Date().toISOString(),
    completedAt: null,
    visibility: "private",
  });
  return d;
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  window.location.hash = "/";
  session = null;
  localStorage.setItem(
    "studyspace:public-config:v1",
    JSON.stringify({
      supabaseUrl: "https://entry-tests.supabase.co",
      supabaseKey: "sb_publishable_test",
    }),
  );
  vi.mocked(readCloud)
    .mockReset()
    .mockImplementation(async (id) => ({
      state: workspace(id === b.id ? "catalina" : "fabrizio"),
      revision: 1,
      mutation_id: "test",
    }));
  vi.mocked(writeCloud)
    .mockReset()
    .mockImplementation(async (state, revision, mutation_id) => ({
      state,
      revision: revision + 1,
      mutation_id,
    }));
  vi.mocked(sharingStatus).mockReset().mockResolvedValue(emptySharing);
  vi.mocked(calendarFeed)
    .mockReset()
    .mockResolvedValue({ connected: false, events: [] });
  vi.mocked(cloudClient).mockReturnValue({
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        authEvent = callback as typeof authEvent;
        queueMicrotask(() =>
          authEvent("INITIAL_SESSION", session ? { user: session } : null),
        );
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async ({ email }: { email: string }) => {
        session = email === b.email ? b : a;
        authEvent("SIGNED_IN", { user: session });
        return { data: { user: session }, error: null };
      }),
      signOut: vi.fn(async () => {
        session = null;
        authEvent("SIGNED_OUT", null);
        return { error: null };
      }),
    },
  } as unknown as ReturnType<typeof cloudClient>);
});
async function loaded() {
  await waitFor(() => expect(readCloud).toHaveBeenCalled());
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}
it("muestra dos tarjetas y un calendario vacío sin revelar datos locales ni consultar actividades anónimas", async () => {
  saveState(workspace("fabrizio"));
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Elige tu espacio" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Entrar al espacio de Fabrizio" }),
  ).toHaveAttribute("href", "#/acceso/fabrizio");
  expect(
    screen.getByRole("link", { name: "Entrar al espacio de Catalina" }),
  ).toHaveClass("catalina");
  expect(
    screen.getByRole("heading", { name: "Calendario conjunto" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Tarea privada de fabrizio"),
  ).not.toBeInTheDocument();
  await act(async () => {
    await Promise.resolve();
  });
  expect(sharingStatus).not.toHaveBeenCalled();
  expect(calendarFeed).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("link", { name: "Entrar al espacio de Catalina" }),
  );
  expect(
    screen.getByRole("heading", { name: "Acceso de Catalina" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
});
it("entra directamente si la tarjeta reconoce el UUID de la sesión restaurada", async () => {
  session = a;
  bindEntry("fabrizio", a.id);
  render(<App />);
  await loaded();
  await userEvent.click(
    screen.getByRole("link", { name: "Entrar al espacio de Fabrizio" }),
  );
  expect(
    await screen.findByText("Cursos, tareas y evaluaciones."),
  ).toBeInTheDocument();
  expect(cloudClient().auth.verifyOtp).not.toHaveBeenCalled();
  expect(readCloud).toHaveBeenCalledTimes(1);
});
it("una sesión no asociada exige confirmación y no abre el espacio por coincidencia de nombre", async () => {
  session = a;
  render(<App />);
  await loaded();
  await userEvent.click(
    screen.getByRole("link", { name: "Entrar al espacio de Fabrizio" }),
  );
  expect(
    screen.queryByText("Tarea privada de fabrizio"),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar y entrar como Fabrizio" }),
  );
  expect(entryBindings().fabrizio).toBe(a.id);
  expect(entryBindings().catalina).toBeUndefined();
  expect(
    await screen.findByText("Cursos, tareas y evaluaciones."),
  ).toBeInTheDocument();
});
it("seleccionar Catalina desde Fabrizio exige cambiar de sesión y autentica el correo de Catalina", async () => {
  session = a;
  bindEntry("fabrizio", a.id);
  render(<App />);
  await loaded();
  const u = userEvent.setup();
  await u.click(
    screen.getByRole("link", { name: "Entrar al espacio de Catalina" }),
  );
  expect(
    screen.queryByText("Tarea privada de fabrizio"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Confirmar y entrar como Catalina" }),
  ).not.toBeInTheDocument();
  await u.click(
    screen.getByRole("button", { name: "Cambiar de cuenta y continuar" }),
  );
  await u.type(screen.getByLabelText("Email"), b.email);
  await u.click(screen.getByRole("button", { name: "Enviar código" }));
  await u.type(screen.getByLabelText("Código recibido"), "123456");
  await u.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  await u.click(
    await screen.findByRole("button", {
      name: "Confirmar y entrar como Catalina",
    }),
  );
  expect(
    await screen.findByText("Cursos, tareas y evaluaciones."),
  ).toBeInTheDocument();
  expect(entryBindings()).toEqual({ fabrizio: a.id, catalina: b.id });
  expect(
    screen.queryByText("Tarea privada de fabrizio"),
  ).not.toBeInTheDocument();
  expect(cloudClient().auth.signOut).toHaveBeenCalledTimes(1);
});
it("un cambio de identidad dentro de un espacio oculta inmediatamente su interfaz", async () => {
  session = a;
  bindEntry("fabrizio", a.id);
  bindEntry("catalina", b.id);
  render(<App />);
  await loaded();
  await userEvent.click(
    screen.getByRole("link", { name: "Entrar al espacio de Fabrizio" }),
  );
  await screen.findByText("Cursos, tareas y evaluaciones.");
  act(() => authEvent("TOKEN_REFRESHED", { user: b }));
  expect(
    screen.queryByText("Cursos, tareas y evaluaciones."),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Tarea privada de fabrizio"),
  ).not.toBeInTheDocument();
  await loaded();
  expect(
    screen.getByRole("heading", { name: "Acceso de Fabrizio" }),
  ).toBeInTheDocument();
});
it("la portada solo muestra actividades compartidas y oculta incluso los detalles propios con visibilidad Ocupado", async () => {
  session = a;
  vi.mocked(sharingStatus).mockResolvedValue({
    ...emptySharing,
    connection: {
      id: "40000000-0000-4000-8000-000000000004",
      peerId: b.id,
      peerName: "Catalina",
      peerEmail: b.email,
      peerAccent: "pink",
    },
  });
  const common = {
    ownerId: a.id,
    ownerName: "Fabrizio",
    ownerAccent: "blue" as const,
    sourceTimezone: "America/Lima",
    date: todayIn("America/Lima"),
    time: "16:00",
    minutes: null,
    courseName: null,
    courseColor: null,
    type: "examen",
    kind: "event" as const,
    own: true,
  };
  vi.mocked(calendarFeed).mockResolvedValue({
    connected: true,
    events: [
      {
        ...common,
        id: "private",
        title: "Examen privado",
        visibility: "private",
      },
      {
        ...common,
        id: "public",
        title: "Actividad compartida",
        visibility: "details",
      },
      {
        ...common,
        id: "busy",
        title: "Detalle sensible del ocupado",
        visibility: "busy",
      },
    ],
  });
  render(<App />);
  expect(await screen.findByText("Actividad compartida")).toBeInTheDocument();
  expect(screen.queryByText("Examen privado")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Detalle sensible del ocupado"),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Ocupado")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Editar/ }),
  ).not.toBeInTheDocument();
});
it("no cierra una sesión con pendientes para cambiar de tarjeta y permite conservar una copia", async () => {
  session = a;
  bindEntry("fabrizio", a.id);
  saveCache(a.id, {
    state: workspace("fabrizio"),
    revision: 1,
    pending: "pending-a",
  });
  render(<App />);
  await loaded();
  await userEvent.click(
    screen.getByRole("link", { name: "Entrar al espacio de Catalina" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Cambiar de cuenta y continuar" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Hay cambios sin sincronizar",
  );
  expect(cloudClient().auth.signOut).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Descargar copia de la sesión actual" }),
  ).toBeInTheDocument();
});
it("el alta de Catalina propone su nombre y diez cursos sin ejecutar cambios en otra cuenta", async () => {
  session = b;
  vi.mocked(readCloud).mockResolvedValue({
    state: null,
    revision: 0,
    mutation_id: null,
  });
  render(<App />);
  await loaded();
  await userEvent.click(
    screen.getByRole("link", { name: "Entrar al espacio de Catalina" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar cuenta de Catalina" }),
  );
  expect(screen.getByLabelText("Tu nombre")).toHaveValue("Catalina");
  expect(screen.getByLabelText("Cursos iniciales")).toHaveValue("catalina");
  expect(screen.getByLabelText("Cursos iniciales")).toBeDisabled();
  await userEvent.click(
    screen.getByRole("button", { name: "Crear mi espacio" }),
  );
  await screen.findByText("Cursos, tareas y evaluaciones.");
  const sent = vi.mocked(writeCloud).mock.calls[0];
  expect(sent[0].courses).toHaveLength(10);
  expect(
    sent[0].courses.filter((c) => c.name === "Cambridge C1 Advanced"),
  ).toHaveLength(1);
  expect(sent[3]).toBe(b.id);
});
it("un acceso de sesión corrupto no permite saltar la portada", async () => {
  sessionStorage.setItem(
    ENTRY_GRANT_KEY,
    JSON.stringify({ profile: "unknown", project: "", userId: "fake" }),
  );
  window.location.hash = "/tareas";
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Elige tu espacio" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Mis tareas" }),
  ).not.toBeInTheDocument();
});

it("conserva el enlace de invitación durante la elección de cuenta y el acceso", async () => {
  session = a;
  bindEntry("fabrizio", a.id);
  window.location.hash =
    "/configuracion?invitacion=50000000-0000-4000-8000-000000000005";
  render(<App />);
  await loaded();
  // A known identity may open its access confirmation automatically on a deep
  // link, but the destination, including the invite token, must survive.
  expect(
    await screen.findByRole("heading", { name: "Configuración" }),
  ).toBeInTheDocument();
  expect(window.location.hash).toContain(
    "invitacion=50000000-0000-4000-8000-000000000005",
  );
});

it("un enlace profundo anónimo conserva su destino al elegir una tarjeta", async () => {
  window.location.hash =
    "/configuracion?invitacion=50000000-0000-4000-8000-000000000005";
  render(<App />);
  await userEvent.click(
    screen.getByRole("link", { name: "Entrar al espacio de Catalina" }),
  );
  expect(window.location.hash).toContain(
    "next=%2Fconfiguracion%3Finvitacion%3D",
  );
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Email"), b.email);
  await u.click(screen.getByRole("button", { name: "Enviar código" }));
  await u.type(screen.getByLabelText("Código recibido"), "123456");
  await u.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  await u.click(
    await screen.findByRole("button", {
      name: "Confirmar y entrar como Catalina",
    }),
  );
  expect(
    await screen.findByRole("heading", { name: "Configuración" }),
  ).toBeInTheDocument();
  expect(window.location.hash).toContain(
    "invitacion=50000000-0000-4000-8000-000000000005",
  );
});
