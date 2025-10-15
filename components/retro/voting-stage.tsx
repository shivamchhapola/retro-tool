"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ClientSafeSession } from "@/lib/retro-hub"
import { retroApi } from "./session-store"
import { useMemo } from "react"

export function VotingStage({
  code,
  state,
  participantId,
}: {
  code: string
  state: ClientSafeSession
  isHost: boolean
  participantId: string
}) {
  const totalUsed = useMemo(() => {
    const map = state.votes[participantId] || {}
    return Object.values(map).reduce((a, b) => a + b, 0)
  }, [state.votes, participantId])

  const remaining = state.voteLimit - totalUsed

  const votesByGroup = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const pMap of Object.values(state.votes)) {
      for (const [gid, c] of Object.entries(pMap)) totals[gid] = (totals[gid] || 0) + c
    }
    return totals
  }, [state.votes])

  return (
    <div className="grid gap-4">
      <div className="text-sm">
        Remaining votes: <span className="font-medium">{remaining}</span> of {state.voteLimit}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.values(state.groups).map((g) => {
          const total = votesByGroup[g.id] || 0
          const mine = (state.votes[participantId] || {})[g.id] || 0
          return (
            <Card key={g.id} className="p-3">
              <h3 className="font-medium">{g.name}</h3>
              <div className="mt-2 grid gap-1">
                {g.noteIds.map((id) => {
                  const n = state.notes[id]
                  if (!n) return null
                  return (
                    <div key={id} className="text-sm text-muted-foreground">
                      • {n.text}
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm">
                  Total: <span className="font-medium">{total}</span>{" "}
                  {mine > 0 && <span className="text-muted-foreground">(you: {mine})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => retroApi.sendEvent(code, { type: "remove-vote", participantId, groupId: g.id })}
                    disabled={mine <= 0}
                  >
                    −
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => retroApi.sendEvent(code, { type: "cast-vote", participantId, groupId: g.id })}
                    disabled={remaining <= 0}
                  >
                    + Vote
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
