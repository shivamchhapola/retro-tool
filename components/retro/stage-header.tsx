"use client"

import { Button } from "@/components/ui/button"
import { CopyIcon, TimerIcon, ChevronRightIcon, UsersIcon, CheckCircle2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { retroApi, nextStage } from "./session-store"
import type { ClientSafeSession, RetroStage } from "@/lib/retro-hub"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export function StageHeader({
  code,
  state,
  isHost,
  participantId,
  mutate,
}: {
  code: string
  state: ClientSafeSession
  isHost: boolean
  participantId: string
  mutate?: (updater: any, opts?: any) => Promise<any>
}) {
  const [remaining, setRemaining] = useState<number>(0)
  const stageOrder: RetroStage[] = ["add-notes", "grouping", "voting", "action-items"]

  useEffect(() => {
    const id = setInterval(() => {
      if (state.timer.running && state.timer.endAt) {
        const diff = Math.max(0, Math.floor((state.timer.endAt - Date.now()) / 1000))
        setRemaining(diff)
      } else {
        setRemaining(0)
      }
    }, 500)
    return () => clearInterval(id)
  }, [state.timer.running, state.timer.endAt])

  const progress = useMemo(() => {
    const idx = stageOrder.indexOf(state.stage)
    return ((idx + 1) / stageOrder.length) * 100
  }, [state.stage])

  const copyCode = async () => {
    await navigator.clipboard.writeText(code)
  }

  const startTimer = async () => {
    const input = prompt("Timer duration in minutes", "5")
    if (!input) return
    const mins = Number.parseInt(input, 10)
    if (Number.isNaN(mins) || mins <= 0) return
    await mutate?.(
      (prev: ClientSafeSession) => ({
        ...prev,
        timer: { running: true, durationSec: mins * 60, endAt: Date.now() + mins * 60 * 1000 },
      }),
      { revalidate: false },
    )
    await retroApi.sendEvent(code, {
      type: "start-timer",
      durationSec: mins * 60,
      hostSecret: retroApi.hostSecret(code),
    })
  }

  const stopTimer = async () => {
    await mutate?.(
      (prev: ClientSafeSession) => ({
        ...prev,
        timer: { running: false, durationSec: prev.timer.durationSec },
      }),
      { revalidate: false },
    )
    await retroApi.sendEvent(code, { type: "stop-timer", hostSecret: retroApi.hostSecret(code) })
  }

  const advance = async () => {
    const ns = nextStage(state.stage)
    await retroApi.sendEvent(code, { type: "set-stage", stage: ns, hostSecret: retroApi.hostSecret(code) })
  }

  const participants = Object.values(state.participants).sort((a, b) => a.joinedAt - b.joinedAt)
  const doneMap = state.dones || {}
  const doneCount = participants.reduce((acc, p) => acc + (doneMap[p.id] ? 1 : 0), 0)
  const meDone = !!doneMap[participantId]

  const toggleDone = async () => {
    await mutate?.(
      (prev: ClientSafeSession) => ({
        ...prev,
        dones: { ...(prev.dones || {}), [participantId]: !meDone },
      }),
      { revalidate: false },
    )
    await retroApi.sendEvent(code, { type: "set-done", participantId, done: !meDone })
  }

  return (
    <header className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Session code</span>
          <code className="rounded bg-muted px-2 py-1 text-sm">{code}</code>
          <Button variant="secondary" size="icon" onClick={copyCode} aria-label="Copy code">
            <CopyIcon className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-2 bg-transparent">
                <UsersIcon className="mr-1 h-4 w-4" />
                {participants.length} members
                <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mr-1 h-3 w-3 text-primary" />
                  {doneCount} done
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Members</span>
                <span className="text-xs text-muted-foreground">{doneCount} done</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-64 overflow-auto p-1">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded px-2 py-1 text-sm">
                    <span className="truncate">{p.name || "Anonymous"}</span>
                    {doneMap[p.id] ? (
                      <span className="inline-flex items-center text-green-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Done
                      </span>
                    ) : (
                      <span className="text-muted-foreground">···</span>
                    )}
                  </div>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={meDone ? "secondary" : "default"} size="sm" onClick={toggleDone}>
            {meDone ? "Undo Done" : "I'm Done"}
          </Button>
          <TimerDisplay remaining={remaining} running={state.timer.running} />
          {isHost && (
            <>
              {!state.timer.running ? (
                <Button size="sm" onClick={startTimer}>
                  Start timer
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={stopTimer}>
                  Stop timer
                </Button>
              )}
            </>
          )}
          {isHost && (
            <Button onClick={advance} className="ml-2">
              Next stage
              <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="h-2 w-full rounded bg-muted">
        <div className="h-2 rounded bg-primary" style={{ width: `${progress}%` }} />
      </div>
      <nav className="flex items-center gap-1 text-sm">
        {stageOrder.map((s, i) => (
          <div key={s} className="flex items-center">
            <span
              className={cn("px-2 py-1 rounded", state.stage === s ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
              {pretty(s)}
            </span>
            {i < stageOrder.length - 1 && <ChevronRightIcon className="mx-1 h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </nav>
    </header>
  )
}

function pretty(s: string) {
  if (s === "add-notes") return "Add Notes"
  if (s === "grouping") return "Grouping"
  if (s === "voting") return "Voting"
  return "Action Items"
}

function TimerDisplay({ remaining, running }: { remaining: number; running: boolean }) {
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return (
    <div className="flex items-center gap-1 text-sm">
      <TimerIcon className={cn("h-4 w-4", running ? "text-primary" : "text-muted-foreground")} />
      <span className={cn(running ? "" : "text-muted-foreground")}>
        {m}:{String(s).padStart(2, "0")}
      </span>
    </div>
  )
}
