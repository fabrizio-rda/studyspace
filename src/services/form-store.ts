import { useRef } from "react";
import { useStore } from "./store";
import { mergeEdit, EditConflict } from "./editing";
import type { Task, AcademicEvent, Course } from "../models/schema";
export function useFormStore() {
  const store = useStore();
  const base = useRef(structuredClone(store.data));
  const workspace = useRef(store.workspaceToken);
  const commit: typeof store.commit = (mutate, message) => {
    const mine = structuredClone(base.current);
    try { mutate(mine); } catch (e) { store.notify((e as Error).message); return false; }
    let merged = mine;
    const ok = store.commit(current => {
      try { merged = mergeEdit(base.current, mine, current); Object.assign(current, merged); }
      catch (e) {
        if (e instanceof EditConflict) store.keepEditConflict(base.current, mine, current);
        throw e;
      }
    }, message, workspace.current);
    if (ok) base.current = structuredClone(merged);
    return ok;
  };
  return { ...store, commit,
    saveTask: (item: Task) => commit(d => { const i=d.tasks.findIndex(x=>x.id===item.id); if(i<0)d.tasks.push(item); else d.tasks[i]=item; }, "Tarea guardada"),
    saveEvent: (item: AcademicEvent) => commit(d => { const i=d.events.findIndex(x=>x.id===item.id); if(i<0)d.events.push(item); else d.events[i]=item; }, "Actividad guardada"),
    saveCourse: (item: Course) => commit(d => { const i=d.courses.findIndex(x=>x.id===item.id); if(i<0)d.courses.push(item); else d.courses[i]=item; }, "Curso guardado"),
  };
}
