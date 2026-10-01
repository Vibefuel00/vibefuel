"use client"

import * as React from "react"

import { StartForm } from "@/components/app/start-form"

/** "Create your developer key" in a modal. Opens from the hero and from /#start. */
export function StartModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal modal-wide"
      aria-label="Create your developer key"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-body">
        <button type="button" className="link-button modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <StartForm />
      </div>
    </dialog>
  )
}
