import type { NextRequest } from "next/server"
import { retroHub } from "@/lib/retro-hub"

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase()
  let state = retroHub.safeState(code)
  if (!state) {
    await retroHub.ensure(code)
    state = retroHub.safeState(code)
  }
  if (!state) return new Response("Not found", { status: 404 })
  return Response.json(state)
}
