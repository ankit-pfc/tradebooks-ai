import { LandingShell } from "@/components/marketing/landing-shell";
import { Hero } from "@/components/marketing/hero";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { GapSection } from "@/components/marketing/gap-section";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { OutputTerminal } from "@/components/marketing/output-terminal";
import { LogicAccordions } from "@/components/marketing/logic-accordions";
import { WhoItsFor } from "@/components/marketing/who-its-for";
import { SecurityPanel } from "@/components/marketing/security-panel";
import { ApproachSection } from "@/components/marketing/approach-section";
import { ProofSection } from "@/components/marketing/proof-section";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { FaqAccordions } from "@/components/marketing/faq-accordions";
import { FinalCta } from "@/components/marketing/final-cta";
import { faqs } from "@/components/marketing/landing-data";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TradeBooks AI",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Converts Zerodha broker exports to Tally-importable XML with FIFO cost basis, exception-first reconciliation, and row-level traceability.",
  url: "https://tradebooks.ai",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
    description: "Free plan — one client file, full flow",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <LandingShell>
        <Hero />
        <TrustStrip />
        <GapSection />
        <HowItWorks />
        <OutputTerminal />
        <LogicAccordions />
        <WhoItsFor />
        <SecurityPanel />
        <ApproachSection />
        <ProofSection />
        <ComparisonTable />
        <PricingCards />
        <FaqAccordions />
        <FinalCta />
      </LandingShell>
    </>
  );
}
