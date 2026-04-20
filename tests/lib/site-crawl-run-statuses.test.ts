import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

function loadLatestStatusConstraintMigration() {
  const migrationsDirectory = resolve(process.cwd(), "db/migrations")
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()

  let latestConstraintMigration: string | null = null

  for (const fileName of migrationFiles) {
    const sql = readFileSync(resolve(migrationsDirectory, fileName), "utf8")

    if (sql.includes("site_crawl_runs_status_check")) {
      latestConstraintMigration = sql
    }
  }

  return latestConstraintMigration
}

describe("site crawl run workflow statuses", () => {
  it("keeps the latest migration aligned with homepage-only onboarding phases", () => {
    const migration = loadLatestStatusConstraintMigration()

    expect(migration).not.toBeNull()
    expect(migration).toContain("'scraping'")
    expect(migration).toContain("'seeding'")
    expect(migration).toContain("'enhancing'")
    expect(migration).toContain("'competitors'")
    expect(migration).toContain("'prompting'")
    expect(migration).toContain("'completed'")
    expect(migration).toContain("'failed'")
  })
})
