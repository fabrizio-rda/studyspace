import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountSignIn from "./components/AccountSignIn";
import { accountAccessError } from "./services/auth-errors";
const store = vi.hoisted(() => ({
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
  cloud: { user: null },
}));
vi.mock("./services/store", () => ({ useStore: () => store }));
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  localStorage.setItem(
    "studyspace:public-config:v1",
    JSON.stringify({
      supabaseUrl: "https://test.supabase.co",
      supabaseKey: "sb_publishable_test",
    }),
  );
  store.sendCode.mockReset().mockResolvedValue(undefined);
  store.verifyCode.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
it("explica errores de envío y conserva el formulario sin afirmar entrega", async () => {
  store.sendCode.mockRejectedValue({
    code: "email_address_not_authorized",
    message: "Email address not authorized",
  });
  render(<AccountSignIn />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Email"), "catalina@example.test");
  await u.click(screen.getByRole("button", { name: "Enviar código" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("SMTP");
  expect(screen.queryByLabelText("Código recibido")).not.toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
});
it("conserva el correo y la espera al recargar, permite reenviar y verificar", async () => {
  const start = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  let view = render(<AccountSignIn />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Email"), "catalina@example.test");
  await u.click(screen.getByRole("button", { name: "Enviar código" }));
  expect(
    screen.getByRole("button", { name: /Reenviar correo en/ }),
  ).toBeDisabled();
  view.unmount();
  view = render(<AccountSignIn />);
  expect(
    screen.getByRole("button", { name: /Reenviar correo en/ }),
  ).toBeDisabled();
  expect(store.sendCode).toHaveBeenCalledTimes(1);
  view.unmount();
  clock.mockReturnValue(start + 61000);
  render(<AccountSignIn />);
  await u.click(screen.getByRole("button", { name: "Reenviar correo" }));
  expect(store.sendCode).toHaveBeenCalledTimes(2);
  expect(store.sendCode).toHaveBeenLastCalledWith("catalina@example.test");
  await u.type(screen.getByLabelText("Código recibido"), "123456");
  await u.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(store.verifyCode).toHaveBeenCalledWith(
    "catalina@example.test",
    "123456",
  );
  expect(sessionStorage.length).toBe(0);
});
it("diferencia límites, código vencido y fallos de conexión", () => {
  expect(accountAccessError({ code: "over_email_send_rate_limit" })).toContain(
    "límite de correos",
  );
  expect(accountAccessError({ code: "otp_expired" })).toContain("más reciente");
  expect(accountAccessError(new TypeError("Failed to fetch"))).toContain(
    "URL del proyecto",
  );
  expect(accountAccessError(new Error("Error desconocido"))).toBe(
    "Error desconocido",
  );
});
