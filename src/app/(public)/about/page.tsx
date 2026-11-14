import { AboutSection } from "@/components/public/about-section";
import { PilotArea } from "@/components/public/pilot-area";
import { AccountabilitySection } from "@/components/public/accountability";

export default function AboutPage() {
  return (
    <div className="flex-1 flex flex-col">
      <AboutSection />
      <AccountabilitySection />
      <PilotArea />
    </div>
  );
}
