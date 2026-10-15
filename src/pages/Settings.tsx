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
  const { data, storageError, notify, updateSettings, replace, reset } =
    useStore();
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
    updateSettings({ name: name.trim(), timezone });
  }
  async function importFile(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      if (f.size > 20_000_000)
        throw new Error("El archivo supera el límite de 20 MB.");
      const parsed = parseBackup(await f.text());
      if (
        window.confirm(
          `Importar ${parsed.courses.length} cursos, ${parsed.tasks.length} tareas y ${parsed.events.length} actividades, ${parsed.topics.length} temas, ${parsed.plans.length} planes y ${parsed.studyLogs.length} registros de estudio. Esto reemplazará TODOS los datos y preferencias de este navegador. Exporta una copia antes. ¿Continuar?`,
        )
      ) {
        if (replace(parsed)) {
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
          <p>Pequeños ajustes para estudiar a tu manera.</p>
        </div>
        <span className="settings-mark">
          <ShieldCheck size={30} />
        </span>
      </div>
      <div className="storage-notice">
        <HardDrive size={24} />
        <div>
          <strong>Tu información vive en este navegador y dispositivo.</strong>
          <p>
            No se sincroniza automáticamente con otros. Borrar los datos del
            sitio o usar navegación privada puede eliminarla. Exporta copias de
            seguridad con frecuencia.
          </p>
        </div>
      </div>
      <StudyPreferences key={JSON.stringify(data.studyPreferences)} />
      <div className="settings-grid">
        <Card title="Perfil y zona horaria">
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
          <div className="theme-preview">
            <span />
            <span />
            <span />
            <div>
              <strong>Azul y celeste sobre beige</strong>
              <p>Morado y naranja como acento secundario.</p>
            </div>
          </div>
        </Card>
        <Card title="Copias de seguridad" className="backup-card">
          <p className="muted">
            Incluyen cursos, tareas, actividades, temarios, planes, sesiones,
            repasos, temporizador y preferencias. Formato JSON · Esquema 2.
            Compatible con copias de fase 1.
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
      <section className="reset-zone">
        <div>
          <h2>Volver a empezar</h2>
          <p>
            Elimina tus tareas, actividades, temarios, planes, sesiones, repasos
            y cursos personalizados. Restaura los once cursos iniciales y las
            preferencias predeterminadas.
          </p>
        </div>
        <button
          className="btn danger"
          onClick={() => {
            if (
              window.confirm(
                "¿Restablecer TODOS los datos de StudySpace en este navegador? Se eliminarán todas las tareas, actividades, temarios, planes, sesiones, repasos y personalizaciones. Exporta una copia antes. Esta acción no se puede deshacer.",
              )
            ) {
              if (reset()) {
                setName("Fabrizio");
                setTimezone("America/Lima");
              }
            }
          }}
        >
          <RotateCcw size={16} />
          Restablecer datos
        </button>
      </section>
      <p className="version-note">StudySpace 2.0</p>
    </div>
  );
}
