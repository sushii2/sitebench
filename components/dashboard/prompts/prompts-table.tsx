"use client"

import * as React from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import { SentimentCell } from "@/components/dashboard/prompts/cells/sentiment-cell"
import { StatusCell } from "@/components/dashboard/prompts/cells/status-cell"
import { TopPerformersCell } from "@/components/dashboard/prompts/cells/top-performers-cell"
import { VisibilityCell } from "@/components/dashboard/prompts/cells/visibility-cell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BrandCompetitor } from "@/lib/brands/types"
import type { PromptMetricSummary } from "@/lib/prompt-metrics/repository"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { SentimentLabel } from "@/lib/response-brand-metrics/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

type PromptRow = {
  id: string
  prompt_text: string
  topic_id: string
  topic_name: string
  created_at: string
  visibility: number | null
  performerCount: number
  sentiment: SentimentLabel | null
  ranAt: Date | null
}

function formatCreated(value: string) {
  const created = new Date(value)
  const diffDays = Math.floor((Date.now() - created.getTime()) / 86_400_000)

  if (diffDays < 1) {
    return "today"
  }

  if (diffDays === 1) {
    return "1 day ago"
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`
  }

  return created.toLocaleDateString()
}

export function PromptsTable({
  topics,
  promptsByTopic,
  competitors,
  promptMetricsById,
}: {
  topics: ProjectTopic[]
  promptsByTopic: Map<string, TrackedPrompt[]>
  competitors: BrandCompetitor[]
  promptMetricsById: Map<string, PromptMetricSummary>
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [topicFilter, setTopicFilter] = React.useState<string>("all")

  const rows = React.useMemo<PromptRow[]>(() => {
    const next: PromptRow[] = []

    for (const topic of topics) {
      const topicPrompts = promptsByTopic.get(topic.id) ?? []

      for (const prompt of topicPrompts) {
        const metric = promptMetricsById.get(prompt.id)

        next.push({
          id: prompt.id,
          prompt_text: prompt.prompt_text,
          topic_id: topic.id,
          topic_name: topic.name,
          created_at: prompt.created_at,
          visibility: metric?.visibility ?? null,
          performerCount: metric?.performerCount ?? 0,
          sentiment: metric?.sentiment ?? null,
          ranAt: metric?.ranAt ? new Date(metric.ranAt) : null,
        })
      }
    }

    return next
  }, [promptMetricsById, promptsByTopic, topics])

  const filteredByTopic = React.useMemo(() => {
    if (topicFilter === "all") {
      return rows
    }
    return rows.filter((row) => row.topic_id === topicFilter)
  }, [rows, topicFilter])

  const columns = React.useMemo<ColumnDef<PromptRow>[]>(
    () => [
      {
        accessorKey: "prompt_text",
        header: "Prompt",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.prompt_text}</span>
        ),
      },
      {
        accessorKey: "topic_name",
        header: "Topic",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.topic_name}</Badge>
        ),
      },
      {
        accessorKey: "visibility",
        header: "Avg. Visibility",
        cell: ({ row }) => <VisibilityCell percent={row.original.visibility} />,
      },
      {
        id: "topPerformers",
        header: "Top Performers",
        cell: ({ row }) => (
          <TopPerformersCell
            competitors={competitors}
            count={row.original.performerCount}
          />
        ),
      },
      {
        accessorKey: "sentiment",
        header: "Sentiment",
        cell: ({ row }) => <SentimentCell tone={row.original.sentiment} />,
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatCreated(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "status",
        header: () => <div className="text-right">Status</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <StatusCell ranAt={row.original.ranAt} />
          </div>
        ),
      },
    ],
    [competitors]
  )

  const table = useReactTable({
    data: filteredByTopic,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  })

  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalFiltered = table.getFilteredRowModel().rows.length
  const rowsOnPage = table.getRowModel().rows

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search prompts..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rowsOnPage.length ? (
              rowsOnPage.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-xs text-muted-foreground"
                >
                  No prompts match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {totalFiltered} prompt{totalFiltered === 1 ? "" : "s"}
        </p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
            <span className="px-2 tabular-nums">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
