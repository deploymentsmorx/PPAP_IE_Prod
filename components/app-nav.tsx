"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FlaskConical, Gauge, History, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppNavItem = { href: string; label: string; icon: "dashboard" | "users" | "labs" | "instruments" | "csr" | "audit" };

const ICONS = { dashboard: LayoutDashboard, users: Users, labs: FlaskConical, instruments: Gauge, csr: ClipboardList, audit: History };

/** Top-bar links; the active section is highlighted (PPAP pages count as the dashboard). */
export function AppNav({ items }: { items: AppNavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/ppap") : pathname.startsWith(href));

  return (
    <div className="flex items-center gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground after:absolute after:inset-x-2 after:-bottom-[0.9rem] after:h-0.5 after:rounded-full after:bg-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden md:inline">{item.label}</span>
            <span className="sr-only md:hidden">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
