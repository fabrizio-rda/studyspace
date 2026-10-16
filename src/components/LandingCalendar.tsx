import { useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import { useStore } from "../services/store";
import { useSharing, useSharedFeed } from "../services/sharing-context";
import { dateKey, parseDay, todayIn, displayDate } from "../services/dates";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function LandingCalendar() {
  const { data, cloud } = useStore();
  const sharing = useSharing();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayIn(data.settings.timezone);
  const month = startOfMonth(addMonths(parseDay(today), offset));
  const first = startOfWeek(month, { weekStartsOn: 1 });
  const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const from = dateKey(first);
  const to = dateKey(last);
  const days = Array.from(
    { length: differenceInCalendarDays(last, first) + 1 },
    (_, index) => dateKey(addDays(first, index)),
  );
  const feed = useSharedFeed(from, to);
  const connected = cloud.mode === "cloud" && !!sharing.status.connection;
  // The shared feed can include the signed-in owner's private events.
  // Never expose those on the landing page, even to that same owner.
  const events = connected
    ? feed.events
        .filter((event) => event.visibility !== "private")
        .map((event) =>
          event.visibility === "busy"
            ? { ...event, title: "Ocupado", courseName: null }
            : event,
        )
    : [];
  const activeDay =
    selected && selected >= from && selected <= to
      ? selected
      : offset === 0
        ? today
        : dateKey(month);
  const activeEvents = events.filter((event) => event.date === activeDay);
  const error = sharing.error || feed.error;

  return (
    <section className="entry-calendar" aria-labelledby="joint-title">
      <div className="entry-calendar-heading">
        <div>
          <span className="entry-eyebrow">ACTIVIDADES DE AMBOS</span>
          <h2 id="joint-title">
            <CalendarDays size={22} />
            Calendario
          </h2>
        </div>
        {connected && (
          <button
            className="btn soft"
            aria-label="Actualizar calendario"
            onClick={() => {
              void sharing.refresh();
              void feed.refresh();
            }}
          >
            <RefreshCw size={16} />
            <span>Actualizar</span>
          </button>
        )}
      </div>
      <div className="entry-month-controls">
        <button
          className="icon-btn"
          aria-label="Mes anterior"
          onClick={() => {
            setSelected(null);
            setOffset((value) => value - 1);
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <h3>{displayDate(dateKey(month), "MMMM yyyy")}</h3>
        <button
          className="icon-btn"
          aria-label="Mes siguiente"
          onClick={() => {
            setSelected(null);
            setOffset((value) => value + 1);
          }}
        >
          <ArrowRight size={18} />
        </button>
        {offset !== 0 && (
          <button
            className="text-btn"
            onClick={() => {
              setSelected(null);
              setOffset(0);
            }}
          >
            Hoy
          </button>
        )}
      </div>
      {!connected && (
        <p className="entry-calendar-status" role="status">
          {sharing.loading
            ? "Consultando vinculación…"
            : error ||
              (cloud.user
                ? "Las actividades compartidas aparecerán cuando ambos espacios estén vinculados."
                : "Inicia sesión en uno de los espacios para consultar las actividades compartidas.")}
        </p>
      )}
      {connected && error && (
        <p className="integration-error" role="alert">{error}</p>
      )}
      {connected && feed.loading && (
        <p className="entry-calendar-status" role="status">
          Consultando actividades…
        </p>
      )}
      <div className="entry-month-calendar">
        <div className="entry-month-weekdays" aria-hidden="true">
          {weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="entry-month-grid">
          {days.map((day) => {
            const items = events.filter((event) => event.date === day);
            const outside = day.slice(0, 7) !== dateKey(month).slice(0, 7);
            return (
              <button
                type="button"
                key={day}
                className={`entry-month-day${outside ? " outside" : ""}${day === today ? " today" : ""}${day === activeDay ? " selected" : ""}`}
                aria-label={`${displayDate(day, "EEEE d MMMM")}, ${items.length} actividades compartidas`}
                aria-pressed={day === activeDay}
                onClick={() => setSelected(day)}
              >
                <span className="entry-month-number">{Number(day.slice(-2))}</span>
                <span className="entry-month-events">
                  {items.slice(0, 2).map((event) => (
                    <span
                      key={`${event.ownerId}:${event.id}`}
                      className={`entry-month-event ${event.ownerAccent === "pink" ? "catalina" : "fabrizio"}`}
                      title={`${event.ownerName}: ${event.title}`}
                    >
                      <span className="entry-month-event-text">
                        {event.title}
                      </span>
                    </span>
                  ))}
                  {items.length > 2 && (
                    <span className="entry-month-more">+{items.length - 2} más</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="entry-month-detail" aria-live="polite">
        <h3>{displayDate(activeDay, "EEEE d 'de' MMMM")}</h3>
        {activeEvents.length ? (
          <ul>
            {activeEvents.map((event) => (
              <li key={`${event.ownerId}:${event.id}`}>
                <span className={`entry-owner ${event.ownerAccent === "pink" ? "catalina" : "fabrizio"}`}>
                  {event.ownerName}
                </span>
                <time>{event.time || "Todo el día"}</time>
                <strong>{event.title}</strong>
                {event.courseName && <small>{event.courseName}</small>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="entry-week-empty">Sin actividades compartidas este día.</p>
        )}
      </div>
      <p className="entry-calendar-note">
        Solo actividades compartidas · Consulta · Las actividades privadas no aparecen aquí.
      </p>
    </section>
  );
}
