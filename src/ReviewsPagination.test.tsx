import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { StoreProvider } from "./services/store";
import { saveState } from "./services/storage";
import { initialState } from "./models/schema";
import Reviews from "./components/Reviews";
it("permite consultar los repasos posteriores al resultado 30 conservando el filtro", async () => {
  localStorage.clear();
  const d = initialState();
  d.units = [
    {
      id: "unit",
      courseId: d.courses[0].id,
      name: "Unidad",
      description: "",
      order: 0,
    },
  ];
  d.topics = Array.from({ length: 31 }, (_, i) => ({
    id: `topic-${i}`,
    unitId: "unit",
    parentId: null,
    name: `Tema ${i}`,
    description: "",
    order: i,
    difficulty: 2,
    mastery: 1,
    completed: false,
    lastStudyDate: "2026-10-01",
    lastReviewDate: null,
    nextReviewDate: "2026-10-02",
    reviewCount: 0,
  }));
  saveState(d);
  render(
    <StoreProvider>
      <MemoryRouter>
        <Reviews />
      </MemoryRouter>
    </StoreProvider>,
  );
  expect(screen.queryByText("Tema 30")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText("Tema 30")).toBeInTheDocument();
  expect(screen.queryByText("Tema 0")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Pendientes" }));
  expect(screen.getByText("Tema 0")).toBeInTheDocument();
});
