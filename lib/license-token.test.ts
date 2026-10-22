import { describe, expect, it } from "vitest";
import { createLicenseToken, verifyLicenseToken } from "@/lib/license-token";

const claims = { licenseId: "license-1", deviceId: "DEV-123", hostName: "DESKTOP-123" };
const secret = "test-secret-that-is-long-enough";
const now = Date.UTC(2026, 9, 22);

describe("license activation tokens", () => {
  it("round trips claims with a 24-hour expiration", () => {
    const token = createLicenseToken(claims, secret, now);

    expect(verifyLicenseToken(token, secret, now)).toEqual({
      ...claims,
      expiresAt: Math.floor(now / 1000) + 24 * 60 * 60,
    });
  });

  it("rejects tampered, expired, and incorrectly signed tokens", () => {
    const token = createLicenseToken(claims, secret, now);
    const [version, payload, signature] = token.split(".");

    expect(verifyLicenseToken(`${version}.${payload}.${signature.slice(1)}`, secret, now)).toBeNull();
    expect(verifyLicenseToken(token, "different-secret", now)).toBeNull();
    expect(verifyLicenseToken(token, secret, now + 24 * 60 * 60 * 1000)).toBeNull();
  });
});