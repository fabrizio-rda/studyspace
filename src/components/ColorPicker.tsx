import { useState } from "react";
import { COURSE_PALETTE } from "../models/schema";
export function normalizeHex(value: string) {
  const v = value.trim().replace(/^#/, "");
  return /^[a-f\d]{3}$/i.test(v)
    ? `#${v
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase()}`
    : /^[a-f\d]{6}$/i.test(v)
      ? `#${v.toUpperCase()}`
      : null;
}
export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [hex, setHex] = useState(value);
  function update(v: string) {
    setHex(v);
    const valid = normalizeHex(v);
    if (valid) onChange(valid);
  }
  return (
    <fieldset>
      <legend>Color</legend>
      <div className="color-options expanded">
        {COURSE_PALETTE.map(([name, color]) => (
          <button
            type="button"
            key={color}
            title={name}
            aria-label={`${name} ${color}`}
            aria-pressed={value.toUpperCase() === color}
            className={value.toUpperCase() === color ? "chosen" : ""}
            style={{ background: color }}
            onClick={() => {
              setHex(color);
              onChange(color);
            }}
          />
        ))}
      </div>
      <div className="custom-color">
        <label>
          Color personalizado
          <input
            type="color"
            aria-label="Color personalizado"
            value={value}
            onChange={(e) => update(e.target.value)}
          />
        </label>
        <label>
          Hexadecimal
          <input
            value={hex}
            onChange={(e) => update(e.target.value)}
            pattern="#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})"
            required
            aria-invalid={!normalizeHex(hex)}
            maxLength={7}
          />
        </label>
      </div>
      {!normalizeHex(hex) && (
        <small role="alert">
          Usa un hexadecimal válido, por ejemplo #83A8EB.
        </small>
      )}
    </fieldset>
  );
}
