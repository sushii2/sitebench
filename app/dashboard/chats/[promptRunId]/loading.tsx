import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ChatDetailLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 pt-0">
      <Card className="min-h-[calc(100svh-6rem)]">
        <CardHeader className="space-y-3 border-b">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.4fr)]">
          <div className="space-y-4">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
