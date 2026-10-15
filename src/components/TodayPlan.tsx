import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useStore } from "../services/store";
import { todayIn } from "../services/dates";
import { pendingForToday, remainingReviews } from "../services/study";
import { Card, Empty } from "./ui";
import SchedulePreview from "./SchedulePreview";
import SessionCards from "./SessionCards";
import Reviews from "./Reviews";
export default function TodayPlan() {
  const { data } = useStore();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(false);
  const today = todayIn(data.settings.timezone);
  const sessions = pendingForToday(data, today);
  const total = sessions.reduce((n, s) => n + s.minutes, 0);
  const reviews = remainingReviews(data, today);
  const overdue = data.scheduledSessions.filter(
    (s) => s.status === "pending" && s.date < today,
  );
  return (
    <div className="today-plan dashboard-study-plan">
      <Card
        title="Tu plan de hoy"
        action={
          <button
            className="icon-btn"
            aria-label="Reprogramar planes desde inicio"
            title="Previsualizar reprogramación"
            onClick={() => setPreview(true)}
          >
            <RotateCcw size={17} />
          </button>
        }
      >
        {sessions.length ? (
          <>
            <p className="today-plan-total">
              {sessions.length} sesiones · {total} minutos previstos
            </p>
            <SessionCards sessions={sessions} showDate={false} />
          </>
        ) : (
          <Empty
            title={
              data.plans.some((p) => p.status === "active")
                ? "No hay sesiones para hoy"
                : "No hay planes activos"
            }
            description={
              data.plans.some((p) => p.status === "active")
                ? "Puedes revisar la programación y tu disponibilidad."
                : "Crea un plan con los temas que quieres preparar."
            }
            action={
              <button className="btn soft" onClick={() => navigate("/planes")}>
                Abrir planes de estudio
              </button>
            }
          />
        )}{" "}
        {overdue.length > 0 && (
          <div className="study-warning">
            <p>
              {overdue.length} sesiones pendientes quedaron en fechas pasadas.
              Reprograma desde la vista previa.
            </p>
          </div>
        )}
        <div className="today-plan-foot">
          <span>{reviews.length} repasos pendientes</span>
          <button className="text-btn" onClick={() => navigate("/sesiones")}>
            Sesiones y repasos
          </button>
        </div>
      </Card>
      {reviews.length > 0 && <Reviews compact dueOnly />}
      {preview && <SchedulePreview onClose={() => setPreview(false)} />}
    </div>
  );
}
