export type SentimentTone = "positive" | "neutral" | "negative"

const SENTIMENTS: SentimentTone[] = ["positive", "neutral", "negative"]

const HOUR_MS = 60 * 60 * 1000

function fnv1a(input: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function unitSeed(promptId: string, platform: string): number {
  return fnv1a(`${promptId}:${platform}`) / 0xffffffff
}

export function mockVisibility(promptId: string, platform: string): number {
  const seed = unitSeed(promptId, platform)

  return Math.round(seed * 100)
}

export function mockSentiment(
  promptId: string,
  platform: string
): SentimentTone {
  const seed = unitSeed(`${promptId}:sentiment`, platform)
  const index = Math.floor(seed * SENTIMENTS.length)

  return SENTIMENTS[Math.min(index, SENTIMENTS.length - 1)]
}

export function mockStatusRanAt(promptId: string): Date {
  const seed = unitSeed(`${promptId}:status`, "global")
  const hoursAgo = Math.floor(seed * 240) + 1

  return new Date(Date.now() - hoursAgo * HOUR_MS)
}

export function mockTopPerformerCount(promptId: string): number {
  const seed = unitSeed(`${promptId}:performers`, "global")

  return Math.floor(seed * 6)
}
