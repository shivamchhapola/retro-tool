"use client"

import { DndContext, useSensor, useSensors, PointerSensor, type DragEndEvent } from "@dnd-kit/core"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ClientSafeSession } from "@/lib/retro-hub"
import { retroApi } from "./session-store"
import { useMemo, useState } from "react"

export function GroupingStage({
  code,
  state,
  isHost,
  participantId,
}: {
  code: string
  state: ClientSafeSession
  isHost: boolean
  participantId: string
}) {
  const ungrouped = useMemo(() => {
    const grouped = new Set<string>()
    Object.values(state.groups).forEach((g) => g.noteIds.forEach((id) => grouped.add(id)))
    return Object.values(state.notes).filter((n) => !grouped.has(n.id))
  }, [state.notes, state.groups])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const onDragEnd = async (e: DragEndEvent) => {
    const noteId = e.active?.id as string
    const overId = e.over?.id as string | undefined
    if (!overId) return
    if (overId.startsWith("group:")) {
      const groupId = overId.slice(6)
      await retroApi.sendEvent(code, { type: "add-note-to-group", groupId, noteId })
    } else if (overId === "new-group") {
      const groupId = crypto.randomUUID()
      await retroApi.sendEvent(code, { type: "create-group", id: groupId, name: "New group" })
      await retroApi.sendEvent(code, { type: "add-note-to-group", groupId, noteId })
    }
  }

  return (
    <div className="grid gap-4">
      <div className="text-sm text-muted-foreground">Drag notes into groups. Create or rename groups as needed.</div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-3">
            <h3 className="font-medium">Ungrouped</h3>
            <div className="mt-2 grid gap-2" id="ungrouped">
              {ungrouped.map((n) => (
                <DraggableNote key={n.id} id={n.id} text={n.text} />
              ))}
              {ungrouped.length === 0 && <div className="text-sm text-muted-foreground">No ungrouped notes.</div>}
            </div>
            <DroppableArea id="new-group" label="Drop here to create new group" />
          </Card>

          {Object.values(state.groups).map((g) => (
            <Card key={g.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <EditableGroupName code={code} groupId={g.id} name={g.name} />
              </div>
              <DroppableArea id={`group:${g.id}`} label="Drop notes here" />
              <div className="mt-2 grid gap-2">
                {g.noteIds.map((id) => {
                  const n = state.notes[id]
                  if (!n) return null
                  return <DraggableNote key={id} id={id} text={n.text} />
                })}
              </div>
            </Card>
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function EditableGroupName({ code, groupId, name }: { code: string; groupId: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(name)
  const save = async () => {
    await retroApi.sendEvent(code, { type: "rename-group", id: groupId, name: val || "Group" })
    setEditing(false)
  }
  return (
    <div className="flex items-center gap-2">
      {!editing ? (
        <>
          <h3 className="font-medium">{name}</h3>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Rename
          </Button>
        </>
      ) : (
        <>
          <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-8" />
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </>
      )}
    </div>
  )
}

import { useDraggable, useDroppable } from "@dnd-kit/core"

function DraggableNote({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="rounded-md border bg-card px-3 py-2 cursor-grab active:cursor-grabbing"
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.7 : 1,
      }}
    >
      <div className="text-sm">{text}</div>
    </div>
  )
}

function DroppableArea({ id, label }: { id: string; label: string }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground"
      style={{ background: isOver ? ("var(--color-muted)" as any) : "transparent" }}
    >
      {label}
    </div>
  )
}
