import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadConfig } from "./config";
import {
  authorizeGoogle,
  disconnectGoogle,
  googleConnected,
  prepareGoogle,
  pickDrive,
  forgetGoogle,
} from "./google";
import type { GoogleService } from "./google";
const Context = createContext<null | {
  driveReady: boolean;
  classroomReady: boolean;
  loaded: boolean;
  error: string;
  connect: (service: GoogleService) => Promise<void>;
  disconnect: (service: GoogleService) => Promise<void>;
  pick: typeof pickDrive;
}>(null);
export function GoogleProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [, refresh] = useState(0);
  useEffect(() => {
    let live = true;
    function prepare() {
      forgetGoogle();
      setLoaded(false);
      setError("");
      if (loadConfig().googleClientId)
        void prepareGoogle()
          .then(() => {
            if (live) setLoaded(true);
          })
          .catch((e) => {
            if (live) setError(e.message);
          });
    }
    prepare();
    const timer = setInterval(() => refresh((n) => n + 1), 10000);
    window.addEventListener("studyspace:config", prepare);
    window.addEventListener("studyspace:workspace", prepare);
    return () => {
      live = false;
      clearInterval(timer);
      forgetGoogle();
      window.removeEventListener("studyspace:config", prepare);
      window.removeEventListener("studyspace:workspace", prepare);
    };
  }, []);
  return (
    <Context.Provider
      value={{
        driveReady: googleConnected("drive"),
        classroomReady: googleConnected("classroom"),
        loaded,
        error,
        connect: async (s) => {
          await authorizeGoogle(s);
          refresh((n) => n + 1);
        },
        disconnect: async (s) => {
          try {
            await disconnectGoogle(s);
          } finally {
            refresh((n) => n + 1);
          }
        },
        pick: pickDrive,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useGoogle() {
  const c = useContext(Context);
  if (!c) throw new Error("Falta GoogleProvider");
  return c;
}
