"use client";

import { useRouter } from "next/navigation";
import React, { useState, useTransition } from "react";
import {
  ALWAYS_ON_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  PERMISSION_GROUPS,
  isEditablePermission,
  type Permission,
} from "@/lib/auth/permissions";
import type { RoleInfo } from "@/server/services/settings.service";
import { saveRolePermissionsAction } from "@/app/(admin)/settings/actions";

type Draft = Record<string, Set<Permission>>;

const sameSet = (a: Set<Permission>, b: Permission[]) => a.size === b.length && b.every((p) => a.has(p));

/** Checkbox matrix: rows = permissions, columns = roles. Owner column and owner-only rows are locked. */
export default function RolePermissionMatrix({ roles }: { roles: RoleInfo[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(roles.map((r) => [r.code, new Set(r.permissions)])));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = (role: RoleInfo, p: Permission) => role.code === "OWNER" || !isEditablePermission(p);
  const dirty = (role: RoleInfo) => role.code !== "OWNER" && !sameSet(draft[role.code], role.permissions);

  function toggle(role: string, p: Permission) {
    setDraft((d) => {
      const next = new Set(d[role]);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...d, [role]: next };
    });
  }

  function save(role: RoleInfo, reset = false) {
    setMessage(null);
    startTransition(async () => {
      const perms = reset ? null : [...draft[role.code]].filter(isEditablePermission);
      const r = await saveRolePermissionsAction(role.code, perms);
      setMessage({ ok: r.success, text: `${role.name}: ${r.message}` });
      if (r.success) {
        if (reset) setDraft((d) => ({ ...d, [role.code]: new Set(role.defaults) }));
        router.refresh();
      }
    });
  }

  return (
    <div>
      {message && (
        <p className={`mb-3 rounded-lg px-4 py-2 text-sm ${message.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-600"}`}>{message.text}</p>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left dark:border-gray-800">
              <th className="py-3 pr-4 font-medium text-gray-500">Hak akses</th>
              {roles.map((r) => (
                <th key={r.code} className="px-3 py-3 text-center font-medium text-gray-900 dark:text-white" title={r.description ?? undefined}>
                  {r.name}
                  {r.customized && <span className="block text-[10px] font-normal text-warning-600">diubah</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <React.Fragment key={g.label}>
                <tr>
                  <td colSpan={roles.length + 1} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {g.label}
                  </td>
                </tr>
                {g.items.map((p) => (
                  <tr key={p.key} className="border-b border-gray-50 dark:border-gray-800/60">
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {p.label}
                      {OWNER_ONLY_PERMISSIONS.includes(p.key) && <span className="ml-2 text-[10px] text-gray-400">khusus Owner</span>}
                      {ALWAYS_ON_PERMISSIONS.includes(p.key) && <span className="ml-2 text-[10px] text-gray-400">selalu aktif</span>}
                    </td>
                    {roles.map((r) => (
                      <td key={r.code} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${p.label} — ${r.name}`}
                          checked={r.code === "OWNER" || draft[r.code].has(p.key) || ALWAYS_ON_PERMISSIONS.includes(p.key)}
                          disabled={locked(r, p.key) || pending}
                          onChange={() => toggle(r.code, p.key)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-500 disabled:opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr>
              <td className="pt-4 text-xs text-gray-400">Simpan per role</td>
              {roles.map((r) => (
                <td key={r.code} className="px-2 pt-4 text-center align-top">
                  {r.code === "OWNER" ? (
                    <span className="text-xs text-gray-400">Terkunci</span>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        disabled={!dirty(r) || pending}
                        onClick={() => save(r)}
                        className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Simpan
                      </button>
                      {r.customized && (
                        <button type="button" disabled={pending} onClick={() => save(r, true)} className="text-[11px] text-gray-500 hover:underline">
                          Reset bawaan
                        </button>
                      )}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
