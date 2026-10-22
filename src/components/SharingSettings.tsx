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
import { Card } from "./ui";
const statusNames = {
  pending: "Pendiente de aceptación",
  accepted: "Aceptada",
  revoked: "Revocada",
  rejected: "Rechazada",
  expired: "Vencida",
};
export default function SharingSettings() {
  const { data, cloud, updateSettings, notify } = useStore();
  const sharing = useSharing();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
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
  const targeted = params.get("invitacion");
  return (
    <Card
      title="Calendario compartido"
      className="sharing-settings"
      action={<Link2 size={22} />}
    >
      <p className="muted">
        Cada cuenta conserva sus datos. Al vincularlas, todas sus tareas y
        actividades con fecha aparecen automáticamente en el calendario
        conjunto.
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
                  {sharing.status.connection.peerEmail} · Calendario conjunto
                  automático.
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
                    Al aceptar, todas las tareas, actividades y sesiones con
                    fecha de ambos aparecerán automáticamente en el calendario
                    conjunto.
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
            <p className="form-help">
              Todas las tareas, actividades y sesiones con fecha se muestran
              automáticamente.
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
