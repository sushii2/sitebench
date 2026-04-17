"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ProviderLogos } from "@/components/onboarding/provider-logos"

type PromptEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "add" | "edit"
  initialValue?: string
  topicName: string
  onSubmit: (value: string) => void
}

export function PromptEditDialog({
  open,
  onOpenChange,
  mode,
  initialValue,
  topicName,
  onSubmit,
}: PromptEditDialogProps) {
  const [value, setValue] = React.useState(initialValue ?? "")

  React.useEffect(() => {
    if (open) {
      setValue(initialValue ?? "")
    }
  }, [initialValue, open])

  const trimmed = value.trim()
  const canSubmit = trimmed.length > 0

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-lg p-6 text-sm sm:max-w-lg">
        <DialogHeader className="gap-2">
          <DialogTitle className="font-heading text-lg font-medium">
            {mode === "add" ? "Add prompt" : "Edit prompt"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            This prompt will be evaluated against &quot;{topicName}&quot; by all
            tracked providers.
          </DialogDescription>
          <ProviderLogos label="Run against" className="mt-3" />
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="prompt-edit-textarea" className="text-sm font-medium">
            Prompt
          </label>
          <Textarea
            id="prompt-edit-textarea"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="e.g. What are the best tools for AI search tracking?"
            rows={5}
            autoFocus
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                handleSubmit()
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Tip: phrase the prompt like a real user would ask it.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {mode === "add" ? "Add prompt" : "Save prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
