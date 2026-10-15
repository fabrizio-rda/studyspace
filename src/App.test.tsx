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
import { loadState, saveState, STORAGE_KEY } from "./services/storage";
const pause = () => new Promise((resolve) => setTimeout(resolve, 220));
async function route(path: string) {
  await act(async () => {
    window.location.hash = path;
    await Promise.resolve();
  });
  await act(pause);
  await act(pause);
  await waitFor(() => expect(document.querySelector("main")).toBeTruthy());
}
async function createTask(
  title: string,
  type = "tarea",
  courseId = "course-1",
) {
  const u = userEvent.setup();
  const button = screen.getByRole("button", { name: "Nueva tarea" });
  await u.click(button);
  const dialog = screen.getByRole("dialog");
  await u.selectOptions(within(dialog).getByLabelText("Tipo"), type);
  await u.type(within(dialog).getByLabelText("Título"), title);
  await u.selectOptions(within(dialog).getByLabelText("Curso"), courseId);
  await u.click(within(dialog).getByRole("button", { name: "Crear tarea" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
}
beforeEach(() => {
  localStorage.clear();
  window.location.hash = "/";
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
describe("StudySpace: recorridos de usuario", () => {
  it("crea, edita, completa y conserva una tarea tras volver a montar la app", async () => {
    const u = userEvent.setup();
    const app = render(<App />);
    expect(
      await screen.findByText("Cursos, tareas y evaluaciones."),
    ).toBeInTheDocument();
    await route("/tareas");
    await createTask("Resolver dinámica");
    await u.click(
      screen.getByRole("button", { name: "Editar Resolver dinámica" }),
    );
    const dialog = screen.getByRole("dialog");
    const title = within(dialog).getByLabelText("Título");
    await u.clear(title);
    await u.type(title, "Resolver energía");
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    await u.click(
      screen.getByRole("button", { name: "Completar Resolver energía" }),
    );
    expect(loadState().data.tasks[0].status).toBe("completada");
    expect(loadState().data.tasks[0].completedAt).toBeTruthy();
    app.unmount();
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Reabrir Resolver energía" }),
    ).toBeInTheDocument();
  }, 15000);
  it("crea un examen y lo refleja una sola vez en el mes, con su detalle diario", async () => {
    render(<App />);
    await route("/tareas");
    await createTask("Prueba de Física", "examen");
    await route("/calendario");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Mi calendario" }),
      ).toBeInTheDocument(),
    );
    expect(document.querySelectorAll(".calendar-event")).toHaveLength(1);
    expect(screen.getAllByText(/Prueba de Física/).length).toBe(2);
    expect(loadState().data.events).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(document.querySelector(".view-week")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Día" }));
    expect(document.querySelectorAll(".calendar-event")).toHaveLength(0);
    expect(screen.getByText("Prueba de Física")).toBeInTheDocument();
  }, 15000);
  it("abre cursos, crea uno, lo edita, archiva y elimina conservando sus tareas", async () => {
    const u = userEvent.setup();
    render(<App />);
    await route("/cursos");
    await u.click(screen.getByRole("button", { name: "Nuevo curso" }));
    let dialog = screen.getByRole("dialog");
    await u.type(
      within(dialog).getByLabelText("Nombre del curso"),
      "Astronomía",
    );
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar curso" }),
    );
    const course = loadState().data.courses.find(
      (c) => c.name === "Astronomía",
    )!;
    await route(`/cursos/${course.id}`);
    expect(
      screen.getByRole("heading", { name: "Astronomía" }),
    ).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Editar curso" }));
    dialog = screen.getByRole("dialog");
    await u.type(
      within(dialog).getByLabelText("Descripción"),
      "Estrellas y planetas",
    );
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar curso" }),
    );
    await createTask("Estudiar órbitas", "tarea", course.id);
    await u.click(screen.getByRole("button", { name: "Archivar" }));
    expect(
      loadState().data.courses.find((c) => c.id === course.id)?.archived,
    ).toBe(true);
    await u.click(screen.getByRole("button", { name: "Restaurar" }));
    await u.click(screen.getByRole("button", { name: "Eliminar curso" }));
    await act(pause);
    expect(loadState().data.courses.some((c) => c.id === course.id)).toBe(
      false,
    );
    expect(loadState().data.tasks).toHaveLength(1);
    expect(loadState().data.tasks[0].courseId).toBeNull();
  }, 15000);
  it("filtra por curso, prioridad, estado y texto, y cambia a Kanban", async () => {
    const data = initialState();
    const base = {
      description: "",
      courseId: "course-1",
      type: "tarea" as const,
      dueDate: "2026-10-19",
      time: "",
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: "pendiente" as const,
    };
    data.tasks = [
      { ...base, id: "one", title: "Dinámica", priority: "alta" },
      {
        ...base,
        id: "two",
        title: "Literatura",
        priority: "baja",
        courseId: "course-5",
      },
    ];
    saveState(data);
    render(<App />);
    await route("/tareas");
    const u = userEvent.setup();
    await u.selectOptions(
      screen.getByLabelText("Filtrar por curso"),
      "course-1",
    );
    expect(
      screen.getByRole("button", { name: "Dinámica" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Literatura" }),
    ).not.toBeInTheDocument();
    await u.selectOptions(
      screen.getByLabelText("Filtrar por prioridad"),
      "baja",
    );
    expect(screen.getByText("No hay coincidencias")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await u.type(screen.getByLabelText("Buscar tareas"), "liter");
    expect(
      screen.queryByRole("button", { name: "Dinámica" }),
    ).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Vista Kanban" }));
    expect(document.querySelectorAll(".kanban-column")).toHaveLength(3);
    await u.selectOptions(
      screen.getByLabelText("Filtrar por estado"),
      "completada",
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Literatura" }),
      ).not.toBeInTheDocument(),
    );
  }, 15000);
  it("exporta e importa JSON válido y rechaza JSON corrupto sin perder datos", async () => {
    const u = userEvent.setup();
    render(<App />);
    await route("/configuracion");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await u.click(screen.getByRole("button", { name: "Exportar mis datos" }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    const backup = initialState();
    backup.settings.name = "Nombre importado";
    const input = screen.getByLabelText("Archivo de copia de seguridad");
    const file = new File([JSON.stringify(backup)], "backup.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify(backup),
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(loadState().data.settings.name).toBe("Nombre importado"),
    );
    const previous = localStorage.getItem(STORAGE_KEY);
    const invalid = new File(["oops"], "invalid.json", {
      type: "application/json",
    });
    Object.defineProperty(invalid, "text", { value: async () => "oops" });
    fireEvent.change(input, { target: { files: [invalid] } });
    await screen.findByText("El archivo no contiene JSON válido.");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(previous);
    click.mockRestore();
  }, 15000);
  it("cancela una importación destructiva y protege datos corruptos al intentar editar", async () => {
    const data = initialState();
    saveState(data);
    render(<App />);
    await route("/configuracion");
    vi.mocked(window.confirm).mockReturnValue(false);
    const backup = {
      ...data,
      settings: { ...data.settings, name: "No importar" },
    };
    const f = new File([JSON.stringify(backup)], "backup.json");
    Object.defineProperty(f, "text", {
      value: async () => JSON.stringify(backup),
    });
    fireEvent.change(screen.getByLabelText("Archivo de copia de seguridad"), {
      target: { files: [f] },
    });
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(loadState().data.settings.name).toBe("Fabrizio");
    localStorage.setItem(STORAGE_KEY, "contenido original roto");
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar preferencias" }),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe("contenido original roto");
    expect(
      await screen.findByText(/No se pudieron leer los datos guardados/),
    ).toBeInTheDocument();
  }, 15000);
  it("crea, edita y elimina una actividad independiente y funciona la búsqueda global", async () => {
    render(<App />);
    await route("/calendario");
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Nueva actividad" }));
    let dialog = screen.getByRole("dialog");
    await u.type(
      within(dialog).getByLabelText("Título"),
      "Repaso en biblioteca",
    );
    await u.click(
      within(dialog).getByRole("button", { name: "Crear actividad" }),
    );
    expect(loadState().data.events).toHaveLength(1);
    expect(loadState().data.tasks).toHaveLength(0);
    await u.type(screen.getByLabelText("Buscar en StudySpace"), "biblioteca");
    const results = screen.getByLabelText("Resultados de búsqueda");
    await u.click(
      within(results).getByRole("button", { name: /Repaso en biblioteca/ }),
    );
    dialog = screen.getByRole("dialog");
    await u.clear(within(dialog).getByLabelText("Título"));
    await u.type(within(dialog).getByLabelText("Título"), "Repaso final");
    await u.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" }),
    );
    await u.click(
      screen.getByRole("button", { name: "Eliminar Repaso final" }),
    );
    expect(loadState().data.events).toHaveLength(0);
  }, 15000);
});
