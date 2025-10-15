"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ClientSafeSession } from "@/lib/retro-hub"
import { retroApi } from "./session-store"
import { useEffect, useState } from "react"

export function NotesStage({
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
  mutate?: any
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">Add notes to sections. Host can manage sections.</div>
        {isHost && <AddSectionForm code={code} mutate={mutate} />}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {state.sections
          .sort((a, b) => a.order - b.order)
          .map((sec) => (
            <SectionColumn
              key={sec.id}
              code={code}
              sectionId={sec.id}
              sectionName={sec.name}
              isHost={isHost}
              notes={Object.values(state.notes).filter((n) => n.sectionId === sec.id)}
              participantId={participantId}
              mutate={mutate} // pass mutate down
            />
          ))}
      </div>
    </div>
  )
}

function AddSectionForm({ code, mutate }: { code: string; mutate?: any }) {
  const [name, setName] = useState("")
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        const id = crypto.randomUUID()
        // optimistic add
        await mutate?.(
          (prev: ClientSafeSession | undefined) => {
            if (!prev) return prev
            const nextSections = prev.sections.concat([{ id, name: name.trim(), order: prev.sections.length } as any])
            return { ...prev, sections: nextSections }
          },
          { revalidate: false },
        )
        // server event
        await retroApi.sendEvent(code, {
          type: "add-section",
          id,
          name: name.trim(),
          hostSecret: retroApi.hostSecret(code),
        })
        setName("")
      }}
    >
      <Input placeholder="Add section" value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
      <Button type="submit" size="sm">
        Add
      </Button>
    </form>
  )
}

function SectionColumn({
  code,
  sectionId,
  sectionName,
  isHost,
  notes,
  participantId,
  mutate,
}: {
  code: string
  sectionId: string
  sectionName: string
  isHost: boolean
  notes: { id: string; text: string }[]
  participantId: string
  mutate?: any // pass mutate down for optimistic updates
}) {
  const [newText, setNewText] = useState("")
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sectionName)

  useEffect(() => {
    if (!editing) setName(sectionName)
  }, [sectionName, editing])

  const rename = async () => {
    await mutate?.(
      (prev: ClientSafeSession | undefined) => {
        if (!prev) return prev
        const nextSections = prev.sections.map((s) => (s.id === sectionId ? { ...s, name } : s))
        return { ...prev, sections: nextSections }
      },
      { revalidate: false },
    )
    await retroApi.sendEvent(code, {
      type: "rename-section",
      id: sectionId,
      name,
      hostSecret: retroApi.hostSecret(code),
    })
    setEditing(false)
  }
  const remove = async () => {
    if (!confirm("Remove section?")) return
    await mutate?.(
      (prev: ClientSafeSession | undefined) => {
        if (!prev) return prev
        const nextSections = prev.sections.filter((s) => s.id !== sectionId)
        return { ...prev, sections: nextSections }
      },
      { revalidate: false },
    )
    await retroApi.sendEvent(code, { type: "remove-section", id: sectionId, hostSecret: retroApi.hostSecret(code) })
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-pretty">{sectionName}</h3>
        {isHost && !editing && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Rename
            </Button>
            <Button size="sm" variant="destructive" onClick={remove}>
              Remove
            </Button>
          </div>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            <Button size="sm" onClick={rename}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setName(sectionName)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!newText.trim()) return
            const id = crypto.randomUUID()
            const note = {
              id,
              text: newText.trim(),
              sectionId,
              createdBy: participantId,
              createdAt: Date.now(),
            }
            if (mutate) {
              await mutate(
                (prev: ClientSafeSession | undefined) => {
                  if (!prev) return prev
                  return {
                    ...prev,
                    notes: { ...prev.notes, [id]: note as any },
                  }
                },
                { revalidate: false },
              )
            }
            await retroApi.sendEvent(code, {
              type: "add-note",
              id,
              text: note.text,
              sectionId,
              createdBy: participantId,
            })
            setNewText("")
          }}
          className="flex gap-2"
        >
          <Input placeholder="Add a note" value={newText} onChange={(e) => setNewText(e.target.value)} />
          <Button type="submit">Add</Button>
        </form>

        <div className="grid gap-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border bg-card px-3 py-2">
              <div className="text-sm">{n.text}</div>
              <div className="mt-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (mutate) {
                      await mutate(
                        (prev: ClientSafeSession | undefined) => {
                          if (!prev) return prev
                          const nextNotes = { ...prev.notes }
                          delete (nextNotes as any)[n.id]
                          const nextGroups = Object.fromEntries(
                            Object.entries(prev.groups).map(([gid, g]) => [
                              gid,
                              { ...g, noteIds: g.noteIds.filter((x) => x !== n.id) },
                            ]),
                          )
                          return { ...prev, notes: nextNotes as any, groups: nextGroups as any }
                        },
                        { revalidate: false },
                      )
                    }
                    await retroApi.sendEvent(code, {
                      type: "delete-note",
                      id: n.id,
                      createdBy: participantId,
                    })
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {notes.length === 0 && <div className="text-sm text-muted-foreground">No notes yet.</div>}
        </div>
      </div>
    </Card>
  )
}
