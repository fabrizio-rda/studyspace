// Three-way edits: unchanged fields follow the current version; competing
// changes require an explicit decision and never partially modify the store.
export class EditConflict extends Error {
  constructor(public path: string) {
    super(
      "Hay cambios recientes en los mismos campos. Conservamos tu formulario y la versión actual. Exporta las versiones antes de volver a abrirlo.",
    );
  }
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const identified = (x: unknown): x is { id: string } =>
  typeof x === "object" && x !== null && "id" in x && typeof x.id === "string";
export function mergeEdit<T>(base: T, mine: T, current: T, path = "datos"): T {
  if (equal(base, mine)) return structuredClone(current);
  if (equal(base, current) || equal(mine, current))
    return structuredClone(mine);
  if (
    Array.isArray(base) &&
    Array.isArray(mine) &&
    Array.isArray(current) &&
    [...base, ...mine, ...current].every(identified)
  ) {
    const b = new Map(base.map((x) => [x.id, x])),
      m = new Map(mine.map((x) => [x.id, x])),
      c = new Map(current.map((x) => [x.id, x]));
    const ids = [
      ...new Set([
        ...current.map((x) => x.id),
        ...mine.map((x) => x.id),
        ...base.map((x) => x.id),
      ]),
    ];
    return ids
      .map((id) => mergeEdit(b.get(id), m.get(id), c.get(id), `${path}/${id}`))
      .filter((x) => x !== undefined) as T;
  }
  if (
    base &&
    mine &&
    current &&
    typeof base === "object" &&
    typeof mine === "object" &&
    typeof current === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(mine) &&
    !Array.isArray(current)
  ) {
    const b = base as Record<string, unknown>,
      m = mine as Record<string, unknown>,
      c = current as Record<string, unknown>;
    return Object.fromEntries(
      [...new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(c)])]
        .map((k) => [k, mergeEdit(b[k], m[k], c[k], `${path}/${k}`)])
        .filter(([, v]) => v !== undefined),
    ) as T;
  }
  throw new EditConflict(path);
}
