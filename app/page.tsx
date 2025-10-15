"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function HomePage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [voteLimit, setVoteLimit] = useState("5")
  const [isLoading, setIsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const createSession = async () => {
    if (!voteLimit.trim() || isNaN(Number(voteLimit))) return alert("Enter valid vote limit")
    setIsLoading(true)
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        body: JSON.stringify({ voteLimit: Number(voteLimit) }),
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      localStorage.setItem(`retro:${data.code}:hostSecret`, data.hostSecret)
      router.push(`/session/${data.code}`)
    } finally {
      setIsLoading(false)
    }
  }

  const joinSession = async () => {
    if (!code.trim()) return alert("Enter session code")
    setIsLoading(true)
    try {
      router.push(`/session/${code.trim().toUpperCase()}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="nb min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="nb-h1 text-center mb-16">Generic Retro Tool</h1>

        {!showCreate ? (
          <div className="nb-stack">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-3 opacity-70">Session Code</label>
              <Input
                className="nb-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., 7KD3XZ"
                onKeyDown={(e) => e.key === "Enter" && joinSession()}
              />
            </div>
            <Button onClick={joinSession} disabled={isLoading} className="nb-btn nb-btn-primary w-full">
              {isLoading ? "Joining..." : "Join Session"}
            </Button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border opacity-40" />
              <span className="text-xs uppercase font-bold opacity-40">or</span>
              <div className="flex-1 h-px bg-border opacity-40" />
            </div>

            <Button onClick={() => setShowCreate(true)} className="nb-btn nb-btn-ghost w-full">
              Create Session
            </Button>
          </div>
        ) : (
          <div className="nb-stack">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-3 opacity-70">Vote Limit</label>
              <Input
                className="nb-input"
                type="number"
                value={voteLimit}
                onChange={(e) => setVoteLimit(e.target.value)}
                placeholder="e.g., 5"
                min="1"
                max="100"
              />
            </div>
            <Button onClick={createSession} disabled={isLoading} className="nb-btn nb-btn-primary w-full">
              {isLoading ? "Creating..." : "Create Session"}
            </Button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border opacity-40" />
              <span className="text-xs uppercase font-bold opacity-40">or</span>
              <div className="flex-1 h-px bg-border opacity-40" />
            </div>

            <Button onClick={() => setShowCreate(false)} className="nb-btn nb-btn-ghost w-full">
              Back to Join
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
