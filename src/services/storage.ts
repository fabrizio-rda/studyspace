import {
  initialState,
  stateSchema,
  legacyStateSchema,
  defaultStudyPreferences,
} from "../models/schema";
import type { AppState } from "../models/schema";
export const STORAGE_KEY = "studyspace:data:v1";
export const LEGACY_BACKUP_KEY = "studyspace:backup:before-phase2";
export function parseBackup(raw: string): AppState {
  if (raw.length > 20_000_000)
    throw new Error("El archivo supera el límite de 20 MB.");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
  if (
    data &&
    typeof data === "object" &&
    "schemaVersion" in data &&
    data.schemaVersion === 1
  ) {
    const legacy = legacyStateSchema.safeParse(data);
    if (!legacy.success)
      throw new Error(
        "La copia de fase 1 no es válida. No se reemplazó tu información.",
      );
    data = {
      ...legacy.data,
      schemaVersion: 2,
      units: [],
      topics: [],
      plans: [],
      scheduledSessions: [],
      studyLogs: [],
      reviewHistory: [],
      activeTimer: null,
      studyPreferences: defaultStudyPreferences(),
    };
  }
  const result = stateSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      "Los datos no tienen un formato StudySpace válido (esquema 1 o 2). No se reemplazó tu información.",
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
    const previous = localStorage.getItem(STORAGE_KEY);
    let legacy = false;
    try {
      legacy = !!previous && JSON.parse(previous).schemaVersion === 1;
    } catch {
      /* A confirmed import/reset may replace corrupt data. */
    }
    if (previous && legacy && localStorage.getItem(LEGACY_BACKUP_KEY) === null)
      localStorage.setItem(LEGACY_BACKUP_KEY, previous);
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
