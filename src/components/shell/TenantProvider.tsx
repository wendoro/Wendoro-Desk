import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  expandSelectionWithDependencies,
  getEntitledModulesForLicense,
  inferUserTypeFromIndustry,
  isModulePurchasedForLicense,
  normalizePurchasedModules,
} from '@/src/core/contracts/marketplace';
import {
  CompanyMembership,
  SessionPrincipal,
  SessionPrincipalSchema,
  SubscriptionTier,
  UserTypeId,
  hasPermission,
} from '@/src/core/contracts/tenancy';
import {
  LicenseActivationState,
  purchaseModulesWithServer,
} from '@/src/core/engine/licenseClient';
import { purchaseModulesInFirebase } from '@/src/lib/firebaseLicense';

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
  userType?: UserTypeId;
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
  licenseActivation?: LicenseActivationState;
}

interface PersistedSetupState {
  setupCompleted: boolean;
  principal: SessionPrincipal;
  licenseKey?: string;
  licenseActivation?: LicenseActivationState;
}

const SETUP_STORAGE_KEY = 'wendoro.setup.v2';
const PLACEHOLDER_COMPANY_ID = '00000000-0000-4000-8000-000000000001';

const INITIAL_PRINCIPAL: SessionPrincipal = SessionPrincipalSchema.parse({
  userId: '00000000-0000-4000-8000-000000000101',
  email: 'admin@wendoro.local',
  fullName: 'Workspace Admin',
  mfaEnabled: false,
  isPlatformAdmin: true,
  activeTenantId: '00000000-0000-4000-8000-000000000201',
  activeCompanyId: PLACEHOLDER_COMPANY_ID,
  activeBranchId: '00000000-0000-4000-8000-000000000401',
  subscriptionTier: 'free',
  memberships: [
    {
      membershipId: '00000000-0000-4000-8000-000000000501',
      tenantId: '00000000-0000-4000-8000-000000000201',
      companyId: PLACEHOLDER_COMPANY_ID,
      companyCode: 'ORG-01',
      companyName: 'My Organization',
      legalName: 'My Organization',
      industryClassification: 'Retail & Distribution',
      userType: 'retail_pos',
      baseCurrency: 'INR',
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      roleName: 'Organization Owner',
      roleSlug: 'owner',
      roleScope: 'tenant',
      permissions: ['*'],
      enabledModules: [
        'core_identity',
        'core_rbac',
        'catalogue',
        'crm',
        'accounting',
      ],
      defaultBranchId: '00000000-0000-4000-8000-000000000401',
      branches: [
        {
          id: '00000000-0000-4000-8000-000000000401',
          code: 'HQ-01',
          name: 'Headquarters',
          isHeadquarters: true,
          city: null,
          countryCode: 'IN',
        },
      ],
    },
  ],
});

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
      licenseActivation: parsed.licenseActivation,
    };
  } catch {
    return { setupCompleted: false, principal: INITIAL_PRINCIPAL };
  }
}

interface TenantContextValue {
  principal: SessionPrincipal;
  activeCompany: CompanyMembership;
  activeUserType: UserTypeId;
  activeBranchId: string | null;
  setupCompleted: boolean;
  licenseKey?: string;
  licenseActivation?: LicenseActivationState;
  isLicenseVerified: boolean;
  purchasedModules: string[];
  entitledModules: string[];
  isModuleEntitled: (moduleSlug: string) => boolean;
  setCompanyUserType: (userType: UserTypeId) => void;
  purchaseAndInstallModules: (
    moduleSlugs: string[],
    options?: { includeDependencies?: boolean; userType?: UserTypeId },
  ) => Promise<{ addedModules: string[]; purchasedModules: string[] }>;
  setLicenseActivation: (activation: LicenseActivationState | undefined) => void;
  clearLicenseActivation: () => void;
  switchCompany: (companyId: string) => void;
  switchBranch: (branchId: string | null) => void;
  addBranchToActiveCompany: (branch: { code: string; name: string; city: string }) => void;
  toggleCompanyModule: (moduleSlug: string) => boolean;
  completeSetupWizard: (input: SetupWizardInput) => CompanyMembership;
  skipSetupWizard: () => void;
  resetSetupWizard: () => void;
  can: (permission: string) => boolean;
  notifications: NotificationItem[];
  pushNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>) => void;
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
  const [licenseActivation, setLicenseActivationState] = useState<
    LicenseActivationState | undefined
  >(initialState.licenseActivation);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const persist = (
    nextPrincipal: SessionPrincipal,
    nextCompleted: boolean,
    nextLicenseKey?: string,
    nextLicenseActivation?: LicenseActivationState,
  ) => {
    if (typeof window === 'undefined') return;
    const payload: PersistedSetupState = {
      setupCompleted: nextCompleted,
      principal: nextPrincipal,
      licenseKey: nextLicenseKey,
      licenseActivation: nextLicenseActivation,
    };
    window.localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(payload));
  };

  const isLicenseVerified = useMemo(() => {
    if (!licenseActivation || !licenseActivation.licenseKey) return false;
    if (licenseActivation.expiresAt) {
      const expiryMs = Date.parse(licenseActivation.expiresAt);
      if (!Number.isNaN(expiryMs) && expiryMs < Date.now()) {
        return false;
      }
    }
    return true;
  }, [licenseActivation]);

  const setLicenseActivation = (activation: LicenseActivationState | undefined) => {
    const nextKey = activation?.licenseKey;
    const nextPrincipal = activation
      ? { ...principal, subscriptionTier: activation.planTier }
      : principal;
    setLicenseActivationState(activation);
    setLicenseKey(nextKey);
    if (activation) setPrincipal(nextPrincipal);
    persist(nextPrincipal, setupCompleted, nextKey, activation);
  };

  const clearLicenseActivation = () => {
    setLicenseActivationState(undefined);
    setLicenseKey(undefined);
    persist(principal, setupCompleted, undefined, undefined);
  };

  const activeCompany = useMemo(() => {
    return (
      principal.memberships.find((m) => m.companyId === principal.activeCompanyId) ??
      principal.memberships[0]
    );
  }, [principal]);

  const purchasedModules = useMemo(
    () => normalizePurchasedModules(licenseActivation?.purchasedModules),
    [licenseActivation?.purchasedModules],
  );

  const entitledModules = useMemo(
    () => getEntitledModulesForLicense(principal.subscriptionTier, purchasedModules),
    [principal.subscriptionTier, purchasedModules],
  );

  const activeUserType: UserTypeId = useMemo(
    () =>
      activeCompany.userType ??
      licenseActivation?.userType ??
      inferUserTypeFromIndustry(activeCompany.industryClassification),
    [activeCompany.userType, activeCompany.industryClassification, licenseActivation?.userType],
  );

  const isModuleEntitled = (moduleSlug: string): boolean =>
    isModulePurchasedForLicense(moduleSlug, principal.subscriptionTier, purchasedModules);

  const setCompanyUserType = (userType: UserTypeId) => {
    const nextActivation = licenseActivation
      ? { ...licenseActivation, userType }
      : undefined;
    setLicenseActivationState(nextActivation);
    setPrincipal((prev) => {
      const next: SessionPrincipal = {
        ...prev,
        memberships: prev.memberships.map((m) =>
          m.companyId === prev.activeCompanyId ? { ...m, userType } : m,
        ),
      };
      persist(next, setupCompleted, licenseKey, nextActivation);
      return next;
    });
  };

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
      persist(next, setupCompleted, licenseKey, licenseActivation);
      return next;
    });
  };

  const switchBranch = (branchId: string | null) => {
    setPrincipal((prev) => {
      const next = { ...prev, activeBranchId: branchId };
      persist(next, setupCompleted, licenseKey, licenseActivation);
      return next;
    });
  };

  const addBranchToActiveCompany = (branch: {
    code: string;
    name: string;
    city: string;
  }) => {
    const newBranch = {
      id: createUuid(),
      code: branch.code.trim().toUpperCase(),
      name: branch.name.trim(),
      isHeadquarters: false,
      city: branch.city.trim() || null,
      countryCode: activeCompany.countryCode,
    };
    setPrincipal((prev) => {
      const next: SessionPrincipal = {
        ...prev,
        memberships: prev.memberships.map((m) =>
          m.companyId === prev.activeCompanyId
            ? { ...m, branches: [...m.branches, newBranch] }
            : m,
        ),
      };
      persist(next, setupCompleted, licenseKey, licenseActivation);
      return next;
    });
  };

  const toggleCompanyModule = (moduleSlug: string): boolean => {
    if (moduleSlug === 'core_identity' || moduleSlug === 'core_rbac') return false;
    const currentlyEnabled = activeCompany.enabledModules.includes(moduleSlug);
    if (!currentlyEnabled && !isModuleEntitled(moduleSlug)) {
      return false;
    }

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
      persist(next, setupCompleted, licenseKey, licenseActivation);
      return next;
    });
    return true;
  };

  const pushNotification: TenantContextValue['pushNotification'] = (item) => {
    setNotifications((prev) => [
      {
        ...item,
        id: createUuid(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isRead: false,
      },
      ...prev.slice(0, 24),
    ]);
  };

  const purchaseAndInstallModules: TenantContextValue['purchaseAndInstallModules'] = async (
    moduleSlugs,
    options,
  ) => {
    if (!licenseActivation?.licenseKey) {
      throw new Error('Activate a license key before purchasing Marketplace modules.');
    }

    const includeDependencies = options?.includeDependencies !== false;
    const targetUserType = options?.userType ?? activeUserType;

    let updatedPurchased: string[] = purchasedModules;
    let addedModules: string[] = [];
    let updatedToken = licenseActivation.activationToken;

    if (licenseActivation.serverUrl.startsWith('firebase://')) {
      const fbRes = await purchaseModulesInFirebase({
        licenseKey: licenseActivation.licenseKey,
        moduleSlugs,
        includeDependencies,
      });
      updatedPurchased = fbRes.purchasedModules;
      addedModules = fbRes.addedModules;
    } else {
      const srvRes = await purchaseModulesWithServer({
        serverUrl: licenseActivation.serverUrl,
        licenseKey: licenseActivation.licenseKey,
        moduleSlugs,
        includeDependencies,
        userType: targetUserType,
      });
      updatedPurchased = normalizePurchasedModules(srvRes.license.purchasedModules);
      addedModules = srvRes.addedModules;
      updatedToken = srvRes.activationToken;
    }

    const nextActivation: LicenseActivationState = {
      ...licenseActivation,
      purchasedModules: updatedPurchased,
      activationToken: updatedToken,
      userType: targetUserType,
      verifiedAt: new Date().toISOString(),
    };

    const expansion = expandSelectionWithDependencies(moduleSlugs, []);
    const toEnable = Array.from(
      new Set([...moduleSlugs, ...addedModules, ...expansion.addedDependencies]),
    );

    setLicenseActivationState(nextActivation);
    setPrincipal((prev) => {
      const next: SessionPrincipal = {
        ...prev,
        memberships: prev.memberships.map((m) =>
          m.companyId === prev.activeCompanyId
            ? {
                ...m,
                userType: targetUserType,
                enabledModules: Array.from(new Set([...m.enabledModules, ...toEnable])),
              }
            : m,
        ),
      };
      persist(next, setupCompleted, licenseActivation.licenseKey, nextActivation);
      return next;
    });

    pushNotification({
      category: 'governance',
      title: 'Marketplace Modules Added',
      body:
        addedModules.length > 0
          ? `Purchased & installed ${addedModules.length} module(s) onto license ${licenseActivation.licenseKey}.`
          : `Installed ${toEnable.length} module(s) on ${activeCompany.companyName}.`,
    });

    return {
      addedModules,
      purchasedModules: updatedPurchased,
    };
  };

  const completeSetupWizard = (input: SetupWizardInput): CompanyMembership => {
    const tenantId = createUuid();
    const companyId = createUuid();
    const branchId = createUuid();
    const membershipId = createUuid();

    const entitledForTier = new Set(
      getEntitledModulesForLicense(
        input.subscriptionTier,
        input.licenseActivation?.purchasedModules,
      ),
    );
    const filteredSelected = input.enabledModules.filter((slug) =>
      entitledForTier.has(slug),
    );
    const dedupedModules = Array.from(
      new Set(['core_identity', 'core_rbac', ...filteredSelected]),
    );
    const resolvedUserType =
      input.userType ?? inferUserTypeFromIndustry(input.industryClassification);

    const newMembership: CompanyMembership = {
      membershipId,
      tenantId,
      companyId,
      companyCode: input.companyCode.toUpperCase(),
      companyName: input.companyName.trim(),
      legalName: input.legalName.trim() || input.companyName.trim(),
      industryClassification: input.industryClassification,
      userType: resolvedUserType,
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

    const existingRealMemberships = principal.memberships.filter(
      (m) => m.companyId !== PLACEHOLDER_COMPANY_ID,
    );

    const nextPrincipal: SessionPrincipal = SessionPrincipalSchema.parse({
      ...principal,
      activeTenantId: tenantId,
      activeCompanyId: companyId,
      activeBranchId: branchId,
      subscriptionTier: input.subscriptionTier,
      memberships: [newMembership, ...existingRealMemberships],
    });

    const trimmedKey =
      input.licenseActivation?.licenseKey ?? (input.licenseKey?.trim() || undefined);
    const nextActivation = input.licenseActivation
      ? { ...input.licenseActivation, userType: resolvedUserType }
      : undefined;
    setPrincipal(nextPrincipal);
    setSetupCompleted(true);
    setLicenseKey(trimmedKey);
    setLicenseActivationState(nextActivation);
    persist(nextPrincipal, true, trimmedKey, nextActivation);

    pushNotification({
      category: 'governance',
      title: `${newMembership.companyName} Ready`,
      body: trimmedKey
        ? `License ${trimmedKey} activated (${dedupedModules.length} modules).`
        : `${dedupedModules.length} modules activated (${input.subscriptionTier} edition).`,
    });

    return newMembership;
  };

  const skipSetupWizard = () => {
    setSetupCompleted(true);
    persist(principal, true, licenseKey, licenseActivation);
  };

  const resetSetupWizard = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SETUP_STORAGE_KEY);
    }
    setPrincipal(INITIAL_PRINCIPAL);
    setLicenseKey(undefined);
    setLicenseActivationState(undefined);
    setNotifications([]);
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
        activeUserType,
        activeBranchId: principal.activeBranchId,
        setupCompleted,
        licenseKey,
        licenseActivation,
        isLicenseVerified,
        purchasedModules,
        entitledModules,
        isModuleEntitled,
        setCompanyUserType,
        purchaseAndInstallModules,
        setLicenseActivation,
        clearLicenseActivation,
        switchCompany,
        switchBranch,
        addBranchToActiveCompany,
        toggleCompanyModule,
        completeSetupWizard,
        skipSetupWizard,
        resetSetupWizard,
        can,
        notifications,
        pushNotification,
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
