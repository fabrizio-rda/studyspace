import { localEntry } from "./test-entry";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { initialState } from "./models/schema";
import {
  saveState,
  loadState,
  serializeBackup,
  parseBackup,
  STORAGE_KEY,
} from "./services/storage";
import { todayIn, plusDays } from "./services/dates";
import { createTimer } from "./services/study";
const pause = () => new Promise((r) => setTimeout(r, 220));
async function route(path: string) {
  await act(async () => {
    window.location.hash = path;
    await Promise.resolve();
  });
  await act(pause);
  await act(pause);
  await waitFor(() =>
    expect(document.querySelector(".route-loading")).toBeNull(),
  );
  await waitFor(() => expect(document.querySelector("main h1")).toBeTruthy());
}
function fixture() {
  const d = initialState();
  d.studyPreferences = {
    ...d.studyPreferences,
    availability: [120, 120, 120, 120, 120, 120, 120],
    dayStart: "00:00",
    dayEnd: "23:59",
  };
  d.units = [
    {
      id: "u1",
      courseId: "course-1",
      name: "Tema E",
      description: "",
      order: 0,
    },
  ];
  d.topics = [
    {
      id: "t1",
      unitId: "u1",
      parentId: null,
      name: "Física nuclear",
      description: "Desintegración",
      order: 0,
      difficulty: 2,
      mastery: 0,
      completed: false,
      lastStudyDate: null,
      lastReviewDate: null,
      nextReviewDate: null,
      reviewCount: 0,
    },
  ];
  return d;
}
beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localEntry();
  window.location.hash = "/espacio";
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
describe("Fase 2: recorridos de estudio", () => {
  it("crea unidad, tema y subtema; cambia dominio y conserva el temario al recargar", async () => {
    const u = userEvent.setup();
    const app = render(<App />);
    await route("/cursos/course-1");
    await u.click(await screen.findByRole("tab", { name: "Temario" }));
    await u.click(screen.getByRole("button", { name: "Nueva unidad" }));
    let dialog = screen.getByRole("dialog");
    await u.type(within(dialog).getByLabelText("Nombre"), "Unidad nuclear");
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar contenido" }),
    );
    await u.click(screen.getByRole("button", { name: "Añadir tema" }));
    dialog = screen.getByRole("dialog");
    await u.type(within(dialog).getByLabelText("Nombre"), "Átomo");
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar contenido" }),
    );
    await u.click(screen.getByRole("button", { name: "+ Subtema" }));
    dialog = screen.getByRole("dialog");
    await u.type(within(dialog).getByLabelText("Nombre"), "Isótopos");
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar contenido" }),
    );
    await u.selectOptions(screen.getByLabelText("Dominio de Isótopos"), "3");
    await u.click(screen.getByRole("button", { name: "Completar tema Átomo" }));
    expect(loadState().data.topics).toHaveLength(2);
    expect(
      loadState().data.topics.find((t) => t.name === "Isótopos")?.mastery,
    ).toBe(3);
    expect(
      loadState().data.topics.find((t) => t.name === "Átomo")?.mastery,
    ).toBe(0);
    app.unmount();
    render(<App />);
    await u.click(await screen.findByRole("tab", { name: "Temario" }));
    expect(screen.getByText("Isótopos")).toBeInTheDocument();
    expect(screen.getByText(/1\/2 completados/)).toBeInTheDocument();
  }, 15000);
  it("crea un plan mediante asistente y solo guarda las sesiones después de confirmar la vista previa", async () => {
    saveState(fixture());
    const u = userEvent.setup();
    render(<App />);
    await route("/planes");
    await u.click(screen.getByRole("button", { name: "Crear plan" }));
    let dialog = screen.getByRole("dialog");
    await u.type(
      within(dialog).getByLabelText("Nombre del plan"),
      "Examen nuclear",
    );
    fireEvent.change(
      within(dialog).getByLabelText("Fecha del examen u objetivo"),
      { target: { value: plusDays(todayIn("America/Lima"), 7) } },
    );
    await u.click(within(dialog).getByRole("button", { name: "Siguiente" }));
    await u.click(
      within(dialog).getByRole("checkbox", { name: "Física nuclear" }),
    );
    await u.click(within(dialog).getByRole("button", { name: "Siguiente" }));
    await u.click(
      within(dialog).getByRole("button", { name: "Ver calendario propuesto" }),
    );
    dialog = screen.getByRole("dialog", {
      name: "Vista previa de planificación",
    });
    expect(loadState().data.plans).toHaveLength(0);
    expect(loadState().data.scheduledSessions).toHaveLength(0);
    await u.click(
      within(dialog).getByRole("button", { name: "Confirmar calendario" }),
    );
    expect(loadState().data.plans).toHaveLength(1);
    expect(loadState().data.scheduledSessions.length).toBeGreaterThan(0);
    const session = loadState().data.scheduledSessions[0];
    await route(`/calendario?date=${session.date}`);
    expect(document.querySelectorAll(".calendar-study").length).toBeGreaterThan(
      0,
    );
    const eventButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".calendar-study"),
    ).find((b) => b.textContent?.includes("Física nuclear"))!;
    await u.click(eventButton);
    expect(
      screen.getByRole("dialog", { name: "Sesión programada" }),
    ).toBeInTheDocument();
  }, 15000);
  it("muestra recomendaciones del día y permite reprogramar duración y fecha sin duplicar", async () => {
    const d = fixture();
    const today = todayIn(d.settings.timezone);
    d.plans = [
      {
        id: "p1",
        courseId: "course-1",
        name: "Plan de hoy",
        goal: "",
        startDate: today,
        targetDate: plusDays(today, 5),
        topicIds: ["t1"],
        availability: [120, 120, 120, 120, 120, 120, 120],
        sessionMinutes: 25,
        priority: "alta",
        reviewPercent: 20,
        status: "active",
        createdAt: new Date().toISOString(),
      },
    ];
    d.scheduledSessions = [
      {
        id: "s1",
        courseId: "course-1",
        topicId: "t1",
        planId: "p1",
        title: "Física nuclear",
        date: today,
        time: "12:00",
        minutes: 25,
        kind: "study",
        status: "pending",
        manual: false,
        reason: "Dominio registrado: no lo entiendo.",
      },
    ];
    saveState(d);
    const u = userEvent.setup();
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Tu plan de hoy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dominio registrado: no lo entiendo."),
    ).toBeInTheDocument();
    await u.click(
      screen.getByRole("button", { name: "Posponer sesión Física nuclear" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Hora"), {
      target: { value: "10:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Duración (min)"), {
      target: { value: "30" },
    });
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar sesión" }),
    );
    expect(loadState().data.scheduledSessions).toHaveLength(1);
    expect(loadState().data.scheduledSessions[0].date).toBe(plusDays(today, 1));
    expect(loadState().data.scheduledSessions[0].minutes).toBe(30);
    expect(loadState().data.scheduledSessions[0].manual).toBe(true);
    await waitFor(() =>
      expect(screen.getByText("No hay sesiones para hoy")).toBeInTheDocument(),
    );
  }, 15000);
  it("inicia, pausa, reanuda y guarda el tiempo real con autoevaluación y próximo repaso", async () => {
    saveState(fixture());
    const u = userEvent.setup();
    render(<App />);
    await route("/sesiones");
    await u.selectOptions(screen.getByLabelText("Curso"), "course-1");
    await u.selectOptions(screen.getByLabelText("Tema"), "t1");
    await u.click(screen.getByRole("button", { name: "Iniciar temporizador" }));
    const start = loadState().data.activeTimer!.runningSince!;
    vi.spyOn(Date, "now").mockReturnValue(start + 90000);
    await u.click(screen.getByRole("button", { name: "Pausar" }));
    expect(loadState().data.activeTimer?.runningSince).toBeNull();
    expect(loadState().data.activeTimer?.elapsedSeconds).toBe(90);
    await u.click(screen.getByRole("button", { name: "Reanudar" }));
    vi.mocked(Date.now).mockReturnValue(start + 150000);
    await u.click(screen.getByRole("button", { name: "Finalizar y guardar" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByLabelText("Minutos realmente estudiados"),
    ).toHaveValue(2.5);
    await u.selectOptions(
      within(dialog).getByLabelText("¿Qué tan bien entendiste este tema?"),
      "1",
    );
    await u.type(
      within(dialog).getByLabelText("Notas"),
      "Falta practicar ejercicios.",
    );
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar registro" }),
    );
    const stored = loadState().data;
    expect(stored.activeTimer).toBeNull();
    expect(stored.studyLogs[0].seconds).toBe(150);
    expect(stored.topics[0].mastery).toBe(1);
    expect(stored.topics[0].completed).toBe(false);
    expect(stored.topics[0].nextReviewDate).toBe(
      plusDays(todayIn(stored.settings.timezone), 2),
    );
    expect(parseBackup(serializeBackup(stored))).toEqual(stored);
  }, 15000);
  it("recupera una sesión interrumpida pausada y no inventa una sesión completa al volver", async () => {
    const d = fixture();
    const now = Date.now();
    d.activeTimer = createTimer(
      d,
      {
        courseId: "course-1",
        topicId: "t1",
        planId: null,
        minutes: 25,
        mode: "continuous",
      },
      now - 120000,
    );
    d.activeTimer.lastSeenAt = now - 60000;
    saveState(d);
    render(<App />);
    await route("/sesiones");
    expect(
      screen.getByRole("button", { name: "Reanudar" }),
    ).toBeInTheDocument();
    expect(loadState().data.activeTimer?.elapsedSeconds).toBe(60);
    expect(loadState().data.studyLogs).toHaveLength(0);
    vi.mocked(window.confirm).mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(loadState().data.activeTimer).not.toBeNull();
    vi.mocked(window.confirm).mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(loadState().data.activeTimer).toBeNull();
    expect(loadState().data.studyLogs).toHaveLength(0);
  }, 15000);
  it("conserva todos los datos de estudio al importar y cambia preferencias sin borrar planes", async () => {
    const d = fixture();
    saveState(d);
    const raw = localStorage.getItem(STORAGE_KEY);
    const u = userEvent.setup();
    render(<App />);
    await route("/configuracion");
    await u.click(screen.getByText("Disponibilidad, Pomodoro y repasos"));
    fireEvent.change(screen.getByLabelText("Disponibilidad global el Lunes"), {
      target: { value: "45" },
    });
    await u.click(
      screen.getByRole("button", { name: "Guardar configuración de estudio" }),
    );
    expect(loadState().data.studyPreferences.availability[0]).toBe(45);
    expect(loadState().data.topics).toEqual(d.topics);
    const file = new File([raw!], "study.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => raw });
    fireEvent.change(screen.getByLabelText("Archivo de copia de seguridad"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(loadState().data.studyPreferences.availability[0]).toBe(120),
    );
    expect(loadState().data.topics).toEqual(d.topics);
  }, 15000);
});
it("impide acortar un plan dejando sesiones manuales después de la nueva fecha objetivo", async () => {
  const d = fixture();
  const today = todayIn(d.settings.timezone),
    oldTarget = plusDays(today, 10);
  d.plans = [
    {
      id: "p1",
      courseId: "course-1",
      name: "Plan con sesión manual",
      goal: "",
      startDate: today,
      targetDate: oldTarget,
      topicIds: ["t1"],
      availability: [120, 120, 120, 120, 120, 120, 120],
      sessionMinutes: 25,
      priority: "media",
      reviewPercent: 20,
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ];
  d.scheduledSessions = [
    {
      id: "manual",
      courseId: "course-1",
      topicId: "t1",
      planId: "p1",
      title: "Física nuclear",
      date: oldTarget,
      time: "12:00",
      minutes: 25,
      kind: "study",
      status: "pending",
      manual: true,
      reason: "Manual",
    },
  ];
  saveState(d);
  const u = userEvent.setup();
  render(<App />);
  await route("/planes");
  await u.click(
    screen.getByRole("button", { name: "Editar plan Plan con sesión manual" }),
  );
  let dialog = screen.getByRole("dialog");
  fireEvent.change(
    within(dialog).getByLabelText("Fecha del examen u objetivo"),
    { target: { value: plusDays(today, 3) } },
  );
  await u.click(within(dialog).getByRole("button", { name: "Siguiente" }));
  await u.click(within(dialog).getByRole("button", { name: "Siguiente" }));
  await u.click(
    within(dialog).getByRole("button", { name: "Ver calendario propuesto" }),
  );
  dialog = screen.getByRole("dialog", {
    name: "Vista previa de planificación",
  });
  await u.click(
    within(dialog).getByRole("button", { name: "Confirmar calendario" }),
  );
  expect(
    await screen.findByText(/Hay sesiones manuales fuera de las nuevas fechas/),
  ).toBeInTheDocument();
  expect(loadState().data.plans[0].targetDate).toBe(oldTarget);
  expect(loadState().data.scheduledSessions[0].id).toBe("manual");
}, 15000);
