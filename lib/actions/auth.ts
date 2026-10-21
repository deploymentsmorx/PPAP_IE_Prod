"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type AuthActionState = { error?: string } | undefined;

export async function authenticateWithCredentials(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw err;
  }
}

const magicLinkSchema = z.object({ email: z.string().email() });

export async function sendMagicLink(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Enter a valid email." };
  }

  try {
    await signIn("nodemailer", { email: parsed.data.email, redirectTo: "/" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Could not send magic link. Check the email address." };
    }
    throw err;
  }
}
