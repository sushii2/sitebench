import Image from "next/image"
import Link from "next/link"

import {
  ArrowRight01Icon,
  ArrowRight02Icon,
  Call02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY

const ENGINE_LOGOS: { name: string; domain: string }[] = [
  { name: "ChatGPT", domain: "openai.com" },
  { name: "Anthropic", domain: "anthropic.com" },
  { name: "Perplexity", domain: "perplexity.ai" },
]

function engineLogoSrc(domain: string): string {
  const params = new URLSearchParams({ size: "64", format: "png" })
  if (LOGO_DEV_TOKEN) params.set("token", LOGO_DEV_TOKEN)
  return `https://img.logo.dev/${domain}?${params.toString()}`
}

export function HomeHero() {
  return (
    <>
      <Navbar />
      <section className="relative mx-auto w-full max-w-5xl overflow-hidden pt-10 sm:pt-14 md:pt-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-hidden"
        >
          <div
            className={cn(
              "absolute inset-0 isolate -z-10",
              "bg-[radial-gradient(20%_80%_at_20%_0%,--theme(--color-foreground/.08),transparent)]",
            )}
          />
        </div>

        <div className="relative z-10 flex max-w-2xl flex-col gap-5 px-4">
          <Link
            href="/onboarding"
            className={cn(
              "group flex w-fit items-center gap-3 border border-border bg-card p-1 shadow-xs",
              "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out",
            )}
          >
            <div className="border border-border bg-card px-1.5 py-0.5 shadow-sm">
              <p className="font-mono text-xs">NEW</p>
            </div>
            <span className="text-xs text-foreground">
              AI visibility for modern brands
            </span>
            <span className="block h-5 border-l border-border" />
            <div className="pr-1">
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                strokeWidth={2}
                className="size-3 -translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5"
              />
            </div>
          </Link>

          <h1
            className={cn(
              "font-heading text-balance text-[2.5rem] leading-[1.02] tracking-[-0.02em] text-foreground sm:text-5xl md:text-6xl lg:text-[5.25rem]",
              "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out",
            )}
          >
            Rank where
            <br />
            the answers live.
          </h1>

          <p
            className={cn(
              "max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base",
              "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out",
            )}
          >
            Sitebench is the bench your brand sits on across every AI answer
            engine
            <span className="mx-1.5 inline-flex -space-x-2 align-middle">
              {ENGINE_LOGOS.map((engine, idx) => (
                <Image
                  key={engine.domain}
                  src={engineLogoSrc(engine.domain)}
                  alt={engine.name}
                  width={56}
                  height={56}
                  unoptimized
                  style={{ zIndex: ENGINE_LOGOS.length - idx }}
                  className="relative inline-block size-6 rounded-full border border-foreground bg-white object-contain p-[3px]"
                />
              ))}
            </span>
            — track prompts, audit citations, and steer your visibility in
            ChatGPT, Perplexity, and beyond.
          </p>

          <div
            className={cn(
              "flex w-full flex-col items-stretch gap-2 pt-2 sm:w-fit sm:flex-row sm:items-center sm:gap-3",
              "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-300 duration-500 ease-out",
            )}
          >
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">
                <HugeiconsIcon
                  icon={Call02Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Book a demo
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/sign-up">
                Get started
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  data-icon="inline-end"
                />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className={cn(
              "absolute -inset-x-20 inset-y-0 -translate-y-1/3 scale-120 rounded-full",
              "bg-[radial-gradient(ellipse_at_center,--theme(--color-foreground/.08),transparent,transparent)]",
              "blur-[50px]",
            )}
          />
          <div
            className={cn(
              "mask-b-from-60% relative mt-10 overflow-hidden px-2 sm:mt-14 md:mt-20",
              "fade-in slide-in-from-bottom-5 animate-in fill-mode-backwards delay-100 duration-1000 ease-out",
            )}
          >
            <div className="relative inset-shadow-2xs inset-shadow-foreground/10 mx-auto max-w-5xl overflow-hidden border border-border bg-background p-1.5 shadow-xl ring-1 ring-card sm:p-2">
              <Image
                src="/hero-dashboard.png"
                alt="Sitebench dashboard showing brand visibility, citation share, and competitor rankings across AI answer engines"
                width={1920}
                height={1080}
                priority
                sizes="(min-width: 1024px) 1024px, 100vw"
                className="h-auto w-full border border-border"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
