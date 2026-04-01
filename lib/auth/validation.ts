import { z } from "zod"

export const APP_PASSWORD_BASELINE = {
  passwordMinLength: 12,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  requireUppercase: true,
} as const

export type PasswordPolicy = {
  passwordMinLength: number
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecialChar: boolean
  requireUppercase: boolean
}

export type PublicAuthConfig = PasswordPolicy & {
  customOAuthProviders: string[]
  oAuthProviders: string[]
  requireEmailVerification: boolean
  resetPasswordMethod: "code" | "link"
  verifyEmailMethod: "code" | "link"
}

function passwordChecks(password: string, policy: PasswordPolicy) {
  const issues: string[] = []

  if (password.length < policy.passwordMinLength) {
    issues.push(
      `Password must be at least ${policy.passwordMinLength} characters long`
    )
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push("Password must include at least one uppercase letter")
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    issues.push("Password must include at least one lowercase letter")
  }

  if (policy.requireNumber && !/\d/.test(password)) {
    issues.push("Password must include at least one number")
  }

  if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
    issues.push("Password must include at least one special character")
  }

  return issues
}

export function buildPasswordPolicy(config?: Partial<PasswordPolicy> | null) {
  return {
    passwordMinLength: Math.max(
      APP_PASSWORD_BASELINE.passwordMinLength,
      config?.passwordMinLength ?? 0
    ),
    requireLowercase:
      APP_PASSWORD_BASELINE.requireLowercase ||
      Boolean(config?.requireLowercase),
    requireNumber:
      APP_PASSWORD_BASELINE.requireNumber || Boolean(config?.requireNumber),
    requireSpecialChar:
      APP_PASSWORD_BASELINE.requireSpecialChar ||
      Boolean(config?.requireSpecialChar),
    requireUppercase:
      APP_PASSWORD_BASELINE.requireUppercase ||
      Boolean(config?.requireUppercase),
  } satisfies PasswordPolicy
}

export function describePasswordPolicy(policy: PasswordPolicy) {
  const parts = [`at least ${policy.passwordMinLength} characters`]

  if (policy.requireUppercase) {
    parts.push("one uppercase letter")
  }

  if (policy.requireLowercase) {
    parts.push("one lowercase letter")
  }

  if (policy.requireNumber) {
    parts.push("one number")
  }

  if (policy.requireSpecialChar) {
    parts.push("one special character")
  }

  return `Password must include ${parts.join(", ")}.`
}

export function createSignupSchema(policy: PasswordPolicy) {
  return z
    .object({
      confirmPassword: z.string().min(1, "Confirm your password"),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Enter a valid email address"),
      name: z
        .string()
        .trim()
        .min(1, "Enter your full name")
        .max(100, "Name must be less than 100 characters"),
      password: z.string().min(1, "Enter a password"),
    })
    .superRefine(({ confirmPassword, password }, ctx) => {
      for (const issue of passwordChecks(password, policy)) {
        ctx.addIssue({
          code: "custom",
          message: issue,
          path: ["password"],
        })
      }

      if (password !== confirmPassword) {
        ctx.addIssue({
          code: "custom",
          message: "Passwords do not match",
          path: ["confirmPassword"],
        })
      }
    })
}

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})
