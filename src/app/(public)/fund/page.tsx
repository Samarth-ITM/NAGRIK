import type { Metadata } from "next";
import { getFundingConfig } from "@/lib/funding/config";
import { getPublicSummary } from "@/lib/funding/ledger";
import { FundView } from "@/components/public/fund-view";

export const metadata: Metadata = {
  title: "Fund repairs | Nagrik",
  description: "Give to civic repairs through UPI or company CSR. Money goes straight to the partner NGO.",
};

// Totals refresh in the background every 30 seconds; the page itself is served instantly.
export const revalidate = 30;

export default async function FundPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const config = getFundingConfig();
  const summary = await getPublicSummary();
  return <FundView config={config} summary={summary} initialTab={type === "csr" ? "csr" : "citizen"} />;
}
