import React, { useContext } from "react";
import { BASE_URL, Workspace } from "./Workspace";

const WorkspaceContext = React.createContext<Workspace>(new Workspace(BASE_URL, undefined, undefined));

export const WorkspaceProvider = WorkspaceContext.Provider;

export default function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  return workspace;
}
