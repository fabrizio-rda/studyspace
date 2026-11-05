import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CourseNotes from "./components/CourseNotes";
import { accountState } from "./services/accounts";
import { classNote, googleDocumentId } from "./services/course-notes";
import { parseBackup, serializeBackup } from "./services/storage";
import { createDriveDocument } from "./services/google";
import type { AppState } from "./models/schema";
const mock = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  google: { driveReady: true, connect: vi.fn() },
}));
vi.mock("./services/store", () => ({ useStore: () => mock.current }));
vi.mock("./services/google-context", () => ({ useGoogle: () => mock.google }));
vi.mock("./services/google", () => ({ createDriveDocument: vi.fn() }));
beforeEach(() => {
  const data = accountState("Fabrizio", "fabrizio");
  mock.current = {
    data,
    workspaceToken: "a",
    commit: vi.fn((mutate: (data: AppState) => void) => {
      mutate(data);
      return true;
    }),
  };
  vi.mocked(createDriveDocument)
    .mockReset()
    .mockResolvedValue({
      ...classNote(
        "Creado",
        "https://docs.google.com/document/d/new-note/edit",
        data.courses[0].id,
        "2026-11-05",
      ),
      source: "drive",
    });
});
function mount() {
  const data = mock.current.data as AppState;
  return render(
    <MemoryRouter>
      <CourseNotes course={data.courses[0]} />
    </MemoryRouter>,
  );
}
it("vincula un documento existente, conserva el curso y lo abre dentro de StudySpace sin duplicarlo", async () => {
  const data = mock.current.data as AppState;
  mount();
  const u = userEvent.setup();
  await u.click(
    screen.getByRole("button", { name: "Usar documento existente" }),
  );
  await u.type(
    screen.getByLabelText("Enlace de Google Docs"),
    "https://docs.google.com/document/d/existing-note/edit?usp=sharing",
  );
  await u.click(screen.getByRole("button", { name: "Vincular y abrir" }));
  expect(screen.getByTitle(/^Editar apuntes:/)).toHaveAttribute(
    "src",
    "https://docs.google.com/document/d/existing-note/edit?embedded=true",
  );
  expect(data.documents[0].courseId).toBe(data.courses[0].id);
  await u.click(screen.getByRole("button", { name: "Vincular y abrir" }));
  expect(data.documents).toHaveLength(1);
  expect(parseBackup(serializeBackup(data)).documents).toEqual(data.documents);
  expect(createDriveDocument).not.toHaveBeenCalled();
});
it("rechaza enlaces ajenos a Google Docs sin guardarlos ni incrustarlos", async () => {
  mount();
  const u = userEvent.setup();
  await u.click(
    screen.getByRole("button", { name: "Usar documento existente" }),
  );
  await u.type(
    screen.getByLabelText("Enlace de Google Docs"),
    "https://evil.example/document/d/test/edit",
  );
  await u.click(screen.getByRole("button", { name: "Vincular y abrir" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Pega un enlace de Google Docs",
  );
  expect((mock.current.data as AppState).documents).toHaveLength(0);
  expect(
    googleDocumentId("https://docs.google.com.evil.example/document/d/id/edit"),
  ).toBeNull();
});
it("conserva acceso al Doc creado si falla guardar el vínculo y reintenta sin crear otro", async () => {
  const commit = mock.current.commit as ReturnType<typeof vi.fn>;
  commit.mockReturnValueOnce(false);
  mount();
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Crear y escribir" }));
  expect(
    await screen.findByRole("link", { name: "Abrir documento creado" }),
  ).toHaveAttribute("href", "https://docs.google.com/document/d/new-note/edit");
  await u.click(
    screen.getByRole("button", { name: "Reintentar guardar vínculo" }),
  );
  expect((mock.current.data as AppState).documents).toHaveLength(1);
  expect(createDriveDocument).toHaveBeenCalledTimes(1);
});
