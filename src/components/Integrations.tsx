import AccountSignIn from "./AccountSignIn";
import AccountSetup from "./AccountSetup";
import { blankAccount } from "../services/accounts";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Cloud,
  FolderOpen,
  GraduationCap,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import { useStore } from "../services/store";
import { useGoogle } from "../services/google-context";
import { loadConfig, saveConfig } from "../services/config";
import {
  loadState,
  serializeBackup,
  downloadText,
  STORAGE_KEY,
  PHASE3_BACKUP_KEY,
} from "../services/storage";
import { recordCounts } from "../services/cloud";
import {
  fetchClassroomCourses,
  fetchCourseWork,
  mergeClassroom,
} from "../services/classroom";
import type { ClassroomCourse } from "../services/classroom";
import { Card, Modal } from "./ui";
const guide =
  "https://github.com/fabrizio-rda/studyspace/blob/main/docs/CONFIGURACION.md";
const syncNames = {
  local: "Solo en este navegador",
  loading: "Consultando nube…",
  synced: "Sincronizado",
  saving: "Guardando en la nube…",
  pending: "Cambios pendientes",
  offline: "Sin conexión · consulta",
  conflict: "Cambios en otro dispositivo",
  error: "Sincronización detenida",
};
export function SyncIndicator() {
  const { cloud } = useStore();
  return (
    <span
      className={`sync-indicator sync-${cloud.status}`}
      title={cloud.error || syncNames[cloud.status]}
    >
      <i />
      {syncNames[cloud.status]}
    </span>
  );
}
export default function Integrations() {
  const store = useStore();
  const { data, cloud, notify, commit } = store;
  const google = useGoogle();
  const [config, setConfig] = useState(loadConfig);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [migration, setMigration] = useState(false);
  const [courses, setCourses] = useState<ClassroomCourse[] | null>(null);
  const [report, setReport] = useState<{
    added: number;
    updated: number;
    errors: string[];
  } | null>(null);
  async function run(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const local = store.localAccess
    ? loadState()
    : {
        data: blankAccount(),
        error:
          "La copia local está asociada a otra cuenta. No se mostrará ni se importará aquí.",
      };
  const counts = recordCounts(local.data);
  const labels: Record<string, string> = {
    courses: "Cursos",
    tasks: "Tareas",
    events: "Actividades",
    units: "Unidades",
    topics: "Temas",
    plans: "Planes",
    scheduledSessions: "Sesiones programadas",
    studyLogs: "Registros de estudio",
    reviewHistory: "Repasos",
    folders: "Carpetas",
    documents: "Documentos",
    classroomLinks: "Cursos Classroom",
    classroomItems: "Actividades Classroom",
  };
  async function syncClassroom() {
    let added = 0,
      updated = 0;
    const errors: string[] = [];
    const workspace = store.workspaceToken;
    const results: {
      id: string;
      items: Awaited<ReturnType<typeof fetchCourseWork>>;
    }[] = [];
    for (const link of data.classroomLinks.filter((l) => l.courseId)) {
      try {
        results.push({
          id: link.externalCourseId,
          items: await fetchCourseWork(link.externalCourseId),
        });
      } catch (e) {
        errors.push(`${link.externalName}: ${(e as Error).message}`);
      }
    }
    if (results.length) {
      const ok = commit(
        (d) => {
          for (const r of results) {
            const n = mergeClassroom(d, r.id, r.items);
            added += n.added;
            updated += n.updated;
          }
          d.integrationPreferences.lastClassroomSync = new Date().toISOString();
        },
        "Classroom actualizado",
        workspace,
      );
      if (!ok)
        throw new Error("No se guardó la importación. Vuelve a intentar.");
    }
    setReport({ added, updated, errors });
  }
  function save(e: FormEvent) {
    e.preventDefault();
    try {
      if (cloud.user)
        throw new Error(
          "Cierra sesión antes de cambiar el proyecto conectado.",
        );
      saveConfig(config);
      notify("Configuración pública guardada.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="integrations-section" id="integraciones">
      <div className="section-title">
        <h2>Cuenta e integraciones</h2>
        <SyncIndicator />
      </div>
      <div className="integrations-grid">
        <Card title="Mi cuenta" action={<Cloud size={23} />}>
          <p className="muted">
            {cloud.user
              ? cloud.user.email
              : "Inicia sesión para acceder al mismo espacio desde otros dispositivos."}
          </p>
          <AccountSetup />
          {cloud.user ? (
            <>
              <p>
                <strong>
                  {cloud.mode === "cloud"
                    ? "Espacio en la nube"
                    : "Cuenta nueva · configuración pendiente"}
                </strong>
              </p>
              <div className="integration-actions">
                <button
                  className="btn soft"
                  disabled={!!busy}
                  onClick={() => void run("sync", store.syncNow)}
                >
                  <RefreshCw size={14} />
                  Sincronizar ahora
                </button>
                <button
                  className="btn ghost"
                  disabled={!!busy}
                  onClick={() => void run("logout", store.signOut)}
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
              <p className="form-help">
                La sesión se conserva en este navegador para que puedas volver a entrar sin solicitar otro correo. Cierra sesión en dispositivos compartidos.
              </p>
            </>
          ) : (
            <AccountSignIn key={config.supabaseUrl + config.supabaseKey} />
          )}
          {cloud.error && (
            <p role="status" className="integration-status">
              {cloud.error}
            </p>
          )}
          {cloud.mode === "cloud" &&
            ["conflict", "error", "offline"].includes(cloud.status) && (
              <div className="integration-actions">
                <button
                  className="btn soft"
                  onClick={() =>
                    downloadText(
                      serializeBackup(data),
                      "studyspace-cambios-sin-sincronizar.json",
                    )
                  }
                >
                  Exportar mis cambios
                </button>
                <button
                  className="btn soft"
                  disabled={!!busy}
                  onClick={() => {
                    if (
                      confirm(
                        "¿Cargar la versión actual de la nube? Los cambios pendientes de esta caché serán reemplazados. Exporta una copia antes.",
                      )
                    )
                      void run("remote", store.useRemote);
                  }}
                >
                  Cargar versión de la nube
                </button>
              </div>
            )}
        </Card>
        <Card title="Google Drive" action={<FolderOpen size={23} />}>
          <span
            className={`integration-badge ${google.driveReady ? "connected" : ""}`}
          >
            {google.driveReady ? "Autorizado en esta sesión" : "Sin conectar"}
          </span>
          <p className="muted">
            Selecciona archivos concretos con Google Picker. Solo guardamos
            referencias.
          </p>
          <div className="integration-actions">
            <button
              className="btn primary"
              disabled={!!busy || !google.loaded}
              onClick={() => void run("drive", () => google.connect("drive"))}
            >
              {google.driveReady ? "Renovar autorización" : "Conectar Drive"}
            </button>
            {google.driveReady && (
              <button
                className="btn ghost"
                disabled={!!busy}
                onClick={() =>
                  void run("disconnect", () => google.disconnect("drive"))
                }
              >
                Desconectar Google
              </button>
            )}
          </div>
          <p className="form-help">
            Permiso: drive.file. Después de conectar, selecciona documentos en
            Biblioteca. No se mueven ni eliminan originales.
          </p>
        </Card>
        <Card title="Google Classroom" action={<GraduationCap size={23} />}>
          <span
            className={`integration-badge ${google.classroomReady ? "connected" : ""}`}
          >
            {google.classroomReady
              ? "Autorizado · solo lectura"
              : "Sin conectar"}
          </span>
          <p className="muted">
            Vincula cursos existentes e importa sus tareas sin duplicados.
          </p>
          <div className="integration-actions">
            <button
              className="btn primary"
              disabled={!!busy || !google.loaded}
              onClick={() =>
                void run("classroom", () => google.connect("classroom"))
              }
            >
              {google.classroomReady
                ? "Renovar autorización"
                : "Conectar Classroom"}
            </button>
            <button
              className="btn soft"
              disabled={!!busy || !google.classroomReady}
              onClick={() =>
                void run("courses", async () =>
                  setCourses(await fetchClassroomCourses()),
                )
              }
            >
              Seleccionar cursos
            </button>
            <button
              className="btn soft"
              disabled={
                !!busy ||
                !google.classroomReady ||
                !data.classroomLinks.some((l) => l.courseId)
              }
              onClick={() => void run("classroom-sync", syncClassroom)}
            >
              <RefreshCw size={14} />
              Sincronizar ahora
            </button>
            {google.classroomReady && (
              <button
                className="btn ghost"
                disabled={!!busy}
                onClick={() =>
                  void run("disconnect", () => google.disconnect("classroom"))
                }
              >
                Desconectar Google
              </button>
            )}
          </div>
          <p className="form-help">
            Última sincronización:{" "}
            {data.integrationPreferences.lastClassroomSync
              ? new Date(
                  data.integrationPreferences.lastClassroomSync,
                ).toLocaleString("es-PE", { timeZone: data.settings.timezone })
              : "todavía no realizada"}
            . Solo se consultan los cursos seleccionados. La cuenta escolar
            puede requerir autorización institucional.
          </p>
          {data.classroomLinks.length > 0 && (
            <ul className="classroom-mappings">
              {data.classroomLinks.map((l) => (
                <li key={l.id}>
                  {l.externalName} →{" "}
                  {data.courses.find((c) => c.id === l.courseId)?.name ??
                    "Curso eliminado: vuelve a vincular"}
                </li>
              ))}
            </ul>
          )}
          {report && (
            <div className="sync-report" role="status">
              {report.added} nuevas · {report.updated} actualizadas ·{" "}
              {report.errors.length} errores
              {report.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
        </Card>
        <Card title="Mis datos" action={<CheckCircle2 size={23} />}>
          <p className="muted">
            Importa los datos de este navegador a una cuenta vacía. El asistente
            conserva los identificadores y comprueba la información guardada.
          </p>
          <button className="btn soft" onClick={() => setMigration(true)}>
            Revisar datos locales y migrar
          </button>
          <p className="form-help">
            En modo nube se conserva una caché por cuenta. Sin conexión permite
            consulta; la edición necesita conexión. Los guardados pendientes se
            conservan para reintentar con su revisión original.
          </p>
          {cloud.verifiedCounts && (
            <p className="integration-status">
              Datos de nube verificados:{" "}
              {Object.entries(cloud.verifiedCounts)
                .map(([k, v]) => `${v} ${labels[k] ?? k}`)
                .join(" · ")}
              .
            </p>
          )}
        </Card>
      </div>
      {google.error && (
        <p className="integration-error" role="alert">{google.error}</p>
      )}
      {error && cloud.user && (
        <p className="integration-error" role="alert">{error}</p>
      )}
      <details className="integration-setup">
        <summary>Configurar servicios externos</summary>
        <p>
          Completa la configuración en el navegador siguiendo la{" "}
          <a href={guide} target="_blank" rel="noopener noreferrer">
            guía paso a paso <ExternalLink size={13} />
          </a>
          . Estos campos contienen identificadores públicos; nunca pegues una
          contraseña, client secret o service_role.
        </p>
        <form className="editor-form" onSubmit={save}>
          <div className="form-grid">
            {(
              [
                ["supabaseUrl", "URL del proyecto Supabase"],
                ["supabaseKey", "Clave pública publishable / anon"],
                ["googleClientId", "Client ID OAuth de Google"],
                ["googleApiKey", "API key pública de Picker"],
                ["googleAppId", "Número de proyecto Google"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={config[key]}
                  disabled={!!cloud.user}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: e.target.value.trim() })
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            ))}
          </div>
          <button className="btn soft" disabled={!!cloud.user}>
            Guardar configuración pública
          </button>
          <p className="form-help">
            La configuración se guarda solo en este navegador. Repite estos
            campos en el otro dispositivo. Desconectar Google revoca el permiso
            del mismo Client ID y desconecta ambas integraciones; las
            referencias se conservan.
          </p>
        </form>
      </details>
      {migration && (
        <Modal
          title="Migrar datos locales"
          wide
          onClose={() => setMigration(false)}
        >
          <p>
            Vista previa de la información que existe en este navegador. No se
            borra al importarla.
          </p>
          {local.error ? (
            <p role="alert">{local.error}</p>
          ) : (
            <div className="migration-counts">
              {Object.entries(counts).map(([k, v]) => (
                <span key={k}>
                  <strong>{v}</strong>
                  {labels[k] ?? k}
                </span>
              ))}
            </div>
          )}
          <ol>
            <li>Exporta una copia JSON antes de continuar.</li>
            <li>Inicia sesión en Mi cuenta.</li>
            <li>
              Importa a una cuenta vacía. No se combina automáticamente con una
              nube que ya tenga datos.
            </li>
            <li>
              Comprueba el resultado y abre la misma cuenta en el otro
              dispositivo.
            </li>
          </ol>
          <div className="integration-actions">
            <button
              className="btn soft"
              disabled={!!local.error || !store.localAccess}
              onClick={() =>
                downloadText(
                  localStorage.getItem(STORAGE_KEY) ??
                    serializeBackup(local.data),
                  "studyspace-local-antes-de-migrar.json",
                )
              }
            >
              Exportar copia local
            </button>
            <button
              className="btn soft"
              disabled={!store.localAccess}
              onClick={() => {
                const raw = localStorage.getItem(PHASE3_BACKUP_KEY);
                if (raw) downloadText(raw, "studyspace-antes-de-fase3.json");
                else notify("No hay respaldo anterior en este navegador.");
              }}
            >
              Descargar respaldo anterior
            </button>
            <button
              className="btn primary"
              disabled={
                !!local.error || !cloud.user || cloud.mode === "cloud" || !!busy
              }
              onClick={() => void run("migrate", store.migrateLocal)}
            >
              {busy === "migrate"
                ? "Importando y verificando…"
                : "Importar a mi cuenta"}
            </button>
          </div>
          {cloud.verifiedCounts && (
            <p role="status">
              Los datos de la cuenta se verificaron. La copia local se conserva.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
      {courses && (
        <ClassroomMapping courses={courses} onClose={() => setCourses(null)} />
      )}
    </section>
  );
}
function ClassroomMapping({
  courses,
  onClose,
}: {
  courses: ClassroomCourse[];
  onClose: () => void;
}) {
  const { data, commit } = useStore();
  const [mapping, setMapping] = useState<Record<string, string>>(
    Object.fromEntries(
      data.classroomLinks.map((l) => [l.externalCourseId, l.courseId ?? ""]),
    ),
  );
  return (
    <Modal title="Seleccionar cursos de Classroom" wide onClose={onClose}>
      <p>
        Vincula solo los cursos que quieras consultar. Tus cursos de StudySpace
        conservan su nombre.
      </p>
      {courses.length ? (
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              commit((d) => {
                d.classroomLinks = courses
                  .filter((c) => mapping[c.id])
                  .map((c) => ({
                    id:
                      d.classroomLinks.find((l) => l.externalCourseId === c.id)
                        ?.id ?? crypto.randomUUID(),
                    externalCourseId: c.id,
                    externalName: c.name.slice(0, 300),
                    courseId: mapping[c.id],
                  }));
              }, "Cursos vinculados")
            )
              onClose();
          }}
        >
          {courses.map((c) => (
            <label key={c.id}>
              {c.name}
              <select
                value={mapping[c.id] ?? ""}
                onChange={(e) =>
                  setMapping({ ...mapping, [c.id]: e.target.value })
                }
              >
                <option value="">No sincronizar este curso</option>
                {data.courses.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="modal-footer">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn primary">Guardar vínculos</button>
          </div>
        </form>
      ) : (
        <p>No hay cursos activos accesibles para esta cuenta.</p>
      )}
    </Modal>
  );
}
