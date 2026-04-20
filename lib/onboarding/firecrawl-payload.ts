export function stripDuplicatedHomepageBodies(
  value: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...value }

  delete sanitized.html
  delete sanitized.markdown

  return sanitized
}
