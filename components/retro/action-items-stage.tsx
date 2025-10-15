"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ClientSafeSession, ActionItem } from "@/lib/retro-hub"
import { retroApi } from "./session-store"
import { useMemo, useRef, useState } from "react"
import { toPng } from "html-to-image"

export function ActionItemsStage({
  code,
  state,
  isHost,
}: {
  code: string
  state: ClientSafeSession
  isHost: boolean
  participantId: string
}) {
  const boardRef = useRef<HTMLDivElement>(null)

  const votesByGroup = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const pMap of Object.values(state.votes)) {
      for (const [gid, c] of Object.entries(pMap)) totals[gid] = (totals[gid] || 0) + c
    }
    return totals
  }, [state.votes])

  const groupsSorted = useMemo(() => {
    return Object.values(state.groups).sort((a, b) => (votesByGroup[b.id] || 0) - (votesByGroup[a.id] || 0))
  }, [state.groups, votesByGroup])

  const addAction = async (groupId: string, text: string) => {
    if (!text.trim()) return
    const action: ActionItem = { id: crypto.randomUUID(), text: text.trim() }
    await retroApi.sendEvent(code, { type: "add-action-item", groupId, action, hostSecret: retroApi.hostSecret(code) })
  }

  const exportPNG = async () => {
    if (!boardRef.current) return
    const dataUrl = await toPng(boardRef.current, { cacheBust: true })
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = `retro-${state.code}-action-items.png`
    a.click()
  }

  const exportJSON = async () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `retro-${state.code}.json`
    a.click()
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button onClick={exportPNG}>Export Action Items (PNG)</Button>
        <Button variant="secondary" onClick={exportJSON}>
          Export Full Retro (JSON)
        </Button>
      </div>

      <div ref={boardRef} className="grid gap-4 md:grid-cols-2">
        {groupsSorted.map((g) => {
          const total = votesByGroup[g.id] || 0
          return (
            <Card key={g.id} className="p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{g.name}</h3>
                <div className="text-sm text-muted-foreground">Votes: {total}</div>
              </div>
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

              <div className="mt-3 grid gap-2">
                <h4 className="text-sm font-medium">Action Items</h4>
                {g.actionItems.map((ai) => (
                  <div key={ai.id} className="flex items-center justify-between gap-2">
                    <div className="text-sm">{ai.text}</div>
                    {isHost && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          retroApi.sendEvent(code, {
                            type: "remove-action-item",
                            groupId: g.id,
                            actionId: ai.id,
                            hostSecret: retroApi.hostSecret(code),
                          })
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {isHost && <AddActionForm onAdd={(t) => addAction(g.id, t)} />}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function AddActionForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("")
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd(text)
        setText("")
      }}
    >
      <Input placeholder="Add action item" value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" size="sm">
        Add
      </Button>
    </form>
  )
}
