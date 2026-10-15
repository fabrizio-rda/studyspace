import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, RotateCcw } from "lucide-react";
import { useStore } from "../services/store";
import { MASTERY } from "../models/schema";
import { todayIn, displayDate } from "../services/dates";
import { topicCourse } from "../services/planner";
import { createTimer } from "../services/study";
import { Card, Empty } from "./ui";
import SchedulePreview from "./SchedulePreview";
export default function Reviews({
  compact = false,
  dueOnly = false,
}: {
  compact?: boolean;
  dueOnly?: boolean;
}) {
  const { data, commit, notify } = useStore();
  const navigate = useNavigate();
  const [view, setView] = useState(dueOnly ? "due" : "all");
  const [preview, setPreview] = useState(false);
  const today = todayIn(data.settings.timezone);
  const topics = data.topics
    .filter(
      (t) => t.nextReviewDate && (view !== "due" || t.nextReviewDate <= today),
    )
    .sort((a, b) => a.nextReviewDate!.localeCompare(b.nextReviewDate!));
  return (
    <Card
      title={dueOnly ? "Repasos pendientes" : "Repasos próximos"}
      className={compact ? "reviews-compact" : ""}
      action={
        <button
          className="icon-btn"
          aria-label="Planificar repasos"
          title="Previsualizar la programación de repasos y planes"
          onClick={() => setPreview(true)}
        >
          <RotateCcw size={17} />
        </button>
      }
    >
      {!dueOnly && (
        <div className="tabs study-tabs">
          <button
            className={view === "all" ? "active" : ""}
            onClick={() => setView("all")}
          >
            Próximos
          </button>
          <button
            className={view === "due" ? "active" : ""}
            onClick={() => setView("due")}
          >
            Pendientes
          </button>
        </div>
      )}
      {topics.length ? (
        <div className="review-list">
          {topics.slice(0, compact ? 8 : 30).map((t) => {
            const course = data.courses.find(
              (c) => c.id === topicCourse(data, t),
            );
            const scheduled = data.scheduledSessions.find(
              (s) =>
                s.topicId === t.id &&
                s.kind === "review" &&
                s.status === "pending",
            );
            return (
              <article key={t.id}>
                <div>
                  <strong>{t.name}</strong>
                  <p>
                    {course?.name ?? "Sin curso"} ·{" "}
                    {displayDate(t.nextReviewDate!)}
                  </p>
                  <small>
                    {MASTERY[t.mastery]} · {t.reviewCount} repasos registrados
                  </small>
                  {scheduled && (
                    <p>
                      Programado: {displayDate(scheduled.date)} ·{" "}
                      {scheduled.time}
                    </p>
                  )}
                </div>
                <button
                  className="icon-btn"
                  aria-label={`Iniciar repaso de ${t.name}`}
                  title="Iniciar repaso libre ahora"
                  onClick={() => {
                    if (data.activeTimer) {
                      notify("Recupera o descarta el temporizador actual.");
                      navigate("/sesiones");
                      return;
                    }
                    if (
                      scheduled &&
                      scheduled.date !== today &&
                      !window.confirm(
                        "Este repaso tiene una sesión programada. ¿Estudiarlo ahora y vincular el registro a esa sesión?",
                      )
                    )
                      return;
                    const ok = commit((d) => {
                      if (d.activeTimer)
                        throw new Error("Ya hay una sesión activa.");
                      d.activeTimer = createTimer(d, {
                        courseId: topicCourse(d, t),
                        topicId: t.id,
                        planId: scheduled?.planId ?? null,
                        sessionId: scheduled?.id ?? null,
                        minutes:
                          scheduled?.minutes ??
                          Math.min(20, d.studyPreferences.preferredMinutes),
                        mode: "continuous",
                        kind: "review",
                      });
                    }, "Repaso iniciado");
                    if (ok) navigate("/sesiones");
                  }}
                >
                  <Play size={16} />
                </button>
              </article>
            );
          })}
          {topics.length > (compact ? 8 : 30) && (
            <p className="form-help">
              Mostrando {compact ? 8 : 30} de {topics.length} repasos.
            </p>
          )}
        </div>
      ) : (
        <Empty
          title="No hay repasos en esta vista"
          description="Después de registrar una sesión y tu comprensión, se calculará el próximo repaso."
        />
      )}
      {preview && <SchedulePreview onClose={() => setPreview(false)} />}
    </Card>
  );
}
