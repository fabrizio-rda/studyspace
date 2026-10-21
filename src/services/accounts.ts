import { initialState } from "../models/schema";
import type { AppState, Course } from "../models/schema";
export type AccountPreset = "fabrizio" | "catalina" | "custom";
const common: [string, Course["icon"]][] = [
  ["English HL", "languages"],
  ["Literatura HL", "book"],
  ["Matemática NM", "calculator"],
  ["Gestión Empresarial", "briefcase"],
  ["Historia", "globe"],
  ["TOK / Teoría del Conocimiento", "brain"],
  ["CAS", "heart"],
  ["Cambridge C1 Advanced", "graduation"],
];
export function accountState(name: string, preset: AccountPreset): AppState {
  const d = initialState();
  d.settings = {
    ...d.settings,
    name: name.trim() || "Mi cuenta",
    academicPreset: preset,
    calendarDefaultVisibility: "details",
    calendarAccent: preset === "catalina" ? "pink" : "blue",
  };
  const courses =
    preset === "custom"
      ? []
      : [
          ...common,
          ...((preset === "catalina"
            ? [
                ["Biology", "flask"],
                ["Psicología", "brain"],
              ]
            : [
                ["Física IB", "atom"],
                ["Química IB", "flask"],
                ["AP Physics C: Mechanics", "rocket"],
              ]) as [string, Course["icon"]][]),
        ];
  const colors = [
    "#83A8EB",
    "#B7A0EA",
    "#B3DFF5",
    "#F4B58A",
    "#A8D9C0",
    "#D4B8F0",
    "#ECA6C8",
    "#597CC8",
    "#7CCBC7",
    "#A889C8",
    "#9BAEC0",
  ];
  d.courses = courses.map(([title, icon], order) => ({
    id: crypto.randomUUID(),
    name: title,
    icon,
    color: colors[order % colors.length],
    description: "",
    archived: false,
    order,
  }));
  return d;
}
export function blankAccount() {
  return accountState("Mi cuenta", "custom");
}
function projectKey(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}
const ownerKey = "studyspace:local-owner:v1";
export function localOwner(): { userId: string; project: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(ownerKey) ?? "null");
    return v && typeof v.userId === "string" && typeof v.project === "string"
      ? { ...v, project: projectKey(v.project) }
      : null;
  } catch {
    return null;
  }
}
export function claimLocal(userId: string, project: string) {
  project = projectKey(project);
  const owner = localOwner();
  if (owner && (owner.userId !== userId || owner.project !== project))
    throw new Error("La copia local ya está asociada a otra cuenta.");
  localStorage.setItem(ownerKey, JSON.stringify({ userId, project }));
}
export function canUseLocal(userId: string | null, project: string) {
  project = projectKey(project);
  const owner = localOwner();
  return !owner || (owner.userId === userId && owner.project === project);
}
