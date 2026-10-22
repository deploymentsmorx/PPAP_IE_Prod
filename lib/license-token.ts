import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

export type LicenseTokenClaims = {
  licenseId: string;
  deviceId: string;
  hostName: string;
  expiresAt: number;
};

function signatureFor(payload: string, secret: string | Buffer) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createLicenseToken(
  claims: Omit<LicenseTokenClaims, "expiresAt">,
  secret: string | Buffer,
  now = Date.now(),
) {
  const payload = Buffer.from(JSON.stringify({
    ...claims,
    expiresAt: Math.floor(now / 1000) + TOKEN_LIFETIME_SECONDS,
  })).toString("base64url");
  const signedContent = `v1.${payload}`;
  return `${signedContent}.${signatureFor(signedContent, secret)}`;
}

export function verifyLicenseToken(token: string, secret: string | Buffer, now = Date.now()): LicenseTokenClaims | null {
  const [version, payload, signature, extra] = token.split(".");
  if (version !== "v1" || !payload || !signature || extra !== undefined) return null;

  const signedContent = `${version}.${payload}`;
  const expected = Buffer.from(signatureFor(signedContent, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof claims !== "object" || claims === null ||
      !("licenseId" in claims) || typeof claims.licenseId !== "string" ||
      !("deviceId" in claims) || typeof claims.deviceId !== "string" ||
      !("hostName" in claims) || typeof claims.hostName !== "string" ||
      !("expiresAt" in claims) || typeof claims.expiresAt !== "number" ||
      !Number.isInteger(claims.expiresAt) || claims.expiresAt <= Math.floor(now / 1000)
    ) return null;
    return claims as LicenseTokenClaims;
  } catch {
    return null;
  }
}

export function licenseTokenSecret(authSecret: string | undefined) {
  if (!authSecret) return null;
  return createHmac("sha256", authSecret).update("ppap-license-token-v1").digest();
}