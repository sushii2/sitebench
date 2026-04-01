import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

const dashboardPages = [
  { heading: "Home", modulePath: "@/app/dashboard/page" },
  { heading: "Prompts", modulePath: "@/app/dashboard/prompts/page" },
  { heading: "Chats", modulePath: "@/app/dashboard/chats/page" },
  { heading: "Insights", modulePath: "@/app/dashboard/insights/page" },
  { heading: "Sources", modulePath: "@/app/dashboard/sources/page" },
  { heading: "Queries", modulePath: "@/app/dashboard/queries/page" },
] as const

describe("dashboard pages", () => {
  it.each(dashboardPages)(
    "renders the $heading page heading",
    async ({ heading, modulePath }) => {
      const module = await import(modulePath)
      const Page = module.default

      render(<Page />)

      expect(
        screen.getByRole("heading", { level: 1, name: heading })
      ).toBeInTheDocument()
    }
  )
})
