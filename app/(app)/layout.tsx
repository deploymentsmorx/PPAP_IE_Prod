import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { AppNav, type AppNavItem } from "@/components/app-nav";
import { getCurrentUser } from "@/lib/permissions";

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

// QA_MANAGER → "QA Manager", ADMIN → "Admin".
const roleLabel = (role: string) =>
  role
    .split("_")
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(" ");

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  const user = await getCurrentUser();
  const can = user?.can;
  const displayName = session.user?.name ?? session.user?.email ?? "";

  const items: AppNavItem[] = [{ href: "/", label: "Dashboard", icon: "dashboard" }];
  if (can?.editSupplierData) {
    items.push({ href: "/instruments", label: "Instruments", icon: "instruments" }, { href: "/labs", label: "Labs", icon: "labs" }, { href: "/csr", label: "CSR", icon: "csr" });
  }
  if (can?.manageUsers) items.push({ href: "/users", label: "Users", icon: "users" });
  if (can?.viewAuditLog) items.push({ href: "/audit", label: "Audit log", icon: "audit" });

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 shadow-[0_1px_3px_0_rgb(15_23_42/0.04)] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <nav aria-label="Main" className="flex h-16 items-center gap-4 px-4 lg:gap-5 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3 rounded-md pr-2 hover:opacity-90">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-[0.8rem] font-bold tracking-tight text-brand-foreground shadow-sm ring-1 ring-white/10">IE</span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold tracking-tight text-foreground">PPAP Management</span>
              <span className="block text-[0.68rem] text-muted-foreground">Ingenious Engineering Pvt Ltd</span>
            </span>
          </Link>
          <div className="mx-0.5 hidden h-7 w-px bg-border sm:block" />
          <AppNav items={items} />
          <div className="ml-auto flex items-center gap-3 lg:gap-4">
            <div className="hidden items-center gap-2.5 lg:flex">
              <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground ring-1 ring-border/80">
                {initials(displayName)}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium">{displayName}</span>
                <span className="block text-[0.7rem] text-muted-foreground">
                  {can?.ownCustomerOnly ? "Customer approver (customer)" : user?.roles.map(roleLabel).join(", ")}
                </span>
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" size="sm" className="gap-1.5">
                <LogOut className="size-3.5" aria-hidden />
                Sign out
              </Button>
            </form>
          </div>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
