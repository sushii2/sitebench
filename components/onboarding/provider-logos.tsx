"use client"

import Image from "next/image"

import { buildBrandLogoUrl } from "@/lib/brands"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"
import { cn } from "@/lib/utils"

const providers = [
  { name: "ChatGPT", domain: "openai.com" },
  { name: "Claude", domain: "anthropic.com" },
  { name: "Gemini", domain: "gemini.google.com" },
  { name: "Perplexity", domain: "perplexity.ai" },
] as const

type ProviderLogosProps = {
  label?: string
  className?: string
  size?: number
  variant?: "default" | "compact"
}

export function ProviderLogos({
  label,
  className,
  size,
  variant = "default",
}: ProviderLogosProps) {
  let publishableKey: string

  try {
    publishableKey = resolveLogoDevPublicConfig().publishableKey
  } catch {
    return null
  }

  const isCompact = variant === "compact"
  const logoSize = size ?? (isCompact ? 16 : 20)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-muted-foreground",
        className
      )}
    >
      {label ? (
        <span className="text-[11px] font-medium tracking-wide uppercase">
          {label}
        </span>
      ) : null}
      <div className={cn("flex items-center", isCompact ? "gap-1.5" : "gap-2")}>
        {providers.map((provider) => (
          <span
            key={provider.name}
            title={provider.name}
            aria-label={provider.name}
            className={cn(
              "inline-flex items-center justify-center overflow-hidden rounded-full border bg-background",
              isCompact ? "p-0.5" : "p-1"
            )}
          >
            <Image
              src={buildBrandLogoUrl(provider.domain, publishableKey)}
              alt=""
              width={logoSize}
              height={logoSize}
              aria-hidden="true"
              className="rounded-full object-contain"
              unoptimized
            />
          </span>
        ))}
      </div>
    </div>
  )
}
