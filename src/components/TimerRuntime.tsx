import { useEffect } from "react";
import { useStore } from "../services/store";
import { timerElapsed } from "../services/study";
export default function TimerRuntime() {
  const { data, commit } = useStore();
  const id = data.activeTimer?.id;
  const running = !!data.activeTimer && data.activeTimer.runningSince !== null;
  useEffect(() => {
    if (!id) return;
    const heartbeat = running
      ? setInterval(
          () =>
            commit((d) => {
              if (
                d.activeTimer?.id === id &&
                d.activeTimer.runningSince !== null
              )
                d.activeTimer.lastSeenAt = Date.now();
            }, null),
          15000,
        )
      : undefined;
    const leave = () =>
      commit((d) => {
        if (d.activeTimer?.id === id) {
          d.activeTimer.elapsedSeconds = timerElapsed(d.activeTimer);
          d.activeTimer.runningSince = null;
          d.activeTimer.lastSeenAt = Date.now();
        }
      }, null);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
    };
  }, [id, running]);
  return null;
}
