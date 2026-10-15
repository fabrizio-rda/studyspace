import type { AppState, DocumentRef } from "../models/schema";
export function folderDescendants(data: AppState, id: string) {
  const found = new Set([id]);
  let size = 0;
  while (size !== found.size) {
    size = found.size;
    for (const f of data.folders)
      if (f.parentId && found.has(f.parentId)) found.add(f.id);
  }
  return found;
}
export function removeFolder(data: AppState, id: string) {
  const ids = folderDescendants(data, id);
  data.folders = data.folders.filter((f) => !ids.has(f.id));
  for (const doc of data.documents)
    if (doc.folderId && ids.has(doc.folderId)) doc.folderId = null;
}
export function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function addDocument(data: AppState, doc: DocumentRef) {
  const previous =
    doc.externalId &&
    data.documents.find(
      (d) => d.source === doc.source && d.externalId === doc.externalId,
    );
  if (previous) return false;
  data.documents.push(doc);
  return true;
}
export function documentType(mime: string) {
  if (mime.includes("document")) return "Documento";
  if (mime.includes("spreadsheet")) return "Hoja de cálculo";
  if (mime.includes("presentation")) return "Presentación";
  if (mime.includes("pdf")) return "PDF";
  return "Enlace / archivo";
}
