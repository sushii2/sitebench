"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function OnboardingGate() {
  const router = useRouter()
  const {
    brand,
    brandStatus,
    brandStatusError,
    isLoading,
    needsOnboarding,
    refreshAuthState,
    user,
  } = useAuth()

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }

    if (!isLoading && user && brandStatus === "ready" && !needsOnboarding) {
      router.replace("/dashboard")
    }
  }, [brandStatus, isLoading, needsOnboarding, router, user])

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Checking your setup...</CardTitle>
            <CardDescription>
              Loading your brand onboarding status.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Redirecting...</CardTitle>
            <CardDescription>Taking you to login.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (brandStatus === "error") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              We couldn&apos;t load your brand setup
            </CardTitle>
            <CardDescription>
              {brandStatusError ?? "Please try again in a moment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Button
              className="w-full"
              type="button"
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

  if (!needsOnboarding) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Redirecting...</CardTitle>
            <CardDescription>
              Your brand is already set up. Taking you to the dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return <OnboardingWizard brand={brand} refreshAuthState={refreshAuthState} />
}
