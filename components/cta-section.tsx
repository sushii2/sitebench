import Image from "next/image"
import Link from "next/link"

import { ArrowRight01Icon, Call02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

const ENGINE_LOGOS: { name: string; domain: string }[] = [
  { name: "ChatGPT", domain: "openai.com" },
  { name: "Claude", domain: "anthropic.com" },
  { name: "Perplexity", domain: "perplexity.ai" },
  { name: "Gemini", domain: "gemini.google.com" },
  { name: "Grok", domain: "x.ai" },
]

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY

function engineLogoSrc(domain: string): string {
  const params = new URLSearchParams({ size: "64", format: "png" })
  if (LOGO_DEV_TOKEN) params.set("token", LOGO_DEV_TOKEN)
  return `https://img.logo.dev/${domain}?${params.toString()}`
}

export function CtaSection() {
  return (
    <section
      id="get-started"
      className="relative mx-auto w-full max-w-5xl scroll-mt-24 px-4 pt-12 pb-24 sm:pt-16 md:pt-20"
    >
      <div className="relative overflow-hidden bg-black text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,255,255,0.08),transparent_70%)]"
        />

        <div className="relative flex flex-col items-center gap-8 px-6 py-16 text-center sm:px-10 sm:py-20 md:px-14 md:py-24">
          <h2 className="max-w-3xl font-heading text-balance text-4xl leading-[1.02] tracking-[-0.025em] sm:text-5xl md:text-6xl lg:text-[4.5rem]">
            Your seat on
            <br />
            the bench is waiting.
          </h2>

          <p className="max-w-lg text-sm leading-relaxed text-pretty text-white/70 sm:text-base">
            Start tracking how ChatGPT, Claude, Perplexity, and every other
            answer engine talks about your brand. 14 days on us, no card
            required.
          </p>

          <div className="flex w-full flex-col items-stretch gap-2 sm:w-fit sm:flex-row sm:items-center sm:gap-3">
            <Button
              asChild
              size="lg"
              className="border border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/contact">
                <HugeiconsIcon
                  icon={Call02Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Book a demo
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-white text-black hover:bg-white/90"
            >
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

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:gap-5">
            <span className="font-mono text-[10px] tracking-[0.18em] text-white/50 uppercase">
              Monitoring
            </span>
            <ul className="flex items-center -space-x-1.5">
              {ENGINE_LOGOS.map((engine, idx) => (
                <li
                  key={engine.domain}
                  style={{ zIndex: ENGINE_LOGOS.length - idx }}
                  className="relative"
                >
                  <Image
                    src={engineLogoSrc(engine.domain)}
                    alt={engine.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="size-7 rounded-full border border-white/15 bg-white object-contain p-[3px]"
                  />
                </li>
              ))}
            </ul>
            <span className="font-mono text-[10px] tracking-[0.18em] text-white/50 uppercase">
              & every engine next
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
