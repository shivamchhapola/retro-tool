"use client"

import React from "react"

import useSWR from "swr"
import type { ClientSafeSession, RetroStage } from "@/lib/retro-hub"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export const retroApi = {
  async sendEvent(code: string, evt: any) {
    await fetch(`/api/session/${code}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evt),
    })
  },
  hostSecret(code: string) {
    return localStorage.getItem(`retro:${code}:hostSecret`) || ""
  },
}

export function useRetroSession(code: string) {
  const { data, isLoading, mutate } = useSWR<ClientSafeSession>(`/api/session/${code}/state`, fetcher)

  // SSE subscription
  React.useEffect(() => {
    if (!code) return
    const es = new EventSource(`/api/session/${code}/events`)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg?.type === "state") mutate(msg.state, { revalidate: false })
      } catch {}
    }
    return () => es.close()
  }, [code, mutate])

  const isHost = React.useMemo(() => {
    const secret = retroApi.hostSecret(code)
    return Boolean(secret)
  }, [code, data])

  return { state: data, isLoading, mutate, isHost }
}

export function nextStage(stage: RetroStage): RetroStage {
  if (stage === "add-notes") return "grouping"
  if (stage === "grouping") return "voting"
  if (stage === "voting") return "action-items"
  return "action-items"
}
