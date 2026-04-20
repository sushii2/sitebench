"use client"

import { useSearchParams } from "next/navigation"

import { PromptRunChatPage } from "@/components/dashboard/chats/prompt-run-chat-page"

export default function ChatsPage() {
  const searchParams = useSearchParams()

  return (
    <PromptRunChatPage promptRunId={searchParams.get("promptRunId") ?? null} />
  )
}
