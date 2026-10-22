import { expect, it } from "vitest";
import { accountState } from "./accounts";
import { interfacePalette } from "./interface-palette";
import { parseBackup, serializeBackup } from "./storage";
import { settingsSchema } from "../models/schema";
it("da vino a las cuentas antiguas de Catalina sin cambiar actividades ni identidad", () => {
  const c = accountState("Catalina", "catalina");
  delete c.settings.interfacePalette;
  const before = structuredClone(c);
  expect(interfacePalette(c.settings)).toBe("wine");
  expect(c).toEqual(before);
  const f = accountState("Fabrizio", "fabrizio");
  delete f.settings.interfacePalette;
  expect(interfacePalette(f.settings)).toBe("blue");
});
it("conserva la elección individual en las copias y no la confunde con el color del calendario", () => {
  const c = accountState("Catalina", "catalina");
  c.settings.interfacePalette = "blue";
  const restored = parseBackup(serializeBackup(c));
  expect(interfacePalette(restored.settings)).toBe("blue");
  expect(restored.settings.calendarAccent).toBe("pink");
  expect(restored.courses).toEqual(c.courses);
  expect(accountState("Fabrizio", "fabrizio").settings.interfacePalette).toBe(
    "blue",
  );
  expect(
    settingsSchema.safeParse({ ...c.settings, interfacePalette: "unknown" })
      .success,
  ).toBe(false);
});
