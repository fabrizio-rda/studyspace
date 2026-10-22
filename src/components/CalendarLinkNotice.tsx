import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../services/store";
import { useSharing } from "../services/sharing-context";
import { acceptCalendar } from "../services/sharing";

export default function CalendarLinkNotice() {
  const { cloud, workspaceToken } = useStore();
  const sharing = useSharing();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  if (cloud.mode !== "cloud" || !cloud.user || sharing.status.connection)
    return null;
  const incoming = sharing.status.incoming;
  const outgoing = sharing.status.outgoing.filter(
    (invite) => invite.status === "pending",
  );
  if (!incoming.length && !outgoing.length) return null;
  return (
    <section
      className="calendar-link-notice"
      aria-labelledby={titleId}
      key={workspaceToken}
    >
      <div>
        <strong id={titleId}>
          El calendario conjunto aún no está vinculado
        </strong>
        <p>
          {incoming.length
            ? "Acepta la invitación para ver automáticamente las actividades de ambos. Cada uno conserva todas sus tareas."
            : "La invitación está enviada, pero falta que la otra persona la acepte desde su cuenta. Hasta entonces solo ves tus actividades."}
        </p>
      </div>
      <div className="calendar-link-actions">
        {incoming.map((invite) => (
          <button
            className="btn primary"
            key={invite.id}
            disabled={busy || sharing.loading}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await acceptCalendar(invite.id);
                await sharing.refresh();
                window.dispatchEvent(new Event("studyspace:calendar"));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Aceptar invitación de {invite.fromName}
          </button>
        ))}
        <button
          className="btn soft"
          disabled={busy || sharing.loading}
          onClick={() => void sharing.refresh()}
        >
          Actualizar vínculo
        </button>
        <Link className="text-btn" to="/configuracion">
          Ver invitación
        </Link>
      </div>
      {error && (
        <p className="integration-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
