import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  CompanyMembership,
  SessionPrincipal,
  SessionPrincipalSchema,
  SubscriptionTier,
  hasPermission,
} from '@/src/core/contracts/tenancy';

export interface NotificationItem {
  id: string;
  category: 'architecture' | 'security' | 'governance';
  title: string;
  body: string;
  timestamp: string;
  isRead: boolean;
}

export interface SetupWizardInput {
  tenantName: string;
  tenantSlug: string;
  companyName: string;
  legalName: string;
  companyCode: string;
  industryClassification: string;
  countryCode: string;
  baseCurrency: string;
  timezone: string;
  taxRegistrationNumber?: string;
  branchCode: string;
  branchName: string;
  branchCity: string;
  enabledModules: string[];
  subscriptionTier: SubscriptionTier;
  licenseKey?: string;
}

interface PersistedSetupState {
  setupCompleted: boolean;
  principal: SessionPrincipal;
  licenseKey?: string;
}

const SETUP_STORAGE_KEY = 'wendoro.setup.v1';

/**
 * Phase 0 Reference Principal validating SessionPrincipalSchema.
 * Demonstrates one identity holding distinct roles & module entitlements
 * across three independent companies prior to Phase 1 database seeding.
 */
const INITIAL_PRINCIPAL: SessionPrincipal = SessionPrincipalSchema.parse({
  userId: '11111111-1111-4111-8111-111111111101',
  email: 'architect@example.com',
  fullName: 'Workspace Architect',
  mfaEnabled: true,
  isPlatformAdmin: true,
  activeTenantId: '22222222-2222-4222-8222-222222222201',
  activeCompanyId: '33333333-3333-4333-8333-333333333301',
  activeBranchId: '44444444-4444-4444-8444-444444444401',
  subscriptionTier: 'enterprise',
  memberships: [
    {
      membershipId: '55555555-5555-4555-8555-555555555501',
      tenantId: '22222222-2222-4222-8222-222222222201',
      companyId: '33333333-3333-4333-8333-333333333301',
      companyCode: 'NRS-GLOBAL',
      companyName: 'Northstar Commerce Ltd',
      legalName: 'Northstar Commerce Private Limited',
      industryClassification: 'Retail & Distribution',
      baseCurrency: 'USD',
      countryCode: 'US',
      timezone: 'America/New_York',
      roleName: 'Organization Owner',
      roleSlug: 'owner',
      roleScope: 'tenant',
      permissions: ['*'],
      enabledModules: [
        'core_identity',
        'core_rbac',
        'catalogue',
        'crm',
        'sales',
        'purchase',
        'inventory',
        'accounting',
        'industry_retail',
      ],
      defaultBranchId: '44444444-4444-4444-8444-444444444401',
      branches: [
        {
          id: '44444444-4444-4444-8444-444444444401',
          code: 'NYC-HQ',
          name: 'New York Headquarters',
          isHeadquarters: true,
          city: 'New York',
          countryCode: 'US',
        },
        {
          id: '44444444-4444-4444-8444-444444444402',
          code: 'AUS-HUB',
          name: 'Austin Fulfilment Hub',
          isHeadquarters: false,
          city: 'Austin',
          countryCode: 'US',
        },
      ],
    },
    {
      membershipId: '55555555-5555-4555-8555-555555555502',
      tenantId: '22222222-2222-4222-8222-222222222201',
      companyId: '33333333-3333-4333-8333-333333333302',
      companyCode: 'VER-ADV',
      companyName: 'Veridian Advisory LLP',
      legalName: 'Veridian Advisory Services LLP',
      industryClassification: 'Professional Services',
      baseCurrency: 'INR',
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      roleName: 'Finance Auditor',
      roleSlug: 'auditor',
      roleScope: 'company',
      permissions: [
        'accounting.ledger.read',
        'accounting.reports.read',
        'audit.logs.read',
        'projects.timesheets.read',
      ],
      enabledModules: [
        'core_identity',
        'core_rbac',
        'crm',
        'accounting',
        'projects',
        'documents',
        'industry_services',
      ],
      defaultBranchId: '44444444-4444-4444-8444-444444444403',
      branches: [
        {
          id: '44444444-4444-4444-8444-444444444403',
          code: 'BLR-HQ',
          name: 'Bengaluru Corporate Office',
          isHeadquarters: true,
          city: 'Bengaluru',
          countryCode: 'IN',
        },
      ],
    },
    {
      membershipId: '55555555-5555-4555-8555-555555555503',
      tenantId: '22222222-2222-4222-8222-222222222202',
      companyId: '33333333-3333-4333-8333-333333333303',
      companyCode: 'AET-MFG',
      companyName: 'Aether Precision Systems',
      legalName: 'Aether Precision Systems GmbH',
      industryClassification: 'Electronics & Manufacturing',
      baseCurrency: 'EUR',
      countryCode: 'DE',
      timezone: 'Europe/Berlin',
      roleName: 'Operations Manager',
      roleSlug: 'ops_manager',
      roleScope: 'branch',
      permissions: [
        'catalogue.*',
        'inventory.*',
        'purchase.order.read',
        'purchase.order.approve',
        'industry_manufacturing.*',
      ],
      enabledModules: [
        'core_identity',
        'core_rbac',
        'catalogue',
        'purchase',
        'inventory',
        'industry_manufacturing',
        'industry_electronics',
      ],
      defaultBranchId: '44444444-4444-4444-8444-444444444404',
      branches: [
        {
          id: '44444444-4444-4444-8444-444444444404',
          code: 'MUC-PLANT',
          name: 'Munich Assembly Plant',
          isHeadquarters: true,
          city: 'Munich',
          countryCode: 'DE',
        },
        {
          id: '44444444-4444-4444-8444-444444444405',
          code: 'FRA-DIST',
          name: 'Frankfurt Logistics Depot',
          isHeadquarters: false,
          city: 'Frankfurt',
          countryCode: 'DE',
        },
      ],
    },
  ],
});

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-phase0-arch',
    category: 'architecture',
    title: 'Phase 0 Foundation Initialized',
    body: 'Core schemas, RLS migration 0000, and multi-tenant shell contracts are ready for review.',
    timestamp: 'Phase 0',
    isRead: false,
  },
  {
    id: 'notif-phase0-rls',
    category: 'security',
    title: 'PostgreSQL RLS Isolation Configured',
    body: 'Transaction-scoped set_config() policies defined across organization and audit schemas.',
    timestamp: 'Migration 0000',
    isRead: false,
  },
  {
    id: 'notif-phase1-gate',
    category: 'governance',
    title: 'Awaiting Phase 1 Sign-Off',
    body: 'Approve foundation deliverables before provisioning Better Auth and live REST endpoints.',
    timestamp: 'Milestone 1',
    isRead: true,
  },
];

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '66666666-6666-4666-8666-666666666601';
}

function loadPersistedState(): PersistedSetupState {
  if (typeof window === 'undefined') {
    return { setupCompleted: false, principal: INITIAL_PRINCIPAL };
  }
  try {
    const raw = window.localStorage.getItem(SETUP_STORAGE_KEY);
    if (!raw) return { setupCompleted: false, principal: INITIAL_PRINCIPAL };
    const parsed = JSON.parse(raw) as PersistedSetupState;
    const validPrincipal = SessionPrincipalSchema.parse(parsed.principal);
    return {
      setupCompleted: Boolean(parsed.setupCompleted),
      principal: validPrincipal,
      licenseKey: parsed.licenseKey,
    };
  } catch {
    return { setupCompleted: false, principal: INITIAL_PRINCIPAL };
  }
}

interface TenantContextValue {
  principal: SessionPrincipal;
  activeCompany: CompanyMembership;
  activeBranchId: string | null;
  setupCompleted: boolean;
  licenseKey?: string;
  switchCompany: (companyId: string) => void;
  switchBranch: (branchId: string | null) => void;
  toggleCompanyModule: (moduleSlug: string) => void;
  completeSetupWizard: (input: SetupWizardInput) => CompanyMembership;
  skipSetupWizard: () => void;
  resetSetupWizard: () => void;
  can: (permission: string) => boolean;
  notifications: NotificationItem[];
  markAllNotificationsRead: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const initialState = useMemo(() => loadPersistedState(), []);
  const [principal, setPrincipal] = useState<SessionPrincipal>(initialState.principal);
  const [setupCompleted, setSetupCompleted] = useState<boolean>(
    initialState.setupCompleted,
  );
  const [licenseKey, setLicenseKey] = useState<string | undefined>(
    initialState.licenseKey,
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS,
  );

  const persist = (
    nextPrincipal: SessionPrincipal,
    nextCompleted: boolean,
    nextLicenseKey?: string,
  ) => {
    if (typeof window === 'undefined') return;
    const payload: PersistedSetupState = {
      setupCompleted: nextCompleted,
      principal: nextPrincipal,
      licenseKey: nextLicenseKey,
    };
    window.localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(payload));
  };

  const activeCompany = useMemo(() => {
    return (
      principal.memberships.find((m) => m.companyId === principal.activeCompanyId) ??
      principal.memberships[0]
    );
  }, [principal]);

  const switchCompany = (companyId: string) => {
    const target = principal.memberships.find((m) => m.companyId === companyId);
    if (!target) return;
    setPrincipal((prev) => {
      const next = {
        ...prev,
        activeTenantId: target.tenantId,
        activeCompanyId: target.companyId,
        activeBranchId: target.defaultBranchId ?? null,
      };
      persist(next, setupCompleted, licenseKey);
      return next;
    });
  };

  const switchBranch = (branchId: string | null) => {
    setPrincipal((prev) => {
      const next = { ...prev, activeBranchId: branchId };
      persist(next, setupCompleted, licenseKey);
      return next;
    });
  };

  const toggleCompanyModule = (moduleSlug: string) => {
    if (moduleSlug === 'core_identity' || moduleSlug === 'core_rbac') return;
    setPrincipal((prev) => {
      const next = {
        ...prev,
        memberships: prev.memberships.map((m) => {
          if (m.companyId !== prev.activeCompanyId) return m;
          const exists = m.enabledModules.includes(moduleSlug);
          return {
            ...m,
            enabledModules: exists
              ? m.enabledModules.filter((slug) => slug !== moduleSlug)
              : [...m.enabledModules, moduleSlug],
          };
        }),
      };
      persist(next, setupCompleted, licenseKey);
      return next;
    });
  };

  const completeSetupWizard = (input: SetupWizardInput): CompanyMembership => {
    const tenantId = createUuid();
    const companyId = createUuid();
    const branchId = createUuid();
    const membershipId = createUuid();

    const dedupedModules = Array.from(
      new Set(['core_identity', 'core_rbac', ...input.enabledModules]),
    );

    const newMembership: CompanyMembership = {
      membershipId,
      tenantId,
      companyId,
      companyCode: input.companyCode.toUpperCase(),
      companyName: input.companyName.trim(),
      legalName: input.legalName.trim() || input.companyName.trim(),
      industryClassification: input.industryClassification,
      baseCurrency: input.baseCurrency.toUpperCase().slice(0, 3),
      countryCode: input.countryCode.toUpperCase().slice(0, 2),
      timezone: input.timezone,
      roleName: 'Organization Owner',
      roleSlug: 'owner',
      roleScope: 'tenant',
      permissions: ['*'],
      enabledModules: dedupedModules,
      defaultBranchId: branchId,
      branches: [
        {
          id: branchId,
          code: input.branchCode.toUpperCase(),
          name: input.branchName.trim(),
          isHeadquarters: true,
          city: input.branchCity.trim() || null,
          countryCode: input.countryCode.toUpperCase().slice(0, 2),
        },
      ],
    };

    const nextPrincipal: SessionPrincipal = SessionPrincipalSchema.parse({
      ...principal,
      activeTenantId: tenantId,
      activeCompanyId: companyId,
      activeBranchId: branchId,
      subscriptionTier: input.subscriptionTier,
      memberships: [newMembership, ...principal.memberships],
    });

    const trimmedKey = input.licenseKey?.trim() || undefined;
    setPrincipal(nextPrincipal);
    setSetupCompleted(true);
    setLicenseKey(trimmedKey);
    persist(nextPrincipal, true, trimmedKey);

    setNotifications((prev) => [
      {
        id: `notif-setup-${companyId}`,
        category: 'governance',
        title: `${newMembership.companyName} Provisioned`,
        body: `Setup wizard configured ${dedupedModules.length} modules under ${input.subscriptionTier} licensing.`,
        timestamp: 'Just now',
        isRead: false,
      },
      ...prev,
    ]);

    return newMembership;
  };

  const skipSetupWizard = () => {
    setSetupCompleted(true);
    persist(principal, true, licenseKey);
  };

  const resetSetupWizard = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SETUP_STORAGE_KEY);
    }
    setPrincipal(INITIAL_PRINCIPAL);
    setLicenseKey(undefined);
    setSetupCompleted(false);
  };

  const can = (permission: string) => hasPermission(activeCompany, permission);

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <TenantContext.Provider
      value={{
        principal,
        activeCompany,
        activeBranchId: principal.activeBranchId,
        setupCompleted,
        licenseKey,
        switchCompany,
        switchBranch,
        toggleCompanyModule,
        completeSetupWizard,
        skipSetupWizard,
        resetSetupWizard,
        can,
        notifications,
        markAllNotificationsRead,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return ctx;
}
