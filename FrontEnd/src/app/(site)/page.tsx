import type { ComponentType } from "react";
import Navbar from "@/components/site/landing/Navbar";
import Hero from "@/components/site/landing/Hero";
import Problem from "@/components/site/landing/Problem";
import HowItWorks from "@/components/site/landing/HowItWorks";
import Features from "@/components/site/landing/Features";
import Pricing from "@/components/site/landing/Pricing";
import Team from "@/components/site/landing/Team";
import CallToAction from "@/components/site/landing/CallToAction";
import Faq from "@/components/site/landing/Faq";
import Footer from "@/components/site/landing/Footer";
import { sections } from "@/content/landing";

// Component của từng mục, theo thứ tự trong `sections`
const sectionComponents: Record<string, ComponentType<{ id: string }>> = {
  "van-de": Problem, "cach-hoat-dong": HowItWorks, "tinh-nang": Features, "bang-gia": Pricing,
  "doi-ngu": Team, faq: Faq, cta: CallToAction,
};

export default function Landing() {
  return (
    <div className="page">
      <Navbar />
      <main>
        <Hero />
        {sections.map((section) => {
          const Section = sectionComponents[section.id];
          return <Section key={section.id} id={section.id} />;
        })}
      </main>
      <Footer />
    </div>
  );
}
