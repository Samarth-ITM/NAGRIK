import { IssueMapSection } from "@/components/public/issue-map-section";
import { PilotArea } from "@/components/public/pilot-area";

export default function IssuesPage() {
  return (
    <div className="flex-1 flex flex-col">
      <IssueMapSection />
      <PilotArea />
    </div>
  );
}
