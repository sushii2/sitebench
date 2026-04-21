"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChatResponseView } from "@/lib/chats/types"

export function ChatPlatformToggle({
  activeCode,
  onChange,
  responses,
}: {
  activeCode: string
  onChange: (code: string) => void
  responses: ChatResponseView[]
}) {
  if (responses.length === 0) {
    return null
  }

  return (
    <Tabs value={activeCode} onValueChange={onChange}>
      <TabsList>
        {responses.map((view) => (
          <TabsTrigger key={view.response.id} value={view.response.platform_code}>
            {view.platformLabel}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
