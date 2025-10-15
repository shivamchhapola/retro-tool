import type { NextRequest } from "next/server"
import { retroHub } from "@/lib/retro-hub"

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase()

  if (!retroHub.getSession(code)) {
    await retroHub.ensure(code)
  }
  const session = retroHub.getSession(code)
  if (!session) return new Response("Not found", { status: 404 })

  const evt = await req.json().catch(() => null)
  if (!evt || typeof evt !== "object") return new Response("Bad Request", { status: 400 })

  // Basic stage guardrails (optional)
  // e.g., restrict voting to voting stage, etc.
  try {
    retroHub.applyEvent(code, evt)
    // notify other tabs to apply the event
    retroHub.forwardEvent(code, evt)
    return Response.json({ ok: true })
  } catch (e) {
    return new Response("Error", { status: 500 })
  }
}
