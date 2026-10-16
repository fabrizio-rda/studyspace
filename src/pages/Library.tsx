import { useFormStore } from "../services/form-store";
import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Plus,
  Search,
  Grid2X2,
  List,
  MoreHorizontal,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  BookOpen,
  Archive,
} from "lucide-react";
import type { DocumentRef, LibraryFolder } from "../models/schema";
import { useStore } from "../services/store";
import {
  folderDescendants,
  removeFolder,
  safeLink,
  documentType,
} from "../services/library";
import { displayDate } from "../services/dates";
import { Modal, Empty } from "../components/ui";
import ColorPicker from "../components/ColorPicker";
import { useGoogle } from "../services/google-context";
const folderIcons = {
  folder: Folder,
  book: BookOpen,
  archive: Archive,
  file: FileText,
};
function DocIcon({ mime }: { mime: string }) {
  const Icon = mime.includes("spreadsheet")
    ? FileSpreadsheet
    : mime.includes("presentation")
      ? Presentation
      : mime.includes("document") || mime.includes("pdf")
        ? FileText
        : File;
  return <Icon size={29} />;
}
export default function Library() {
  const { data, commit, workspaceToken } = useStore();
  const google = useGoogle();
  const [params, setParams] = useSearchParams();
  const folderId = params.get("carpeta");
  const selected = params.get("documento");
  const current = data.folders.find((f) => f.id === folderId);
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState("");
  const [sort, setSort] = useState("date");
  const [view, setView] = useState("grid");
  const [folderEditor, setFolderEditor] = useState<
    LibraryFolder | null | false
  >(false);
  const [docEditor, setDocEditor] = useState<DocumentRef | null | false>(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const crumbs: LibraryFolder[] = [];
  let cursor = current;
  const seen = new Set();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    crumbs.unshift(cursor);
    cursor = data.folders.find((f) => f.id === cursor?.parentId);
  }
  const q = query.trim().toLocaleLowerCase();
  const searching = !!q || !!course;
  const folders = data.folders
    .filter(
      (f) =>
        (searching || f.parentId === (folderId || null)) &&
        (!course || f.courseId === course) &&
        (!q || f.name.toLocaleLowerCase().includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const documents = data.documents
    .filter(
      (d) =>
        (searching || d.folderId === (folderId || null)) &&
        (!course || d.courseId === course) &&
        (!q ||
          `${d.name} ${d.tags.join(" ")} ${data.topics.find((t) => t.id === d.topicId)?.name ?? ""}`
            .toLocaleLowerCase()
            .includes(q)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.createdAt.localeCompare(a.createdAt),
    );
  const detail = data.documents.find((d) => d.id === selected);
  function openFolder(id: string | null) {
    setParams(id ? { carpeta: id } : {});
    setQuery("");
    setCourse("");
  }
  async function pick() {
    setBusy(true);
    setError("");
    try {
      const docs = await google.pick();
      commit(
        (d) => {
          for (const doc of docs) {
            if (
              !d.documents.some(
                (x) => x.source === "drive" && x.externalId === doc.externalId,
              )
            )
              d.documents.push({
                ...doc,
                folderId: folderId || null,
                courseId: course || current?.courseId || null,
              });
          }
        },
        "Referencias añadidas",
        workspaceToken,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <h1>Biblioteca</h1>
          <p>Documentos y materiales de tus cursos.</p>
        </div>
        <div className="library-add">
          <button className="btn soft" onClick={() => setFolderEditor(null)}>
            <Folder size={16} />
            Nueva carpeta
          </button>
          <button className="btn primary" onClick={() => setDocEditor(null)}>
            <Plus size={16} />
            Añadir documento
          </button>
        </div>
      </div>
      <div className="library-summary">
        <span>
          <FolderOpen size={23} /> {data.folders.length} carpetas
        </span>
        <span>
          <FileText size={23} /> {data.documents.length} documentos
        </span>
        <button
          className="text-btn"
          onClick={() => void pick()}
          disabled={busy || !google.driveReady}
        >
          {busy ? "Abriendo…" : "Seleccionar de Drive"}
        </button>
        {!google.driveReady && (
          <Link to="/configuracion#integraciones">Configurar Drive</Link>
        )}
      </div>
      <nav aria-label="Ruta de biblioteca" className="library-crumbs">
        <button onClick={() => openFolder(null)}>Biblioteca</button>
        {crumbs.map((f) => (
          <span key={f.id}>
            <ChevronRight size={14} />
            <button
              aria-current={f.id === folderId ? "page" : undefined}
              onClick={() => openFolder(f.id)}
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>
      <div className="library-toolbar">
        <label className="input-with-icon">
          <Search size={17} />
          <input
            aria-label="Buscar materiales"
            placeholder="Buscar nombre, tema o etiqueta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar biblioteca por curso"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">Todos los cursos</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Ordenar documentos"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date">Más recientes</option>
          <option value="name">Nombre</option>
        </select>
        <div className="tabs">
          <button
            aria-label="Vista de cuadrícula"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={18} />
          </button>
          <button
            aria-label="Vista de lista"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {folderId && !current && (
        <p>
          Esta carpeta ya no existe.{" "}
          <button onClick={() => openFolder(null)}>Volver a Biblioteca</button>
        </p>
      )}
      {current && (
        <button
          className="text-btn"
          onClick={() => openFolder(current.parentId)}
        >
          <ArrowLeft size={14} />
          Volver
        </button>
      )}
      {folders.length > 0 && (
        <>
          <h2 className="library-section-title">Carpetas</h2>
          <div
            className={`library-folders ${view === "list" ? "list-view" : ""}`}
          >
            {folders.map((f) => {
              const Icon = folderIcons[f.icon];
              return (
                <article
                  className="folder-tile"
                  key={f.id}
                  style={{ borderColor: `${f.color}80` }}
                >
                  <button
                    className="folder-open"
                    onClick={() => openFolder(f.id)}
                  >
                    <span
                      style={{ background: `${f.color}38`, color: f.color }}
                    >
                      <Icon size={30} />
                    </span>
                    <strong>{f.name}</strong>
                    <small>
                      {data.documents.filter((d) => d.folderId === f.id).length}{" "}
                      documentos ·{" "}
                      {data.courses.find((c) => c.id === f.courseId)?.name ??
                        "Sin curso"}
                    </small>
                  </button>
                  <details className="context-menu">
                    <summary aria-label={`Acciones de carpeta ${f.name}`}>
                      <MoreHorizontal size={18} />
                    </summary>
                    <div>
                      <button onClick={() => setFolderEditor(f)}>
                        Editar o mover carpeta
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar «${f.name}» y sus subcarpetas? Los documentos se conservarán en la raíz. Sus originales no se modifican.`,
                            )
                          )
                            commit(
                              (d) => removeFolder(d, f.id),
                              "Carpeta eliminada",
                            );
                        }}
                      >
                        Eliminar carpeta
                      </button>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      )}
      <h2 className="library-section-title">
        {searching ? "Resultados de documentos" : "Documentos"}
        <small>{documents.length}</small>
      </h2>
      {documents.length ? (
        <div
          className={`library-documents ${view === "list" ? "list-view" : ""}`}
        >
          {documents.map((doc) => {
            const c = data.courses.find((c) => c.id === doc.courseId);
            return (
              <article
                key={doc.id}
                className="document-tile"
                style={{ borderTopColor: c?.color ?? "#B3DFF5" }}
              >
                <div className="document-type">
                  <DocIcon mime={doc.mimeType} />
                  <span>{documentType(doc.mimeType)}</span>
                  <details className="context-menu">
                    <summary aria-label={`Acciones de ${doc.name}`}>
                      <MoreHorizontal size={18} />
                    </summary>
                    <div>
                      <button onClick={() => setDocEditor(doc)}>
                        Editar / mover referencia
                      </button>
                      <button
                        onClick={() =>
                          setParams({
                            ...Object.fromEntries(params),
                            documento: doc.id,
                          })
                        }
                      >
                        Ver detalles
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar la referencia «${doc.name}»? El documento original se conserva.`,
                            )
                          )
                            commit((d) => {
                              d.documents = d.documents.filter(
                                (x) => x.id !== doc.id,
                              );
                            }, "Referencia eliminada");
                        }}
                      >
                        Eliminar referencia
                      </button>
                    </div>
                  </details>
                </div>
                <a
                  className="document-name"
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {doc.name}
                  <ExternalLink size={14} />
                </a>
                <span className="document-course">
                  <i style={{ background: c?.color ?? "#ccc" }} />
                  {c?.name ?? "Sin curso"}
                </span>
                {doc.tags.length > 0 && (
                  <div className="document-tags">
                    {doc.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                )}
                <small>
                  {displayDate(doc.createdAt.slice(0, 10))} ·{" "}
                  {doc.source === "manual"
                    ? "Enlace"
                    : doc.source === "drive"
                      ? "Google Drive"
                      : "Classroom"}
                </small>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            searching ? "Sin coincidencias" : "Todavía no hay documentos aquí"
          }
          description={
            searching
              ? "Prueba otro nombre, curso o etiqueta."
              : "Añade un enlace o selecciona archivos de Drive. Las carpetas son virtuales."
          }
          action={
            <button className="btn soft" onClick={() => setDocEditor(null)}>
              Añadir enlace
            </button>
          }
        />
      )}
      {folderEditor !== false && (
        <FolderEditor
          item={folderEditor ?? undefined}
          parentId={folderId}
          onClose={() => setFolderEditor(false)}
        />
      )}
      {docEditor !== false && (
        <DocumentEditor
          item={docEditor ?? undefined}
          folderId={folderId}
          courseId={course || current?.courseId || null}
          onClose={() => setDocEditor(false)}
        />
      )}
      {detail && (
        <Modal
          title={detail.name}
          onClose={() => {
            const p = new URLSearchParams(params);
            p.delete("documento");
            setParams(p);
          }}
        >
          <p>
            {documentType(detail.mimeType)} · {detail.source}
          </p>
          <p>{data.topics.find((t) => t.id === detail.topicId)?.name}</p>
          <p className="form-help">
            Se abrirá el original con los permisos de tu cuenta. StudySpace no
            almacena su contenido.
          </p>
          <a
            className="btn primary"
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir documento <ExternalLink size={16} />
          </a>
          <button
            className="btn soft"
            onClick={() => {
              setDocEditor(detail);
              const p = new URLSearchParams(params);
              p.delete("documento");
              setParams(p);
            }}
          >
            Editar referencia
          </button>
        </Modal>
      )}
      <p className="form-help">
        Mover o eliminar referencias aquí no modifica archivos de Drive.
      </p>
    </div>
  );
}
function FolderEditor({
  item,
  parentId,
  onClose,
}: {
  item?: LibraryFolder;
  parentId: string | null;
  onClose: () => void;
}) {
  const { data, commit } = useFormStore();
  const [name, setName] = useState(item?.name ?? "");
  const [parent, setParent] = useState(item?.parentId ?? parentId ?? "");
  const [course, setCourse] = useState(
    item?.courseId ??
      data.folders.find((f) => f.id === parentId)?.courseId ??
      "",
  );
  const [icon, setIcon] = useState<LibraryFolder["icon"]>(
    item?.icon ?? "folder",
  );
  const [color, setColor] = useState(item?.color ?? "#83A8EB");
  const blocked = item ? folderDescendants(data, item.id) : new Set();
  function save(e: FormEvent) {
    e.preventDefault();
    if (
      commit((d) => {
        const f: LibraryFolder = {
          id: item?.id ?? crypto.randomUUID(),
          name: name.trim(),
          parentId: parent || null,
          courseId: course || null,
          icon,
          color,
          createdAt: item?.createdAt ?? new Date().toISOString(),
        };
        const i = d.folders.findIndex((x) => x.id === f.id);
        if (i < 0) d.folders.push(f);
        else d.folders[i] = f;
      }, "Carpeta guardada")
    )
      onClose();
  }
  return (
    <Modal title={item ? "Editar carpeta" : "Nueva carpeta"} onClose={onClose}>
      <form className="editor-form" onSubmit={save}>
        <label>
          Nombre de carpeta
          <input
            required
            autoFocus
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Ubicación
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Biblioteca (raíz)</option>
            {data.folders
              .filter((f) => !blocked.has(f.id))
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Curso de carpeta
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Sin curso</option>
            {data.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Icono de carpeta
          <select
            value={icon}
            onChange={(e) => setIcon(e.target.value as LibraryFolder["icon"])}
          >
            <option value="folder">Carpeta</option>
            <option value="book">Libro</option>
            <option value="archive">Archivo</option>
            <option value="file">Documento</option>
          </select>
        </label>
        <ColorPicker value={color} onChange={setColor} />
        <p className="form-help">
          Cambiar el curso de la carpeta no cambia el curso de los documentos
          que contiene.
        </p>
        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary">Guardar carpeta</button>
        </div>
      </form>
    </Modal>
  );
}
function DocumentEditor({
  item,
  folderId,
  courseId,
  onClose,
}: {
  item?: DocumentRef;
  folderId: string | null;
  courseId: string | null;
  onClose: () => void;
}) {
  const { data, commit } = useFormStore();
  const [name, setName] = useState(item?.name ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [folder, setFolder] = useState(item?.folderId ?? folderId ?? "");
  const [course, setCourse] = useState(item?.courseId ?? courseId ?? "");
  const [topic, setTopic] = useState(item?.topicId ?? "");
  const [tags, setTags] = useState(item?.tags.join(", ") ?? "");
  const [mime, setMime] = useState(item?.mimeType ?? "text/uri-list");
  const [error, setError] = useState("");
  function save(e: FormEvent) {
    e.preventDefault();
    const valid = safeLink(url);
    if (!valid) {
      setError("Utiliza un enlace https:// o http:// válido.");
      return;
    }
    if (
      commit((d) => {
        const doc: DocumentRef = {
          id: item?.id ?? crypto.randomUUID(),
          name: name.trim(),
          url: valid,
          source: item?.source ?? "manual",
          externalId: item?.externalId ?? null,
          mimeType: mime,
          folderId: folder || null,
          courseId: course || null,
          topicId: topic || null,
          tags: [
            ...new Set(
              tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            ),
          ],
          createdAt: item?.createdAt ?? new Date().toISOString(),
        };
        const i = d.documents.findIndex((x) => x.id === doc.id);
        if (i < 0) d.documents.push(doc);
        else d.documents[i] = doc;
      }, "Documento guardado")
    )
      onClose();
  }
  return (
    <Modal
      title={item ? "Editar documento" : "Añadir documento"}
      onClose={onClose}
    >
      <form className="editor-form" onSubmit={save}>
        <label>
          Nombre del documento
          <input
            required
            maxLength={300}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Enlace original
          <input
            type="url"
            required
            maxLength={4000}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="form-grid">
          <label>
            Carpeta
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">Biblioteca (raíz)</option>
              {data.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Curso del documento
            <select
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                setTopic("");
              }}
            >
              <option value="">Sin curso</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tema del documento
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Sin tema</option>
              {data.topics
                .filter(
                  (t) =>
                    data.units.find((u) => u.id === t.unitId)?.courseId ===
                    (course || null),
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tipo de documento
            <select value={mime} onChange={(e) => setMime(e.target.value)}>
              <option value="text/uri-list">Enlace / otro archivo</option>
              <option value="application/vnd.google-apps.document">
                Google Docs
              </option>
              <option value="application/vnd.google-apps.spreadsheet">
                Google Sheets
              </option>
              <option value="application/vnd.google-apps.presentation">
                Google Slides
              </option>
              <option value="application/pdf">PDF</option>
              {item &&
                ![
                  "text/uri-list",
                  "application/vnd.google-apps.document",
                  "application/vnd.google-apps.spreadsheet",
                  "application/vnd.google-apps.presentation",
                  "application/pdf",
                ].includes(item.mimeType) && (
                  <option value={item.mimeType}>{item.mimeType}</option>
                )}
            </select>
          </label>
        </div>
        <label>
          Etiquetas (separadas por comas)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            maxLength={1000}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary">Guardar documento</button>
        </div>
      </form>
    </Modal>
  );
}
