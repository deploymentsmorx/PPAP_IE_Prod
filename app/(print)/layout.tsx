import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  // Customer-only logins are confined to their own customer's PPAPs in each print page (assertCanViewPpap).

  return <div className="min-h-svh bg-white">{children}</div>;
}
