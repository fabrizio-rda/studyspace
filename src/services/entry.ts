import { loadConfig } from "./config";
import type { Settings } from "../models/schema";
export const entryProfiles = [
  {
    id: "fabrizio",
    name: "Fabrizio",
    initials: "F",
    courses: [
      "Física",
      "Química",
      "Literatura",
      "Matemática",
      "AP Physics",
      "Cambridge C1",
    ],
    avatarSrc: "",
  },
  {
    id: "catalina",
    name: "Catalina",
    initials: "C",
    courses: [
      "Biology",
      "Psicología",
      "Gestión",
      "Literatura",
      "Matemática",
      "Cambridge C1",
    ],
    avatarSrc: "",
  },
] as const;
export type EntryProfile = (typeof entryProfiles)[number]["id"];
export function workspacePath(path: string) {
  return /^\/(espacio|tareas|calendario|cursos(?:\/[^?]*)?|biblioteca|planes|sesiones|configuracion)(?:\?|$)/.test(
    path,
  );
}
export function entryProject() {
  return loadConfig().supabaseUrl.replace(/\/$/, "");
}
function key() {
  return `studyspace:entry-identities:v1:${entryProject()}`;
}
export function entryBindings(): Partial<Record<EntryProfile, string>> {
  try {
    const value = JSON.parse(localStorage.getItem(key()) ?? "{}");
    return Object.fromEntries(
      entryProfiles
        .filter((p) => typeof value?.[p.id] === "string")
        .map((p) => [p.id, value[p.id]]),
    );
  } catch {
    return {};
  }
}
export function entryIdentity(userId: string) {
  const bindings = entryBindings();
  return entryProfiles.find((p) => bindings[p.id] === userId)?.id;
}
export function bindEntry(profile: EntryProfile, userId: string) {
  const bindings = entryBindings();
  if (!entryProject() || !userId)
    throw Error("Primero inicia sesión en tu proyecto Supabase.");
  if (bindings[profile] && bindings[profile] !== userId)
    throw Error(
      "Esta tarjeta corresponde a otra cuenta. Inicia sesión con su correo.",
    );
  if (entryIdentity(userId) && entryIdentity(userId) !== profile)
    throw Error("Esta sesión ya corresponde a la otra persona.");
  localStorage.setItem(
    key(),
    JSON.stringify({ ...bindings, [profile]: userId }),
  );
}
// A preset/name may prevent an obvious first-time mismatch; it never grants
// access. Only the authenticated UUID and an explicitly confirmed binding do.
export function entryMismatch(
  profile: EntryProfile,
  userId: string,
  settings: Settings,
) {
  const bindings = entryBindings();
  if (bindings[profile]) return bindings[profile] !== userId;
  const known = entryIdentity(userId);
  if (known) return known !== profile;
  const hint =
    settings.academicPreset === "fabrizio" ||
    settings.academicPreset === "catalina"
      ? settings.academicPreset
      : ["fabrizio", "catalina"].find(
          (n) => settings.name.trim().toLowerCase() === n,
        );
  return !!hint && hint !== profile;
}
export type EntryGrant = {
  profile: EntryProfile | "local";
  userId: string | null;
  project: string;
};
export const ENTRY_GRANT_KEY = "studyspace:entry-grant:v1";
export function readEntryGrant(): EntryGrant | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(ENTRY_GRANT_KEY) ?? "null");
    if (!value || typeof value.project !== "string") return null;
    if (value.profile === "local" && value.userId === null) return value;
    return entryProfiles.some((p) => p.id === value.profile) &&
      typeof value.userId === "string" &&
      value.userId
      ? value
      : null;
  } catch {
    return null;
  }
}
