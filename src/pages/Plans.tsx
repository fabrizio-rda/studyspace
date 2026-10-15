import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Pause,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useStore } from "../services/store";
import type { AppState, StudyPlan, Topic } from "../models/schema";
import { DIFFICULTY, PRIORITIES, WEEKDAYS } from "../models/schema";
import { todayIn, displayDate } from "../services/dates";
import { planProgress } from "../services/planner";
import { courseTopics } from "../services/study";
import { Card, CourseIcon, Empty, Modal } from "../components/ui";
import SchedulePreview from "../components/SchedulePreview";
import SessionCards from "../components/SessionCards";
export default function Plans() {
  const { data, commit } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [wizard, setWizard] = useState<StudyPlan | null | false>(false);
  const [preview, setPreview] = useState<{
    plan?: StudyPlan;
    difficulties?: Record<string, Topic["difficulty"]>;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(params.get("plan"));
  useEffect(() => setSelected(params.get("plan")), [params]);
  const [filter, setFilter] = useState("all");
  const today = todayIn(data.settings.timezone);
  const plan = data.plans.find((p) => p.id === selected);
  function patch(d: AppState) {
    if (preview?.plan) {
      const i = d.plans.findIndex((p) => p.id === preview.plan!.id);
      if (i < 0) d.plans.push(preview.plan);
      else d.plans[i] = preview.plan;
      for (const t of d.topics)
        if (preview.difficulties?.[t.id])
          t.difficulty = preview.difficulties[t.id];
    }
  }
  const list = data.plans
    .filter(
      (p) =>
        filter === "all" ||
        (filter === "future" && p.status === "active" && p.startDate > today) ||
        (filter === "active" &&
          p.status === "active" &&
          p.startDate <= today) ||
        (filter === "completed" && p.status === "completed") ||
        (filter === "paused" && p.status === "paused"),
    )
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Planes de estudio</h1>
          <p>Preparación por temas, fechas y disponibilidad real.</p>
        </div>
        <button className="btn primary" onClick={() => setWizard(null)}>
          <Plus size={16} />
          Crear plan
        </button>
      </div>
      <div className="study-toolbar">
        <div className="tabs">
          {[
            ["all", "Todos"],
            ["active", "Activos"],
            ["future", "Futuros"],
            ["completed", "Completados"],
            ["paused", "En pausa"],
          ].map(([k, v]) => (
            <button
              key={k}
              className={filter === k ? "active" : ""}
              onClick={() => setFilter(k)}
            >
              {v}
            </button>
          ))}
        </div>
        <button className="btn soft" onClick={() => setPreview({})}>
          <RotateCcw size={15} />
          Previsualizar reprogramación
        </button>
      </div>
      <p className="form-help planning-note">
        Todos los planes comparten el tiempo total de Configuración. Regenerar
        requiere revisar y confirmar el calendario propuesto.
      </p>
      {list.length ? (
        <div className="plans-grid">
          {list.map((p) => {
            const course = data.courses.find((c) => c.id === p.courseId);
            const progress = planProgress(data, p);
            const next = data.scheduledSessions
              .filter((s) => s.planId === p.id && s.status === "pending")
              .sort(
                (a, b) =>
                  a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
              )[0];
            return (
              <Card
                key={p.id}
                title={p.name}
                className="plan-tile"
                action={<CourseIcon course={course} size={20} />}
              >
                <p className="muted">
                  {course?.name ?? "Sin curso"} ·{" "}
                  {p.status === "completed"
                    ? "Completado"
                    : p.status === "paused"
                      ? "En pausa"
                      : p.startDate > today
                        ? "Futuro"
                        : "Activo"}
                </p>
                <p className="plan-goal">
                  {p.goal || "Sin objetivo adicional."}
                </p>
                <div className="plan-target">
                  <CalendarDays size={15} />
                  Objetivo: {displayDate(p.targetDate, "d MMM yyyy")}
                  <span className={`badge priority-${p.priority}`}>
                    {PRIORITIES[p.priority]}
                  </span>
                </div>
                <div className="linear-progress">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p className="muted">
                  {progress}% de la preparación estimada completada ·{" "}
                  {p.topicIds.length} temas
                </p>
                <p className="next-session">
                  {next
                    ? `Próxima sesión: ${displayDate(next.date)} · ${next.time}`
                    : "Sin sesiones pendientes"}
                </p>
                <div className="plan-tile-actions">
                  <button
                    className="btn soft"
                    onClick={() => setSelected(p.id)}
                  >
                    Abrir plan
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Editar plan ${p.name}`}
                    onClick={() => setWizard(p)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`${p.status === "paused" ? "Reactivar" : "Pausar"} plan ${p.name}`}
                    onClick={() => {
                      if (data.activeTimer?.planId === p.id) {
                        window.alert(
                          "Finaliza o descarta el temporizador de este plan primero.",
                        );
                        return;
                      }
                      if (
                        window.confirm(
                          "Cambiar el estado conservará el historial y cancelará sus sesiones pendientes. Podrás regenerarlas desde la vista previa.",
                        )
                      )
                        commit((d) => {
                          d.plans.find((x) => x.id === p.id)!.status =
                            p.status === "paused" ? "active" : "paused";
                          d.scheduledSessions.forEach((s) => {
                            if (s.planId === p.id && s.status === "pending")
                              s.status = "cancelled";
                          });
                        }, "Estado del plan actualizado");
                    }}
                  >
                    <Pause size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Completar plan ${p.name}`}
                    disabled={p.status === "completed"}
                    onClick={() => {
                      if (data.activeTimer?.planId === p.id) {
                        window.alert(
                          "Finaliza o descarta el temporizador de este plan primero.",
                        );
                        return;
                      }
                      if (
                        window.confirm(
                          "¿Marcar el plan como completado? Se cancelarán las sesiones pendientes, sin inventar registros ni dominio.",
                        )
                      )
                        commit((d) => {
                          d.plans.find((x) => x.id === p.id)!.status =
                            "completed";
                          d.scheduledSessions.forEach((s) => {
                            if (s.planId === p.id && s.status === "pending")
                              s.status = "cancelled";
                          });
                        }, "Plan completado");
                    }}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    className="icon-btn danger-icon"
                    aria-label={`Eliminar plan ${p.name}`}
                    onClick={() => {
                      if (data.activeTimer?.planId === p.id) {
                        window.alert(
                          "Finaliza o descarta el temporizador de este plan primero.",
                        );
                        return;
                      }
                      if (
                        window.confirm(
                          "¿Eliminar este plan? Las sesiones y registros de estudio se conservarán sin plan; las pendientes se cancelarán.",
                        )
                      )
                        commit((d) => {
                          d.plans = d.plans.filter((x) => x.id !== p.id);
                          for (const s of d.scheduledSessions)
                            if (s.planId === p.id) {
                              s.planId = null;
                              if (s.status === "pending")
                                s.status = "cancelled";
                            }
                          for (const l of d.studyLogs)
                            if (l.planId === p.id) l.planId = null;
                        }, "Plan eliminado; historial conservado");
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No hay planes en esta vista"
          description="Crea un temario dentro de un curso y selecciona los temas que quieres preparar."
          action={
            <button className="btn soft" onClick={() => navigate("/cursos")}>
              Abrir mis cursos
            </button>
          }
        />
      )}{" "}
      {wizard !== false && (
        <PlanWizard
          item={wizard ?? undefined}
          onClose={() => setWizard(false)}
          onReview={(plan, difficulties) => {
            setWizard(false);
            setPreview({ plan, difficulties });
          }}
        />
      )}
      {preview && (
        <SchedulePreview
          onClose={() => setPreview(null)}
          patch={preview.plan ? patch : undefined}
        />
      )}{" "}
      {plan && (
        <Modal title={plan.name} onClose={() => setSelected(null)} wide>
          <p className="form-help">
            {plan.goal || "Sin objetivo adicional."} · Fecha objetivo:{" "}
            {displayDate(plan.targetDate, "d MMM yyyy")}
          </p>
          <p className="form-help">
            El avance compara los minutos de estudio y repaso registrados con la
            carga estimada de cada tema. Cambia al actualizar el dominio o la
            dificultad; los minutos que no cupieron siguen contando como
            pendientes.
          </p>
          <div className="selected-plan-topics">
            {plan.topicIds
              .map((id) => data.topics.find((t) => t.id === id)?.name)
              .filter(Boolean)
              .join(" · ") || "Sin temas"}
          </div>
          <SessionCards
            sessions={data.scheduledSessions
              .filter((s) => s.planId === plan.id && s.status !== "cancelled")
              .sort(
                (a, b) =>
                  a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
              )}
          />
        </Modal>
      )}
    </div>
  );
}
function PlanWizard({
  item,
  onClose,
  onReview,
}: {
  item?: StudyPlan;
  onClose: () => void;
  onReview: (
    plan: StudyPlan,
    difficulties: Record<string, Topic["difficulty"]>,
  ) => void;
}) {
  const { data } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(item?.name ?? "");
  const [goal, setGoal] = useState(item?.goal ?? "");
  const [courseId, setCourseId] = useState(
    item
      ? (item.courseId ?? "")
      : (data.courses.find((c) => !c.archived)?.id ?? ""),
  );
  const [start, setStart] = useState(
    item?.startDate ?? todayIn(data.settings.timezone),
  );
  const [target, setTarget] = useState(item?.targetDate ?? "");
  const [topicIds, setTopicIds] = useState<string[]>(item?.topicIds ?? []);
  const [difficulties, setDifficulties] = useState<
    Record<string, Topic["difficulty"]>
  >({});
  const [availability, setAvailability] = useState(
    item?.availability ?? [...data.studyPreferences.availability],
  );
  const [duration, setDuration] = useState(
    item?.sessionMinutes ?? data.studyPreferences.preferredMinutes,
  );
  const [priority, setPriority] = useState<StudyPlan["priority"]>(
    item?.priority ?? "media",
  );
  const [reviewPercent, setReviewPercent] = useState(
    item?.reviewPercent ?? data.studyPreferences.reviewPercent,
  );
  const [error, setError] = useState("");
  const topics = courseTopics(data, courseId || null);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 0) {
      if (!name.trim() || (!courseId && !item) || !target || target < start) {
        setError("Completa el nombre, curso y fechas válidas.");
        return;
      }
      setError("");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!topicIds.length) {
        setError(
          "Selecciona al menos un tema. Puedes crearlos en la pestaña Temario del curso.",
        );
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (!availability.some((x) => x > 0)) {
      setError("Selecciona al menos un día con tiempo disponible.");
      return;
    }
    onReview(
      {
        id: item?.id ?? crypto.randomUUID(),
        name: name.trim(),
        goal,
        courseId: courseId || null,
        startDate: start,
        targetDate: target,
        topicIds,
        availability,
        sessionMinutes: duration,
        priority,
        reviewPercent,
        status: item?.status ?? "active",
        createdAt: item?.createdAt ?? new Date().toISOString(),
      },
      difficulties,
    );
  }
  return (
    <Modal
      title={item ? "Editar plan de estudio" : "Crear plan de estudio"}
      onClose={onClose}
      wide
    >
      <div className="wizard-steps">
        {["Objetivo", "Temas", "Tiempo disponible"].map((label, i) => (
          <span key={label} className={step === i ? "current" : ""}>
            {i + 1}. {label}
          </span>
        ))}
      </div>
      <form className="editor-form" onSubmit={submit}>
        {step === 0 && (
          <>
            <label>
              Nombre del plan
              <input
                autoFocus
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Curso
              <select
                required={!item}
                disabled={!!item}
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setTopicIds([]);
                }}
              >
                <option value="">
                  {item ? "Sin curso (conservado)" : "Seleccionar curso"}
                </option>
                {data.courses
                  .filter((c) => !c.archived || c.id === courseId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Objetivo
              <textarea
                rows={2}
                maxLength={5000}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Fecha de inicio
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Fecha del examen u objetivo
                <input
                  type="date"
                  required
                  min={start}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="form-help">
              Cada tema seleccionado cuenta por separado. Selecciona el tema
              general o sus subtemas según lo que quieras preparar. La
              dificultad se comparte con el temario.
            </p>
            <div className="topic-picker">
              {topics.length ? (
                topics.map((t) => (
                  <div
                    key={t.id}
                    className={t.parentId ? "subtopic-choice" : ""}
                  >
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={topicIds.includes(t.id)}
                        onChange={(e) =>
                          setTopicIds(
                            e.target.checked
                              ? [...topicIds, t.id]
                              : topicIds.filter((id) => id !== t.id),
                          )
                        }
                      />
                      {t.name}
                    </label>
                    <select
                      aria-label={`Dificultad de ${t.name}`}
                      value={difficulties[t.id] ?? t.difficulty}
                      onChange={(e) =>
                        setDifficulties({
                          ...difficulties,
                          [t.id]: Number(e.target.value) as Topic["difficulty"],
                        })
                      }
                    >
                      {Object.entries(DIFFICULTY).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              ) : (
                <Empty
                  title="Este curso todavía no tiene temario"
                  description="Crea unidades y temas dentro del curso antes de planificar."
                />
              )}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p className="form-help">
              Estos son los máximos de este plan. El límite global de
              Configuración se comparte entre todos los planes; no se suman sus
              disponibilidades.
            </p>
            <div className="weekly-inputs">
              {WEEKDAYS.map((day, i) => (
                <label key={day}>
                  {day}
                  <span>
                    <input
                      type="number"
                      min={0}
                      max={720}
                      step={5}
                      aria-label={`Minutos del plan el ${day}`}
                      value={availability[i]}
                      onChange={(e) =>
                        setAvailability(
                          availability.map((v, j) =>
                            i === j ? Number(e.target.value) : v,
                          ),
                        )
                      }
                    />
                    min
                  </span>
                </label>
              ))}
            </div>
            <div className="form-grid">
              <label>
                Duración preferida (min)
                <input
                  required
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
              <label>
                Tiempo para repasar (%)
                <input
                  required
                  type="number"
                  min={0}
                  max={50}
                  value={reviewPercent}
                  onChange={(e) => setReviewPercent(Number(e.target.value))}
                />
              </label>
              <label>
                Prioridad
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as StudyPlan["priority"])
                  }
                >
                  {Object.entries(PRIORITIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          {step > 0 && (
            <button
              className="btn ghost"
              type="button"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={14} />
              Atrás
            </button>
          )}
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" type="submit">
            {step === 2 ? "Ver calendario propuesto" : "Siguiente"}
            <ArrowRight size={14} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
