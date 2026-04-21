"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { createSignupSchema, buildPasswordPolicy, describePasswordPolicy } from "@/lib/auth/validation"
import { useAuth } from "@/components/auth-provider"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { cn } from "@/lib/utils"
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

type SignupValues = {
  confirmPassword: string
  email: string
  name: string
  password: string
}

const emptyValues: SignupValues = {
  confirmPassword: "",
  email: "",
  name: "",
  password: "",
}

export function SignupForm({
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
  const [formValues, setFormValues] = React.useState<SignupValues>(emptyValues)
  const [fieldErrors, setFieldErrors] = React.useState<Partial<
    Record<keyof SignupValues, string>
  >>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isConfigLoading, setIsConfigLoading] = React.useState(true)
  const [configError, setConfigError] = React.useState<string | null>(null)
  const [passwordPolicy, setPasswordPolicy] = React.useState(
    buildPasswordPolicy()
  )
  const [canSubmit, setCanSubmit] = React.useState(false)

  const schema = React.useMemo(
    () => createSignupSchema(passwordPolicy),
    [passwordPolicy]
  )

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

  React.useEffect(() => {
    const insforge = getInsforgeBrowserClient()
    let active = true

    async function loadAuthConfig() {
      setIsConfigLoading(true)
      setConfigError(null)

      const { data, error } = await insforge.auth.getPublicAuthConfig()

      if (!active) {
        return
      }

      if (error || !data) {
        setConfigError(error?.message ?? "Unable to load auth configuration.")
        setCanSubmit(false)
        setIsConfigLoading(false)
        return
      }

      if (data.requireEmailVerification) {
        setConfigError(
          "This sign-up flow is not available because this backend requires email verification. Disable email verification in Insforge to use this form."
        )
        setCanSubmit(false)
        setIsConfigLoading(false)
        return
      }

      setPasswordPolicy(buildPasswordPolicy(data))
      setCanSubmit(true)
      setIsConfigLoading(false)
    }

    void loadAuthConfig()

    return () => {
      active = false
    }
  }, [])

  const passwordRequirementText = React.useMemo(
    () => describePasswordPolicy(passwordPolicy),
    [passwordPolicy]
  )

  function updateField<K extends keyof SignupValues>(
    key: K,
    value: SignupValues[K]
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit || isConfigLoading || configError) {
      return
    }

    const parsed = schema.safeParse(formValues)

    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof SignupValues, string>> = {}

      for (const issue of parsed.error.issues) {
        const path = issue.path[0]

        if (path === "email" || path === "name" || path === "password" || path === "confirmPassword") {
          nextErrors[path] ??= issue.message
        }
      }

      setFieldErrors(nextErrors)
      return
    }

    const insforge = getInsforgeBrowserClient()

    setIsSubmitting(true)
    setFormError(null)

    try {
      const { data, error } = await insforge.auth.signUp({
        email: parsed.data.email,
        name: parsed.data.name,
        password: parsed.data.password,
        redirectTo: `${window.location.origin}/login`,
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
        }
      }
    } catch (submissionError) {
      setFormError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create your account."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitDisabled =
    isAuthLoading ||
    isConfigLoading ||
    !canSubmit ||
    Boolean(configError) ||
    isSubmitting

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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={formValues.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name ? (
                  <FieldDescription className="text-destructive">
                    {fieldErrors.name}
                  </FieldDescription>
                ) : null}
              </Field>
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
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
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
                    <FieldLabel htmlFor="confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      type="password"
                      required
                      value={formValues.confirmPassword}
                      onChange={(event) =>
                        updateField("confirmPassword", event.target.value)
                      }
                      aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    />
                    {fieldErrors.confirmPassword ? (
                      <FieldDescription className="text-destructive">
                        {fieldErrors.confirmPassword}
                      </FieldDescription>
                    ) : null}
                  </Field>
                </Field>
                <FieldDescription>{passwordRequirementText}</FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={submitDisabled}>
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
                {formError ? (
                  <FieldDescription className="text-destructive">
                    {formError}
                  </FieldDescription>
                ) : null}
                {configError ? (
                  <FieldDescription className="text-destructive">
                    {configError}
                  </FieldDescription>
                ) : null}
                <FieldDescription className="text-center">
                  Already have an account? <Link href="/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
