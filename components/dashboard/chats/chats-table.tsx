"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
} from "@hugeicons/core-free-icons"

import { BrandIconsCell } from "@/components/dashboard/chats/cells/brand-icons-cell"
import { PlatformIconsCell } from "@/components/dashboard/chats/cells/platform-icons-cell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ChatSummary } from "@/lib/chats/types"

function formatScheduled(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays < 1) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (diffDays === 1) {
    return "yesterday"
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

export function ChatsTable({
  chats,
  hrefForChat,
}: {
  chats: ChatSummary[]
  hrefForChat: (promptRunId: string) => string
}) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])

  const columns = React.useMemo<ColumnDef<ChatSummary>[]>(
    () => [
      {
        accessorKey: "promptText",
        header: "Prompt",
        cell: ({ row }) => (
          <span className="block max-w-[520px] text-sm font-medium text-foreground">
            <span className="line-clamp-2">
              {row.original.promptText || "Untitled prompt"}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "topicName",
        header: "Topic",
        cell: ({ row }) =>
          row.original.topicName ? (
            <Badge variant="outline" className="font-normal">
              {row.original.topicName}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "platforms",
        header: "Platforms",
        cell: ({ row }) => (
          <PlatformIconsCell platforms={row.original.platforms} />
        ),
      },
      {
        id: "brands",
        header: "Brands",
        cell: ({ row }) => (
          <BrandIconsCell mentions={row.original.brandMentions} />
        ),
      },
      {
        accessorKey: "sourceCount",
        header: () => <div className="text-right">Sources</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-sm">
            {row.original.sourceCount}
          </div>
        ),
      },
      {
        accessorKey: "scheduledFor",
        header: () => <div className="text-right">Ran</div>,
        cell: ({ row }) => (
          <div className="text-right text-xs tabular-nums text-muted-foreground">
            {formatScheduled(row.original.scheduledFor)}
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: chats,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: {
      pagination: { pageSize: 25 },
      sorting: [{ id: "scheduledFor", desc: true }],
    },
  })

  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalFiltered = table.getFilteredRowModel().rows.length
  const rowsOnPage = table.getRowModel().rows

  if (chats.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No chats match these filters.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
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
            {rowsOnPage.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => {
                  router.push(hrefForChat(row.original.promptRunId))
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {totalFiltered} chat{totalFiltered === 1 ? "" : "s"}
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
