/** derozic — the fleet's conversational system voice */

export const SYSTEM_SPEAKER = 'derozic'

export function systemDisplay(): string {
  return '💜 derozic'
}

export function sessionWelcome(agentNames: string[]): string {
  if (agentNames.length === 0) return `hi — i'm derozic ♡ say hello when you're ready…`
  if (agentNames.length === 1) {
    return `hi — i'm derozic ♡ ${agentNames[0]} is here with you. just say the word…`
  }
  return `hi — i'm derozic ♡ your fleet's listening: ${agentNames.join(', ')}. say anything — they'll all hear you, or @mention one…`
}

export function askingFleet(agentNames: string[]): string {
  if (agentNames.length === 1) return handingToAgent(agentNames[0])
  if (agentNames.length === 2) {
    return `asking ${agentNames[0]} and ${agentNames[1]} — the fleet's on it ♡…`
  }
  const last = agentNames[agentNames.length - 1]
  const rest = agentNames.slice(0, -1).join(', ')
  return `asking ${rest}, and ${last} — everyone's listening ♡…`
}

export function memberJoined(name: string): string {
  return `${name} joined ♡ welcome in…`
}

export function memberLeft(name: string): string {
  return `${name} stepped out — derozic's still here if you need anything ♡`
}

/** BEVEL channel rooms — shorter, workspace-forward copy (`^` channel tag). */
export function channelWelcome(channelSlug: string, agentNames: string[]): string {
  const tag = `^${channelSlug}`
  if (agentNames.length === 0) {
    return `${tag} is open — pick agents above, then post.`
  }
  if (agentNames.length === 1) {
    return `${tag} · ${agentNames[0]} is on the roster. Post or @mention to focus.`
  }
  return `${tag} · roster: ${agentNames.join(', ')}. Everyone hears the channel; @mention to route.`
}

export function channelMemberJoined(name: string, channelSlug: string): string {
  return `${name} joined ^${channelSlug}`
}

export function channelMemberLeft(name: string, channelSlug: string): string {
  return `${name} left ^${channelSlug}`
}

export function pickAgent(agentNames: string[]): string {
  const hint = agentNames[0] ? `@${agentNames[0].toLowerCase()}` : 'an agent'
  return `Who should answer? @mention ${hint} or pick an agent above.`
}

export function handingToAgent(agentName: string): string {
  return `passing your note to ${agentName} with love 💜…`
}

export function agentThinking(agentName: string): string {
  return `${agentName} is thinking… ♡`
}

export function agentStumbled(agentName: string): string {
  return `oh no — ${agentName} hit a snag 💔 want to try again?…`
}

export function fleetRateLimited(agentName: string): string {
  return `the fleet's a little busy right now — ${agentName} will answer as soon as OpenRouter clears us ♡ try again in a moment…`
}

export function workAccessDenied(repo: string): string {
  return `Write access to ${repo} is required to put agents on work. Link GitHub or ask an admin.`
}

export function puttingOnWork(agentNames: string[], repo: string): string {
  if (agentNames.length === 1) {
    return `putting ${agentNames[0]} on work in ${repo}…`
  }
  return `putting ${agentNames.join(', ')} on work in ${repo}…`
}