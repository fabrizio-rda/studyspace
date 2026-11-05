import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../services/store";
import { useGoogle } from "../services/google-context";
import { createDriveDocument } from "../services/google";
import {
  classNote,
  googleDocumentId,
  googleDocumentUrl,
  GOOGLE_DOC_MIME,
} from "../services/course-notes";
import { todayIn } from "../services/dates";
import type { Course, DocumentRef } from "../models/schema";

export default function CourseNotes({ course }: { course: Course }) {
  const { data, commit, workspaceToken } = useStore();
  const google = useGoogle();
  const active = useRef(workspaceToken);
  active.current = workspaceToken;
  const [mode, setMode] = useState<"create" | "link">("create");
  const [name, setName] = useState(`Apuntes de ${course.name}`);
  const [date, setDate] = useState(todayIn(data.settings.timezone));
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<DocumentRef | null>(null);
  const notes = data.documents
    .filter(
      (doc) =>
        doc.courseId === course.id &&
        (doc.mimeType === GOOGLE_DOC_MIME || !!googleDocumentId(doc.url)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const current = notes.find((doc) => doc.id === selected) ?? notes[0];
  const currentId = current && googleDocumentId(current.url);
  function attach(doc: DocumentRef, token: string) {
    let linkedId = doc.id;
    const ok = commit(
      (draft) => {
        if (!draft.courses.some((item) => item.id === course.id))
          throw new Error("El curso ya no existe.");
        const existing = draft.documents.find(
          (item) =>
            item.courseId === course.id &&
            googleDocumentId(item.url) === googleDocumentId(doc.url),
        );
        if (existing) {
          linkedId = existing.id;
          return;
        }
        draft.documents.push({ ...doc, courseId: course.id });
      },
      "Apuntes vinculados al curso",
      token,
    );
    if (ok) {
      setSelected(linkedId);
      setRecovery(null);
    } else
      setError(
        "No se pudo guardar el vínculo. El documento sigue en Google Drive; puedes abrirlo y volver a vincularlo.",
      );
    return ok;
  }
  return (
    <section className="course-notes" aria-label="Apuntes de clase">
      <div className="card">
        <h2>Apuntes de clase</h2>
        <p className="form-help">
          Un documento por clase o uno para todo el curso. El texto se guarda en
          Google Docs; aquí guardamos el vínculo a tu curso.
        </p>
        <div className="tabs" aria-label="Añadir apuntes">
          <button
            type="button"
            className={mode === "create" ? "active" : ""}
            aria-pressed={mode === "create"}
            onClick={() => setMode("create")}
          >
            Crear documento
          </button>
          <button
            type="button"
            className={mode === "link" ? "active" : ""}
            aria-pressed={mode === "link"}
            onClick={() => setMode("link")}
          >
            Usar documento existente
          </button>
        </div>
        <form
          className="class-notes-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            const token = workspaceToken;
            try {
              if (!name.trim())
                throw new Error("Escribe el título de la clase.");
              const title = `${date} · ${name.trim()}`;
              let doc: DocumentRef;
              if (mode === "create") {
                doc = {
                  ...(await createDriveDocument(title)),
                  courseId: course.id,
                  tags: ["apuntes-clase", date],
                };
                if (active.current !== token) return;
                setRecovery(doc);
              } else doc = classNote(title, url, course.id, date);
              if (active.current !== token) return;
              attach(doc, token);
            } catch (e) {
              if (active.current === token) setError((e as Error).message);
            } finally {
              if (active.current === token) setBusy(false);
            }
          }}
        >
          <label>
            Título de los apuntes
            <input
              required
              maxLength={275}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Fecha de la clase
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          {mode === "link" && (
            <label className="class-notes-url">
              Enlace de Google Docs
              <input
                type="url"
                required
                placeholder="https://docs.google.com/document/d/…/edit"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
          )}
          <button
            className="btn primary"
            disabled={
              busy || (mode === "create" && (!google.driveReady || !!recovery))
            }
          >
            {busy
              ? "Preparando…"
              : mode === "create"
                ? "Crear y escribir"
                : "Vincular y abrir"}
          </button>
        </form>
        {mode === "create" && !google.driveReady && (
          <div className="integration-actions">
            <button
              className="btn soft"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await google.connect("drive");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Conectar Google Drive
            </button>
            <Link className="text-btn" to="/configuracion">
              Configurar conexión con Google
            </Link>
            <p className="form-help">
              También puedes usar un documento existente pegando su enlace, sin
              configurar la API de Google.
            </p>
          </div>
        )}
        {recovery && (
          <p role="status">
            El documento se creó en Drive.{" "}
            <a href={recovery.url} target="_blank" rel="noopener noreferrer">
              Abrir documento creado
            </a>{" "}
            <button
              className="text-btn"
              onClick={() => attach(recovery, workspaceToken)}
            >
              Reintentar guardar vínculo
            </button>
          </p>
        )}
        {error && (
          <p className="integration-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {!!notes.length && (
        <div className="class-notes-workspace">
          <div
            className="card class-notes-list"
            aria-label="Documentos del curso"
          >
            {notes.map((doc) => (
              <button
                key={doc.id}
                className={current?.id === doc.id ? "active" : ""}
                aria-pressed={current?.id === doc.id}
                onClick={() => setSelected(doc.id)}
              >
                {doc.name}
              </button>
            ))}
          </div>
          {current && currentId && (
            <div className="card class-notes-editor">
              <div className="class-notes-heading">
                <h3>{current.name}</h3>
                <a
                  className="btn soft"
                  href={googleDocumentUrl(currentId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir en Google Docs
                </a>
              </div>
              <p className="form-help">
                Usa en Google la cuenta que tiene permiso de edición. Si el
                editor no carga o Google pide iniciar sesión fuera, abre el
                mismo documento con el botón de arriba. No necesitas hacerlo
                público.
              </p>
              <iframe
                key={currentId}
                src={`${googleDocumentUrl(currentId)}?embedded=true`}
                title={`Editar apuntes: ${current.name}`}
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-read; clipboard-write"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
