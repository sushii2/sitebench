"use client"

import Link from "next/link"
import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldDescription, FieldGroup } from "@/components/ui/field"

export function HomeAuthPanel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isLoading, signOut, user } = useAuth()
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  if (isLoading) {
    return (
      <div className={className} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Checking your session...</CardTitle>
            <CardDescription>Loading your account state.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (user) {
    return (
      <div className={className} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Signed in as</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Button asChild className="w-full">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome to Sitebench</CardTitle>
          <CardDescription>
            Sign in or create an account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Button asChild className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up">Create account</Link>
            </Button>
          </FieldGroup>
          <FieldDescription className="mt-4 text-center">
            Your session will appear here after sign in.
          </FieldDescription>
        </CardContent>
      </Card>
    </div>
  )
}
