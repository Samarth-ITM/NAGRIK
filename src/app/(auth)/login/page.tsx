import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in | Nagrik",
};

// `role` is read on the server, so the form renders and hydrates immediately
// (no Suspense boundary around useSearchParams).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const params = await searchParams;
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role;
  return <LoginForm initialRole={role === "ngo" ? "ngo" : "citizen"} />;
}
