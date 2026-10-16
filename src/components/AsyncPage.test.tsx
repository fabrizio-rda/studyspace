import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { deferredPage } from "./AsyncPage";
it("permite reintentar una página que no pudo cargarse sin desmontar la aplicación", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const loader = vi
    .fn()
    .mockRejectedValueOnce(new Error("Network"))
    .mockResolvedValue({ default: () => <h1>Sección recuperada</h1> });
  const Page = deferredPage(loader);
  render(<Page />);
  await screen.findByRole("heading", { name: "No se pudo abrir esta sección" });
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(
    await screen.findByRole("heading", { name: "Sección recuperada" }),
  ).toBeInTheDocument();
  expect(loader).toHaveBeenCalledTimes(2);
  error.mockRestore();
});
