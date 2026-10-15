import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link2, UserPlus, RefreshCw, Copy } from "lucide-react";
import { useStore } from "../services/store";
import { useSharing } from "../services/sharing-context";
import {
  inviteCalendar,
  acceptCalendar,
  cancelCalendar,
  revokeCalendar,
} from "../services/sharing";
import type { Visibility } from "../models/schema";
import VisibilitySelect from "./VisibilitySelect";
import { Card } from "./ui";
const statusNames = {
  pending: "Pendiente de aceptación",
  accepted: "Aceptada",
  revoked: "Revocada",
  rejected: "Rechazada",
  expired: "Vencida",
};
export default function SharingSettings() {
  const { data, cloud, commit, notify, updateSettings } = useStore();
  const sharing = useSharing();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const ready = cloud.mode === "cloud" && !!cloud.user;
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await sharing.refresh();
      window.dispatchEvent(new Event("studyspace:calendar"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const activity = [
    ...data.tasks
      .filter((t) => !!t.dueDate)
      .map((t) => ({
        id: t.id,
        kind: "task",
        name: t.title,
        date: t.dueDate,
        visibility: t.visibility ?? "private",
      })),
    ...data.events.map((e) => ({
      id: e.id,
      kind: "event",
      name: e.title,
      date: e.date,
      visibility: e.visibility ?? "private",
    })),
    ...data.scheduledSessions
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        id: s.id,
        kind: "session",
        name: s.title,
        date: s.date,
        visibility: s.visibility ?? "private",
      })),
  ]
    .filter((a) =>
      a.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  function change(kind: string, id: string, visibility: Visibility) {
    commit((d) => {
      const list =
        kind === "task"
          ? d.tasks
          : kind === "event"
            ? d.events
            : d.scheduledSessions;
      const item = list.find((x) => x.id === id);
      if (item) item.visibility = visibility;
    }, "Visibilidad guardada; se aplicará al sincronizar la nube.");
  }
  const targeted = params.get("invitacion");
  return (
    <Card
      title="Calendario compartido"
      className="sharing-settings"
      action={<Link2 size={22} />}
    >
      <p className="muted">
        Dos cuentas independientes. La vinculación permite leer únicamente las
        actividades autorizadas; nunca editar las de la otra persona.
      </p>
      {!ready ? (
        <p className="sharing-notice">
          Inicia sesión y configura tu cuenta en Mi cuenta para invitar o
          aceptar. No hay un selector para entrar en la cuenta de otra persona.
        </p>
      ) : (
        <>
          {sharing.status.connection ? (
            <div className="linked-account">
              <span
                className={`owner-avatar accent-${sharing.status.connection.peerAccent}`}
              >
                {sharing.status.connection.peerName.slice(0, 1)}
              </span>
              <div>
                <strong>
                  Vinculado con {sharing.status.connection.peerName}
                </strong>
                <small>
                  {sharing.status.connection.peerEmail} · Lectura según la
                  visibilidad de cada actividad.
                </small>
              </div>
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "¿Revocar el calendario compartido para ambas cuentas? Cada uno conservará todas sus actividades personales.",
                    )
                  )
                    void run(async () => {
                      await revokeCalendar();
                    });
                }}
              >
                Revocar acceso
              </button>
            </div>
          ) : (
            <form
              className="sharing-invite-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const result = await inviteCalendar(email);
                  setInviteLink(
                    `${window.location.origin}${window.location.pathname}#/configuracion?invitacion=${result.id}`,
                  );
                  setEmail("");
                });
              }}
            >
              <label>
                Email de la persona invitada
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Escribe su email real"
                  autoComplete="off"
                />
              </label>
              <button
                className="btn primary"
                disabled={busy || !!sharing.error || sharing.loading}
              >
                <UserPlus size={15} />
                Crear invitación
              </button>
              <p className="form-help">
                No se envía un correo automáticamente. Comparte el enlace; la
                otra persona debe iniciar sesión con ese email, configurar su
                espacio y aceptar. Vence a los siete días.
              </p>
            </form>
          )}
          {inviteLink && (
            <div className="invitation-link">
              <label>
                Enlace de invitación
                <input
                  readOnly
                  value={inviteLink}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="btn soft"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink);
                    notify("Enlace copiado.");
                  } catch {
                    setError(
                      "Selecciona y copia el enlace que aparece en el campo.",
                    );
                  }
                }}
              >
                <Copy size={14} />
                Copiar enlace
              </button>
            </div>
          )}
          {targeted &&
            !sharing.loading &&
            !sharing.status.incoming.some((i) => i.id === targeted) &&
            !sharing.status.connection && (
              <p className="form-help">
                La invitación del enlace debe corresponder a tu email verificado
                y seguir vigente. Puedes actualizar la consulta.
              </p>
            )}
          {sharing.status.incoming.length > 0 && (
            <div className="incoming-invites">
              <h3>Invitaciones recibidas</h3>
              {sharing.status.incoming.map((i) => (
                <article key={i.id}>
                  <strong>
                    {i.fromName} ({i.fromEmail}) te invita a vincular
                    calendarios
                  </strong>
                  <p>
                    Solo se mostrarán las actividades que cada uno autorice. Tus
                    actividades actuales seguirán privadas.
                  </p>
                  <div className="integration-actions">
                    <button
                      className="btn primary"
                      disabled={busy || !!sharing.status.connection}
                      onClick={() =>
                        void run(async () => {
                          await acceptCalendar(i.id);
                        })
                      }
                    >
                      Aceptar invitación
                    </button>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await cancelCalendar(i.id);
                        })
                      }
                    >
                      Rechazar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {sharing.status.outgoing.length > 0 && (
            <details className="sharing-history">
              <summary>Estado de mis invitaciones</summary>
              {sharing.status.outgoing.map((i) => (
                <div className="invitation-row" key={i.id}>
                  <span>
                    {i.email}
                    <small>{statusNames[i.status]}</small>
                  </span>
                  {i.status === "pending" && (
                    <>
                      <button
                        className="text-btn"
                        onClick={() =>
                          setInviteLink(
                            `${window.location.origin}${window.location.pathname}#/configuracion?invitacion=${i.id}`,
                          )
                        }
                      >
                        Ver enlace
                      </button>
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await cancelCalendar(i.id);
                          })
                        }
                      >
                        Cancelar invitación
                      </button>
                    </>
                  )}
                </div>
              ))}
            </details>
          )}
          <div className="sharing-defaults">
            <VisibilitySelect
              label="Visibilidad predeterminada para actividades nuevas"
              value={data.settings.calendarDefaultVisibility ?? "private"}
              onChange={(v) => updateSettings({ calendarDefaultVisibility: v })}
            />
            <p className="form-help">
              Este cambio no publica las actividades existentes. Para las
              sesiones regeneradas de un plan existente se mantiene un criterio
              privado; revisa su visibilidad individual.
            </p>
            <label>
              Color de propietario
              <select
                value={data.settings.calendarAccent ?? "blue"}
                onChange={(e) =>
                  updateSettings({
                    calendarAccent: e.target.value as "blue" | "pink",
                  })
                }
              >
                <option value="blue">Azul / celeste</option>
                <option value="pink">Rosado / lila</option>
              </select>
            </label>
          </div>
          <details className="sharing-activities">
            <summary>
              Revisar visibilidad de mis actividades ({activity.length})
            </summary>
            <label>
              Buscar mis actividades
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Título de la actividad"
              />
            </label>
            {activity.slice(page * 30, (page + 1) * 30).map((a) => (
              <div className="visibility-row" key={`${a.kind}:${a.id}`}>
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {a.date} ·{" "}
                    {a.kind === "task"
                      ? "Tarea"
                      : a.kind === "session"
                        ? "Sesión / repaso"
                        : "Actividad"}
                  </small>
                </span>
                <select
                  aria-label={`Visibilidad de ${a.name}`}
                  value={a.visibility}
                  onChange={(e) =>
                    change(a.kind, a.id, e.target.value as Visibility)
                  }
                >
                  <option value="private">Privado</option>
                  <option value="busy">Solo disponibilidad</option>
                  <option value="details">Con detalles</option>
                </select>
              </div>
            ))}
            <div className="integration-actions">
              <button
                className="btn ghost"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                className="btn ghost"
                disabled={(page + 1) * 30 >= activity.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </details>
          <div className="integration-actions">
            <button
              className="btn soft"
              disabled={busy || sharing.loading}
              onClick={() => void run(async () => {})}
            >
              <RefreshCw size={14} />
              Actualizar vínculo
            </button>
          </div>
        </>
      )}
      {(error || sharing.error) && (
        <p className="integration-status" role="status">
          {error || sharing.error}
        </p>
      )}
      <p className="form-help">
        Actualización cada 30 segundos con la página visible y al recuperar el
        foco. Sin conexión se ocultan los datos compartidos.{" "}
        <a
          href="https://github.com/fabrizio-rda/studyspace/blob/main/docs/DOS-CUENTAS.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Configuración y privacidad
        </a>
        .
      </p>
    </Card>
  );
}
