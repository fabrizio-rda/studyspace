import { localEntry } from "./test-entry";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { loadState, saveState } from "./services/storage";
import { mergeClassroom } from "./services/classroom";
import { initialState } from "./models/schema";
beforeEach(() => {
  localStorage.clear();
  localEntry();
  window.location.hash = "/biblioteca";
  vi.restoreAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
async function dialog() {
  return screen.findByRole("dialog");
}
describe("Biblioteca y personalización", () => {
  it("crea subcarpetas, añade, busca, mueve y abre una referencia sin Google", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Nueva carpeta" }),
    );
    let modal = await dialog();
    await user.type(
      within(modal).getByLabelText("Nombre de carpeta"),
      "Física",
    );
    await user.selectOptions(
      within(modal).getByLabelText("Curso de carpeta"),
      "course-1",
    );
    await user.click(
      within(modal).getByRole("button", { name: "Guardar carpeta" }),
    );
    await user.click(
      await screen.findByRole("button", { name: /Física.*0 documentos/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Nueva carpeta" }),
    );
    modal = await dialog();
    await user.type(
      within(modal).getByLabelText("Nombre de carpeta"),
      "Mecánica",
    );
    await user.click(
      within(modal).getByRole("button", { name: "Guardar carpeta" }),
    );
    await user.click(
      await screen.findByRole("button", { name: /Mecánica.*0 documentos/ }),
    );
    await user.click(screen.getByRole("button", { name: "Añadir documento" }));
    modal = await dialog();
    await user.type(
      within(modal).getByLabelText("Nombre del documento"),
      "Resumen de fuerzas",
    );
    await user.type(
      within(modal).getByLabelText("Enlace original"),
      "https://example.com/fuerzas",
    );
    await user.type(
      within(modal).getByLabelText(/Etiquetas/),
      "dinámica, repaso",
    );
    await user.click(
      within(modal).getByRole("button", { name: "Guardar documento" }),
    );
    const link = await screen.findByRole("link", {
      name: "Resumen de fuerzas",
    });
    expect(link).toHaveAttribute("href", "https://example.com/fuerzas");
    expect(link).toHaveAttribute("target", "_blank");
    expect(loadState().data.documents[0].courseId).toBe("course-1");
    await user.type(
      screen.getByRole("textbox", { name: "Buscar materiales" }),
      "dinámica",
    );
    expect(
      screen.getByRole("link", { name: "Resumen de fuerzas" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vista de lista" }));
    await user.click(screen.getByLabelText("Acciones de Resumen de fuerzas"));
    await user.click(
      screen.getByRole("button", { name: "Editar / mover referencia" }),
    );
    modal = await dialog();
    await user.selectOptions(within(modal).getByLabelText("Carpeta"), "");
    await user.click(
      within(modal).getByRole("button", { name: "Guardar documento" }),
    );
    expect(loadState().data.documents[0].folderId).toBeNull();
    expect(loadState().data.documents[0].courseId).toBe("course-1");
    await user.click(screen.getByRole("button", { name: "Biblioteca" }));
    await user.click(screen.getByLabelText("Acciones de carpeta Física"));
    await user.click(
      screen.getByRole("button", { name: "Editar o mover carpeta" }),
    );
    modal = await dialog();
    await user.clear(within(modal).getByLabelText("Nombre de carpeta"));
    await user.type(
      within(modal).getByLabelText("Nombre de carpeta"),
      "Materiales de física",
    );
    await user.selectOptions(
      within(modal).getByLabelText("Icono de carpeta"),
      "archive",
    );
    await user.click(
      within(modal).getByRole("button", { name: "Verde esmeralda #74B8A3" }),
    );
    await user.click(
      within(modal).getByRole("button", { name: "Guardar carpeta" }),
    );
    expect(
      loadState().data.folders.find((f) => f.name === "Materiales de física"),
    ).toMatchObject({ icon: "archive", color: "#74B8A3" });
    await user.click(
      screen.getByLabelText("Acciones de carpeta Materiales de física"),
    );
    await user.click(screen.getByRole("button", { name: "Eliminar carpeta" }));
    expect(loadState().data.folders).toHaveLength(0);
    expect(loadState().data.documents).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Resumen de fuerzas" }),
    ).toHaveAttribute("href", "https://example.com/fuerzas");
  });
  it("elige un hexadecimal, lo previsualiza y conserva el color tras recargar", async () => {
    window.location.hash = "/configuracion";
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(await screen.findByRole("button", { name: "Física IB" }));
    const modal = await dialog();
    expect(
      within(modal).getAllByRole("button", { name: /#[A-F0-9]{6}$/ }),
    ).toHaveLength(20);
    const hex = within(modal).getByLabelText("Hexadecimal");
    await user.clear(hex);
    await user.type(hex, "#125ABC");
    expect(
      within(modal)
        .getByLabelText("Vista previa del curso")
        .getAttribute("style"),
    ).toContain("rgb(18, 90, 188)");
    await user.click(
      within(modal).getByRole("button", { name: "Guardar curso" }),
    );
    expect(loadState().data.courses[0].color).toBe("#125ABC");
    app.unmount();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Física IB" }));
    expect((await dialog()).querySelector("input[type=color]")).toHaveValue(
      "#125abc",
    );
  });
  it("agrupa el buscador global y navega al documento, sin conexiones inventadas", async () => {
    const d = initialState();
    d.folders = [
      {
        id: "folder",
        name: "Material de ondas",
        parentId: null,
        courseId: null,
        icon: "folder",
        color: "#83A8EB",
        createdAt: new Date().toISOString(),
      },
    ];
    d.documents = [
      {
        id: "doc",
        name: "Ondas transversales",
        url: "https://example.com/ondas",
        source: "manual",
        externalId: null,
        mimeType: "application/pdf",
        folderId: "folder",
        courseId: null,
        topicId: null,
        tags: [],
        createdAt: new Date().toISOString(),
      },
    ];
    saveState(d);
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByRole("textbox", { name: "Buscar en StudySpace" }),
      "ondas",
    );
    const results = screen.getByLabelText("Resultados de búsqueda");
    expect(within(results).getAllByText("Carpeta").length).toBeGreaterThan(0);
    await user.click(
      within(results).getByRole("button", { name: /Ondas transversales/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Ondas transversales" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("link", { name: "Configuración" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Conectar Drive" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByRole("button", { name: "Conectar Classroom" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Enviar código" }),
    ).toBeDisabled();
  });
  it("refleja una tarea importada una sola vez en el calendario con el color guardado del curso", async () => {
    const d = initialState();
    d.courses[0].color = "#125ABC";
    d.classroomLinks.push({
      id: "link",
      externalCourseId: "school",
      externalName: "Clase",
      courseId: "course-1",
    });
    mergeClassroom(d, "school", [
      {
        work: {
          id: "assignment",
          courseId: "school",
          title: "Entrega de ondas",
          description: "",
          alternateLink: "https://classroom.google.com/c/school/a/assignment",
          dueDate: { year: 2026, month: 10, day: 20 },
          dueTime: { hours: 2, minutes: 30 },
        },
        submissionState: "TURNED_IN",
      },
    ]);
    saveState(d);
    window.location.hash = "/calendario?date=2026-10-19";
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Mi calendario" });
    const activities = document.querySelectorAll(".calendar-event");
    expect(
      Array.from(activities).filter((e) =>
        e.textContent?.includes("Entrega de ondas"),
      ),
    ).toHaveLength(1);
    const activity = Array.from(activities).find((e) =>
      e.textContent?.includes("Entrega de ondas"),
    )!;
    expect(activity).toHaveStyle({ borderLeftColor: "#125ABC" });
    await user.click(activity);
    const modal = await dialog();
    expect(
      within(modal).getByRole("link", { name: /Abrir actividad original/ }),
    ).toHaveAttribute(
      "href",
      "https://classroom.google.com/c/school/a/assignment",
    );
    expect(
      within(modal).getByText(/Entregada en Classroom/),
    ).toBeInTheDocument();
    expect(within(modal).getByLabelText("Estado")).toHaveValue("pendiente");
  });
  it("muestra tareas sin fecha sin marcarlas como vencidas y permite consultar el dashboard", async () => {
    const d = initialState();
    d.tasks.push({
      id: "undated",
      title: "Leer material sin fecha",
      description: "",
      courseId: null,
      type: "lectura",
      dueDate: "",
      time: "",
      priority: "media",
      status: "pendiente",
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    saveState(d);
    window.location.hash = "/tareas";
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByText("Leer material sin fecha"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin fecha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vencidas" }));
    expect(
      screen.queryByText("Leer material sin fecha"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Inicio" }));
    expect(
      await screen.findByText("Cursos, tareas y evaluaciones."),
    ).toBeInTheDocument();
  });
});
