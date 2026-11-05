import type { DocumentRef } from "../models/schema";

export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
export function googleDocumentId(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "docs.google.com" ||
      url.username ||
      url.password
    )
      return null;
    return (
      url.pathname.match(
        /^\/document\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/|$)/,
      )?.[1] ?? null
    );
  } catch {
    return null;
  }
}
export function googleDocumentUrl(id: string) {
  if (!/^[\w-]+$/.test(id))
    throw new Error("Identificador de Google Docs inválido.");
  return `https://docs.google.com/document/d/${id}/edit`;
}
export function classNote(
  name: string,
  url: string,
  courseId: string,
  date: string,
): DocumentRef {
  const externalId = googleDocumentId(url);
  if (!externalId)
    throw new Error(
      "Pega un enlace de Google Docs: https://docs.google.com/document/d/…/edit",
    );
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    url: googleDocumentUrl(externalId),
    externalId,
    mimeType: GOOGLE_DOC_MIME,
    source: "manual",
    courseId,
    folderId: null,
    topicId: null,
    tags: ["apuntes-clase", date],
    createdAt: new Date().toISOString(),
  };
}
