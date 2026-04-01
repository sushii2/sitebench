import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function DashboardPage({
  title,
  isLoading = false,
}: {
  title: string
  isLoading?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col p-4 pt-0">
      <Card className="min-h-[calc(100svh-6rem)]">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>
            {isLoading ? "Loading page shell..." : "Dashboard content coming soon."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        </CardContent>
      </Card>
    </div>
  )
}
