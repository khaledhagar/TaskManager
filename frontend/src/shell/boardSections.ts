import type { BoardSummary } from '../api/boards'
import type { Workspace } from '../api/workspaces'

/** Starred, then each workspace, then your other boards, then shared ones; archived boards last. */
export function boardSections(boards: BoardSummary[], workspaces: Workspace[] = []) {
  const active = boards.filter((b) => !b.archived)
  const rest = active.filter((b) => !b.starred)
  const inWorkspace = (b: BoardSummary) => workspaces.some((p) => p.id === b.workspace_id)
  return {
    starred: active.filter((b) => b.starred),
    workspaces: workspaces.map((workspace) => ({ workspace, boards: rest.filter((b) => b.workspace_id === workspace.id) })),
    own: rest.filter((b) => b.role === 'admin' && !inWorkspace(b)),
    shared: rest.filter((b) => b.role !== 'admin' && !inWorkspace(b)),
    archived: boards.filter((b) => b.archived),
  }
}
