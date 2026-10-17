import { useState } from "react";

const OTP_PENDING_TTL = 15 * 60 * 1000;
function pendingOtpKey() {
  const route = window.location.hash.split("?")[0];
  return `studyspace:pending-email-code:v1:${loadConfig().supabaseUrl}:${route}`;
}
function readPendingOtp(): string {
  try {
    const raw = sessionStorage.getItem(pendingOtpKey());
    if (!raw) return "";
    const value = JSON.parse(raw) as { email?: unknown; sentAt?: unknown };
    if (typeof value.email === "string" && typeof value.sentAt === "number" && Date.now() - value.sentAt < OTP_PENDING_TTL && Date.now() >= value.sentAt) return value.email;
    sessionStorage.removeItem(pendingOtpKey());
  } catch { /* A private browsing session may restrict storage. */ }
  return "";
}
function savePendingOtp(email: string) {
  try { sessionStorage.setItem(pendingOtpKey(), JSON.stringify({ email, sentAt: Date.now() })); } catch { /* The form still works without persistence. */ }
}
function clearPendingOtp() {
  try { sessionStorage.removeItem(pendingOtpKey()); } catch { /* Ignore unavailable storage. */ }
}

import { useStore } from "../services/store";
import { loadConfig, saveConfig } from "../services/config";
export default function AccountSignIn({
  connection = false,
}: {
  connection?: boolean;
}) {
  const store = useStore();
  const [config, setConfig] = useState(loadConfig);
  const [pendingEmail] = useState(readPendingOtp);
  const [email, setEmail] = useState(pendingEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(!!pendingEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            if (sent) {
              await store.verifyCode(email.trim(), code.trim());
              clearPendingOtp();
            } else {
              await store.sendCode(email.trim());
              savePendingOtp(email.trim());
              setSent(true);
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sent || busy}
          />
        </label>
        {sent && (
          <p className="form-help" role="status">
            Correo enviado a {email}. Revisa el mensaje en otra pestaña: si contiene un código, escríbelo abajo; si contiene un botón «Sign in», ese enlace inicia sesión directamente. No necesitas pedir otro correo al recargar.
          </p>
        )}
        {sent && (
          <label>
            Código recibido
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              minLength={6}
              maxLength={12}
            />
          </label>
        )}
        <button
          className="btn primary"
          disabled={busy || !config.supabaseUrl || !config.supabaseKey}
        >
          {busy ? "Conectando…" : sent ? "Iniciar sesión" : "Enviar código"}
        </button>
        {sent && (
          <button
            type="button"
            className="text-btn"
            disabled={busy}
            onClick={() => {
              clearPendingOtp();
              setSent(false);
              setCode("");
            }}
          >
            Cambiar email / solicitar otro código
          </button>
        )}
        {!config.supabaseUrl && (
          <p className="form-help">
            Configura la conexión con el proyecto Supabase para iniciar sesión.
          </p>
        )}
        {error && (
          <p className="integration-error" role="alert">
            No se pudo completar el acceso: {error}
          </p>
        )}
      </form>
      {connection && (
        <details className="entry-connection">
          <summary>Conexión con Supabase</summary>
          <form
            className="editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              try {
                if (store.cloud.user)
                  throw Error("Cierra sesión antes de cambiar el proyecto.");
                saveConfig(config);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <p className="form-help">
              Usa el mismo proyecto y su clave pública en ambos dispositivos.
            </p>
            <label>
              URL del proyecto Supabase
              <input
                type="url"
                required
                value={config.supabaseUrl}
                onChange={(e) =>
                  setConfig({ ...config, supabaseUrl: e.target.value.trim() })
                }
              />
            </label>
            <label>
              Clave pública publishable / anon
              <input
                required
                value={config.supabaseKey}
                onChange={(e) =>
                  setConfig({ ...config, supabaseKey: e.target.value.trim() })
                }
              />
            </label>
            <button className="btn soft">Guardar conexión</button>
          </form>
        </details>
      )}
    </>
  );
}
