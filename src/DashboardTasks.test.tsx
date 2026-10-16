import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { initialState } from "./models/schema";
import { saveState, loadState } from "./services/storage";
import { todayIn, plusDays, weekStart } from "./services/dates";
beforeEach(() => {
  localStorage.clear();
  window.location.hash = "/";
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
it("agrupa tareas reales por hoy y mañana y añade con la fecha del grupo", async () => {
  const d = initialState(),
    today = todayIn(d.settings.timezone),
    tomorrow = plusDays(today, 1);
  d.tasks = [today, tomorrow].map((dueDate, i) => ({
    id: `task-${i}`,
    title: i ? "Lectura de mañana" : "Práctica de hoy",
    dueDate,
    description: "",
    courseId: d.courses[0].id,
    type: "tarea",
    time: "18:00",
    priority: "media",
    status: i ? "completada" : "pendiente",
    createdAt: new Date().toISOString(),
    completedAt: i ? new Date().toISOString() : null,
  }));
  saveState(d);
  render(<App />);
  const todayGroup = screen.getByRole("region", { name: "Tareas de hoy" }),
    tomorrowGroup = screen.getByRole("region", { name: "Tareas de mañana" });
  expect(within(todayGroup).getByText("1 pendiente")).toBeInTheDocument();
  expect(within(tomorrowGroup).getByText("0 pendientes")).toBeInTheDocument();
  expect(
    within(todayGroup).queryByText("Lectura de mañana"),
  ).not.toBeInTheDocument();
  const u = userEvent.setup();
  await u.click(
    within(tomorrowGroup).getByRole("button", {
      name: "Añadir tarea para mañana",
    }),
  );
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Fecha límite")).toHaveValue(tomorrow);
  await u.type(within(dialog).getByLabelText("Título"), "Entrega de mañana");
  await u.click(within(dialog).getByRole("button", { name: "Crear tarea" }));
  expect(
    loadState().data.tasks.find((t) => t.title === "Entrega de mañana")
      ?.dueDate,
  ).toBe(tomorrow);
  expect(within(tomorrowGroup).getByText("1 pendiente")).toBeInTheDocument();
});
it("consulta más resultados semanales sin extender indefinidamente la tarjeta", async () => {
  const d = initialState(),
    date = weekStart(todayIn(d.settings.timezone));
  d.tasks = Array.from({ length: 8 }, (_, i) => ({
    id: `t-${i}`,
    title: `Tarea semanal ${i}`,
    dueDate: date,
    description: "",
    courseId: null,
    type: "tarea",
    time: "",
    priority: "media",
    status: "pendiente",
    createdAt: new Date().toISOString(),
    completedAt: null,
  }));
  saveState(d);
  render(<App />);
  const heading = screen.getByRole("heading", {
    name: "Tareas de esta semana",
  });
  const card = heading.closest("section")!;
  expect(within(card).queryByText("Tarea semanal 7")).not.toBeInTheDocument();
  await userEvent.click(
    within(card).getByRole("button", { name: "Mostrar más (2)" }),
  );
  expect(within(card).getByText("Tarea semanal 7")).toBeInTheDocument();
});
it("mantiene completada una tarea al editar un formulario abierto antes de una actualización", async () => {
  const d = initialState(),
    date = todayIn(d.settings.timezone);
  d.tasks = [
    {
      id: "task",
      title: "Original",
      dueDate: date,
      description: "",
      courseId: null,
      type: "tarea",
      time: "",
      priority: "media",
      status: "pendiente",
      createdAt: new Date().toISOString(),
      completedAt: null,
    },
  ];
  saveState(d);
  window.location.hash = "/tareas";
  render(<App />);
  const u = userEvent.setup();
  await u.click(await screen.findByRole("button", { name: "Editar Original" }));
  const remote = structuredClone(d);
  remote.tasks[0].status = "completada";
  remote.tasks[0].completedAt = new Date().toISOString();
  saveState(remote);
  fireEvent(window, new StorageEvent("storage", { key: "studyspace:data:v1" }));
  const dialog = screen.getByRole("dialog");
  await u.clear(within(dialog).getByLabelText("Título"));
  await u.type(within(dialog).getByLabelText("Título"), "Nuevo título");
  await u.click(
    within(dialog).getByRole("button", { name: "Guardar cambios" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(loadState().data.tasks[0]).toMatchObject({
    title: "Nuevo título",
    status: "completada",
  });
});
