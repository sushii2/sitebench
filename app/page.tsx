import { CtaSection } from "@/components/cta-section"
import { FaqSection } from "@/components/faq-section"
import { Footer } from "@/components/footer"
import { HomeHero } from "@/components/home-hero"
import { LlmAnalyticsSection } from "@/components/llm-analytics-section"
import { MetricsSection } from "@/components/metrics-section"

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col overflow-x-hidden bg-background">
      <HomeHero />
      <LlmAnalyticsSection />
      <MetricsSection />
      <FaqSection />
      <CtaSection />
      <Footer />
    </main>
  )
}
