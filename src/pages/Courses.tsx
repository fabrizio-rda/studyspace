import { useState, useEffect } from "react";
import Syllabus from "../components/Syllabus";
import { topicProgress } from "../services/planner";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  BookOpen,
  CalendarDays,
  Pencil,
  Trash2,
} from "lucide-react";
import { useStore } from "../services/store";
import { todayIn, displayDate } from "../services/dates";
import { AddButton, Card, CourseIcon, Empty } from "../components/ui";
import { TaskList } from "../components/TaskList";
import { useEditor } from "../components/AppContext";
import type { Course } from "../models/schema";
export default function Courses() {
  const { data, updateSettings, commit } = useStore();
  const open = useEditor();
  const navigate = useNavigate();
  const courses = data.courses
    .filter((c) => data.settings.showArchived || !c.archived)
    .sort((a, b) => a.order - b.order);
  const today = todayIn(data.settings.timezone);
  function move(id: string, direction: number) {
    commit((d) => {
      const sorted = [...d.courses].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((c) => c.id === id);
      const other = index + direction;
      if (other < 0 || other >= sorted.length) return;
      [sorted[index], sorted[other]] = [sorted[other], sorted[index]];
      sorted.forEach((c, i) => (c.order = i));
    }, "Orden de cursos actualizado");
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Mis cursos</h1>
          <p>
            {data.courses.filter((c) => !c.archived).length} cursos activos.
            Tareas, temario y materiales por curso.
          </p>
        </div>
        <AddButton
          label="Nuevo curso"
          onClick={() => open({ kind: "course" })}
        />
      </div>
      <div className="courses-toolbar">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={data.settings.showArchived}
            onChange={(e) => updateSettings({ showArchived: e.target.checked })}
          />
          Mostrar archivados
        </label>
        <span className="muted">Usa las flechas para ordenar tus cursos.</span>
      </div>
      <div className="course-grid">
        {courses.map((c) => {
          const learning = topicProgress(data, c.id);
          const upcoming = [
            ...data.tasks
              .filter(
                (t) =>
                  t.courseId === c.id &&
                  t.type === "examen" &&
                  t.status !== "completada" &&
                  t.dueDate >= today,
              )
              .map((t) => t.dueDate),
            ...data.events
              .filter(
                (e) =>
                  e.courseId === c.id && e.type === "examen" && e.date >= today,
              )
              .map((e) => e.date),
          ].sort()[0];
          return (
            <article
              className={`course-card ${c.archived ? "archived" : ""}`}
              key={c.id}
              style={{ "--course-color": c.color } as React.CSSProperties}
            >
              <div className="course-card-top">
                <CourseIcon course={c} size={27} />
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    aria-label={`Subir ${c.name}`}
                    disabled={
                      c.id ===
                      [...data.courses].sort((a, b) => a.order - b.order)[0]?.id
                    }
                    onClick={() => move(c.id, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Bajar ${c.name}`}
                    disabled={
                      c.id ===
                      [...data.courses].sort((a, b) => b.order - a.order)[0]?.id
                    }
                    onClick={() => move(c.id, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
              </div>
              <button
                className="course-open"
                onClick={() => navigate(`/cursos/${c.id}`)}
              >
                <h2>{c.name}</h2>
                {c.archived && <span className="badge">Archivado</span>}
                <p>{c.description || "Sin descripción."}</p>
                <div className="course-card-bottom">
                  <span>
                    {
                      data.tasks.filter(
                        (t) => t.courseId === c.id && t.status !== "completada",
                      ).length
                    }{" "}
                    pendientes
                  </span>
                  <ArrowUpRight size={20} />
                </div>
              </button>
              {learning.total > 0 && (
                <p className="course-topic-progress">
                  Temario:{" "}
                  {Math.round((learning.completed / learning.total) * 100)}%
                  completado ·{" "}
                  {Math.round((learning.mastered / learning.total) * 100)}%
                  dominado
                </p>
              )}
              <div className="course-next">
                <CalendarDays size={13} />
                {upcoming
                  ? `Próxima evaluación: ${displayDate(upcoming)}`
                  : "Sin evaluaciones programadas"}
              </div>
            </article>
          );
        })}
      </div>
      {data.units.some((u) => u.courseId === null) && (
        <button
          className="btn soft"
          onClick={() => navigate("/cursos/sin-curso")}
        >
          Ver temarios conservados sin curso
        </button>
      )}
      {!courses.length && (
        <Empty
          title="No hay cursos"
          action={
            <button
              className="btn soft"
              onClick={() => open({ kind: "course" })}
            >
              Crear curso
            </button>
          }
        />
      )}
    </div>
  );
}
export function CourseDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(
    window.location.hash.includes("temario=1") ? "syllabus" : "overview",
  );
  useEffect(() => {
    if (searchParams.get("temario")) setTab("syllabus");
  }, [searchParams]);
  const { data, commit, deleteCourse } = useStore();
  const open = useEditor();
  const navigate = useNavigate();
  const course = data.courses.find((c) => c.id === id);
  const today = todayIn(data.settings.timezone);
  if (id === "sin-curso")
    return (
      <div className="page">
        <button className="text-btn" onClick={() => navigate("/cursos")}>
          Volver a cursos
        </button>
        <h1>Temarios sin curso</h1>
        <p className="form-help">
          Contenido conservado después de eliminar un curso.
        </p>
        <Syllabus courseId={null} />
      </div>
    );
  if (!course)
    return (
      <Empty
        title="No encontramos este curso"
        description="Puede haberse eliminado."
        action={
          <button className="btn primary" onClick={() => navigate("/cursos")}>
            Volver a mis cursos
          </button>
        }
      />
    );
  const tasks = data.tasks
    .filter((t) => t.courseId === id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const events = data.events
    .filter((e) => e.courseId === id && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = tasks.filter(
    (t) =>
      t.type === "examen" && t.dueDate >= today && t.status !== "completada",
  );
  function remove(c: Course) {
    const count =
      data.tasks.filter((t) => t.courseId === c.id).length +
      data.events.filter((e) => e.courseId === c.id).length;
    if (
      window.confirm(
        `¿Eliminar el curso «${c.name}»? Se conservarán sus ${count} tareas y actividades, temario, planes y sesiones como «Sin curso». Solo se eliminarán el curso y su descripción. Esta acción no se puede deshacer.`,
      )
    ) {
      if (deleteCourse(c.id)) navigate("/cursos");
    }
  }
  return (
    <div className="page">
      <button
        className="text-btn back-link"
        onClick={() => navigate("/cursos")}
      >
        <ArrowLeft size={16} />
        Mis cursos
      </button>
      <div
        className="course-hero"
        style={{
          background: `linear-gradient(120deg,${course.color}55,${course.color}15)`,
        }}
      >
        <CourseIcon course={course} size={35} />
        <div>
          <p className="eyebrow">
            {course.archived ? "CURSO ARCHIVADO" : "MI ESPACIO DE APRENDIZAJE"}
          </p>
          <h1>{course.name}</h1>
          <p className="course-description">
            {course.description || "Sin descripción. Puedes editarla."}
          </p>
        </div>
        <button
          className="btn soft"
          onClick={() => open({ kind: "course", item: course })}
        >
          <Pencil size={15} />
          Editar curso
        </button>
      </div>
      <div className="detail-actions">
        <AddButton
          label="Nueva tarea"
          onClick={() => open({ kind: "task", courseId: course.id })}
        />
        <button
          className="btn ghost"
          onClick={() =>
            open({ kind: "task", courseId: course.id, type: "examen" })
          }
        >
          <CalendarDays size={16} />
          Nuevo examen
        </button>
        <button
          className="btn ghost"
          onClick={() =>
            commit(
              (d) => {
                const c = d.courses.find((x) => x.id === course.id)!;
                c.archived = !c.archived;
              },
              course.archived ? "Curso restaurado" : "Curso archivado",
            )
          }
        >
          {course.archived ? (
            <ArchiveRestore size={16} />
          ) : (
            <Archive size={16} />
          )}{" "}
          {course.archived ? "Restaurar" : "Archivar"}
        </button>
        <button className="btn danger" onClick={() => remove(course)}>
          <Trash2 size={16} />
          Eliminar curso
        </button>
      </div>
      <div
        className="tabs study-tabs"
        role="tablist"
        aria-label="Secciones del curso"
      >
        <button
          role="tab"
          aria-selected={tab === "overview"}
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Resumen
        </button>
        <button
          role="tab"
          aria-selected={tab === "syllabus"}
          className={tab === "syllabus" ? "active" : ""}
          onClick={() => setTab("syllabus")}
        >
          Temario
        </button>
      </div>
      {tab === "syllabus" ? (
        <Syllabus courseId={course.id} />
      ) : (
        <>
          <Card
            title="Tareas del curso"
            action={<span className="count-pill">{tasks.length}</span>}
          >
            {tasks.length ? (
              <TaskList
                tasks={tasks}
                onEdit={(item) => open({ kind: "task", item })}
              />
            ) : (
              <Empty
                title="Sin tareas en este curso"
                description="Las tareas que crees para este curso aparecerán aquí."
              />
            )}
          </Card>
          <div className="detail-grid">
            <Card title="Evaluaciones próximas">
              {upcoming.length || events.some((e) => e.type === "examen") ? (
                <div className="simple-list">
                  {[
                    ...upcoming.map((t) => ({
                      id: t.id,
                      title: t.title,
                      date: t.dueDate,
                      edit: () => open({ kind: "task", item: t }),
                    })),
                    ...events
                      .filter((e) => e.type === "examen")
                      .map((e) => ({
                        id: e.id,
                        title: e.title,
                        date: e.date,
                        edit: () => open({ kind: "event", item: e }),
                      })),
                  ]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((e) => (
                      <button key={e.id} onClick={e.edit}>
                        <CalendarDays size={17} />
                        <span>{e.title}</span>
                        <small>{displayDate(e.date)}</small>
                      </button>
                    ))}
                </div>
              ) : (
                <Empty title="Sin evaluaciones por ahora" />
              )}
            </Card>
            <Card
              title="Materiales"
              action={
                <span className="count-pill">
                  {data.documents.filter((d) => d.courseId === course.id).length}
                </span>
              }
            >
              <p className="form-help">
                Consulta los documentos y enlaces asociados con este curso.
              </p>
              <button
                className="btn soft"
                onClick={() =>
                  navigate(`/biblioteca?curso=${encodeURIComponent(course.id)}`)
                }
              >
                <BookOpen size={17} />
                Ver materiales del curso
              </button>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
