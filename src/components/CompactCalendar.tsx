import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { useStore } from "../services/store";
import { dateKey, parseDay, todayIn, displayDate } from "../services/dates";
import { ArrowButton, Card } from "./ui";
import { useNavigate } from "react-router-dom";
import { useEditor } from "./AppContext";
export function CompactCalendar() {
  const { data } = useStore();
  const today = todayIn(data.settings.timezone);
  const [selected, setSelected] = useState(parseDay(today));
  const [month, setMonth] = useState(parseDay(today));
  const navigate = useNavigate();
  const open = useEditor();
  const key = dateKey(selected);
  const activities = [
    ...data.tasks
      .filter((t) => t.dueDate === key)
      .map((t) => ({
        id: t.id,
        title: t.title,
        time: t.time,
        courseId: t.courseId,
        edit: () => open({ kind: "task", item: t }),
      })),
    ...data.scheduledSessions
      .filter((s) => s.status !== "cancelled" && s.date === key)
      .map((s) => ({
        id: s.id,
        title: `${s.kind === "review" ? "Repaso" : "Estudio"}: ${s.title}`,
        time: s.time,
        courseId: s.courseId,
        edit: () => navigate(`/calendario?date=${key}`),
      })),
    ...data.events
      .filter((e) => e.date === key)
      .map((e) => ({
        id: e.id,
        title: e.title,
        time: e.time,
        courseId: e.courseId,
        edit: () => open({ kind: "event", item: e }),
      })),
  ];
  return (
    <Card
      title="Tu calendario"
      className="compact-calendar"
      action={
        <ArrowButton
          label="Abrir calendario completo"
          onClick={() => navigate(`/calendario?date=${key}`)}
        />
      }
    >
      <DayPicker
        mode="single"
        required
        selected={selected}
        month={month}
        onMonthChange={setMonth}
        onSelect={setSelected}
        locale={es}
        weekStartsOn={1}
        today={parseDay(today)}
        modifiers={{
          activity: [
            ...data.tasks.map((t) => parseDay(t.dueDate)),
            ...data.scheduledSessions
              .filter((s) => s.status !== "cancelled")
              .map((s) => parseDay(s.date)),
            ...data.events.map((e) => parseDay(e.date)),
          ],
        }}
        modifiersClassNames={{ activity: "has-activity" }}
      />
      <div className="day-summary">
        <strong>{displayDate(key, "EEEE d")}</strong>
        {activities.length ? (
          activities.map((a) => (
            <button key={a.id} className="mini-activity" onClick={a.edit}>
              <span
                className="course-dot"
                style={{
                  background:
                    data.courses.find((c) => c.id === a.courseId)?.color ??
                    "#A18BE0",
                }}
              />
              {a.title}
              <small>{a.time || "Todo el día"}</small>
            </button>
          ))
        ) : (
          <p>Sin actividades para esta fecha.</p>
        )}
        <button
          className="text-btn"
          onClick={() => open({ kind: "task", date: key })}
        >
          + Añadir para este día
        </button>
      </div>
    </Card>
  );
}
