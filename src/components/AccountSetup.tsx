import { useState } from "react";
import { useStore } from "../services/store";
import type { AccountPreset } from "../services/accounts";
export default function AccountSetup() {
  const { cloud, startCloud } = useStore();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<AccountPreset>("catalina");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (cloud.mode !== "setup") return null;
  return (
    <section className="account-setup">
      <h3>Configura tu espacio académico</h3>
      <p>
        Esta cuenta todavía no tiene datos. Los cursos se crearán una sola vez,
        sin copiar actividades de otra persona.
      </p>
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await startCloud(name, preset);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Tu nombre
          <input
            required
            maxLength={60}
            value={name}
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Cursos iniciales
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as AccountPreset)}
          >
            <option value="catalina">Catalina · 10 cursos</option>
            <option value="fabrizio">Fabrizio · 11 cursos</option>
            <option value="custom">Elegir mis cursos después</option>
          </select>
        </label>
        <p className="form-help">
          {preset === "catalina"
            ? "English HL, Literatura HL, Matemática NM, Gestión Empresarial, Historia, TOK, CAS, Cambridge C1 Advanced, Biology y Psicología. Sin Física IB, Química IB ni AP Physics."
            : preset === "fabrizio"
              ? "Ocho cursos comunes, Física IB, Química IB y AP Physics C: Mechanics. Si ya tienes datos locales, utiliza el asistente de migración para conservarlos."
              : "Empezarás sin cursos y podrás crearlos en Mis cursos."}
        </p>
        <button
          className="btn primary"
          disabled={busy || cloud.status === "loading"}
        >
          {busy ? "Creando y verificando…" : "Crear mi espacio"}
        </button>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
