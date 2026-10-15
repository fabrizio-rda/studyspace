import { useState } from "react";
import { Link } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import {
  addDays,
  addMonths,
  startOfMonth,
  startOfWeek,
  endOfMonth,
  endOfWeek,
} from "date-fns";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useStore } from "../services/store";
import { useSharing, useSharedFeed } from "../services/sharing-context";
import { dateKey, parseDay, todayIn, displayDate } from "../services/dates";
import type { SharedEvent } from "../services/sharing";
import { Card, Modal } from "./ui";
import { visibilityLabels } from "./VisibilitySelect";
const names: Record<string, string> = {
  tarea: "Tarea",
  examen: "Examen",
  practica: "Práctica",
  proyecto: "Proyecto",
  lectura: "Lectura",
  study: "Sesión de estudio",
  review: "Repaso",
  busy: "Ocupado",
};
function OwnerLabel({ event }: { event: SharedEvent }) {
  return (
    <span className={`owner-label accent-${event.ownerAccent}`}>
      <i />
      {event.ownerName}
    </span>
  );
}
export default function SharedCalendar({
  compact = false,
  initialDate,
}: {
  compact?: boolean;
  initialDate?: string;
}) {
  const { data, cloud } = useStore();
  const sharing = useSharing();
  const today = todayIn(data.settings.timezone);
  const [anchor, setAnchor] = useState(initialDate ?? today);
  const [selected, setSelected] = useState(anchor);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [owner, setOwner] = useState("both");
  const [detailId, setDetailId] = useState<string | null>(null);
  const date = parseDay(anchor);
  const start =
    view === "day"
      ? date
      : startOfWeek(view === "month" ? startOfMonth(date) : date, {
          weekStartsOn: 1,
        });
  const end =
    view === "day"
      ? date
      : view === "month"
        ? endOfWeek(endOfMonth(date), { weekStartsOn: 1 })
        : addDays(start, 6);
  const from = dateKey(start),
    to = dateKey(end);
  const feed = useSharedFeed(from, to);
  const participants = [
    {
      id: cloud.user?.id ?? "",
      name: data.settings.name,
      accent: data.settings.calendarAccent ?? "blue",
    },
    {
      id: sharing.status.connection?.peerId ?? "",
      name: sharing.status.connection?.peerName ?? "Cuenta vinculada",
      accent: sharing.status.connection?.peerAccent ?? "pink",
    },
  ];
  const events = feed.events.filter(
    (e) => owner === "both" || e.ownerId === owner,
  );
  const detail = feed.events.find((e) => e.id === detailId);
  const agenda = events.filter(
    (e) => e.date === (view === "day" ? anchor : selected),
  );
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const filters = (
    <div
      className="owner-filters"
      aria-label="Filtrar calendario por propietario"
    >
      <button
        className={owner === "both" ? "active" : ""}
        aria-pressed={owner === "both"}
        onClick={() => setOwner("both")}
      >
        Ambos
      </button>
      {participants.map((p) => (
        <button
          key={p.id}
          className={`${owner === p.id ? "active" : ""} accent-${p.accent}`}
          aria-pressed={owner === p.id}
          onClick={() => setOwner(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
  function eventButton(e: SharedEvent, mini = false) {
    return (
      <button
        key={e.id}
        className={
          mini
            ? "mini-activity shared-mini"
            : `calendar-event shared-event accent-${e.ownerAccent}`
        }
        style={{
          borderLeftColor: e.ownerAccent === "pink" ? "#C58BBC" : "#83A8EB",
        }}
        onClick={() => setDetailId(e.id)}
        aria-label={`${e.title} · ${e.ownerName}${e.time ? " · " + e.time : ""}`}
      >
        <OwnerLabel event={e} />
        <strong>
          {e.time && <small>{e.time} </small>}
          {e.title}
        </strong>
        {e.courseName && (
          <small className="shared-course">
            <i style={{ background: e.courseColor ?? "#ccc" }} />
            {e.courseName}
          </small>
        )}
      </button>
    );
  }
  if (!sharing.status.connection)
    return (
      <Card title="Calendario compartido">
        <p>
          {sharing.error ||
            "Vincula las cuentas con una invitación aceptada para consultar actividades autorizadas."}
        </p>
        <Link className="btn soft" to="/configuracion">
          Configurar calendario compartido
        </Link>
      </Card>
    );
  const content = (
    <>
      {filters}
      {!compact && (
        <div className="calendar-toolbar">
          <div className="calendar-title">
            <button
              className="icon-btn"
              aria-label="Periodo compartido anterior"
              onClick={() =>
                setAnchor(
                  dateKey(
                    view === "month"
                      ? addMonths(date, -1)
                      : addDays(date, view === "week" ? -7 : -1),
                  ),
                )
              }
            >
              <ArrowLeft size={18} />
            </button>
            <h2>
              {displayDate(
                anchor,
                view === "day" ? "d MMMM yyyy" : "MMMM yyyy",
              )}
            </h2>
            <button
              className="icon-btn"
              aria-label="Periodo compartido siguiente"
              onClick={() =>
                setAnchor(
                  dateKey(
                    view === "month"
                      ? addMonths(date, 1)
                      : addDays(date, view === "week" ? 7 : 1),
                  ),
                )
              }
            >
              <ArrowRight size={18} />
            </button>
            <button
              className="btn soft small-btn"
              onClick={() => {
                setAnchor(today);
                setSelected(today);
              }}
            >
              Hoy
            </button>
          </div>
          <div className="segmented">
            {(
              [
                ["month", "Mes"],
                ["week", "Semana"],
                ["day", "Día"],
              ] as const
            ).map(([k, v]) => (
              <button
                key={k}
                className={view === k ? "selected" : ""}
                onClick={() => setView(k)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}
      {compact ? (
        <DayPicker
          mode="single"
          required
          selected={parseDay(selected)}
          month={date}
          onMonthChange={(d) => {
            setAnchor(dateKey(d));
            setSelected(dateKey(d));
          }}
          onSelect={(d) => {
            setSelected(dateKey(d));
            setAnchor(dateKey(d));
          }}
          locale={es}
          weekStartsOn={1}
          today={parseDay(today)}
          modifiers={{ activity: events.map((e) => parseDay(e.date)) }}
          modifiersClassNames={{ activity: "has-activity" }}
        />
      ) : (
        view !== "day" && (
          <div className="calendar-scroll">
            <div className={`calendar-grid view-${view}`}>
              <div className="weekday-row">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="calendar-days">
                {days.map((day) => {
                  const key = dateKey(day);
                  const list = events.filter((e) => e.date === key);
                  return (
                    <div
                      key={key}
                      className={`calendar-cell ${key === today ? "is-today" : ""} ${key === selected ? "is-selected" : ""} ${day.getMonth() !== date.getMonth() && view === "month" ? "outside" : ""}`}
                    >
                      <button
                        className="calendar-day-number"
                        aria-label={`Ver calendario compartido del ${key}`}
                        onClick={() => setSelected(key)}
                      >
                        {day.getDate()}
                      </button>
                      {list
                        .slice(0, view === "month" ? 3 : 20)
                        .map((e) => eventButton(e))}
                      {list.length > (view === "month" ? 3 : 20) && (
                        <button
                          className="text-btn"
                          onClick={() => {
                            setSelected(key);
                            setAnchor(key);
                            setView("day");
                          }}
                        >
                          Ver {list.length} actividades
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      )}
      <div className="day-summary shared-agenda">
        <strong>
          {displayDate(view === "day" ? anchor : selected, "EEEE d MMMM")}
        </strong>
        {agenda.length ? (
          agenda.map((e) => eventButton(e, true))
        ) : (
          <p>
            {feed.loading
              ? "Consultando actividades…"
              : "Sin actividades autorizadas para esta fecha."}
          </p>
        )}
      </div>
      {(feed.error || sharing.error) && (
        <p className="integration-status" role="status">
          {feed.error || sharing.error}
        </p>
      )}
      <div className="shared-freshness">
        <small>
          {feed.updated
            ? `Consultado ${new Date(feed.updated).toLocaleTimeString("es-PE", { timeZone: data.settings.timezone, hour: "2-digit", minute: "2-digit" })} · ${data.settings.timezone}`
            : "Consulta pendiente"}{" "}
          · cada 30 s y al volver a la ventana
        </small>
        <button
          className="text-btn"
          disabled={feed.loading}
          onClick={() => void feed.refresh()}
        >
          <RefreshCw size={12} />
          Actualizar
        </button>
      </div>
      {detail && (
        <Modal title={detail.title} onClose={() => setDetailId(null)}>
          <OwnerLabel event={detail} />
          <p>
            {displayDate(detail.date, "d MMMM yyyy")} ·{" "}
            {detail.time || "Todo el día"}
            {detail.minutes ? ` · ${detail.minutes} min` : ""}
          </p>
          {detail.courseName && <p>{detail.courseName}</p>}
          <p>{names[detail.type] ?? "Actividad"}</p>
          <p className="form-help">
            {visibilityLabels[detail.visibility]} ·{" "}
            {detail.own
              ? "Tu actividad. Puedes editarla en Mi calendario."
              : "Actividad de otra cuenta, solo lectura."}
          </p>
          {detail.time && detail.sourceTimezone !== data.settings.timezone && (
            <p className="form-help">
              Hora convertida desde {detail.sourceTimezone} a{" "}
              {data.settings.timezone}.
            </p>
          )}
        </Modal>
      )}
    </>
  );
  return compact ? (
    <Card
      title="Calendario compartido"
      className="compact-calendar shared-calendar"
      action={
        <Link className="text-btn" to="/calendario?compartido=1">
          Abrir
        </Link>
      }
    >
      {content}
    </Card>
  ) : (
    <div className="page shared-calendar">
      <div className="page-heading">
        <div>
          <h1>Calendario compartido</h1>
          <p>
            Actividades autorizadas de ambas cuentas. Los colores de propietario
            y curso se muestran por separado.
          </p>
        </div>
      </div>
      <div className="card calendar-workspace">{content}</div>
    </div>
  );
}
