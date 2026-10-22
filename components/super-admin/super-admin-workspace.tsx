"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, Monitor, Pause, Play, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomerLicense, createTeamAccount, setCustomerLicenseStatus } from "@/lib/actions/super-admin";
import type { CustomerLicenseState, TeamAccountState } from "@/lib/actions/super-admin";

type TeamAccount = { id: string; name: string; email: string; roles: string[]; createdAt: Date };
type License = {
  id: string;
  companyName: string;
  licenseKey: string;
  requireDevice: boolean;
  grantFullAccess: boolean;
  deviceId: string | null;
  hostName: string | null;
  engineerName: string;
  engineerEmail: string;
  engineerRole: string;
  status: string;
  activatedAt: Date | null;
  createdAt: Date;
};

const ROLE_OPTIONS = [
  { value: "ENGINEERING", label: "Engineer", description: "Update PPAP documentation." },
  { value: "LEAD", label: "Lead", description: "Update and approve PPAP pages." },
  { value: "QA_MANAGER", label: "Manager", description: "Approve pages, sign PSW, and review audit history." },
  { value: "ADMIN", label: "Admin", description: "Full workspace and user management access." },
] as const;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  QA_MANAGER: "Manager",
  QA_ENGINEER: "Engineer",
  ENGINEERING: "Engineer",
  LEAD: "Lead",
  PRODUCTION: "Production",
  CUSTOMER_APPROVER: "Customer Approver",
};

function roleName(role: string) {
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

function SecretValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
      <div className="min-w-0">
        <div className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
        <code className="block truncate text-sm font-medium">{value}</code>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} onClick={copy}>
        {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </Button>
    </div>
  );
}

function TeamAccountForm() {
  const [state, action, pending] = useActionState<TeamAccountState, FormData>(createTeamAccount, undefined);
  return (
    <form action={action} className="space-y-3 rounded-xl border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="team-name">Full name</Label>
          <Input id="team-name" name="name" placeholder="e.g. Asha Sharma" required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-email">Username or email</Label>
          <Input id="team-email" name="email" type="email" placeholder="e.g. asha@example.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-role">Role</Label>
          <select id="team-role" name="role" defaultValue="ENGINEERING" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-password">Temporary password</Label>
          <Input id="team-password" name="temporaryPassword" type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to auto-generate" />
        </div>
      </div>
      {state && "error" in state ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state && "created" in state ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Account created for {state.created.name}.</p>
          <SecretValue label="Temporary password — share once" value={state.created.temporaryPassword} />
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="gap-2">
        <UserPlus className="size-4" aria-hidden />
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

function CustomerLicenseForm() {
  const [state, action, pending] = useActionState<CustomerLicenseState, FormData>(createCustomerLicense, undefined);
  const [requireDevice, setRequireDevice] = useState(true);
  const [grantFullAccess, setGrantFullAccess] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="license-company">Company / organization name</Label>
          <Input id="license-company" name="companyName" placeholder="Customer company" required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="license-key">License key <span className="font-normal text-muted-foreground">(blank = auto-generate)</span></Label>
          <Input id="license-key" name="licenseKey" placeholder="SMX-2026-XXXXXX" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="install-password">Install password <span className="font-normal text-muted-foreground">(blank = auto)</span></Label>
          <Input id="install-password" name="installPassword" type="password" minLength={10} autoComplete="new-password" placeholder="At least 10 characters" />
        </div>
        <label className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3 text-sm sm:col-span-2">
          <input type="checkbox" name="requireDevice" checked={requireDevice} onChange={(event) => setRequireDevice(event.target.checked)} className="mt-0.5 accent-primary" />
          <span><span className="block font-medium">Require approved device</span><span className="text-xs text-muted-foreground">Bind the license to the device ID and host name from the activation screen.</span></span>
        </label>
        {requireDevice ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="device-id">Device ID</Label>
              <Input id="device-id" name="deviceId" placeholder="DEV-…" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="host-name">Host name</Label>
              <Input id="host-name" name="hostName" placeholder="DESKTOP-…" required />
            </div>
          </>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="engineer-name">Engineer full name</Label>
          <Input id="engineer-name" name="engineerName" placeholder="Full name" required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="engineer-email">Engineer email</Label>
          <Input id="engineer-email" name="engineerEmail" type="email" placeholder="name@customer.com" required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="engineer-role">Role</Label>
          <select id="engineer-role" name="role" defaultValue="ENGINEERING" disabled={grantFullAccess} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3 text-sm sm:col-span-2">
          <input type="checkbox" name="grantFullAccess" checked={grantFullAccess} onChange={(event) => setGrantFullAccess(event.target.checked)} className="mt-0.5 accent-primary" />
          <span><span className="block font-medium">Grant full access (Admin role)</span><span className="text-xs text-muted-foreground">Gives this engineer administrator access to the workspace.</span></span>
        </label>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="engineer-password">Temporary password <span className="font-normal text-muted-foreground">(blank = auto-generate)</span></Label>
          <Input id="engineer-password" name="temporaryPassword" type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to auto-generate" />
        </div>
      </div>
      {state && "error" in state ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state && "created" in state ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">License created for {state.created.companyName}. Save these credentials now.</p>
          <SecretValue label="License key" value={state.created.licenseKey} />
          <SecretValue label="Install password — share once" value={state.created.installPassword} />
          <SecretValue label="Engineer temporary password — share once" value={state.created.temporaryPassword} />
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="gap-2">
        <KeyRound className="size-4" aria-hidden />
        {pending ? "Creating license…" : "Create & save"}
      </Button>
    </form>
  );
}

function TeamAccounts({ accounts }: { accounts: TeamAccount[] }) {
  if (!accounts.length) return <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">No team logins yet.</p>;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Team accounts <span className="text-muted-foreground">({accounts.length})</span></h3>
      <div className="max-h-[25rem] space-y-2 overflow-auto pr-1">
        {accounts.map((account) => (
          <div key={account.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3 shadow-[0_2px_8px_rgb(15_23_42/0.035)]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold">{account.name}</span>
                {account.roles.map((role) => <Badge key={role} variant={role === "ADMIN" ? "default" : "secondary"}>{roleName(role)}</Badge>)}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{account.email}</p>
            </div>
            <span className="shrink-0 text-[0.65rem] text-muted-foreground">{account.roles.includes("SUPER_ADMIN") ? "Super Admin" : "Team"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LicenseList({ licenses }: { licenses: License[] }) {
  if (!licenses.length) return <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">No licensed organizations yet. New licenses will appear here.</p>;
  return (
    <div className="space-y-3">
      {licenses.map((license) => {
        const active = license.status === "ACTIVE";
        const suspended = license.status === "SUSPENDED";
        const statusAction = setCustomerLicenseStatus.bind(null, license.id);
        return (
          <article key={license.id} className="rounded-xl border bg-card p-4 shadow-[0_2px_8px_rgb(15_23_42/0.035)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{license.companyName}</h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{license.licenseKey}</p>
              </div>
              <Badge className={active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300" : suspended ? "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"}>
                {license.status}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Engineer</div><div className="font-medium">{license.engineerName}</div><div className="truncate text-xs text-muted-foreground">{license.engineerEmail}</div></div>
              <div><div className="text-xs text-muted-foreground">App role</div><div className="font-medium">{roleName(license.engineerRole)}{license.grantFullAccess ? " · full access" : ""}</div></div>
              <div><div className="flex items-center gap-1 text-xs text-muted-foreground"><Monitor className="size-3" aria-hidden />Approved device</div><div className="truncate font-mono text-xs">{license.requireDevice ? license.deviceId || "Not set" : "Device independent"}</div><div className="truncate text-xs text-muted-foreground">{license.hostName || ""}</div></div>
              <div><div className="text-xs text-muted-foreground">Created</div><div className="font-medium">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(license.createdAt))}</div><div className="text-xs text-muted-foreground">{license.activatedAt ? `Activated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(license.activatedAt))}` : "Waiting for activation"}</div></div>
            </div>
            <div className="mt-4 flex justify-end">
              <form action={statusAction}>
                <Button type="submit" name="status" value={active ? "SUSPENDED" : "ACTIVE"} variant={active ? "outline" : "default"} size="sm" className="gap-1.5" disabled={license.requireDevice && (!license.deviceId || !license.hostName) && !active}>
                  {active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                  {active ? "Suspend license" : suspended ? "Reactivate license" : "Activate license"}
                </Button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SuperAdminWorkspace({ mode, teamAccounts, licenses }: { mode: "team" | "license" | "licenses"; teamAccounts: TeamAccount[]; licenses: License[] }) {
  if (mode === "team") return <><TeamAccountForm /><TeamAccounts accounts={teamAccounts} /></>;
  if (mode === "license") return <CustomerLicenseForm />;
  return <LicenseList licenses={licenses} />;
}
