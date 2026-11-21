import { Hero } from "@/components/public/hero";
import { HowItWorks } from "@/components/public/how-it-works";
import { BeforeAfter } from "@/components/public/before-after";
import { ReportGrid } from "@/components/public/issue-icons";
import { IssueMapSection } from "@/components/public/issue-map-section";
import { AccountabilitySection } from "@/components/public/accountability";
import { PilotArea } from "@/components/public/pilot-area";
import { AboutSection } from "@/components/public/about-section";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col">
      <Hero />
      <HowItWorks />
      <BeforeAfter />
      <ReportGrid />
      <IssueMapSection />
      <AccountabilitySection />
      <PilotArea />
      <AboutSection />
    </main>
  );
}
