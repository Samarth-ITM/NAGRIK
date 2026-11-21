import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NGODashboardView } from "@/components/ngo/ngo-dashboard-view";
import { NGO_SESSION_COOKIE, readNgoSessionToken } from "@/lib/auth/ngo-session";

export const metadata = {
  title: "NGO field desk | Nagrik Kharghar",
  description: "Repair queue for NGO and field teams working on civic problems reported in Kharghar.",
};

export const dynamic = "force-dynamic";

export default async function NGOPage() {
  const cookieStore = await cookies();
  if (!readNgoSessionToken(cookieStore.get(NGO_SESSION_COOKIE)?.value)) {
    redirect("/login?role=ngo");
  }
  return <NGODashboardView />;
}
