import type { Settings } from "../models/schema";
export type InterfacePalette = "blue" | "wine";
// Presentation preference only; it never changes account identity or permissions.
export function interfacePalette(settings: Settings): InterfacePalette {
  return (
    settings.interfacePalette ??
    (settings.academicPreset === "catalina" ||
    (!settings.academicPreset && settings.calendarAccent === "pink")
      ? "wine"
      : "blue")
  );
}
