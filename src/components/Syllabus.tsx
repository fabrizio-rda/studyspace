import { useFormStore } from "../services/form-store";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  History,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useStore } from "../services/store";
import { DIFFICULTY, MASTERY } from "../models/schema";
import type { Topic, Unit } from "../models/schema";
import { Card, Empty, Modal } from "./ui";
import { removeContent } from "../services/study";
import { topicProgress } from "../services/planner";
import { displayDate } from "../services/dates";
export default function Syllabus({ courseId }: { courseId: string | null }) {
  const { data, commit } = useStore();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const target = searchParams.get("tema");
    if (target) {
      const element = document.getElementById(`topic-${target}`);
      element?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      element?.focus();
    }
  }, [searchParams]);
  const [editor, setEditor] = useState<
    | { kind: "unit"; item?: Unit }
    | { kind: "topic"; unitId: string; parentId: string | null; item?: Topic }
    | null
  >(null);
  const [history, setHistory] = useState<Topic | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const units = data.units
    .filter((u) => u.courseId === courseId)
    .sort((a, b) => a.order - b.order);
  const progress = courseId
    ? topicProgress(data, courseId)
    : {
        total: data.topics.filter((t) => units.some((u) => u.id === t.unitId))
          .length,
        completed: data.topics.filter(
          (t) => units.some((u) => u.id === t.unitId) && t.completed,
        ).length,
        mastered: data.topics.filter(
          (t) => units.some((u) => u.id === t.unitId) && t.mastery === 3,
        ).length,
      };
  function move(id: string, kind: "unit" | "topic", direction: number) {
    commit((d) => {
      const collection =
        kind === "unit"
          ? d.units.filter((u) => u.courseId === courseId)
          : d.topics.filter((t) => {
              const original = d.topics.find((x) => x.id === id)!;
              return (
                t.unitId === original.unitId && t.parentId === original.parentId
              );
            });
      const list = collection.sort((a, b) => a.order - b.order);
      const i = list.findIndex((x) => x.id === id),
        j = i + direction;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((x, index) => (x.order = index));
    });
  }
  function remove(id: string, kind: "unit" | "topic") {
    const ids =
      kind === "unit"
        ? data.topics.filter((t) => t.unitId === id).map((t) => t.id)
        : data.topics
            .filter((t) => t.id === id || t.parentId === id)
            .map((t) => t.id);
    if (
      window.confirm(
        `¿Eliminar ${kind === "unit" ? "esta unidad y todos sus contenidos" : "este tema y sus subtemas"}? Se quitarán de los planes y se cancelarán sus sesiones pendientes. Los registros de estudio se conservarán.`,
      )
    )
      commit((d) => {
        removeContent(d, ids);
        if (kind === "unit") d.units = d.units.filter((u) => u.id !== id);
      }, "Contenido eliminado; historial conservado");
  }
  function renderTopic(t: Topic) {
    const children = data.topics
      .filter((x) => x.parentId === t.id)
      .sort((a, b) => a.order - b.order);
    const folded = collapsed.includes(t.id);
    return (
      <div
        key={t.id}
        id={`topic-${t.id}`}
        tabIndex={-1}
        className={`syllabus-topic ${t.parentId ? "subtopic" : ""}`}
      >
        <div className="topic-line">
          <button
            className="check-btn"
            aria-label={`${t.completed ? "Desmarcar" : "Completar"} tema ${t.name}`}
            aria-pressed={t.completed}
            onClick={() =>
              commit((d) => {
                const x = d.topics.find((x) => x.id === t.id)!;
                x.completed = !x.completed;
              }, "Progreso del tema actualizado")
            }
          >
            {t.completed && <Check size={13} />}
          </button>
          {children.length > 0 && (
            <button
              className="icon-btn"
              aria-label={`Desplegar ${t.name}`}
              aria-expanded={!folded}
              onClick={() =>
                setCollapsed(
                  folded
                    ? collapsed.filter((x) => x !== t.id)
                    : [...collapsed, t.id],
                )
              }
            >
              {folded ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          <div className="topic-name">
            <strong>{t.name}</strong>
            {t.description && <p>{t.description}</p>}
            <small>
              Dificultad: {DIFFICULTY[t.difficulty]}
              {t.nextReviewDate
                ? ` · Próximo repaso: ${displayDate(t.nextReviewDate)}`
                : ""}
            </small>
          </div>
          <select
            className={`mastery-select mastery-${t.mastery}`}
            aria-label={`Dominio de ${t.name}`}
            value={t.mastery}
            onChange={(e) =>
              commit((d) => {
                d.topics.find((x) => x.id === t.id)!.mastery = Number(
                  e.target.value,
                );
              }, "Dominio actualizado; no cambia la fecha de repaso hasta registrar una sesión")
            }
          >
            {MASTERY.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <div className="row-actions">
            <button
              className="icon-btn"
              aria-label={`Subir tema ${t.name}`}
              onClick={() => move(t.id, "topic", -1)}
            >
              <ArrowUp size={13} />
            </button>
            <button
              className="icon-btn"
              aria-label={`Bajar tema ${t.name}`}
              onClick={() => move(t.id, "topic", 1)}
            >
              <ArrowDown size={13} />
            </button>
            <button
              className="icon-btn"
              aria-label={`Historial de ${t.name}`}
              onClick={() => setHistory(t)}
            >
              <History size={14} />
            </button>
            <button
              className="icon-btn"
              aria-label={`Editar tema ${t.name}`}
              onClick={() =>
                setEditor({
                  kind: "topic",
                  unitId: t.unitId,
                  parentId: t.parentId,
                  item: t,
                })
              }
            >
              <Pencil size={14} />
            </button>
            <button
              className="icon-btn danger-icon"
              aria-label={`Eliminar tema ${t.name}`}
              onClick={() => remove(t.id, "topic")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {!t.parentId && (
          <button
            className="text-btn add-subtopic"
            onClick={() =>
              setEditor({ kind: "topic", unitId: t.unitId, parentId: t.id })
            }
          >
            + Subtema
          </button>
        )}
        {!folded && children.map(renderTopic)}
      </div>
    );
  }
  return (
    <div className="syllabus">
      <div className="study-toolbar">
        <div>
          <h2>Temario</h2>
          <p className="muted">
            {progress.total
              ? `${progress.completed}/${progress.total} completados (${Math.round((progress.completed / progress.total) * 100)}%) · ${progress.mastered}/${progress.total} dominados (${Math.round((progress.mastered / progress.total) * 100)}%)`
              : "Sin temas registrados. No se calcula progreso."}
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => setEditor({ kind: "unit" })}
        >
          <Plus size={15} />
          Nueva unidad
        </button>
      </div>
      {units.length ? (
        units.map((u) => (
          <Card
            key={u.id}
            title={u.name}
            className="unit-card"
            action={
              <div className="row-actions">
                <button
                  className="icon-btn"
                  aria-label={`Desplegar unidad ${u.name}`}
                  aria-expanded={!collapsed.includes(u.id)}
                  onClick={() =>
                    setCollapsed(
                      collapsed.includes(u.id)
                        ? collapsed.filter((x) => x !== u.id)
                        : [...collapsed, u.id],
                    )
                  }
                >
                  {collapsed.includes(u.id) ? (
                    <ChevronRight size={15} />
                  ) : (
                    <ChevronDown size={15} />
                  )}
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Subir unidad ${u.name}`}
                  disabled={units[0]?.id === u.id}
                  onClick={() => move(u.id, "unit", -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Bajar unidad ${u.name}`}
                  disabled={units[units.length - 1]?.id === u.id}
                  onClick={() => move(u.id, "unit", 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Editar unidad ${u.name}`}
                  onClick={() => setEditor({ kind: "unit", item: u })}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-btn danger-icon"
                  aria-label={`Eliminar unidad ${u.name}`}
                  onClick={() => remove(u.id, "unit")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            }
          >
            {!collapsed.includes(u.id) && (
              <>
                {u.description && (
                  <p className="muted unit-description">{u.description}</p>
                )}
                {data.topics
                  .filter((t) => t.unitId === u.id && !t.parentId)
                  .sort((a, b) => a.order - b.order)
                  .map(renderTopic)}
                <button
                  className="dashed-add"
                  onClick={() =>
                    setEditor({ kind: "topic", unitId: u.id, parentId: null })
                  }
                >
                  <Plus size={15} />
                  Añadir tema
                </button>
              </>
            )}
          </Card>
        ))
      ) : (
        <Empty
          title="No hay unidades"
          description="Crea una unidad y añade sus temas. No se cargan programas oficiales ni se marca contenido como estudiado."
        />
      )}
      {editor && (
        <ContentEditor
          key={
            editor.item?.id ??
            `${editor.kind}-${"parentId" in editor ? editor.parentId : ""}`
          }
          editor={editor}
          courseId={courseId}
          onClose={() => setEditor(null)}
        />
      )}{" "}
      {history && (
        <Modal
          title={`Historial: ${history.name}`}
          onClose={() => setHistory(null)}
        >
          <p className="form-help">
            Estudiado: {history.lastStudyDate ?? "Sin registro"} · Último
            repaso: {history.lastReviewDate ?? "Sin registro"} · Repasos:{" "}
            {history.reviewCount}
          </p>
          {data.studyLogs.some((l) => l.topicId === history.id) ? (
            <div className="study-history">
              {data.studyLogs
                .filter((l) => l.topicId === history.id)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((l) => (
                  <article key={l.id}>
                    <strong>
                      {displayDate(l.date)} ·{" "}
                      {Math.round((l.seconds / 60) * 10) / 10} min ·{" "}
                      {l.kind === "review" ? "Repaso" : "Estudio"}
                    </strong>
                    <p>
                      {l.mastery !== null
                        ? MASTERY[l.mastery]
                        : "Sin autoevaluación"}{" "}
                      ·{" "}
                      {l.status === "completed" ? "Completada" : "Interrumpida"}
                    </p>
                    {l.notes && <p>{l.notes}</p>}
                  </article>
                ))}
            </div>
          ) : (
            <Empty title="Todavía no hay sesiones registradas" />
          )}
        </Modal>
      )}
    </div>
  );
}
function ContentEditor({
  editor,
  courseId,
  onClose,
}: {
  editor:
    | { kind: "unit"; item?: Unit }
    | { kind: "topic"; unitId: string; parentId: string | null; item?: Topic };
  courseId: string | null;
  onClose: () => void;
}) {
  const { commit } = useFormStore();
  const item = editor.item;
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [difficulty, setDifficulty] = useState<Topic["difficulty"]>(
    editor.kind === "topic" ? (editor.item?.difficulty ?? 2) : 2,
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = commit((d) => {
      if (editor.kind === "unit") {
        const u: Unit = {
          id: item?.id ?? crypto.randomUUID(),
          name: name.trim(),
          description,
          courseId,
          order:
            item?.order ??
            d.units.filter((u) => u.courseId === courseId).length,
        };
        const i = d.units.findIndex((x) => x.id === u.id);
        if (i < 0) d.units.push(u);
        else d.units[i] = u;
      } else {
        const t: Topic = {
          id: item?.id ?? crypto.randomUUID(),
          unitId: editor.unitId,
          parentId: editor.parentId,
          name: name.trim(),
          description,
          difficulty,
          order:
            item?.order ??
            d.topics.filter(
              (t) =>
                t.unitId === editor.unitId && t.parentId === editor.parentId,
            ).length,
          mastery: editor.item?.mastery ?? 0,
          completed: editor.item?.completed ?? false,
          lastStudyDate: editor.item?.lastStudyDate ?? null,
          lastReviewDate: editor.item?.lastReviewDate ?? null,
          nextReviewDate: editor.item?.nextReviewDate ?? null,
          reviewCount: editor.item?.reviewCount ?? 0,
        };
        const i = d.topics.findIndex((x) => x.id === t.id);
        if (i < 0) d.topics.push(t);
        else d.topics[i] = t;
      }
    }, "Temario guardado");
    if (ok) onClose();
  }
  return (
    <Modal
      title={`${item ? "Editar" : "Crear"} ${editor.kind === "unit" ? "unidad" : editor.parentId ? "subtema" : "tema"}`}
      onClose={onClose}
    >
      <form className="editor-form" onSubmit={submit}>
        <label>
          Nombre
          <input
            autoFocus
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Descripción
          <textarea
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {editor.kind === "topic" && (
          <label>
            Dificultad
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(Number(e.target.value) as Topic["difficulty"])
              }
            >
              {Object.entries(DIFFICULTY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="form-help">
          Completar un tema y dominarlo son estados diferentes. El dominio se
          registra con tu autoevaluación.
        </p>
        <div className="modal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" type="submit">
            Guardar contenido
          </button>
        </div>
      </form>
    </Modal>
  );
}
