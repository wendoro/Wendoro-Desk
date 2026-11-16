import React, { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Check, Lock, ShoppingCart, Store } from 'lucide-react';
import { AppShell } from '@/src/components/shell/AppShell';
import { ErpDataProvider } from '@/src/components/shell/ErpDataProvider';
import { FirebaseProvider, useFirebase } from '@/src/components/shell/FirebaseProvider';
import { TenantProvider, useTenant } from '@/src/components/shell/TenantProvider';
import { ThemeProvider } from '@/src/components/shell/ThemeProvider';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { ToastProvider, useToast } from '@/src/components/ui/ToastProvider';
import {
  computeMarketplaceCartPricing,
  expandSelectionWithDependencies,
  getMarketplaceEntry,
} from '@/src/core/contracts/marketplace';
import { verifyLicenseWithServer } from '@/src/core/engine/licenseClient';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { AccountingView } from '@/src/features/erp/AccountingView';
import { BiAnalyticsView } from '@/src/features/erp/BiAnalyticsView';
import { CatalogueView } from '@/src/features/erp/CatalogueView';
import { CrmView } from '@/src/features/erp/CrmView';
import { DashboardOverview } from '@/src/features/erp/DashboardOverview';
import { IndustryOpsView } from '@/src/features/erp/IndustryOpsView';
import { InventoryView } from '@/src/features/erp/InventoryView';
import { OperationsModulesView } from '@/src/features/erp/OperationsModulesView';
import { SalesPurchaseView } from '@/src/features/erp/SalesPurchaseView';
import { SystemAdminView } from '@/src/features/erp/SystemAdminView';
import { WorkflowStudioView } from '@/src/features/erp/WorkflowStudioView';
import { DeploymentGuideView } from '@/src/features/foundation/DeploymentGuideView';
import { ModuleRoadmapView } from '@/src/features/foundation/ModuleRoadmapView';
import { ModuleMarketplaceView } from '@/src/features/marketplace/ModuleMarketplaceView';
import { LicenseGate } from '@/src/features/setup/LicenseGate';
import { SetupWizard } from '@/src/features/setup/SetupWizard';
import { reverifyActiveLicenseInFirebase } from '@/src/lib/firebaseLicense';
import { formatNumericCurrency } from '@/src/lib/utils';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function LockedModuleGate({
  slug,
  onOpenMarketplace,
  onBack,
}: {
  slug: string;
  onOpenMarketplace: (slug: string) => void;
  onBack: () => void;
}) {
  const {
    activeCompany,
    entitledModules,
    licenseActivation,
    purchaseAndInstallModules,
  } = useTenant();
  const { pushToast } = useToast();
  const [purchasing, setPurchasing] = useState(false);

  const entry = getMarketplaceEntry(slug);
  const currency: 'INR' | 'USD' = activeCompany.baseCurrency === 'INR' ? 'INR' : 'USD';
  const expansion = expandSelectionWithDependencies([slug], entitledModules);
  const pricing = computeMarketplaceCartPricing(expansion.resolvedSlugs, currency, 0);
  const nameBySlug = useMemo(
    () => new Map(WENDORO_MODULES.map((m) => [m.slug, m.name])),
    [],
  );

  const handleInstantUnlock = async () => {
    setPurchasing(true);
    try {
      const res = await purchaseAndInstallModules([slug], { includeDependencies: true });
      pushToast({
        variant: 'success',
        category: 'system',
        title: `${entry?.module.name ?? slug} Unlocked`,
        description: `Purchased ${res.addedModules.length} module(s) onto ${licenseActivation?.licenseKey ?? 'your license'}.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        category: 'alert',
        title: 'Purchase Failed',
        description: err instanceof Error ? err.message : 'Unable to unlock module.',
      });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Surface padding="lg" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono text-[#78716C] dark:text-stone-400">
              {entry?.listing.sku ?? slug.toUpperCase()} · Marketplace Add-On Required
            </div>
            <h1 className="text-xl font-bold text-[#1C1917] dark:text-stone-100 mt-0.5">
              {entry?.module.name ?? slug} is Not Purchased on This License
            </h1>
            <p className="text-xs text-[#57534E] dark:text-stone-400 mt-1 leading-relaxed">
              {entry?.listing.tagline ??
                'This module is packaged separately in the WENDORO Marketplace and is not included in your current license entitlement.'}
            </p>
          </div>
        </div>

        {entry && (
          <div className="p-4 rounded-xl bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#1C1917] dark:text-stone-200">
                Module Add-On Price
              </span>
              <span className="font-mono text-base font-bold text-[#DC2626] dark:text-[#FACC15] tabular-nums">
                {formatNumericCurrency(pricing.total, currency, 0)}
              </span>
            </div>

            {expansion.addedDependencies.length > 0 && (
              <div className="text-[11px] text-[#57534E] dark:text-stone-400">
                Includes required prerequisite module(s):{' '}
                <span className="font-medium text-[#1C1917] dark:text-stone-200">
                  {expansion.addedDependencies
                    .map((d) => nameBySlug.get(d) ?? d)
                    .join(', ')}
                </span>
              </div>
            )}

            <ul className="space-y-1 pt-1">
              {entry.module.capabilities.map((cap) => (
                <li
                  key={cap}
                  className="flex items-start gap-1.5 text-[11px] text-[#1C1917] dark:text-stone-300"
                >
                  <Check className="h-3.5 w-3.5 text-[#D97706] dark:text-[#FACC15] shrink-0 mt-0.5" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to Dashboard
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenMarketplace(slug)}
            >
              <Store className="h-3.5 w-3.5 text-[#DC2626]" />
              Browse in Marketplace
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={purchasing}
              onClick={() => void handleInstantUnlock()}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {purchasing
                ? 'Unlocking Module...'
                : `Purchase & Unlock (${formatNumericCurrency(pricing.total, currency, 0)})`}
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function WorkspaceRouter() {
  const [activeRoute, setActiveRoute] = useState<string>('overview');
  const [marketplaceHighlightSlug, setMarketplaceHighlightSlug] = useState<string | undefined>(
    undefined,
  );
  const [verifyingStartup, setVerifyingStartup] = useState<boolean>(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const {
    activeCompany,
    setupCompleted,
    skipSetupWizard,
    isLicenseVerified,
    isModuleEntitled,
    licenseActivation,
    setLicenseActivation,
    clearLicenseActivation,
  } = useTenant();
  const { user, authReady, isConfigured: isFirebaseConfigured, syncWorkspacePresence } = useFirebase();

  const navigateTo = (routeId: string) => {
    if (routeId !== 'marketplace') {
      setMarketplaceHighlightSlug(undefined);
    }
    setActiveRoute(routeId);
  };

  useEffect(() => {
    if (!isLicenseVerified || !licenseActivation) return;
    let cancelled = false;

    const verifyActiveSession = async () => {
      if (licenseActivation.serverUrl.startsWith('firebase://')) {
        if (!isFirebaseConfigured || !authReady) return;
        setVerifyingStartup(true);
        const check = await reverifyActiveLicenseInFirebase(licenseActivation);
        if (cancelled) return;
        setVerifyingStartup(false);
        if (!check.valid) {
          setStartupError(check.reason || 'Firebase license verification failed.');
          clearLicenseActivation();
        } else if (check.updatedActivation && !check.offlineGrace) {
          setLicenseActivation(check.updatedActivation);
        }
        return;
      }

      try {
        const res = await verifyLicenseWithServer({
          serverUrl: licenseActivation.serverUrl,
          licenseKey: licenseActivation.licenseKey,
        });
        if (!cancelled && !res.valid) {
          setStartupError(res.message || 'License key is no longer valid on the license server.');
          clearLicenseActivation();
        }
      } catch {
        // Preserve offline native grace when license server is unreachable
      }
    };

    void verifyActiveSession();
    return () => {
      cancelled = true;
    };
  }, [authReady, isFirebaseConfigured, isLicenseVerified, licenseActivation?.licenseKey]);

  useEffect(() => {
    if (setupCompleted && authReady && user) {
      void syncWorkspacePresence({
        companyId: activeCompany.companyId,
        companyName: activeCompany.companyName,
        activeRoute,
      });
    }
  }, [
    setupCompleted,
    authReady,
    user,
    activeCompany.companyId,
    activeCompany.companyName,
    activeRoute,
    syncWorkspacePresence,
  ]);

  const breadcrumb = useMemo(() => {
    if (activeRoute.startsWith('module:')) {
      const slug = activeRoute.replace('module:', '');
      const mod = WENDORO_MODULES.find((m) => m.slug === slug);
      return [
        'WENDORO',
        mod?.layer === 'industry' ? 'Industry' : 'Operations',
        mod?.name ?? slug,
      ];
    }
    switch (activeRoute) {
      case 'marketplace':
        return ['WENDORO', 'Software', 'Module Marketplace'];
      case 'bi_analytics':
        return ['WENDORO', 'Workspace', 'BI & Analytics'];
      case 'workflow_studio':
        return ['WENDORO', 'Workspace', 'Workflow Studio'];
      case 'admin':
        return ['WENDORO', 'Workspace', 'Modules & Settings'];
      case 'setup':
        return ['WENDORO', 'Software', 'Setup & License'];
      case 'deploy':
        return ['WENDORO', 'Software', 'Desktop & Android'];
      case 'schema':
      case 'identity':
      case 'design':
      case 'milestone':
        return ['WENDORO', 'Workspace', 'Platform Architecture'];
      case 'overview':
      default:
        return ['WENDORO', 'Operations', 'Dashboard'];
    }
  }, [activeRoute]);

  if (!isLicenseVerified || verifyingStartup) {
    return (
      <LicenseGate
        verifyingStartup={verifyingStartup}
        startupError={startupError}
      />
    );
  }

  if (!setupCompleted) {
    return (
      <SetupWizard
        onComplete={() => navigateTo('overview')}
        onSkip={() => {
          skipSetupWizard();
          navigateTo('overview');
        }}
      />
    );
  }

  const renderContent = () => {
    if (activeRoute.startsWith('module:')) {
      const slug = activeRoute.replace('module:', '');
      if (!isModuleEntitled(slug)) {
        return (
          <LockedModuleGate
            slug={slug}
            onOpenMarketplace={(highlight) => {
              setMarketplaceHighlightSlug(highlight);
              setActiveRoute('marketplace');
            }}
            onBack={() => navigateTo('overview')}
          />
        );
      }

      switch (slug) {
        case 'catalogue':
          return <CatalogueView />;
        case 'crm':
          return <CrmView onNavigate={navigateTo} />;
        case 'sales':
          return <SalesPurchaseView mode="sales" />;
        case 'purchase':
          return <SalesPurchaseView mode="purchase" />;
        case 'inventory':
          return <InventoryView onNavigate={navigateTo} />;
        case 'accounting':
          return <AccountingView />;
        case 'hrms':
        case 'projects':
        case 'support':
        case 'documents':
        case 'marketing':
          return <OperationsModulesView slug={slug} />;
        default:
          if (slug.startsWith('industry_')) {
            return <IndustryOpsView moduleSlug={slug} />;
          }
          return (
            <ModuleRoadmapView
              moduleSlug={slug}
              onBack={() => navigateTo('overview')}
            />
          );
      }
    }

    switch (activeRoute) {
      case 'marketplace':
        return (
          <ModuleMarketplaceView
            onNavigate={navigateTo}
            highlightSlug={marketplaceHighlightSlug}
          />
        );
      case 'bi_analytics':
        return <BiAnalyticsView />;
      case 'workflow_studio':
        return <WorkflowStudioView />;
      case 'admin':
        return <SystemAdminView onNavigate={navigateTo} />;
      case 'schema':
        return (
          <SystemAdminView
            onNavigate={navigateTo}
            initialTab="architecture"
            initialArchTab="schema"
          />
        );
      case 'identity':
        return (
          <SystemAdminView
            onNavigate={navigateTo}
            initialTab="architecture"
            initialArchTab="identity"
          />
        );
      case 'design':
        return (
          <SystemAdminView
            onNavigate={navigateTo}
            initialTab="architecture"
            initialArchTab="design"
          />
        );
      case 'milestone':
        return (
          <SystemAdminView
            onNavigate={navigateTo}
            initialTab="architecture"
            initialArchTab="milestone"
          />
        );
      case 'setup':
        return (
          <SetupWizard
            isModalOrEmbedded
            onComplete={() => navigateTo('overview')}
            onSkip={() => navigateTo('overview')}
          />
        );
      case 'deploy':
        return <DeploymentGuideView onNavigate={navigateTo} />;
      case 'overview':
      default:
        return <DashboardOverview onNavigate={navigateTo} />;
    }
  };

  return (
    <AppShell
      activeRoute={activeRoute}
      onNavigate={navigateTo}
      breadcrumb={breadcrumb}
    >
      {renderContent()}
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <FirebaseProvider>
            <TenantProvider>
              <ErpDataProvider>
                <WorkspaceRouter />
              </ErpDataProvider>
            </TenantProvider>
          </FirebaseProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
