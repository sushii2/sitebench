import { ChatDetailPage } from "@/components/dashboard/chats/chat-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ promptRunId: string }>
}) {
  const { promptRunId } = await params

  return <ChatDetailPage promptRunId={promptRunId} />
}
