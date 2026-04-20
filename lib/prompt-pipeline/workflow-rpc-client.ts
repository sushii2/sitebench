import { resolveInsforgePublicConfig } from "@/lib/insforge/config"

type PromptPipelineWorkflowRpcResult<TData = unknown> = {
  data: TData | null
  error: Error | null
}

type Awaitable<T> = T | PromiseLike<T>

export type PromptPipelineWorkflowRpcClient = {
  database: {
    rpc: <TData = unknown>(
      functionName: string,
      params?: Record<string, unknown>
    ) => Awaitable<PromptPipelineWorkflowRpcResult<TData>>
  }
}

function extractErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload
  }

  return null
}

function removeBrokenUnicodeSequences(value: string) {
  let sanitized = ""

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)

    if (codeUnit === 0) {
      continue
    }

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit =
        index + 1 < value.length ? value.charCodeAt(index + 1) : null

      if (
        nextCodeUnit !== null &&
        nextCodeUnit >= 0xdc00 &&
        nextCodeUnit <= 0xdfff
      ) {
        sanitized += value[index] + value[index + 1]
        index += 1
      }

      continue
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      continue
    }

    sanitized += value[index]
  }

  return sanitized
}

function sanitizeRpcPayload<T>(value: T): T {
  if (typeof value === "string") {
    return removeBrokenUnicodeSequences(value) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRpcPayload(item)) as T
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      sanitizeRpcPayload(entryValue),
    ])
  ) as T
}

async function readResponsePayload(response: Response) {
  if (typeof response.text === "function") {
    const bodyText = await response.text()

    if (!bodyText.trim()) {
      return null
    }

    try {
      return JSON.parse(bodyText) as unknown
    } catch {
      return bodyText
    }
  }

  if (typeof response.json === "function") {
    return (await response.json()) as unknown
  }

  return null
}

export function createPromptPipelineWorkflowRpcClient(): PromptPipelineWorkflowRpcClient {
  const { anonKey, baseUrl } = resolveInsforgePublicConfig()

  return {
    database: {
      async rpc<TData = unknown>(
        functionName: string,
        params: Record<string, unknown> = {}
      ): Promise<PromptPipelineWorkflowRpcResult<TData>> {
        const rpcUrl = `${baseUrl}/api/database/rpc/${functionName}`

        console.log("[prompt-pipeline][workflow-rpc] Calling RPC", {
          functionName,
        })

        try {
          const sanitizedParams = sanitizeRpcPayload(params)
          const response = await fetch(rpcUrl, {
            body: JSON.stringify(sanitizedParams),
            headers: {
              Authorization: `Bearer ${anonKey}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          })
          const payload = await readResponsePayload(response)

          if (!response.ok) {
            const message =
              extractErrorMessage(payload) ??
              `RPC ${functionName} failed with status ${response.status}.`
            const error = new Error(message)

            console.log("[prompt-pipeline][workflow-rpc] RPC failed", {
              functionName,
              message,
              status: response.status,
            })

            return {
              data: null,
              error,
            }
          }

          console.log("[prompt-pipeline][workflow-rpc] RPC succeeded", {
            functionName,
          })

          return {
            data: payload as TData | null,
            error: null,
          }
        } catch (error) {
          const resolvedError =
            error instanceof Error
              ? error
              : new Error(`RPC ${functionName} failed unexpectedly.`)

          console.log("[prompt-pipeline][workflow-rpc] RPC threw", {
            functionName,
            message: resolvedError.message,
          })

          return {
            data: null,
            error: resolvedError,
          }
        }
      },
    },
  }
}
