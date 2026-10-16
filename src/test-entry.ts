import { ENTRY_GRANT_KEY } from "./services/entry";
// Existing CRUD journeys explicitly exercise the preserved local workspace.
export function localEntry() {
  sessionStorage.clear();
  sessionStorage.setItem(
    ENTRY_GRANT_KEY,
    JSON.stringify({ profile: "local", userId: null, project: "" }),
  );
}
