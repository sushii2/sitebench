import { syncEnvVars } from "@trigger.dev/build/extensions/core"
import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  project: "proj_buehlfekageivexkxyui",
  runtime: "node-22",
  logLevel: "info",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      syncEnvVars(async () =>
        [
          "AI_GATEWAY_API_KEY",
          "ANTHROPIC_API_KEY",
          "INSFORGE_API_KEY",
          "NEXT_PUBLIC_INSFORGE_ANON_KEY",
          "NEXT_PUBLIC_INSFORGE_URL",
        ]
          .map((name) => ({
            name,
            value: process.env[name],
          }))
          .filter(
            (
              envVar
            ): envVar is {
              name: string
              value: string
            } => typeof envVar.value === "string" && envVar.value.length > 0
          )
      ),
    ],
  },
});
