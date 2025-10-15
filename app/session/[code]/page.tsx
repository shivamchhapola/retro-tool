"use client"

import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { retroApi, useRetroSession } from "@/components/retro/session-store"
import { StageHeader } from "@/components/retro/stage-header"
import { NotesStage } from "@/components/retro/notes-stage"
import { GroupingStage } from "@/components/retro/grouping-stage"
import { VotingStage } from "@/components/retro/voting-stage"
import { ActionItemsStage } from "@/components/retro/action-items-stage"

export default function SessionPage() {
  const { code } = useParams<{ code: string }>()
  const [name, setName] = useState<string>("")
  const [participantId, setParticipantId] = useState<string>("")
  const nameDialogRef = useRef<HTMLDialogElement>(null)

  // Ensure identity
  useEffect(() => {
    const savedName = localStorage.getItem("retro:name") || ""
    setName(savedName)
    let pid = localStorage.getItem("retro:pid")
    if (!pid) {
      pid = crypto.randomUUID()
      localStorage.setItem("retro:pid", pid)
    }
    setParticipantId(pid)
  }, [])

  const { state, isLoading, isHost, mutate } = useRetroSession(code) // include mutate for optimistic updates

  // Auto join on first load
  useEffect(() => {
    if (!state || !participantId) return
    if (!state.participants[participantId] && name) {
      retroApi.sendEvent(code, {
        type: "join",
        participant: { id: participantId, name, joinedAt: Date.now() },
      })
    }
  }, [state, participantId, name, code])

  useEffect(() => {
    if (!name) {
      try {
        nameDialogRef.current?.showModal()
      } catch {}
    }
  }, [name])

  if (isLoading || !state) {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Loading session...</p>
      </main>
    )
  }

  const stage = state.stage

  return (
    <main className="p-4 md:p-6">
      <dialog ref={nameDialogRef} className="rounded-lg p-0">
        <Card className="p-4 w-80">
          <h2 className="text-lg font-medium">Enter your name</h2>
          <div className="mt-3 grid gap-2">
            <Label htmlFor="nm">Name</Label>
            <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              onClick={() => {
                if (!name.trim()) return
                localStorage.setItem("retro:name", name.trim())
                nameDialogRef.current?.close()
                // trigger join
                retroApi.sendEvent(code, {
                  type: "join",
                  participant: { id: participantId, name: name.trim(), joinedAt: Date.now() },
                })
              }}
            >
              Continue
            </Button>
          </div>
        </Card>
      </dialog>

      <StageHeader code={code} state={state} isHost={isHost} participantId={participantId} mutate={mutate} />

      <Separator className="my-4" />

      {stage === "add-notes" && (
        <NotesStage code={code} state={state} isHost={isHost} participantId={participantId} mutate={mutate} />
      )}
      {stage === "grouping" && (
        <GroupingStage code={code} state={state} isHost={isHost} participantId={participantId} />
      )}
      {stage === "voting" && <VotingStage code={code} state={state} isHost={isHost} participantId={participantId} />}
      {stage === "action-items" && (
        <ActionItemsStage code={code} state={state} isHost={isHost} participantId={participantId} />
      )}
    </main>
  )
}
