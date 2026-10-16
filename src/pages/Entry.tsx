import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "../services/store";
import {
  entryProfiles,
  entryProject,
  entryBindings,
  entryIdentity,
  entryMismatch,
  bindEntry,
  ENTRY_GRANT_KEY,
  readEntryGrant,
  workspacePath,
} from "../services/entry";
import type { EntryProfile, EntryGrant } from "../services/entry";
import AccountSignIn from "../components/AccountSignIn";
import AccountSetup from "../components/AccountSetup";
import LandingCalendar from "../components/LandingCalendar";
import { downloadText, serializeBackup } from "../services/storage";

function EntryFrame({ children }: { children: ReactNode }) {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="entry-page">
      <header className="entry-header">
        <Link to="/" className="entry-brand">
          <GraduationCap size={29} />
          <span>
            Study<span>Space</span>
          </span>
        </Link>
        <span className="entry-header-label">Espacios académicos</span>
      </header>
      <main id="entry-content" tabIndex={-1} ref={main}>
        {children}
      </main>
      <footer className="entry-footer">
        StudySpace · Cursos, tareas y calendario.
      </footer>
    </div>
  );
}
function ProfileAvatar({
  profile,
}: {
  profile: (typeof entryProfiles)[number];
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="entry-avatar" aria-hidden="true">
      {profile.avatarSrc && !failed ? (
        <img src={profile.avatarSrc} alt="" onError={() => setFailed(true)} />
      ) : (
        profile.initials
      )}
    </span>
  );
}
function Landing() {
  const { cloud, localAccess } = useStore();
  const location = useLocation();
  const next = workspacePath(location.pathname)
    ? `?next=${encodeURIComponent(location.pathname + location.search)}`
    : "";
  return (
    <EntryFrame>
      <div className="entry-intro">
        <span className="entry-eyebrow">STUDYSPACE</span>
        <h1>Elige tu espacio</h1>
        <p>Accede a tus cursos y consulta el calendario conjunto.</p>
      </div>
      <div className="entry-profiles">
        {entryProfiles.map((profile) => (
          <Link
            key={profile.id}
            className={`entry-profile ${profile.id}`}
            to={`/acceso/${profile.id}${next}`}
            aria-label={`Entrar al espacio de ${profile.name}`}
          >
            <ProfileAvatar profile={profile} />
            <div className="entry-profile-body">
              <h2>{profile.name}</h2>
              <p className="entry-profile-label">Algunos de sus cursos</p>
              <ul>
                {profile.courses.map((course) => (
                  <li key={course}>{course}</li>
                ))}
              </ul>
            </div>
            <span className="entry-enter">
              Entrar a mi espacio
              <ArrowRight size={19} />
            </span>
          </Link>
        ))}
      </div>
      <LandingCalendar />
      {!cloud.user && localAccess && (
        <details className="entry-local">
          <summary>Datos de este navegador</summary>
          <p>El espacio local se conserva por separado de las cuentas.</p>
          <Link className="btn soft" to="/local">
            Abrir espacio local
          </Link>
        </details>
      )}
    </EntryFrame>
  );
}
function Access({
  profile,
  enter,
}: {
  profile: EntryProfile;
  enter: (p: EntryProfile, id: string) => void;
}) {
  const store = useStore();
  const { cloud, data } = store;
  const person = entryProfiles.find((p) => p.id === profile)!;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, refreshBinding] = useState(0);
  const mismatch =
    !!cloud.user && entryMismatch(profile, cloud.user.id, data.settings);
  const ready =
    cloud.mode === "cloud" && !["loading", "saving"].includes(cloud.status);
  const recognized = cloud.user && entryBindings()[profile] === cloud.user.id;
  // A valid session already identifies the owner. Bind an unrecognized card
  // automatically only when its academic profile does not contradict the
  // selected card. A known binding to another UUID is never overwritten.
  useEffect(() => {
    if (!cloud.user || mismatch || recognized) return;
    if (
      !(cloud.mode === "cloud" && ready) &&
      !(cloud.mode === "setup" && cloud.status === "local")
    ) return;
    try {
      bindEntry(profile, cloud.user.id);
      refreshBinding((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [cloud.user?.id, cloud.mode, cloud.status, ready, recognized, mismatch, profile]);
  useEffect(() => {
    if (cloud.user && ready && recognized && !mismatch)
      enter(profile, cloud.user.id);
  }, [cloud.user?.id, ready, recognized, mismatch, profile]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <EntryFrame>
      <div className={`entry-access ${profile}`}>
        <Link className="entry-back" to="/">
          <ArrowLeft size={17} />
          Volver a la portada
        </Link>
        <ProfileAvatar profile={person} />
        <h1>Acceso de {person.name}</h1>
        {cloud.user ? (
          mismatch ? (
            <>
              <p>
                Hay otra sesión abierta en este navegador. Para entrar como{" "}
                {person.name}, inicia sesión con su cuenta.
              </p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void run(store.signOut)}
              >
                Cambiar de cuenta y continuar
              </button>
            </>
          ) : cloud.status === "loading" || cloud.status === "saving" ? (
            <p role="status">Comprobando la sesión…</p>
          ) : cloud.mode === "setup" ? (
            cloud.status === "local" ? (
              recognized ? (
                <AccountSetup
                  initialName={person.name}
                  initialPreset={profile}
                  fixedPreset={profile}
                />
              ) : (
                <p role="status">Preparando el espacio de {person.name}…</p>
              )
            ) : (
              <>
                <p role="alert">
                  {cloud.error || "No se pudo cargar la cuenta."}
                </p>
                <button
                  className="btn soft"
                  disabled={busy}
                  onClick={() => void run(store.syncNow)}
                >
                  Volver a comprobar
                </button>
              </>
            )
          ) : recognized ? (
            <p role="status">Abriendo tu espacio…</p>
          ) : (
            <p role="status">Abriendo el espacio de {person.name}…</p>
          )
        ) : (
          <>
            <p>Usa el correo de {person.name} para acceder a su cuenta.</p>
            <AccountSignIn connection />
          </>
        )}
        {cloud.user &&
          ["pending", "conflict", "error", "offline"].includes(
            cloud.status,
          ) && (
            <div className="entry-recovery">
              <p>Conserva los cambios pendientes antes de cambiar de cuenta.</p>
              <button
                className="btn soft"
                disabled={busy}
                onClick={() => void run(store.syncNow)}
              >
                Sincronizar cambios
              </button>
              <button
                className="btn soft"
                onClick={() =>
                  downloadText(
                    serializeBackup(data),
                    "studyspace-copia-personal.json",
                  )
                }
              >
                Descargar copia de la sesión actual
              </button>
            </div>
          )}
        {error && (
          <p className="integration-error" role="alert">
            {error}
          </p>
        )}
        <p className="entry-access-note">
          <ShieldCheck size={16} />
          Cada cuenta conserva sus datos por separado.
        </p>
      </div>
    </EntryFrame>
  );
}
export default function EntryRouter({ workspace }: { workspace: ReactNode }) {
  const { cloud, localAccess } = useStore();
  const location = useLocation(),
    navigate = useNavigate();
  const [grant, setGrant] = useState<EntryGrant | null>(readEntryGrant);
  const local = location.pathname === "/local" && !cloud.user && localAccess;
  useEffect(() => {
    if (local) {
      const next: EntryGrant = {
        profile: "local",
        userId: null,
        project: entryProject(),
      };
      setGrant(next);
      try {
        sessionStorage.setItem(ENTRY_GRANT_KEY, JSON.stringify(next));
      } catch {
        /* Memory access remains available. */
      }
    }
  }, [local]);
  function enter(profile: EntryProfile, userId: string) {
    const next: EntryGrant = { profile, userId, project: entryProject() };
    setGrant(next);
    try {
      sessionStorage.setItem(ENTRY_GRANT_KEY, JSON.stringify(next));
    } catch {
      /* Session memory is enough. */
    }
    const requested = new URLSearchParams(location.search).get("next") ?? "";
    navigate(
      workspacePath(requested)
        ? requested
        : workspacePath(location.pathname)
          ? location.pathname + location.search
          : "/espacio",
      { replace: true },
    );
  }
  if (location.pathname === "/") return <Landing />;
  const requested = location.pathname.match(
    /^\/acceso\/(fabrizio|catalina)$/,
  )?.[1] as EntryProfile | undefined;
  if (requested)
    return (
      <Access
        key={`${requested}:${cloud.user?.id ?? "out"}`}
        profile={requested}
        enter={enter}
      />
    );
  const authorized =
    local ||
    (grant?.profile === "local"
      ? !cloud.user && localAccess
      : grant &&
        grant.project === entryProject() &&
        cloud.mode === "cloud" &&
        cloud.user?.id === grant.userId &&
        entryBindings()[grant.profile] === cloud.user?.id);
  if (authorized) return workspace;
  const selected = grant?.profile !== "local" ? grant?.profile : undefined;
  const identified = cloud.user ? entryIdentity(cloud.user.id) : undefined;
  if (selected || identified)
    return (
      <Access
        key={`${selected ?? identified}:${cloud.user?.id ?? "out"}`}
        profile={(selected ?? identified)!}
        enter={enter}
      />
    );
  return <Landing />;
}
