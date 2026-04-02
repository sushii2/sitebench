import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardPage({
  title,
  isLoading = false,
}: {
  title: string
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col p-4 pt-0">
        <Card className="min-h-[calc(100svh-6rem)] overflow-hidden border-border/60 bg-background/80 shadow-sm">
          <CardHeader className="space-y-4 border-b bg-muted/30">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <CardTitle className="text-2xl">{title}</CardTitle>
            </div>
            <CardDescription>Loading page shell...</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
            <section className="space-y-4">
              <Skeleton className="h-64 w-full rounded-none" />
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-24 rounded-none" />
                <Skeleton className="h-24 rounded-none" />
                <Skeleton className="h-24 rounded-none" />
              </div>
            </section>
            <section className="space-y-4">
              <Skeleton className="h-8 w-40" />
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-none" />
                <Skeleton className="h-14 w-full rounded-none" />
                <Skeleton className="h-14 w-full rounded-none" />
                <Skeleton className="h-14 w-full rounded-none" />
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col p-4 pt-0">
      <Card className="min-h-[calc(100svh-6rem)]">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading page shell..."
              : "Dashboard content coming soon."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        </CardContent>
      </Card>
    </div>
  )
}
