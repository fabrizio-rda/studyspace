import { Component, lazy, Suspense, useState } from "react";
import type { ComponentType, ReactNode } from "react";
class PageBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="page" role="alert">
        <h1>No se pudo abrir esta sección</h1>
        <p>
          Revisa la conexión y vuelve a intentarlo. Los cambios guardados se
          conservan.
        </p>
        <button className="btn primary" onClick={this.props.retry}>
          Reintentar
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
// A rejected lazy module must get a fresh loader to retry after reconnection.
export function deferredPage(load: () => Promise<{ default: ComponentType }>) {
  let sharedPage = lazy(load);
  return function DeferredPage() {
    const [attempt, setAttempt] = useState(0);
    const [Page, setPage] = useState(() => sharedPage);
    function retry() {
      sharedPage = lazy(load);
      setPage(() => sharedPage);
      setAttempt((n) => n + 1);
    }
    return (
      <PageBoundary key={attempt} retry={retry}>
        <Suspense
          fallback={
            <p className="route-loading" role="status">
              Cargando sección…
            </p>
          }
        >
          <Page />
        </Suspense>
      </PageBoundary>
    );
  };
}
