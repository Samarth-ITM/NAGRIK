import { NgoFixStack } from "@/components/public/ngo-fix-stack";
import Link from "next/link";
import { Hero } from "@/components/public/hero";
import { HowItWorks } from "@/components/public/how-it-works";
import { BeforeAfter } from "@/components/public/before-after";
import { ReportGrid } from "@/components/public/issue-icons";
import { IssueMapSection } from "@/components/public/issue-map-section";
import { AccountabilitySection } from "@/components/public/accountability";
import { PilotArea } from "@/components/public/pilot-area";
import { AboutSection } from "@/components/public/about-section";
import { loadPublicFixes } from "@/lib/public/fixes";

// Rebuilt in the background at most once a minute, so "Recently fixed" arrives with the page.
export const revalidate = 60;

export default async function HomePage() {
  let initialFixes = null;
  try {
    const { fixes, profileLogoUrl } = await loadPublicFixes();
    initialFixes = { fixes, profileLogoUrl };
  } catch {
    /* the stack falls back to loading in the browser */
  }

  return (
    <main className="flex-1 flex flex-col">
      <Hero />
      <HowItWorks />
      <BeforeAfter />
      <ReportGrid />
      <section aria-labelledby="repairs-title" className="street-repairs">
        <div>
          <h2 id="repairs-title" className="nk-h2">Recently fixed</h2>
          <Link href="/#issues">View the issue map <span aria-hidden>→</span></Link>
        </div>
        <NgoFixStack initial={initialFixes} />
      </section>
      <IssueMapSection />
      <AccountabilitySection />
      <PilotArea />
      <AboutSection />
    </main>
  );
}
