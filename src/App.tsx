import React, { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/src/components/shell/AppShell';
import { ErpDataProvider } from '@/src/components/shell/ErpDataProvider';
import { FirebaseProvider, useFirebase } from '@/src/components/shell/FirebaseProvider';
import { TenantProvider, useTenant } from '@/src/components/shell/TenantProvider';
import { ThemeProvider } from '@/src/components/shell/ThemeProvider';
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
import { verifyLicenseWithServer } from '@/src/core/engine/licenseClient';
import { reverifyActiveLicenseInFirebase } from '@/src/lib/firebaseLicense';
import { DeploymentGuideView } from '@/src/features/foundation/DeploymentGuideView';
import { ModuleRoadmapView } from '@/src/features/foundation/ModuleRoadmapView';
import { LicenseGate } from '@/src/features/setup/LicenseGate';
import { SetupWizard } from '@/src/features/setup/SetupWizard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function WorkspaceRouter() {
  const [activeRoute, setActiveRoute] = useState<string>('overview');
  const [verifyingStartup, setVerifyingStartup] = useState<boolean>(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const {
    activeCompany,
    setupCompleted,
    skipSetupWizard,
    isLicenseVerified,
    licenseActivation,
    setLicenseActivation,
    clearLicenseActivation,
  } = useTenant();
  const { user, authReady, isConfigured: isFirebaseConfigured, syncWorkspacePresence } = useFirebase();

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
        onComplete={() => setActiveRoute('overview')}
        onSkip={() => {
          skipSetupWizard();
          setActiveRoute('overview');
        }}
      />
    );
  }

  const renderContent = () => {
    if (activeRoute.startsWith('module:')) {
      const slug = activeRoute.replace('module:', '');
      switch (slug) {
        case 'catalogue':
          return <CatalogueView />;
        case 'crm':
          return <CrmView onNavigate={setActiveRoute} />;
        case 'sales':
          return <SalesPurchaseView mode="sales" />;
        case 'purchase':
          return <SalesPurchaseView mode="purchase" />;
        case 'inventory':
          return <InventoryView onNavigate={setActiveRoute} />;
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
              onBack={() => setActiveRoute('overview')}
            />
          );
      }
    }

    switch (activeRoute) {
      case 'bi_analytics':
        return <BiAnalyticsView />;
      case 'workflow_studio':
        return <WorkflowStudioView />;
      case 'admin':
        return <SystemAdminView onNavigate={setActiveRoute} />;
      case 'schema':
        return (
          <SystemAdminView
            onNavigate={setActiveRoute}
            initialTab="architecture"
            initialArchTab="schema"
          />
        );
      case 'identity':
        return (
          <SystemAdminView
            onNavigate={setActiveRoute}
            initialTab="architecture"
            initialArchTab="identity"
          />
        );
      case 'design':
        return (
          <SystemAdminView
            onNavigate={setActiveRoute}
            initialTab="architecture"
            initialArchTab="design"
          />
        );
      case 'milestone':
        return (
          <SystemAdminView
            onNavigate={setActiveRoute}
            initialTab="architecture"
            initialArchTab="milestone"
          />
        );
      case 'setup':
        return (
          <SetupWizard
            isModalOrEmbedded
            onComplete={() => setActiveRoute('overview')}
            onSkip={() => setActiveRoute('overview')}
          />
        );
      case 'deploy':
        return <DeploymentGuideView onNavigate={setActiveRoute} />;
      case 'overview':
      default:
        return <DashboardOverview onNavigate={setActiveRoute} />;
    }
  };

  return (
    <AppShell
      activeRoute={activeRoute}
      onNavigate={setActiveRoute}
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
        <FirebaseProvider>
          <TenantProvider>
            <ErpDataProvider>
              <WorkspaceRouter />
            </ErpDataProvider>
          </TenantProvider>
        </FirebaseProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
