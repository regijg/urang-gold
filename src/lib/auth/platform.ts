/**
 * Platform admins are the people who run UrangGold itself (not a shop's owner): they create
 * shops, switch them on/off and set their plan from /platform. They are listed in the
 * PLATFORM_ADMIN_EMAILS environment variable (comma separated) instead of the database, so a
 * shop can never grant itself this role. Pure helper: safe for middleware and server code.
 */
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** The email must be verified: Supabase may allow open sign-ups, and anyone could otherwise register a listed address. */
export function isPlatformAdminUser(user: { email?: string | null; email_confirmed_at?: string | null } | null | undefined): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  return platformAdminEmails().includes(user.email.toLowerCase());
}
