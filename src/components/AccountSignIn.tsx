import { useEffect, useState } from "react";
import { accountAccessError } from "../services/auth-errors";

const OTP_PENDING_TTL = 15 * 60 * 1000;
function pendingOtpKey() {
  const route = window.location.hash.split("?")[0];
  return `studyspace:pending-email-code:v1:${loadConfig().supabaseUrl}:${route}`;
}
function readPendingOtp(): { email: string; sentAt: number } | null {
  try {
    const raw = sessionStorage.getItem(pendingOtpKey());
    if (!raw) return null;
    const value = JSON.parse(raw) as { email?: unknown; sentAt?: unknown };
    if (
      typeof value.email === "string" &&
      typeof value.sentAt === "number" &&
      Date.now() - value.sentAt < OTP_PENDING_TTL &&
      Date.now() >= value.sentAt
    )
      return { email: value.email, sentAt: value.sentAt };
    sessionStorage.removeItem(pendingOtpKey());
  } catch {
    /* A private browsing session may restrict storage. */
  }
  return null;
}
function savePendingOtp(email: string) {
  try {
    sessionStorage.setItem(
      pendingOtpKey(),
      JSON.stringify({ email, sentAt: Date.now() }),
    );
  } catch {
    /* The form still works without persistence. */
  }
}
function clearPendingOtp() {
  try {
    sessionStorage.removeItem(pendingOtpKey());
  } catch {
    /* Ignore unavailable storage. */
  }
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
  const [email, setEmail] = useState(pendingEmail?.email ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(!!pendingEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState((pendingEmail?.sentAt ?? 0) + 60000);
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  async function requestEmail() {
    await store.sendCode(email.trim());
    savePendingOtp(email.trim());
    setNow(Date.now());
    setRetryAt(Date.now() + 60000);
    setSent(true);
    setCode("");
  }
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
              await requestEmail();
            }
          } catch (e) {
            setError(accountAccessError(e));
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
            Solicitud enviada para {email}. Revisa la bandeja de entrada y
            correo no deseado: el mensaje puede contener un código o un enlace
            «Sign in» / «Confirm your signup». Si trae un enlace, ábrelo para
            iniciar sesión; no tienes que inventar un código. No necesitas pedir
            otro correo al recargar.
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
            className="btn soft"
            disabled={busy || remaining > 0}
            onClick={async () => {
              if (busy || Date.now() < retryAt) return;
              setBusy(true);
              setError("");
              try {
                await requestEmail();
              } catch (e) {
                setError(accountAccessError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {remaining > 0
              ? `Reenviar correo en ${remaining} s`
              : "Reenviar correo"}
          </button>
        )}
        {sent && (
          <details className="form-help">
            <summary>No recibí el correo</summary>
            <p>
              Busca mensajes de Supabase y revisa spam. Si usas el correo del
              colegio, puede estar retenido por su filtro. Espera al menos un
              minuto antes de reenviar. Si aparece un error de envío, sigue la
              indicación que muestra abajo.
            </p>
          </details>
        )}
        {sent && (
          <button
            type="button"
            className="text-btn"
            disabled={busy}
            onClick={() => {
              clearPendingOtp();
              setSent(false);
              setCode("");
              setError("");
            }}
          >
            Cambiar email
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
                setError(accountAccessError(e));
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
