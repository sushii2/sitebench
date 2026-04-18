function toSerializableObject(value: unknown) {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== "object") {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

export function serializeOnboardingError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    const serialized = {
      code:
        typeof record.code === "string" || typeof record.code === "number"
          ? record.code
          : undefined,
      details:
        typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
      message:
        typeof record.message === "string" ? record.message : undefined,
      name: typeof record.name === "string" ? record.name : undefined,
      statusCode:
        typeof record.statusCode === "number" ? record.statusCode : undefined,
    }

    if (Object.values(serialized).some((value) => value !== undefined)) {
      return serialized
    }
  }

  return toSerializableObject(error)
}

export function getOnboardingErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : null

    if (message?.trim()) {
      return message
    }
  }

  return fallback
}

export function logOnboardingAnalysisEvent(
  message: string,
  details?: Record<string, unknown>
) {
  console.log(`[onboarding] ${message}`, details ?? {})
}

export function logOnboardingAnalysisError(
  message: string,
  error: unknown,
  details?: Record<string, unknown>
) {
  console.error(`[onboarding] ${message}`, {
    ...(details ?? {}),
    error: serializeOnboardingError(error),
  })
}
