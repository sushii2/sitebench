import { StepIndicator, type StepStatus } from "./step-indicator"

export type SidebarStep = {
  key: number
  label: string
  optional?: boolean
}

type OnboardingSidebarProps = {
  steps: readonly SidebarStep[]
  currentStep: number
  completedSteps: ReadonlySet<number>
}

export function OnboardingSidebar({
  steps,
  currentStep,
  completedSteps,
}: OnboardingSidebarProps) {
  return (
    <aside className="dark sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col self-start bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 px-6 py-6">
        <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-foreground text-sidebar">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 12h10M12 7v10" />
          </svg>
        </span>
        <span className="font-heading text-base font-medium tracking-tight">
          Sitebench
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-6 pt-2" aria-label="Onboarding steps">
        {steps.map((step) => {
          const status: StepStatus = completedSteps.has(step.key)
            ? "done"
            : step.key === currentStep
              ? "current"
              : "upcoming"

          return (
            <StepIndicator
              key={step.key}
              index={step.key}
              label={step.label}
              status={status}
              optional={step.optional}
            />
          )
        })}
      </nav>
    </aside>
  )
}
