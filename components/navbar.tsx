import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          aria-label="Sitebench home"
          className="flex items-center"
          href="/"
        >
          <Image
            alt="Sitebench"
            className="h-5 w-auto"
            height={140}
            priority
            src="/bench.svg"
            width={286}
          />
        </Link>

        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </header>
  )
}
