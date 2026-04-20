import {
  stepCountIs,
  type PrepareStepFunction,
  type StopCondition,
  type ToolSet,
} from "ai"

// AI SDK structured output with tool calling needs one extra step after search.
export const SINGLE_SEARCH_STRUCTURED_OUTPUT_MAX_STEPS = 3

export function createSingleSearchStructuredOutputLoopControl<
  TOOLS extends ToolSet,
>(_tools: TOOLS, logMessage: string): {
  prepareStep: PrepareStepFunction<TOOLS>
  stopWhen: StopCondition<TOOLS>
} {
  const prepareStep: PrepareStepFunction<TOOLS> = ({ stepNumber, steps }) => {
    const hasCompletedSearch = steps.some((step) =>
      step.toolCalls.some((toolCall) => toolCall.toolName === "parallel_search")
    )

    if (!hasCompletedSearch) {
      return {}
    }

    console.log(logMessage, {
      priorStepCount: steps.length,
      stepNumber,
    })

    return {
      activeTools: [],
    }
  }

  return {
    prepareStep,
    stopWhen: stepCountIs(
      SINGLE_SEARCH_STRUCTURED_OUTPUT_MAX_STEPS
    ) as StopCondition<TOOLS>,
  }
}
