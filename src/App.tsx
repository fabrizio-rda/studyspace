import { useEffect, useRef, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ListTodo,
  Timer,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  House,
  ListChecks,
  Menu,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { StoreProvider, useStore } from "./services/store";
import { todayIn, displayDate } from "./services/dates";
import { Editors } from "./components/Editors";
import type { EditorState } from "./components/Editors";
import { EditorContext } from "./components/AppContext";
import { Modal } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Courses, { CourseDetail } from "./pages/Courses";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Plans from "./pages/Plans";
import StudySessions from "./pages/StudySessions";
import TimerRuntime from "./components/TimerRuntime";
const links = [
  { to: "/", label: "Inicio", icon: House },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/tareas", label: "Mis tareas", icon: ListChecks },
  { to: "/cursos", label: "Mis cursos", icon: BookOpen },
  { to: "/planes", label: "Planes de estudio", icon: ListTodo },
  { to: "/sesiones", label: "Sesiones de estudio", icon: Timer },
  { to: "/configuracion", label: "Configuración", icon: Settings2 },
];
function Shell() {
  const { data, storageError, notice, updateSettings } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [adding, setAdding] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [clock, setClock] = useState(0);
  const content = useRef<HTMLElement>(null);
  const collapsed = data.settings.sidebarCollapsed;
  const section =
    links.find((l) =>
      l.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(l.to),
    )?.label ?? "StudySpace";
  useEffect(() => {
    setMobile(false);
    setQuery("");
    setSearching(false);
    content.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const id = setInterval(() => setClock((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const q = query.trim().toLocaleLowerCase("es");
  const results = q
    ? [
        ...data.courses
          .filter((c) =>
            `${c.name} ${c.description}`.toLocaleLowerCase("es").includes(q),
          )
          .map((c) => ({
            id: `c-${c.id}`,
            label: c.name,
            category: "Curso",
            run: () => navigate(`/cursos/${c.id}`),
          })),
        ...data.tasks
          .filter((t) =>
            `${t.title} ${t.description}`.toLocaleLowerCase("es").includes(q),
          )
          .map((t) => ({
            id: `t-${t.id}`,
            label: t.title,
            category: "Tarea",
            run: () => setEditor({ kind: "task", item: t }),
          })),
        ...data.events
          .filter((e) =>
            `${e.title} ${e.description}`.toLocaleLowerCase("es").includes(q),
          )
          .map((e) => ({
            id: `e-${e.id}`,
            label: e.title,
            category: "Actividad",
            run: () => setEditor({ kind: "event", item: e }),
          })),
      ].slice(0, 12)
    : [];
  return (
    <EditorContext.Provider value={setEditor}>
      <div
        className={`app-shell ${collapsed ? "collapsed" : ""} ${data.settings.compact ? "is-compact" : ""}`}
        data-clock={clock}
      >
        <TimerRuntime />
        <a
          className="skip-link"
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            content.current?.focus();
          }}
        >
          Saltar al contenido
        </a>
        {mobile && (
          <button
            className="sidebar-scrim"
            aria-label="Cerrar navegación"
            onClick={() => setMobile(false)}
          />
        )}
        <aside
          id="primary-navigation"
          className={`sidebar ${mobile ? "mobile-open" : ""}`}
          aria-label="Navegación principal"
        >
          <NavLink className="brand" to="/">
            <span className="brand-mark">
              <GraduationCap size={26} strokeWidth={1.8} />
            </span>
            <span>
              Study<span className="brand-light">Space</span>
            </span>
          </NavLink>
          <button
            className="mobile-close icon-btn"
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
          <p className="nav-eyebrow">MI ESPACIO</p>
          <nav>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                aria-label={l.label}
                end={l.to === "/"}
                title={collapsed ? l.label : undefined}
                onClick={() => setMobile(false)}
              >
                <l.icon size={20} strokeWidth={1.7} />
                <span>{l.label}</span>
                {l.to === "/" && <span className="nav-active-dot" />}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <p>Los pendientes sí se acuerdan de ti.</p>
            </div>
            <button
              className="collapse-btn"
              onClick={() => updateSettings({ sidebarCollapsed: !collapsed })}
              aria-label={
                collapsed ? "Expandir barra lateral" : "Contraer barra lateral"
              }
            >
              {collapsed ? (
                <ChevronRight size={17} />
              ) : (
                <>
                  <ChevronLeft size={17} />
                  <span>Contraer menú</span>
                </>
              )}
            </button>
            <div className="sidebar-profile">
              <span className="avatar">
                {data.settings.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{data.settings.name}</strong>
                <small>Mi espacio personal</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="main-wrapper">
          <header className="topbar">
            <div className="topbar-title">
              <button
                className="icon-btn mobile-toggle"
                aria-label="Abrir menú"
                aria-controls="primary-navigation"
                aria-expanded={mobile}
                onClick={() => setMobile(true)}
              >
                <Menu size={22} />
              </button>
              <span>{section}</span>
            </div>
            <div className="topbar-actions">
              <div className="global-search">
                <label className="input-with-icon">
                  <Search size={17} />
                  <input
                    aria-label="Buscar en StudySpace"
                    placeholder="Buscar cursos y actividades…"
                    value={query}
                    onFocus={() => setSearching(true)}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSearching(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearching(false);
                      if (e.key === "Enter" && results[0]) {
                        results[0].run();
                        setSearching(false);
                      }
                    }}
                  />
                  {query && (
                    <button
                      className="search-clear"
                      aria-label="Limpiar búsqueda"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                {searching && q && (
                  <div
                    className="search-results"
                    aria-label="Resultados de búsqueda"
                  >
                    <div className="search-results-heading">
                      Resultados
                      <button
                        className="icon-btn"
                        aria-label="Cerrar resultados"
                        onClick={() => setSearching(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {results.length ? (
                      results.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            r.run();
                            setSearching(false);
                          }}
                        >
                          <span>{r.label}</span>
                          <small>{r.category}</small>
                        </button>
                      ))
                    ) : (
                      <p>No encontramos coincidencias.</p>
                    )}
                  </div>
                )}
              </div>
              <span className="topbar-date">
                {displayDate(todayIn(data.settings.timezone), "d MMM yyyy")}
              </span>
              <button
                className="btn primary add-top"
                onClick={() => setAdding(true)}
              >
                <Plus size={17} />
                <span>Añadir</span>
              </button>
              <button
                className="avatar profile-btn"
                aria-label="Abrir configuración de perfil"
                onClick={() => navigate("/configuracion")}
              >
                {data.settings.name.slice(0, 1).toUpperCase()}
              </button>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} ref={content}>
            {data.activeTimer && location.pathname !== "/sesiones" && (
              <button
                className="active-timer-banner"
                onClick={() => navigate("/sesiones")}
              >
                <Timer size={16} />
                Sesión{" "}
                {data.activeTimer.runningSince === null
                  ? "pausada"
                  : "en curso"}
                : {data.activeTimer.topicName} · Abrir temporizador
              </button>
            )}
            {storageError && (
              <div className="storage-error" role="alert">
                {storageError}
                <button
                  className="text-btn"
                  onClick={() => navigate("/configuracion")}
                >
                  Abrir recuperación
                </button>
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <Routes location={location}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tareas" element={<Tasks />} />
                  <Route path="/calendario" element={<Calendar />} />
                  <Route path="/cursos" element={<Courses />} />
                  <Route path="/cursos/:id" element={<CourseDetail />} />
                  <Route path="/planes" element={<Plans />} />
                  <Route path="/sesiones" element={<StudySessions />} />
                  <Route path="/configuracion" element={<Settings />} />
                  <Route
                    path="*"
                    element={
                      <div className="page">
                        <h1>Página no encontrada</h1>
                        <NavLink className="btn primary" to="/">
                          Volver al inicio
                        </NavLink>
                      </div>
                    }
                  />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </main>
          <footer className="app-footer">
            <span>StudySpace</span>
            <p>Cursos, tareas y calendario.</p>
            <small>FASE 02</small>
          </footer>
        </div>
        {adding && (
          <Modal title="¿Qué quieres añadir?" onClose={() => setAdding(false)}>
            <div className="add-options">
              {[
                {
                  label: "Una nueva tarea",
                  detail: "Entregas, prácticas, proyectos o lecturas",
                  icon: ListChecks,
                  editor: { kind: "task" } as EditorState,
                },
                {
                  label: "Un examen",
                  detail: "Examen con fecha y curso",
                  icon: GraduationCap,
                  editor: { kind: "task", type: "examen" } as EditorState,
                },
                {
                  label: "Una actividad",
                  detail: "Evento independiente en el calendario",
                  icon: CalendarDays,
                  editor: { kind: "event" } as EditorState,
                },
                {
                  label: "Un curso",
                  detail: "Nombre, icono y color del curso",
                  icon: BookOpen,
                  editor: { kind: "course" } as EditorState,
                },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => {
                    setAdding(false);
                    setEditor(a.editor);
                  }}
                >
                  <a.icon size={24} />
                  <span>
                    <strong>{a.label}</strong>
                    <small>{a.detail}</small>
                  </span>
                  <ChevronRight size={19} />
                </button>
              ))}
            </div>
          </Modal>
        )}
        {editor && (
          <Editors
            key={`${editor.kind}-${editor.item?.id ?? ("date" in editor ? editor.date : undefined) ?? "new"}`}
            editor={editor}
            onClose={() => setEditor(null)}
          />
        )}
        <div
          className={`toast ${notice ? "visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          {notice}
        </div>
      </div>
    </EditorContext.Provider>
  );
}
export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
