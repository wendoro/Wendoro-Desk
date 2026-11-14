import React from 'react';
import { Building2, CheckCircle2, KeyRound, ShieldAlert, UserCheck } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useFirebase } from '@/src/components/shell/FirebaseProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';

const PERMISSION_PROBES = [
  { key: 'organization.company.manage', label: 'Manage Company & Branches' },
  { key: 'organization.roles.assign', label: 'Assign Roles & Permissions' },
  { key: 'catalogue.item.write', label: 'Create / Edit Catalogue Items' },
  { key: 'inventory.stock.adjust', label: 'Post Stock Adjustments' },
  { key: 'accounting.ledger.read', label: 'Read General Ledger' },
  { key: 'accounting.journal.post', label: 'Post Double-Entry Journals' },
  { key: 'audit.logs.read', label: 'Inspect Immutable Audit Logs' },
];

export function IdentityTenancyView() {
  const { principal, activeCompany, switchCompany, can } = useTenant();
  const {
    user,
    authReady,
    connectionState,
    projectId,
    authError,
    signInWithGoogle,
    signOutUser,
  } = useFirebase();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium text-[#16B8A6] mb-1">
          Firebase Auth + Multi-Tenant RBAC
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
          Identity & Multi-Tenancy Model
        </h1>
        <p className="mt-1.5 text-sm text-[#718096] dark:text-slate-400 max-w-3xl">
          Identity (<code className="font-mono">identity.users</code>) and Business
          Authorization (<code className="font-mono">organization.memberships</code>) are
          strictly decoupled. Switch active companies below to observe real-time role and
          permission boundary changes for the same authenticated user.
        </p>
      </div>

      {/* Firebase Realtime & Auth Binding */}
      <Surface>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-[#718096] dark:text-slate-400">
              Firebase Project: <span className="font-mono">{projectId}</span> · Firestore:{' '}
              <span className="capitalize font-medium text-[#16B8A6]">{connectionState}</span>
            </div>
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              {user
                ? `Signed in via Google: ${user.displayName ?? user.email}`
                : authReady
                  ? 'Firebase Auth Session Not Connected'
                  : 'Checking Firebase Auth Session...'}
            </h2>
            {user && (
              <p className="text-xs font-mono text-[#718096] dark:text-slate-400">
                firebase_uid: {user.uid} · verified: {String(user.emailVerified)}
              </p>
            )}
            {authError && (
              <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>
            )}
          </div>

          <div className="shrink-0">
            {user ? (
              <Button variant="outline" size="sm" onClick={() => void signOutUser()}>
                Sign Out
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => void signInWithGoogle()}>
                Sign In with Google
              </Button>
            )}
          </div>
        </div>
      </Surface>

      {/* Global User Identity */}
      <Surface>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#4169F5]/10 text-[#4169F5] flex items-center justify-center shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-[#718096] dark:text-slate-400">
                Global Identity Principal · identity.users
              </div>
              <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
                {user?.displayName ?? principal.fullName} ({user?.email ?? principal.email})
              </h2>
              <div className="mt-1 text-xs text-[#718096] dark:text-slate-400 font-mono">
                user_id: {principal.userId} · MFA: {principal.mfaEnabled ? 'Enabled' : 'Off'}
              </div>
            </div>
          </div>

          <div className="text-xs text-[#718096] dark:text-slate-400 sm:text-right">
            <div>Memberships: {principal.memberships.length} Companies</div>
            <div className="font-mono mt-0.5">
              active_tenant: {principal.activeTenantId.slice(0, 8)}...
            </div>
          </div>
        </div>
      </Surface>

      {/* Company Memberships Switcher Cards */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
          Company Memberships & Distinct Role Assignments
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {principal.memberships.map((m) => {
            const isCurrent = m.companyId === activeCompany.companyId;
            return (
              <Surface
                key={m.companyId}
                className={
                  isCurrent
                    ? 'ring-2 ring-[#4169F5] border-transparent'
                    : ''
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-[#718096] dark:text-slate-400">
                      {m.companyCode} · {m.countryCode} · {m.baseCurrency}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-[#182238] dark:text-slate-100">
                      {m.companyName}
                    </h3>
                  </div>
                  <Building2
                    className={`h-4 w-4 shrink-0 ${
                      isCurrent ? 'text-[#4169F5]' : 'text-[#718096]'
                    }`}
                  />
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#223257] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#718096] dark:text-slate-400">Role</span>
                    <span className="font-semibold text-[#182238] dark:text-slate-100">
                      {m.roleName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#718096] dark:text-slate-400">Scope</span>
                    <span className="font-mono">{m.roleScope}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#718096] dark:text-slate-400">Branches</span>
                    <span className="font-mono tabular-nums">{m.branches.length}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <Button
                    variant={isCurrent ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full"
                    disabled={isCurrent}
                    onClick={() => switchCompany(m.companyId)}
                  >
                    {isCurrent ? 'Active Company Context' : 'Switch to This Company'}
                  </Button>
                </div>
              </Surface>
            );
          })}
        </div>
      </section>

      {/* Live Permission Evaluation Matrix */}
      <Surface>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#4169F5]" />
              Effective Permission Evaluation ({activeCompany.companyName})
            </h2>
            <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
              Evaluated using <code className="font-mono">hasPermission(membership, key)</code>{' '}
              from <code className="font-mono">src/core/contracts/tenancy.ts</code> for role{' '}
              <span className="font-semibold text-[#182238] dark:text-slate-200">
                {activeCompany.roleName}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-[#223257]">
          {PERMISSION_PROBES.map((probe) => {
            const allowed = can(probe.key);
            return (
              <div
                key={probe.key}
                className="py-2.5 flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <div className="font-medium text-[#182238] dark:text-slate-100">
                    {probe.label}
                  </div>
                  <div className="font-mono text-[11px] text-[#718096] dark:text-slate-400">
                    {probe.key}
                  </div>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
                    allowed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {allowed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Allowed</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4" />
                      <span>Denied (403)</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Surface>
    </div>
  );
}
