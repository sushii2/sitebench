function formatRelative(ranAt: Date): string {
  const diffMs = Date.now() - ranAt.getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))

  if (minutes < 1) {
    return "just now"
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  return `${days}d ago`
}

export function StatusCell({ ranAt }: { ranAt: Date | null }) {
  if (!ranAt) {
    return <span className="text-xs text-muted-foreground">Not run yet</span>
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-emerald-500"
      />
      Prompt ran {formatRelative(ranAt)}
    </span>
  )
}
