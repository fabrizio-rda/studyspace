import type { Visibility } from "../models/schema";
export const visibilityLabels = {
  private: "Privado",
  busy: "Solo disponibilidad",
  details: "Compartido con detalles",
};
export default function VisibilitySelect({
  value,
  onChange,
  label = "Visibilidad en calendario compartido",
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  label?: string;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Visibility)}
      >
        {Object.entries(visibilityLabels).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <small className="form-help">
        Privado no aparece a la otra persona. Disponibilidad oculta título,
        curso y tipo. Los detalles nunca incluyen notas, documentos ni
        resultados.
      </small>
    </label>
  );
}
