import * as React from "react"
import {
  BookOpen02Icon,
  CommandIcon,
  ComputerTerminalIcon,
  LayoutBottomIcon,
  MapsIcon,
  PieChartIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export type DashboardNavItem = {
  href: string
  icon: React.ReactNode
  label: string
}

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    icon: <HugeiconsIcon icon={LayoutBottomIcon} strokeWidth={2} />,
    label: "Home",
  },
  {
    href: "/dashboard/prompts",
    icon: <HugeiconsIcon icon={CommandIcon} strokeWidth={2} />,
    label: "Prompts",
  },
  {
    href: "/dashboard/chats",
    icon: <HugeiconsIcon icon={ComputerTerminalIcon} strokeWidth={2} />,
    label: "Chats",
  },
  {
    href: "/dashboard/insights",
    icon: <HugeiconsIcon icon={PieChartIcon} strokeWidth={2} />,
    label: "Insights",
  },
  {
    href: "/dashboard/sources",
    icon: <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} />,
    label: "Sources",
  },
  {
    href: "/dashboard/queries",
    icon: <HugeiconsIcon icon={MapsIcon} strokeWidth={2} />,
    label: "Queries",
  },
]

export const dashboardCollectionLabels = ["Tags", "Brands", "Cohorts"] as const
