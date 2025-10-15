import type { NextRequest } from "next/server"
import { retroHub } from "@/lib/retro-hub"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const voteLimit = typeof body?.voteLimit === "number" && body.voteLimit > 0 ? body.voteLimit : 5
  const { code, hostSecret } = retroHub.createSession(voteLimit)
  return Response.json({ code, hostSecret, voteLimit })
}
