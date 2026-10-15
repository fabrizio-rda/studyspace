import { initialState, stateSchema } from "../models/schema";
import type { AppState } from "../models/schema";
export const STORAGE_KEY = "studyspace:data:v1";
export function parseBackup(raw: string): AppState {
  if (raw.length > 20_000_000)
    throw new Error("El archivo supera el límite de 20 MB.");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
  const result = stateSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      "Los datos no tienen un formato StudySpace válido (esquema 1). No se reemplazó tu información.",
    );
  return result.data;
}
export function loadState(): { data: AppState; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      data: raw === null ? initialState() : parseBackup(raw),
      error: null,
    };
  } catch {
    return {
      data: initialState(),
      error:
        "No se pudieron leer los datos guardados. Se muestra una vista temporal. Exporta una copia de recuperación antes de importar o restablecer. No sobrescribiremos los datos existentes.",
    };
  }
}
export function saveState(data: AppState) {
  const validated = stateSchema.parse(data);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  } catch {
    throw new Error(
      "No se pudo guardar. Revisa el espacio disponible y los permisos de almacenamiento del navegador. El cambio no se aplicó.",
    );
  }
}
export function serializeBackup(data: AppState) {
  return JSON.stringify(stateSchema.parse(data), null, 2);
}
export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
