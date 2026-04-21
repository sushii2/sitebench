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

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { cn } from "@/lib/utils"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

type PromptRow = {
  id: string
  prompt_text: string
  topic_id: string
  topic_name: string
}

type PromptsSelectionTableProps = {
  prompts: TrackedPrompt[]
  topics: ProjectTopic[]
  selectedPromptIds: Set<string>
  onSelectionChange: (next: Set<string>) => void
  pageSize?: number
}

export function PromptsSelectionTable({
  prompts,
  topics,
  selectedPromptIds,
  onSelectionChange,
  pageSize = 8,
}: PromptsSelectionTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [topicFilter, setTopicFilter] = React.useState<string>("all")

  const topicsById = React.useMemo(() => {
    const map = new Map<string, ProjectTopic>()
    for (const topic of topics) {
      map.set(topic.id, topic)
    }
    return map
  }, [topics])

  const rows = React.useMemo<PromptRow[]>(() => {
    return prompts
      .filter((prompt) => prompt.is_active)
      .map((prompt) => {
        const topic = topicsById.get(prompt.project_topic_id)
        return {
          id: prompt.id,
          prompt_text: prompt.prompt_text,
          topic_id: prompt.project_topic_id,
          topic_name: topic?.name ?? "Uncategorized",
        }
      })
  }, [prompts, topicsById])

  const filteredRows = React.useMemo(() => {
    if (topicFilter === "all") {
      return rows
    }
    return rows.filter((row) => row.topic_id === topicFilter)
  }, [rows, topicFilter])

  const toggleRow = React.useCallback(
    (promptId: string, checked: boolean) => {
      const next = new Set(selectedPromptIds)
      if (checked) {
        next.add(promptId)
      } else {
        next.delete(promptId)
      }
      onSelectionChange(next)
    },
    [onSelectionChange, selectedPromptIds]
  )

  const toggleTopic = React.useCallback(
    (topicId: string, checked: boolean) => {
      const topicPromptIds = rows
        .filter((row) => row.topic_id === topicId)
        .map((row) => row.id)
      const next = new Set(selectedPromptIds)
      for (const promptId of topicPromptIds) {
        if (checked) {
          next.add(promptId)
        } else {
          next.delete(promptId)
        }
      }
      onSelectionChange(next)
    },
    [onSelectionChange, rows, selectedPromptIds]
  )

  const columns = React.useMemo<ColumnDef<PromptRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const visibleRows = table.getRowModel().rows
          const allChecked =
            visibleRows.length > 0 &&
            visibleRows.every((row) => selectedPromptIds.has(row.original.id))
          const someChecked =
            !allChecked &&
            visibleRows.some((row) => selectedPromptIds.has(row.original.id))
          return (
            <Checkbox
              checked={allChecked ? true : someChecked ? "indeterminate" : false}
              onCheckedChange={(value) => {
                const next = new Set(selectedPromptIds)
                for (const row of visibleRows) {
                  if (value) {
                    next.add(row.original.id)
                  } else {
                    next.delete(row.original.id)
                  }
                }
                onSelectionChange(next)
              }}
              aria-label="Select all on page"
            />
          )
        },
        cell: ({ row }) => (
          <Checkbox
            checked={selectedPromptIds.has(row.original.id)}
            onCheckedChange={(value) => toggleRow(row.original.id, Boolean(value))}
            aria-label={`Select prompt ${row.original.prompt_text}`}
          />
        ),
        enableSorting: false,
      },
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
        cell: ({ row }) => {
          const topicId = row.original.topic_id
          const topicSelected = rows
            .filter((item) => item.topic_id === topicId)
            .every((item) => selectedPromptIds.has(item.id))
          return (
            <button
              type="button"
              onClick={() => toggleTopic(topicId, !topicSelected)}
              className="inline-flex"
              aria-label={
                topicSelected
                  ? `Deselect all prompts in ${row.original.topic_name}`
                  : `Select all prompts in ${row.original.topic_name}`
              }
            >
              <Badge
                variant={topicSelected ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  topicSelected ? "" : "hover:bg-accent"
                )}
              >
                {row.original.topic_name}
              </Badge>
            </button>
          )
        },
      },
    ],
    [onSelectionChange, rows, selectedPromptIds, toggleRow, toggleTopic]
  )

  const table = useReactTable({
    data: filteredRows,
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
      pagination: { pageSize },
    },
  })

  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalFiltered = table.getFilteredRowModel().rows.length
  const rowsOnPage = table.getRowModel().rows

  return (
    <div className="flex w-full flex-col gap-3">
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
            className="h-8 pl-8"
          />
        </div>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger className="h-8 w-full sm:w-52">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {topics
              .filter((topic) => topic.is_active)
              .map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
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
                <TableRow
                  key={row.id}
                  data-state={
                    selectedPromptIds.has(row.original.id) ? "selected" : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
          {selectedPromptIds.size} selected · {totalFiltered} prompt
          {totalFiltered === 1 ? "" : "s"} shown
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
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
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
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
