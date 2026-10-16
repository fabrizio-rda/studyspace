import { renderHook, act } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { mergeEdit, EditConflict } from "./editing";
import { useFormStore } from "./form-store";
import { StoreProvider, useStore } from "./store";
import { initialState } from "../models/schema";
import { saveState } from "./storage";
beforeEach(() => localStorage.clear());
it("preserva el estado remoto al guardar el título de un formulario anterior", () => {
  const d = initialState();
  d.tasks = [
    {
      id: "task",
      title: "Original",
      description: "",
      courseId: null,
      type: "tarea",
      dueDate: "2026-11-01",
      time: "",
      priority: "media",
      status: "pendiente",
      createdAt: new Date().toISOString(),
      completedAt: null,
    },
  ];
  saveState(d);
  const { result } = renderHook(
    () => ({ form: useFormStore(), live: useStore() }),
    { wrapper: StoreProvider },
  );
  const original = structuredClone(d.tasks[0]);
  act(() => {
    result.current.live.commit((s) => {
      s.tasks[0].status = "completada";
      s.tasks[0].completedAt = new Date().toISOString();
    });
  });
  act(() =>
    expect(
      result.current.form.saveTask({ ...original, title: "Editado" }),
    ).toBe(true),
  );
  expect(result.current.live.data.tasks[0]).toMatchObject({
    title: "Editado",
    status: "completada",
  });
});
it("detiene cambios incompatibles y conserva base, formulario y versión actual", () => {
  saveState(initialState());
  const { result } = renderHook(
    () => ({ form: useFormStore(), live: useStore() }),
    { wrapper: StoreProvider },
  );
  act(() => {
    result.current.live.commit((d) => {
      d.settings.name = "Remoto";
    });
  });
  act(() =>
    expect(
      result.current.form.commit((d) => {
        d.settings.name = "Mi edición";
      }),
    ).toBe(false),
  );
  expect(result.current.live.data.settings.name).toBe("Remoto");
  expect(result.current.live.editConflict?.mine.settings.name).toBe(
    "Mi edición",
  );
  expect(result.current.live.editConflict?.base.settings.name).toBe("Fabrizio");
});
it("no resucita registros eliminados ni descarta cambios al eliminar uno editado remotamente", () => {
  const base = [{ id: "a", title: "A" }];
  expect(() => mergeEdit(base, [{ id: "a", title: "B" }], [])).toThrow(
    EditConflict,
  );
  expect(() => mergeEdit(base, [], [{ id: "a", title: "C" }])).toThrow(
    EditConflict,
  );
  expect(
    mergeEdit(
      base,
      [...base, { id: "b", title: "B" }],
      [...base, { id: "c", title: "C" }],
    ),
  ).toHaveLength(3);
});
