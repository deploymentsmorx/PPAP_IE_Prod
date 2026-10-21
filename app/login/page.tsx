import { redirect } from "next/navigation";
import { BadgeCheck, FileStack, Gauge, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in" };

const FEATURES = [
  { icon: FileStack, text: "All 18 AIAG elements, from design record to PSW" },
  { icon: ShieldCheck, text: "E-signed Prepared → Checked → Approved workflow with full audit trail" },
  { icon: Gauge, text: "Live SPC, MSA and calibration status" },
  { icon: BadgeCheck, text: "One-click bookmarked submission pack for the customer" },
];

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/");
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand p-12 text-brand-foreground lg:flex lg:flex-col lg:justify-between">
        {/* Subtle engineering-grid backdrop. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div aria-hidden className="absolute -top-40 -right-40 size-[28rem] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.12_245/0.42),transparent_70%)]" />
        <div aria-hidden className="absolute -bottom-56 -left-40 size-[30rem] rounded-full bg-[radial-gradient(circle,oklch(0.66_0.1_188/0.18),transparent_68%)]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-sm font-bold ring-1 ring-white/20">IE</span>
          <span className="text-sm font-medium opacity-90">Ingenious Engineering Pvt Ltd</span>
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">Production Part Approval, end to end.</h1>
          <ul className="space-y-3.5 text-sm opacity-90">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs opacity-60">Built on the AIAG PPAP 4th edition</p>
      </section>
      <section className="flex items-center justify-center bg-background p-6">
        <div className="page-enter w-full max-w-sm">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
