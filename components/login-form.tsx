"use client";

import { useActionState } from "react";
import { authenticateWithCredentials, sendMagicLink, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const initialState: AuthActionState = undefined;

export function LoginForm() {
  const [credentialsState, credentialsAction, credentialsPending] = useActionState(
    authenticateWithCredentials,
    initialState,
  );
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <Card className="w-full max-w-sm shadow-lg shadow-slate-900/5">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>PPAP Management — Ingenious Engineering Pvt Ltd</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={credentialsAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {credentialsState?.error ? (
            <p className="text-sm text-destructive">{credentialsState.error}</p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={credentialsPending}>
            {credentialsPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>

        <form action={magicLinkAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="magic-email">Email magic link</Label>
            <Input id="magic-email" name="email" type="email" required autoComplete="email" />
          </div>
          {magicLinkState?.error ? (
            <p className="text-sm text-destructive">{magicLinkState.error}</p>
          ) : null}
          <Button type="submit" variant="outline" size="lg" className="w-full" disabled={magicLinkPending}>
            {magicLinkPending ? "Sending..." : "Email me a sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
