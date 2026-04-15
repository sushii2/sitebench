"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const platforms = ["All Platforms", "ChatGPT", "Gemini", "Claude", "Grok"]
const dateRanges = ["Last 7 Days", "Last 14 Days", "Last 30 Days", "Last 90 Days"]

export function DashboardFilters() {
  const { brand } = useAuth()
  const [platform, setPlatform] = React.useState("All Platforms")
  const [dateRange, setDateRange] = React.useState("Last 7 Days")
  const [topic, setTopic] = React.useState("All Topics")

  const topics = ["All Topics", ...(brand?.topics ?? [])]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={platform} onValueChange={setPlatform}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {platforms.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={dateRange} onValueChange={setDateRange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {dateRanges.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={topic} onValueChange={setTopic}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {topics.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
