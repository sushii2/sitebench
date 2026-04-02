"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { signInSchema } from "@/lib/auth/validation"
import { cn } from "@/lib/utils"

type LoginValues = {
  email: string
  password: string
}

const emptyValues: LoginValues = {
  email: "",
  password: "",
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const {
    authenticatedRedirectPath,
    brandStatus,
    brandStatusError,
    isLoading: isAuthLoading,
    refreshAuthState,
    user,
  } = useAuth()
  const [formValues, setFormValues] = React.useState<LoginValues>(emptyValues)
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof LoginValues, string>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (
      !isAuthLoading &&
      user &&
      brandStatus === "ready" &&
      authenticatedRedirectPath
    ) {
      router.replace(authenticatedRedirectPath)
    }
  }, [authenticatedRedirectPath, brandStatus, isAuthLoading, router, user])

  function updateField<K extends keyof LoginValues>(
    key: K,
    value: LoginValues[K]
  ) {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }))
    setFieldErrors((current) => ({
      ...current,
      [key]: undefined,
    }))
    setFormError(null)
  }

  async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (isAuthLoading || user) {
      return
    }

    const parsed = signInSchema.safeParse(formValues)

    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof LoginValues, string>> = {}

      for (const issue of parsed.error.issues) {
        const path = issue.path[0]

        if (path === "email" || path === "password") {
          nextErrors[path] ??= issue.message
        }
      }

      setFieldErrors(nextErrors)
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const insforge = getInsforgeBrowserClient()
      const { data, error } = await insforge.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (error) {
        setFormError(error.message)
        return
      }

      if (data?.accessToken) {
        const nextAuthState = await refreshAuthState()

        if (nextAuthState.brandStatus === "error") {
          setFormError(
            nextAuthState.brandStatusError ??
              "Unable to load your brand setup."
          )
          return
        }

        if (nextAuthState.authenticatedRedirectPath) {
          router.replace(nextAuthState.authenticatedRedirectPath)
          return
        }

        return
      }

      setFormError("Unable to sign in.")
    } catch (submissionError) {
      setFormError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to sign in."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitDisabled = isAuthLoading || isSubmitting || Boolean(user)

  if (isAuthLoading) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Checking your session...</CardTitle>
            <CardDescription>Loading Sitebench.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (user && brandStatus === "error") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              We couldn&apos;t load your brand setup
            </CardTitle>
            <CardDescription>
              {brandStatusError ?? "Please try again in a moment."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => {
                void refreshAuthState()
              }}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (user) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Redirecting...</CardTitle>
            <CardDescription>Taking you to your account.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Log in to your account</CardTitle>
          <CardDescription>
            Enter your email below to continue to Sitebench
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
            noValidate
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={formValues.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email ? (
                  <FieldDescription className="text-destructive">
                    {fieldErrors.email}
                  </FieldDescription>
                ) : null}
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <span className="ml-auto text-sm text-muted-foreground">
                    Forgot your password?
                  </span>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formValues.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                {fieldErrors.password ? (
                  <FieldDescription className="text-destructive">
                    {fieldErrors.password}
                  </FieldDescription>
                ) : null}
              </Field>
              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitDisabled}
                >
                  {isSubmitting ? "Signing in..." : "Log In"}
                </Button>
                {formError ? (
                  <FieldDescription className="text-destructive">
                    {formError}
                  </FieldDescription>
                ) : null}
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
