import { useState } from "react";
import type { FormEvent } from "react";
import { useStore } from "../services/store";
import { MASTERY, WEEKDAYS, studyPreferencesSchema } from "../models/schema";
import type { StudyPreferences as Preferences } from "../models/schema";
import { plusDays, todayIn } from "../services/dates";
import { nowMinute, sessionConflict, toMinute } from "../services/planner";
import { Card } from "./ui";
import SchedulePreview from "./SchedulePreview";
export default function StudyPreferences() {
  const { data, commit } = useStore();
  const [pref, setPref] = useState<Preferences>(
    structuredClone(data.studyPreferences),
  );
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  function field<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPref({ ...pref, [key]: value });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const validated = studyPreferencesSchema.safeParse(pref);
    if (!validated.success) {
      setError(
        "Revisa los minutos, intervalos y horarios. El fin del día debe ser posterior al inicio.",
      );
      return;
    }
    const test = { ...data, studyPreferences: validated.data };
    const today = todayIn(data.settings.timezone);
    const conflicts = data.scheduledSessions.filter(
      (s) =>
        s.status === "pending" &&
        (s.date > today ||
          (s.date === today &&
            toMinute(s.time) >= nowMinute(data.settings.timezone))) &&
        sessionConflict(test, s, s.id),
    ).length;
    if (
      conflicts &&
      !window.confirm(
        `${conflicts} sesiones existentes no encajan en la nueva disponibilidad. ¿Guardar las preferencias conservando sus fechas? Después puedes reprogramar con vista previa y confirmación.`,
      )
    )
      return;
    const ok = commit((d) => {
      d.studyPreferences = validated.data;
      for (const t of d.topics)
        if (t.lastStudyDate)
          t.nextReviewDate = plusDays(
            t.lastStudyDate,
            validated.data.reviewIntervals[t.mastery],
          );
    }, "Preferencias de estudio guardadas; las sesiones existentes conservan sus fechas");
    if (ok) setError("");
  }
  return (
    <>
      <Card title="Configuración de estudio" className="study-preferences">
        <form className="editor-form" onSubmit={submit}>
          <p className="form-help">
            Disponibilidad TOTAL por día para todos los planes. Cero minutos
            significa día de descanso. Los límites propios de cada plan pueden
            reducir este tiempo, nunca multiplicarlo.
          </p>
          <div className="weekly-inputs">
            {WEEKDAYS.map((day, i) => (
              <div className="weekly-day" key={day}>
                <label>
                  {day}
                  <span>
                    <input
                      aria-label={`Disponibilidad global el ${day}`}
                      type="number"
                      min={0}
                      max={720}
                      step={5}
                      required
                      value={pref.availability[i]}
                      onChange={(e) =>
                        field(
                          "availability",
                          pref.availability.map((v, j) =>
                            i === j ? Number(e.target.value) : v,
                          ),
                        )
                      }
                    />
                    min
                  </span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={pref.availability[i] === 0}
                    aria-label={`Descanso el ${day}`}
                    onChange={(e) =>
                      field(
                        "availability",
                        pref.availability.map((v, j) =>
                          i === j ? (e.target.checked ? 0 : 60) : v,
                        ),
                      )
                    }
                  />
                  Descanso
                </label>
              </div>
            ))}
          </div>
          <div className="form-grid">
            <label>
              Hora inicial de estudio
              <input
                required
                type="time"
                value={pref.dayStart}
                onChange={(e) => field("dayStart", e.target.value)}
              />
            </label>
            <label>
              Hora final de estudio
              <input
                required
                type="time"
                value={pref.dayEnd}
                onChange={(e) => field("dayEnd", e.target.value)}
              />
            </label>
            <label>
              Sesión preferida (min)
              <input
                type="number"
                required
                min={5}
                max={180}
                value={pref.preferredMinutes}
                onChange={(e) =>
                  field("preferredMinutes", Number(e.target.value))
                }
              />
            </label>
            <label>
              Reserva por tarea/actividad (min)
              <input
                type="number"
                required
                min={0}
                max={240}
                value={pref.activityReserveMinutes}
                onChange={(e) =>
                  field("activityReserveMinutes", Number(e.target.value))
                }
              />
            </label>
            <label>
              Repaso por defecto (%)
              <input
                type="number"
                required
                min={0}
                max={50}
                value={pref.reviewPercent}
                onChange={(e) => field("reviewPercent", Number(e.target.value))}
              />
            </label>
          </div>
          <h3>Pomodoro</h3>
          <div className="form-grid">
            {(
              [
                ["pomodoroMinutes", "Estudio (min)", 180],
                ["shortBreakMinutes", "Descanso corto (min)", 60],
                ["longBreakMinutes", "Descanso largo (min)", 120],
                ["longBreakEvery", "Descanso largo cada N bloques", 12],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  required
                  min={1}
                  max={max}
                  value={pref[key]}
                  onChange={(e) => field(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <h3>Repetición espaciada</h3>
          <div className="form-grid">
            {MASTERY.map((label, i) => (
              <label key={label}>
                {label} · días
                <input
                  type="number"
                  required
                  min={1}
                  max={365}
                  value={pref.reviewIntervals[i]}
                  onChange={(e) =>
                    field(
                      "reviewIntervals",
                      pref.reviewIntervals.map((v, j) =>
                        i === j ? Number(e.target.value) : v,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <p className="form-help">
            Guardar recalcula la próxima fecha recomendada de los temas ya
            estudiados, a partir de su última sesión y dominio actual. No cambia
            las fechas de las sesiones programadas hasta que confirmes una
            reprogramación. Un temporizador abierto mantiene la duración de su
            bloque actual.
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="backup-actions">
            <button className="btn primary" type="submit">
              Guardar configuración de estudio
            </button>
            <button
              className="btn soft"
              type="button"
              onClick={() => setPreview(true)}
            >
              Previsualizar reprogramación
            </button>
          </div>
        </form>
      </Card>
      {preview && <SchedulePreview onClose={() => setPreview(false)} />}
    </>
  );
}
