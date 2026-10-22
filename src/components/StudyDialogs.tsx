import { useFormStore } from "../services/form-store";
import { useState } from "react";
import type { FormEvent } from "react";
import type { ActiveTimer, StudySession } from "../models/schema";
import { MASTERY } from "../models/schema";
import { useStore } from "../services/store";
import { completeStudy, timerStudySeconds } from "../services/study";
import { plusDays, todayIn } from "../services/dates";
import { sessionConflict } from "../services/planner";
import { Modal } from "./ui";
export function EditSessionDialog({
  session,
  postpone = false,
  onClose,
}: {
  session: StudySession;
  postpone?: boolean;
  onClose: () => void;
}) {
  const { data, commit } = useFormStore();
  const [date, setDate] = useState(
    postpone
      ? plusDays(
          session.date < todayIn(data.settings.timezone)
            ? todayIn(data.settings.timezone)
            : session.date,
          1,
        )
      : session.date,
  );
  const [time, setTime] = useState(session.time);
  const [minutes, setMinutes] = useState(session.minutes);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      ...session,
      date,
      time,
      minutes,
      visibility: "details" as const,
      manual: true,
    };
    const conflict = sessionConflict(data, next, session.id);
    if (conflict) {
      setError(conflict);
      return;
    }
    const ok = commit((d) => {
      const current = d.scheduledSessions.find((s) => s.id === session.id);
      if (!current || current.status !== "pending")
        throw new Error("La sesión ya no está pendiente.");
      if (d.activeTimer?.sessionId === session.id)
        throw new Error(
          "Pausa y finaliza o descarta el temporizador antes de reprogramar.",
        );
      const conflict = sessionConflict(d, next, session.id);
      if (conflict) throw new Error(conflict);
      Object.assign(current, next);
    }, "Sesión reprogramada; se conservará al regenerar");
    if (ok) onClose();
  }
  return (
    <Modal
      title={postpone ? "Posponer sesión" : "Editar sesión de estudio"}
      onClose={onClose}
    >
      <form className="editor-form" onSubmit={submit}>
        <p className="form-help">
          {session.title}. Los cambios manuales se conservan al regenerar
          planes.
        </p>
        <div className="form-grid">
          <label>
            Fecha
            <input
              required
              type="date"
              min={todayIn(data.settings.timezone)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Hora
            <input
              required
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label>
            Duración (min)
            <input
              required
              type="number"
              min={5}
              max={180}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="form-help">
          Esta sesión aparecerá en el calendario conjunto.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" type="submit">
            Guardar sesión
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function CompleteSessionDialog({
  session,
  timer,
  onClose,
}: {
  session?: StudySession;
  timer?: ActiveTimer;
  onClose: () => void;
}) {
  const { data, commit } = useStore();
  const currentTimer =
    timer ??
    (data.activeTimer?.sessionId === session?.id
      ? data.activeTimer
      : undefined);
  const [minutes, setMinutes] = useState(
    currentTimer
      ? String(Math.round((timerStudySeconds(currentTimer) / 60) * 100) / 100)
      : "",
  );
  const [notes, setNotes] = useState("");
  const [mastery, setMastery] = useState("");
  const [status, setStatus] = useState<"completed" | "interrupted">(
    "completed",
  );
  const [error, setError] = useState("");
  const topicId = session?.topicId ?? currentTimer?.topicId;
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!minutes || Number(minutes) <= 0) {
      setError("Registra el tiempo que realmente estudiaste.");
      return;
    }
    if (topicId && mastery === "") {
      setError("Selecciona tu nivel de comprensión.");
      return;
    }
    const ok = commit(
      (d) => {
        if (currentTimer && d.activeTimer?.id !== currentTimer.id)
          throw new Error(
            "El temporizador cambió en otra pestaña. Revisa el registro actual.",
          );
        completeStudy(d, {
          sessionId: session?.id ?? currentTimer?.sessionId,
          timer: currentTimer,
          seconds: Number(minutes) * 60,
          notes,
          mastery: mastery === "" ? null : Number(mastery),
          status,
        });
      },
      status === "completed"
        ? "Sesión registrada y próximo repaso actualizado"
        : "Tiempo parcial registrado; sesión pendiente conservada",
    );
    if (ok) onClose();
  }
  return (
    <Modal title="Registrar sesión" onClose={onClose}>
      <form className="editor-form" onSubmit={submit}>
        <p className="form-help">
          {session?.title ?? currentTimer?.topicName ?? "Estudio libre"}. El
          tiempo previsto no se guarda como tiempo real automáticamente.
        </p>
        <label>
          Minutos realmente estudiados
          <input
            required
            autoFocus
            type="number"
            min={0.01}
            step={0.01}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        {topicId && (
          <label>
            ¿Qué tan bien entendiste este tema?
            <select
              required
              value={mastery}
              onChange={(e) => setMastery(e.target.value)}
            >
              <option value="">Selecciona tu respuesta</option>
              {MASTERY.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Estado
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="completed">Completada</option>
            <option value="interrupted">
              Interrumpida (guardar solo tiempo parcial)
            </option>
          </select>
        </label>
        <label>
          Notas
          <textarea
            maxLength={10000}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <p className="form-help">
          Completar una sesión no marca el tema como completado ni dominado. El
          dominio depende únicamente de tu respuesta. Los intervalos se ajustan
          en Configuración.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" type="submit">
            Guardar registro
          </button>
        </div>
      </form>
    </Modal>
  );
}
