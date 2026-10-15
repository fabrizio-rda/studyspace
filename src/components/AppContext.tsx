import { createContext, useContext } from "react";
import type { EditorState } from "./Editors";
export const EditorContext = createContext<(editor: EditorState) => void>(
  () => {},
);
export const useEditor = () => useContext(EditorContext);
