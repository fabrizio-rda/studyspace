import { useState } from "react";
import { addDays, startOfWeek } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import { useStore } from "../services/store";
import { useSharing, useSharedFeed } from "../services/sharing-context";
import { dateKey, parseDay, todayIn, displayDate } from "../services/dates";
export default function LandingCalendar() {
  const { data, cloud } = useStore();
  const sharing = useSharing();
  const [offset, setOffset] = useState(0);
  const start = addDays(
    startOfWeek(parseDay(todayIn(data.settings.timezone)), { weekStartsOn: 1 }),
    offset * 7,
  );
  const from = dateKey(start),
    to = dateKey(addDays(start, 6));
  const feed = useSharedFeed(from, to);
  const connected = cloud.mode === "cloud" && !!sharing.status.connection;
  // The existing authenticated feed includes one's own private entries. The
  // entrance deliberately excludes them and redacts even one's own busy items.
  const events = connected
    ? feed.events
        .filter((e) => e.visibility !== "private")
        .map((e) =>
          e.visibility === "busy"
            ? { ...e, title: "Ocupado", courseName: null }
            : e,
        )
    : [];
  const error = sharing.error || feed.error;
  return (
    <section className="entry-calendar" aria-labelledby="joint-title">
      <div className="entry-calendar-heading">
        <div>
          <span className="entry-eyebrow">AGENDA COMPARTIDA</span>
          <h2 id="joint-title">
            <CalendarDays size={22} />
            Calendario conjunto
          </h2>
        </div>
        {connected && (
          <button
            className="btn soft"
            aria-label="Actualizar calendario conjunto"
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
      {!connected ? (
        <div className="entry-calendar-empty" role="status">
          <CalendarDays size={30} />
          <h3>
            {sharing.loading
              ? "Consultando vinculación…"
              : "Aún no hay un calendario conjunto disponible"}
          </h3>
          <p>
            {error ||
              (cloud.user
                ? "Aparecerá cuando ambas cuentas estén vinculadas mediante una invitación aceptada."
                : "Inicia sesión en uno de los espacios. Cuando ambas cuentas estén vinculadas, aquí aparecerán sus actividades compartidas.")}
          </p>
        </div>
      ) : (
        <>
          <div className="entry-week-controls">
            <button
              className="icon-btn"
              aria-label="Semana conjunta anterior"
              onClick={() => setOffset((n) => n - 1)}
            >
              <ArrowLeft size={18} />
            </button>
            <p>
              {displayDate(from, "d MMM")} — {displayDate(to, "d MMM yyyy")}
            </p>
            <button
              className="icon-btn"
              aria-label="Semana conjunta siguiente"
              onClick={() => setOffset((n) => n + 1)}
            >
              <ArrowRight size={18} />
            </button>
            <button className="text-btn" onClick={() => setOffset(0)}>
              Esta semana
            </button>
          </div>
          {error ? (
            <p className="integration-error" role="alert">
              {error}
            </p>
          ) : feed.loading ? (
            <p role="status">Consultando actividades…</p>
          ) : events.length ? (
            <div className="entry-agenda">
              {Array.from({ length: 7 }, (_, i) =>
                dateKey(addDays(start, i)),
              ).map((day) => {
                const list = events.filter((e) => e.date === day);
                if (!list.length) return null;
                return (
                  <section
                    key={day}
                    className="entry-agenda-day"
                    aria-label={displayDate(day, "EEEE d MMMM")}
                  >
                    <h3>{displayDate(day, "EEE d")}</h3>
                    <ul>
                      {list.map((e) => (
                        <li key={`${e.ownerId}:${e.id}`}>
                          <span
                            className={`entry-owner ${e.ownerAccent === "pink" ? "catalina" : "fabrizio"}`}
                          >
                            {e.ownerName}
                          </span>
                          <time>{e.time || "Todo el día"}</time>
                          <strong>{e.title}</strong>
                          {e.courseName && <small>{e.courseName}</small>}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="entry-week-empty">
              No hay actividades compartidas esta semana.
            </p>
          )}
          <p className="entry-calendar-note">
            Solo actividades compartidas · Consulta · La edición se realiza
            dentro de cada espacio.
          </p>
        </>
      )}
    </section>
  );
}
