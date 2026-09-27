import React from "react";
import AdminShell from "@/layout/AdminShell";
import { SessionProvider } from "@/context/SessionContext";
import { requireAppSession } from "@/server/auth/session";

// Server-side guard: the user, their tenant and role are verified on every request
// before anything under (admin) renders.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAppSession();

  return (
    <SessionProvider session={session}>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
