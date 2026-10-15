import { ExternalLink } from "lucide-react";
import { useStore } from "../services/store";
const names: Record<string, string> = {
  TURNED_IN: "Entregada en Classroom",
  RETURNED: "Devuelta en Classroom",
  NEW: "Sin abrir en Classroom",
  CREATED: "Pendiente en Classroom",
  RECLAIMED_BY_STUDENT: "Retirada por el estudiante",
  UNKNOWN: "Estado de entrega no disponible",
};
export function ClassroomSource({ taskId }: { taskId: string }) {
  const { data } = useStore();
  const ref = data.classroomItems.find((i) => i.taskId === taskId);
  if (!ref) return null;
  return (
    <div className="classroom-source">
      <strong>
        Google Classroom · {names[ref.submissionState] ?? ref.submissionState}
      </strong>
      <p>El estado personal de StudySpace se gestiona por separado.</p>
      <a href={ref.url} target="_blank" rel="noopener noreferrer">
        Abrir actividad original <ExternalLink size={13} />
      </a>
      <p className="form-help">
        Los cambios locales en título, descripción o fecha se conservan al
        sincronizar. Última fecha recibida: {ref.remoteDueDate || "sin fecha"}{" "}
        {ref.remoteTime}.
      </p>
    </div>
  );
}
