import { retroHub } from "@/lib/retro-hub"

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase()

  if (!retroHub.safeState(code)) {
    await retroHub.ensure(code)
  }
  const state = retroHub.safeState(code)
  if (!state) return new Response("Not found", { status: 404 })

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const write = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      // send initial state
      write({ type: "state", state })

      const subscriber = (payload: any) => write(payload)
      retroHub.on(code, subscriber)

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"))
      }, 15000)

      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"))

      const cancel = () => {
        clearInterval(heartbeat)
        retroHub.off(code, subscriber)
        try {
          controller.close()
        } catch {}
      }

      // @ts-ignore Next.js abort signal
      const signal: AbortSignal | undefined = (globalThis as any).nextFetchSignal
      if (signal) {
        signal.addEventListener("abort", cancel)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
