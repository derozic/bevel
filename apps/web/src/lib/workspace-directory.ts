/**
 * Workspace people directory — seed roster for starting multi-party threads.
 * Agents come from agent-catalog; people can later sync from Google / Attio.
 */

export type WorkspacePerson = {
  id: string
  name: string
  handle: string
  role?: string
  avatarUrl?: string
  /** Future: real user id once people rooms land */
  email?: string
}

/** Known teammates shown in the conversation roster (including Peter). */
export const WORKSPACE_PEOPLE: WorkspacePerson[] = [
  {
    id: 'peter',
    name: 'Peter',
    handle: 'peter',
    role: 'Teammate',
  },
  {
    id: 'scott',
    name: 'Scott',
    handle: 'scott',
    role: 'Operator',
    email: 'scott@derozic.com',
  },
]

export function getPersonById(id: string): WorkspacePerson | undefined {
  return WORKSPACE_PEOPLE.find((p) => p.id.toLowerCase() === id.toLowerCase())
}
