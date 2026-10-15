import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Clock3, Pencil, Play, SkipForward, X } from "lucide-react";
import type { StudySession } from "../models/schema";
import { PRIORITIES } from "../models/schema";
import { useStore } from "../services/store";
import { displayDate, todayIn } from "../services/dates";
import { createTimer } from "../services/study";
import { CompleteSessionDialog, EditSessionDialog } from "./StudyDialogs";
export default function SessionCards({
  sessions,
  showDate = true,
}: {
  sessions: StudySession[];
  showDate?: boolean;
}) {
  const { data, commit, notify } = useStore();
  const navigate = useNavigate();
  const [edit, setEdit] = useState<{
    session: StudySession;
    postpone?: boolean;
  } | null>(null);
  const [complete, setComplete] = useState<StudySession | null>(null);
  function start(s: StudySession) {
    if (data.activeTimer) {
      notify(
        "Ya hay un temporizador guardado. Recupéralo o descártalo antes de iniciar otro.",
      );
      navigate("/sesiones");
      return;
    }
    if (
      s.date > todayIn(data.settings.timezone) &&
      !window.confirm(
        "Esta sesión está programada para una fecha futura. ¿Iniciar ahora?",
      )
    )
      return;
    const ok = commit((d) => {
      if (d.activeTimer)
        throw new Error("Ya hay un temporizador activo en otra pestaña.");
      const current = d.scheduledSessions.find((x) => x.id === s.id);
      if (!current || current.status !== "pending")
        throw new Error("La sesión ya no está pendiente.");
      d.activeTimer = createTimer(d, {
        courseId: s.courseId,
        topicId: s.topicId,
        planId: s.planId,
        sessionId: s.id,
        minutes: s.minutes,
        mode: "continuous",
        kind: s.kind,
      });
    }, "Sesión iniciada");
    if (ok) navigate("/sesiones");
  }
  return (
    <>
      <div className="study-session-list">
        {sessions.map((s) => {
          const course = data.courses.find((c) => c.id === s.courseId);
          const plan = data.plans.find((p) => p.id === s.planId);
          return (
            <article
              className={`study-session-card ${s.status === "completed" ? "session-completed" : ""}`}
              key={s.id}
            >
              <span
                className="session-color"
                style={{ background: course?.color ?? "#83A8EB" }}
              />
              <div className="study-session-main">
                <div className="session-badges">
                  <span
                    className={`badge ${s.kind === "review" ? "review-badge" : ""}`}
                  >
                    {s.kind === "review" ? "Repaso" : "Estudio"}
                  </span>
                  <span
                    className={`badge priority-${plan?.priority ?? "media"}`}
                  >
                    {PRIORITIES[plan?.priority ?? "media"]}
                  </span>
                  <span className="muted">
                    {s.status === "pending"
                      ? "Pendiente"
                      : s.status === "completed"
                        ? "Completada"
                        : "Cancelada"}
                  </span>
                </div>
                <strong>{s.title}</strong>
                <p>
                  {course?.name ?? "Sin curso"}
                  {plan ? ` · ${plan.name}` : ""}
                </p>
                <p className="session-explanation">{s.reason}</p>
                <span className="session-time">
                  <Clock3 size={13} />
                  {showDate ? `${displayDate(s.date)} · ` : ""}
                  {s.time} · {s.minutes} min
                </span>
              </div>
              {s.status === "pending" && (
                <div className="session-actions">
                  <button
                    className="btn primary small-btn"
                    onClick={() => start(s)}
                  >
                    <Play size={13} />
                    Iniciar
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Completar sesión ${s.title}`}
                    title="Registrar sesión completada"
                    onClick={() => setComplete(s)}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Posponer sesión ${s.title}`}
                    title="Posponer"
                    onClick={() => setEdit({ session: s, postpone: true })}
                  >
                    <SkipForward size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Editar sesión ${s.title}`}
                    title="Editar duración o fecha"
                    onClick={() => setEdit({ session: s })}
                  >
                    <Pencil size={15} />
                  </button>
                  {plan && (
                    <button
                      className="text-btn"
                      onClick={() => navigate(`/planes?plan=${plan.id}`)}
                    >
                      Ver plan
                    </button>
                  )}
                  <button
                    className="icon-btn danger-icon"
                    aria-label={`Cancelar sesión ${s.title}`}
                    onClick={() => {
                      if (data.activeTimer?.sessionId === s.id) {
                        notify("Finaliza o descarta el temporizador primero.");
                        return;
                      }
                      if (
                        window.confirm(
                          "¿Cancelar esta sesión? Se conservará en el historial de programación.",
                        )
                      )
                        commit((d) => {
                          d.scheduledSessions.find(
                            (x) => x.id === s.id,
                          )!.status = "cancelled";
                        }, "Sesión cancelada");
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {edit && (
        <EditSessionDialog
          session={edit.session}
          postpone={edit.postpone}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {complete && (
        <CompleteSessionDialog
          session={complete}
          onClose={() => setComplete(null)}
        />
      )}
    </>
  );
}
