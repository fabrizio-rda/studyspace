import {
  Atom,
  FlaskConical,
  Calculator,
  BookOpen,
  BriefcaseBusiness,
  Languages,
  Globe2,
  Brain,
  Heart,
  Rocket,
  GraduationCap,
  ArrowUpRight,
  Plus,
  X,
  Inbox,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { Course } from "../models/schema";
const icons = {
  atom: Atom,
  flask: FlaskConical,
  calculator: Calculator,
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  languages: Languages,
  globe: Globe2,
  brain: Brain,
  heart: Heart,
  rocket: Rocket,
  graduation: GraduationCap,
};
export function CourseIcon({
  course,
  size = 22,
}: {
  course?: Pick<Course, "color" | "icon">;
  size?: number;
}) {
  const Icon = icons[course?.icon ?? "book"];
  return (
    <span
      className="course-icon"
      style={{
        background: `${course?.color ?? "#A18BE0"}27`,
        color: "#555064",
      }}
    >
      <Icon size={size} strokeWidth={1.7} />
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={26} strokeWidth={1.4} />
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Card({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function AddButton({
  onClick,
  label = "Añadir",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="btn primary" onClick={onClick}>
      <Plus size={17} />
      {label}
    </button>
  );
}
export function ArrowButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className="icon-btn"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <ArrowUpRight size={19} />
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
