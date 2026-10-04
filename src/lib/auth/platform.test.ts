import { afterEach, describe, expect, it } from "vitest";
import { isPlatformAdminUser, platformAdminEmails } from "./platform";

const original = process.env.PLATFORM_ADMIN_EMAILS;
afterEach(() => {
  if (original === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = original;
});

const confirmed = "2026-10-05T00:00:00Z";

describe("platform admin", () => {
  it("nobody is a platform admin when the list is empty or unset", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(platformAdminEmails()).toEqual([]);
    expect(isPlatformAdminUser({ email: "a@x.id", email_confirmed_at: confirmed })).toBe(false);
    process.env.PLATFORM_ADMIN_EMAILS = " , ";
    expect(isPlatformAdminUser({ email: "a@x.id", email_confirmed_at: confirmed })).toBe(false);
  });

  it("matches listed emails case-insensitively, ignoring spaces", () => {
    process.env.PLATFORM_ADMIN_EMAILS = " Owner@Uranggold.id , second@x.id ";
    expect(platformAdminEmails()).toEqual(["owner@uranggold.id", "second@x.id"]);
    expect(isPlatformAdminUser({ email: "OWNER@uranggold.id", email_confirmed_at: confirmed })).toBe(true);
    expect(isPlatformAdminUser({ email: "second@x.id", email_confirmed_at: confirmed })).toBe(true);
    expect(isPlatformAdminUser({ email: "someone@else.id", email_confirmed_at: confirmed })).toBe(false);
  });

  it("requires a verified email, so a listed address cannot be claimed by signing up", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@uranggold.id";
    expect(isPlatformAdminUser({ email: "owner@uranggold.id", email_confirmed_at: null })).toBe(false);
    expect(isPlatformAdminUser({ email: "owner@uranggold.id" })).toBe(false);
  });

  it("handles missing users", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@uranggold.id";
    expect(isPlatformAdminUser(null)).toBe(false);
    expect(isPlatformAdminUser(undefined)).toBe(false);
    expect(isPlatformAdminUser({ email: null, email_confirmed_at: confirmed })).toBe(false);
  });
});
