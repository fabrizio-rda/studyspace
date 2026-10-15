import { useState } from "react";
import type { AppState } from "../models/schema";
import { useStore } from "../services/store";
import {
  generateSchedule,
  sessionConflict,
  nowMinute,
  planningFingerprint,
  toMinute,
} from "../services/planner";
import { todayIn, displayDate } from "../services/dates";
import { Modal } from "./ui";
export default function SchedulePreview({
  onClose,
  patch,
}: {
  onClose: () => void;
  patch?: (data: AppState) => void;
}) {
  const { data, commit, notify } = useStore();
  const [base, setBase] = useState(() => planningFingerprint(data));
  const [preview, setPreview] = useState(() => {
    const d = structuredClone(data);
    patch?.(d);
    return generateSchedule(d);
  });
  function refresh() {
    setBase(planningFingerprint(data));
    const d = structuredClone(data);
    patch?.(d);
    setPreview(generateSchedule(d));
  }
  function confirm() {
    const today = todayIn(data.settings.timezone);
    if (
      preview.sessions.some(
        (s) =>
          s.status === "pending" &&
          !s.manual &&
          s.id !== data.activeTimer?.sessionId &&
          s.date === today &&
          toMinute(s.time) < nowMinute(data.settings.timezone),
      )
    ) {
      notify("La hora cambió. Actualiza la vista previa antes de confirmar.");
      return;
    }
    const ok = commit((d) => {
      if (planningFingerprint(d) !== base)
        throw new Error(
          "Los datos cambiaron mientras revisabas el plan. Actualiza la vista previa.",
        );
      patch?.(d);
      d.scheduledSessions = preview.sessions;
      for (const session of d.scheduledSessions.filter(
        (s) =>
          s.status === "pending" &&
          s.id !== d.activeTimer?.sessionId &&
          s.date >= today,
      )) {
        const plan = d.plans.find((p) => p.id === session.planId);
        if (
          plan &&
          (session.date < plan.startDate || session.date > plan.targetDate)
        )
          throw new Error(
            "Hay sesiones manuales fuera de las nuevas fechas del plan. Reprográmalas o cancélalas antes de cambiar las fechas.",
          );
        if (
          session.date === today &&
          toMinute(session.time) < nowMinute(d.settings.timezone)
        )
          continue;
        const conflict = sessionConflict(d, session, session.id);
        if (conflict)
          throw new Error(
            `No se aplicó la propuesta: ${conflict} Revisa las sesiones manuales conservadas.`,
          );
      }
    }, "Calendario de estudio actualizado");
    if (ok) onClose();
  }
  const pending = preview.sessions
    .filter((s) => s.status === "pending")
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    );
  return (
    <Modal title="Vista previa de planificación" onClose={onClose} wide>
      <p className="form-help">
        Se generarán {preview.created} sesiones y se reemplazarán{" "}
        {preview.replaced} pendientes automáticas. Se conservan sesiones
        completadas, manuales y el temporizador activo. Tareas y actividades
        existentes no se modifican.
      </p>
      <p className="form-help">
        La disponibilidad de Configuración es el límite TOTAL compartido. Cada
        tarea/actividad reserva {data.studyPreferences.activityReserveMinutes}{" "}
        min; las que tienen hora también bloquean ese intervalo. Las duraciones
        de preparación son estimaciones basadas en dificultad y dominio.
      </p>
      {preview.warnings.length > 0 && (
        <div className="study-warning" role="alert">
          <strong>
            {preview.unscheduledMinutes
              ? `${preview.unscheduledMinutes} min sin programar`
              : "Observaciones"}
          </strong>
          <ul>
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="preview-table">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Tema</th>
              <th>Tipo</th>
              <th>Min</th>
            </tr>
          </thead>
          <tbody>
            {pending.slice(0, 150).map((s) => (
              <tr key={s.id}>
                <td>{displayDate(s.date)}</td>
                <td>{s.time}</td>
                <td>{s.title}</td>
                <td>
                  {s.kind === "review" ? "Repaso" : "Estudio"}
                  {s.manual ? " · Manual" : ""}
                </td>
                <td>{s.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pending.length && (
          <p className="muted">No hay sesiones por programar.</p>
        )}
        {pending.length > 150 && (
          <p className="muted">
            Se muestran las primeras 150 de {pending.length} sesiones.
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn soft" onClick={refresh}>
          Actualizar vista previa
        </button>
        <button className="btn primary" onClick={confirm}>
          Confirmar calendario
        </button>
      </div>
    </Modal>
  );
}
