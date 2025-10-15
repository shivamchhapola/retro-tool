/**
 * Real-time in-memory hub for collaborative retros.
 * Stores session state and SSE subscribers per session code.
 */

export type RetroStage = "add-notes" | "grouping" | "voting" | "action-items"

export type Section = { id: string; name: string; order: number }
export type Note = { id: string; text: string; sectionId: string; createdBy: string; createdAt: number }
export type ActionItem = { id: string; text: string; owner?: string; due?: string }
export type Group = { id: string; name: string; noteIds: string[]; actionItems: ActionItem[] }

export type Participant = { id: string; name: string; joinedAt: number }

export type RetroSession = {
  code: string
  createdAt: number
  hostSecret: string
  voteLimit: number
  stage: RetroStage
  sections: Section[]
  notes: Record<string, Note>
  groups: Record<string, Group>
  participants: Record<string, Participant>
  votes: Record<string, Record<string, number>> // participantId -> groupId -> count
  timer: { running: boolean; durationSec?: number; endAt?: number }
  dones: Record<string, boolean>
}

export type ClientSafeSession = Omit<RetroSession, "hostSecret">

type SessionEvent =
  | { type: "join"; participant: Participant }
  | { type: "set-stage"; stage: RetroStage; hostSecret: string }
  | { type: "start-timer"; durationSec: number; hostSecret: string }
  | { type: "stop-timer"; hostSecret: string }
  | { type: "add-section"; id: string; name: string; hostSecret: string }
  | { type: "rename-section"; id: string; name: string; hostSecret: string }
  | { type: "remove-section"; id: string; hostSecret: string }
  | { type: "add-note"; id: string; text: string; sectionId: string; createdBy: string }
  | { type: "delete-note"; id: string; createdBy: string }
  | { type: "create-group"; id: string; name: string }
  | { type: "rename-group"; id: string; name: string }
  | { type: "add-note-to-group"; groupId: string; noteId: string }
  | { type: "remove-note-from-group"; groupId: string; noteId: string }
  | { type: "cast-vote"; participantId: string; groupId: string }
  | { type: "remove-vote"; participantId: string; groupId: string }
  | { type: "add-action-item"; groupId: string; action: ActionItem; hostSecret: string }
  | { type: "update-action-item"; groupId: string; action: ActionItem; hostSecret: string }
  | { type: "remove-action-item"; groupId: string; actionId: string; hostSecret: string }
  | { type: "set-done"; participantId: string; done: boolean }

type Subscriber = (payload: { type: "state"; state: ClientSafeSession }) => void

const globalAny = globalThis as any

const instanceId: string =
  (globalAny.__retroInstanceId as string) ||
  (globalAny.__retroInstanceId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("retro-hub") : null

type HubMessage =
  | { kind: "request-state"; code: string; origin: string }
  | { kind: "provide-state"; code: string; state: ClientSafeSession; origin: string }
  | { kind: "forward-event"; code: string; evt: any; origin: string }

if (!globalAny.__retroHub) {
  const sessions = new Map<string, RetroSession>()
  const subs = new Map<string, Set<Subscriber>>()

  const broadcast = (code: string) => {
    const s = sessions.get(code)
    if (!s) return
    const listeners = subs.get(code)
    if (!listeners || listeners.size === 0) return
    const { hostSecret, ...safe } = s
    const payload = { type: "state" as const, state: safe }
    for (const fn of listeners) {
      try {
        fn(payload)
      } catch {}
    }
  }

  const defaultSections = (): Section[] => [
    { id: crypto.randomUUID(), name: "What went well", order: 0 },
    { id: crypto.randomUUID(), name: "What went wrong", order: 1 },
    { id: crypto.randomUUID(), name: "What could be improved", order: 2 },
  ]

  const createSession = (voteLimit = 5): { code: string; hostSecret: string } => {
    const code = genCode()
    const hostSecret = crypto.randomUUID()
    const session: RetroSession = {
      code,
      createdAt: Date.now(),
      hostSecret,
      voteLimit,
      stage: "add-notes",
      sections: defaultSections(),
      notes: {},
      groups: {},
      participants: {},
      votes: {},
      timer: { running: false },
      dones: {},
    }
    sessions.set(code, session)
    subs.set(code, new Set())
    return { code, hostSecret }
  }

  const getSession = (code: string) => sessions.get(code)

  const on = (code: string, fn: Subscriber) => {
    if (!subs.has(code)) subs.set(code, new Set())
    subs.get(code)!.add(fn)
  }
  const off = (code: string, fn: Subscriber) => {
    subs.get(code)?.delete(fn)
  }

  const requireHost = (session: RetroSession, secret: string) => session.hostSecret === secret

  const totalVotesForParticipant = (session: RetroSession, participantId: string) => {
    const map = session.votes[participantId] || {}
    return Object.values(map).reduce((a, b) => a + b, 0)
  }

  const applyEvent = (code: string, evt: SessionEvent) => {
    const s = sessions.get(code)
    if (!s) return
    switch (evt.type) {
      case "join": {
        s.participants[evt.participant.id] = evt.participant
        if (!s.votes[evt.participant.id]) s.votes[evt.participant.id] = {}
        if (!(evt.participant.id in s.dones)) s.dones[evt.participant.id] = false
        break
      }
      case "set-stage": {
        if (!requireHost(s, evt.hostSecret)) return
        s.stage = evt.stage
        break
      }
      case "start-timer": {
        if (!requireHost(s, evt.hostSecret)) return
        s.timer.running = true
        s.timer.durationSec = evt.durationSec
        s.timer.endAt = Date.now() + evt.durationSec * 1000
        break
      }
      case "stop-timer": {
        if (!requireHost(s, evt.hostSecret)) return
        s.timer.running = false
        s.timer.endAt = undefined
        break
      }
      case "add-section": {
        if (!requireHost(s, evt.hostSecret)) return
        s.sections.push({ id: evt.id, name: evt.name, order: s.sections.length })
        break
      }
      case "rename-section": {
        if (!requireHost(s, evt.hostSecret)) return
        const sec = s.sections.find((x) => x.id === evt.id)
        if (sec) sec.name = evt.name
        break
      }
      case "remove-section": {
        if (!requireHost(s, evt.hostSecret)) return
        s.sections = s.sections.filter((x) => x.id !== evt.id)
        // orphan notes remain; they will show as ungrouped if needed
        break
      }
      case "add-note": {
        s.notes[evt.id] = {
          id: evt.id,
          text: evt.text,
          sectionId: evt.sectionId,
          createdBy: evt.createdBy,
          createdAt: Date.now(),
        }
        break
      }
      case "delete-note": {
        delete s.notes[evt.id]
        for (const g of Object.values(s.groups)) {
          g.noteIds = g.noteIds.filter((n) => n !== evt.id)
        }
        break
      }
      case "create-group": {
        s.groups[evt.id] = { id: evt.id, name: evt.name, noteIds: [], actionItems: [] }
        break
      }
      case "rename-group": {
        const g = s.groups[evt.id]
        if (g) g.name = evt.name
        break
      }
      case "add-note-to-group": {
        const g = s.groups[evt.groupId]
        if (!g) break
        if (!g.noteIds.includes(evt.noteId)) g.noteIds.push(evt.noteId)
        break
      }
      case "remove-note-from-group": {
        const g = s.groups[evt.groupId]
        if (!g) break
        g.noteIds = g.noteIds.filter((id) => id !== evt.noteId)
        break
      }
      case "cast-vote": {
        const used = totalVotesForParticipant(s, evt.participantId)
        if (used >= s.voteLimit) break
        const current = s.votes[evt.participantId] || {}
        current[evt.groupId] = (current[evt.groupId] || 0) + 1
        s.votes[evt.participantId] = current
        break
      }
      case "remove-vote": {
        const current = s.votes[evt.participantId] || {}
        if (current[evt.groupId] && current[evt.groupId] > 0) {
          current[evt.groupId] -= 1
          s.votes[evt.participantId] = current
        }
        break
      }
      case "add-action-item": {
        if (!requireHost(s, evt.hostSecret)) return
        const g = s.groups[evt.groupId]
        if (g) g.actionItems.push(evt.action)
        break
      }
      case "update-action-item": {
        if (!requireHost(s, evt.hostSecret)) return
        const g = s.groups[evt.groupId]
        if (g) {
          const i = g.actionItems.findIndex((a) => a.id === evt.action.id)
          if (i >= 0) g.actionItems[i] = evt.action
        }
        break
      }
      case "remove-action-item": {
        if (!requireHost(s, evt.hostSecret)) return
        const g = s.groups[evt.groupId]
        if (g) g.actionItems = g.actionItems.filter((a) => a.id !== evt.actionId)
        break
      }
      case "set-done": {
        s.dones[evt.participantId] = evt.done
        break
      }
    }
    broadcast(code)
    forwardEvent(code, evt)
  }

  const safeState = (code: string): ClientSafeSession | undefined => {
    const s = sessions.get(code)
    if (!s) return
    const { hostSecret, ...safe } = s
    return safe
  }

  const hydrateFromState = (code: string, state: ClientSafeSession) => {
    if (sessions.has(code)) return
    const hostSecret = crypto.randomUUID()
    const session: RetroSession = {
      ...state,
      hostSecret,
    }
    sessions.set(code, session)
    if (!subs.has(code)) subs.set(code, new Set())
  }

  const ensure = async (code: string, timeoutMs = 1200) => {
    if (sessions.has(code) || !channel) return
    // Ask other tabs for the state
    channel.postMessage({ kind: "request-state", code, origin: instanceId } as HubMessage)

    await new Promise<void>((resolve) => {
      let done = false
      const t = setTimeout(() => {
        if (!done) {
          done = true
          resolve()
        }
      }, timeoutMs)

      const onMsg = (e: MessageEvent<HubMessage>) => {
        const msg = e.data
        if (!msg || msg.origin === instanceId) return
        if (msg.kind === "provide-state" && msg.code === code) {
          hydrateFromState(code, msg.state)
          clearTimeout(t)
          channel?.removeEventListener("message", onMsg as any)
          done = true
          resolve()
        }
      }
      channel.addEventListener("message", onMsg as any)
    })
  }

  const forwardEvent = (code: string, evt: any) => {
    if (!channel) return
    channel.postMessage({ kind: "forward-event", code, evt, origin: instanceId } as HubMessage)
  }

  if (channel) {
    channel.onmessage = (e: MessageEvent<HubMessage>) => {
      const msg = e.data
      if (!msg || typeof msg !== "object") return
      if (msg.origin === instanceId) return

      if (msg.kind === "request-state") {
        const safe = safeState(msg.code)
        if (safe) {
          channel!.postMessage({ kind: "provide-state", code: msg.code, state: safe, origin: instanceId } as HubMessage)
        }
        return
      }

      if (msg.kind === "provide-state") {
        // receive and hydrate if we don't have it
        if (!sessions.has(msg.code)) {
          hydrateFromState(msg.code, msg.state)
          // broadcast current state to local subscribers
          broadcast(msg.code)
        }
        return
      }

      if (msg.kind === "forward-event") {
        // apply a remote event to our local hub (no re-broadcast to avoid loops)
        applyEvent(msg.code, msg.evt)
        return
      }
    }
  }

  globalAny.__retroHub = {
    createSession,
    getSession,
    applyEvent,
    on,
    off,
    safeState,
    ensure,
    forwardEvent,
  }
}

export const retroHub: {
  createSession: (voteLimit?: number) => { code: string; hostSecret: string }
  getSession: (code: string) => RetroSession | undefined
  applyEvent: (code: string, evt: any) => void
  on: (code: string, fn: (payload: { type: "state"; state: ClientSafeSession }) => void) => void
  off: (code: string, fn: (payload: { type: "state"; state: ClientSafeSession }) => void) => void
  safeState: (code: string) => ClientSafeSession | undefined
  ensure: (code: string, timeoutMs?: number) => Promise<void>
  forwardEvent: (code: string, evt: any) => void
} = globalAny.__retroHub

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
