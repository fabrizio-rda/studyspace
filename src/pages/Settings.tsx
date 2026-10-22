import { useFormStore } from "../services/form-store";
import SharingSettings from "../components/SharingSettings";
import Integrations from "../components/Integrations";
import StudyPreferences from "../components/StudyPreferences";
import { LEGACY_BACKUP_KEY } from "../services/storage";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  HardDrive,
  Info,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "../services/store";
import { validTimezone } from "../models/schema";
import { interfacePalette } from "../services/interface-palette";
import {
  downloadText,
  parseBackup,
  serializeBackup,
  STORAGE_KEY,
} from "../services/storage";
import { todayIn } from "../services/dates";
import { Card, CourseIcon } from "../components/ui";
import { useEditor } from "../components/AppContext";
export default function Settings() {
  const {
    data,
    cloud,
    localAccess,
    storageError,
    notify,
    updateSettings,
    replace,
    workspaceToken,
    reset,
  } = useStore();
  const activeWorkspace = useRef(workspaceToken);
  activeWorkspace.current = workspaceToken;
  const form = useFormStore();
  const open = useEditor();
  const [name, setName] = useState(data.settings.name);
  const [timezone, setTimezone] = useState(data.settings.timezone);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !validTimezone(timezone)) {
      setError(
        "Escribe un nombre y una zona horaria IANA válida, por ejemplo America/Lima.",
      );
      return;
    }
    setError("");
    form.commit((d) => {
      d.settings.name = name.trim();
      d.settings.timezone = timezone;
    }, "Preferencias guardadas");
  }
  async function importFile(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      if (f.size > 20_000_000)
        throw new Error("El archivo supera el límite de 20 MB.");
      const workspace = form.workspaceToken;
      const parsed = parseBackup(await f.text());
      if (workspace !== activeWorkspace.current)
        throw new Error("La cuenta cambió durante la lectura.");
      if (
        window.confirm(
          `Importar ${parsed.courses.length} cursos, ${parsed.tasks.length} tareas y ${parsed.events.length} actividades, ${parsed.topics.length} temas, ${parsed.plans.length} planes y ${parsed.studyLogs.length} registros de estudio. Esto reemplazará TODOS los datos del espacio activo (nube si has iniciado sesión). Las actividades importadas también aparecerán en el calendario conjunto. Exporta una copia antes. ¿Continuar?`,
        )
      ) {
        for (const item of [
          ...parsed.tasks,
          ...parsed.events,
          ...parsed.scheduledSessions,
        ])
          item.visibility = "details";
        parsed.settings.calendarDefaultVisibility = "details";
        if (replace(parsed, workspace)) {
          setName(parsed.settings.name);
          setTimezone(parsed.settings.timezone);
        }
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <h1>Configuración</h1>
          <p>Cuenta, estudio y copias de seguridad.</p>
        </div>
        <span className="settings-mark">
          <ShieldCheck size={30} />
        </span>
      </div>
      <nav
        className="settings-navigation"
        aria-label="Secciones de configuración"
      >
        <button
          className="btn soft"
          onClick={() =>
            document.getElementById("integraciones")?.scrollIntoView()
          }
        >
          Cuenta
        </button>
        <button
          className="btn soft"
          onClick={() => {
            const e = document.getElementById("estudio") as HTMLDetailsElement;
            e.open = true;
            e.scrollIntoView();
          }}
        >
          Estudio
        </button>
        <button
          className="btn soft"
          onClick={() => document.getElementById("perfil")?.scrollIntoView()}
        >
          Perfil
        </button>
        <button
          className="btn soft"
          onClick={() =>
            document.querySelector(".backup-card")?.scrollIntoView()
          }
        >
          Copias
        </button>
      </nav>
      <div className="storage-notice">
        <HardDrive size={24} />
        <div>
          <strong>
            {cloud.mode === "cloud"
              ? "Datos de tu cuenta y caché local."
              : "Tu información está en este navegador."}
          </strong>
          <p>
            {cloud.mode === "cloud"
              ? "Sin conexión puedes consultar la caché tras autenticarte en esta sesión. La edición requiere conexión. Exporta copias de seguridad."
              : "Conecta Supabase para utilizar el mismo espacio en otros dispositivos. Exporta copias para conservar tus datos locales."}
          </p>
        </div>
      </div>
      <Integrations />
      <SharingSettings />
      <details id="estudio">
        <summary>Disponibilidad, Pomodoro y repasos</summary>
        <StudyPreferences />
      </details>
      <div className="settings-grid" id="perfil">
        <Card title="Perfil y zona horaria" className="profile-settings">
          <form onSubmit={save} className="editor-form">
            <label>
              Nombre mostrado
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Zona horaria
              <input
                required
                list="timezones"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/Lima"
              />
              <datalist id="timezones">
                {[
                  "America/Lima",
                  "America/Bogota",
                  "America/Mexico_City",
                  "America/Santiago",
                  "America/Argentina/Buenos_Aires",
                  "America/New_York",
                  "Europe/Madrid",
                  "UTC",
                ].map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <p className="form-help">
              Las fechas de día completo se conservan tal como las ingresas. Las
              horas opcionales son horas del calendario; cambiar esta
              preferencia no convierte las horas de actividades existentes.
            </p>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <button type="submit" className="btn primary">
              Guardar preferencias
            </button>
          </form>
        </Card>
        <Card title="Visualización">
          <div className="setting-row">
            <div>
              <strong>Vista compacta</strong>
              <p>Menos espacio entre tareas y tarjetas.</p>
            </div>
            <input
              aria-label="Vista compacta"
              type="checkbox"
              className="switch"
              checked={data.settings.compact}
              onChange={(e) => updateSettings({ compact: e.target.checked })}
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Mostrar cursos archivados</strong>
              <p>Vuelve a encontrarlos en Mis cursos.</p>
            </div>
            <input
              aria-label="Mostrar cursos archivados"
              type="checkbox"
              className="switch"
              checked={data.settings.showArchived}
              onChange={(e) =>
                updateSettings({ showArchived: e.target.checked })
              }
            />
          </div>
          <fieldset className="interface-palettes">
            <legend>Paleta de la interfaz</legend>
            <p className="form-help">
              Se aplica a todas tus páginas y se guarda en tu cuenta.
            </p>
            <div className="palette-options">
              {(
                [
                  ["blue", "Azul y celeste"],
                  ["wine", "Vino y rosa suave"],
                ] as const
              ).map(([palette, label]) => (
                <button
                  key={palette}
                  type="button"
                  className={`palette-option palette-${palette}`}
                  aria-pressed={interfacePalette(data.settings) === palette}
                  onClick={() => updateSettings({ interfacePalette: palette })}
                >
                  <span className="palette-swatch" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </Card>
        <Card title="Copias de seguridad" className="backup-card">
          <p className="muted">
            Incluyen cursos, tareas, actividades, temarios, planes, sesiones,
            repasos, temporizador, Biblioteca y preferencias. Formato JSON ·
            Esquema 3. Compatible con copias de fases 1 y 2.
          </p>
          <div className="backup-stats">
            <span>
              <strong>{data.courses.length}</strong>Cursos
            </span>
            <span>
              <strong>{data.tasks.length}</strong>Tareas
            </span>
            <span>
              <strong>{data.events.length}</strong>Actividades
            </span>
          </div>
          <div className="backup-actions">
            <button
              className="btn primary"
              onClick={() => {
                downloadText(
                  serializeBackup(data),
                  `studyspace-${todayIn(data.settings.timezone)}.json`,
                );
                notify("Copia de seguridad exportada.");
              }}
            >
              <ArrowDownToLine size={17} />
              Exportar mis datos
            </button>
            <button
              className="btn soft"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              <ArrowUpFromLine size={17} />
              {busy ? "Validando…" : "Importar JSON"}
            </button>
            <input
              type="file"
              hidden
              accept=".json,application/json"
              ref={file}
              aria-label="Archivo de copia de seguridad"
              onChange={(e) => {
                void importFile(e.currentTarget);
              }}
            />
          </div>
          <button
            className="text-btn"
            disabled={!localAccess}
            onClick={() => {
              try {
                const raw = localStorage.getItem(LEGACY_BACKUP_KEY);
                if (raw) downloadText(raw, "studyspace-antes-de-fase2.json");
                else
                  notify(
                    "No hay una copia anterior a la fase 2 en este navegador.",
                  );
              } catch {
                notify("No se pudo leer la copia anterior.");
              }
            }}
          >
            Descargar copia anterior a fase 2 (si existe)
          </button>
          {storageError && (
            <button
              className="btn danger"
              onClick={() => {
                try {
                  downloadText(
                    localStorage.getItem(STORAGE_KEY) ?? "",
                    `studyspace-recuperacion-${Date.now()}.json`,
                  );
                } catch {
                  notify("El navegador no permite leer el almacenamiento.");
                }
              }}
            >
              Exportar datos originales para recuperación
            </button>
          )}
          <p className="form-help">
            <Info size={13} />
            Importar requiere confirmación y reemplaza la información actual.
            Los archivos inválidos se rechazan sin modificarla.
          </p>
        </Card>
        <Card title="Colores y cursos">
          <p className="muted">
            Selecciona un curso para cambiar su color, icono o descripción. El
            orden se ajusta con las flechas en Mis cursos.
          </p>
          <div className="settings-course-list">
            {[...data.courses]
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => open({ kind: "course", item: c })}
                >
                  <CourseIcon course={c} size={17} />
                  <span>{c.name}</span>
                  <span
                    className="course-dot"
                    style={{ background: c.color }}
                  />
                </button>
              ))}
          </div>
        </Card>
      </div>
      <details className="reset-advanced">
        <summary>Opciones avanzadas · restablecimiento</summary>
        <section className="reset-zone">
          <div>
            <h2>Volver a empezar</h2>
            <p>
              Elimina tus tareas, actividades, temarios, planes, sesiones,
              repasos, carpetas, referencias de documentos y Classroom y cursos
              personalizados. Restaura los cursos iniciales de tu perfil y las
              preferencias predeterminadas.
            </p>
          </div>
          <button
            className="btn danger"
            onClick={() => {
              if (
                window.confirm(
                  "¿Restablecer TODOS los datos del espacio activo de StudySpace? Si estás en modo nube, también reemplaza sus datos. Se eliminarán todas las tareas, actividades, temarios, planes, sesiones, repasos, carpetas, referencias de documentos, Classroom y personalizaciones. Exporta una copia antes. Esta acción no se puede deshacer.",
                )
              ) {
                if (reset()) {
                  setName(
                    cloud.mode === "cloud" ? data.settings.name : "Fabrizio",
                  );
                  setTimezone("America/Lima");
                }
              }
            }}
          >
            <RotateCcw size={16} />
            Restablecer datos
          </button>
        </section>
      </details>
      <p className="version-note">StudySpace 4</p>
    </div>
  );
}
