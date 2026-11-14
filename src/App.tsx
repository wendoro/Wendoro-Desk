import React, { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/src/components/shell/AppShell';
import { FirebaseProvider, useFirebase } from '@/src/components/shell/FirebaseProvider';
import { TenantProvider, useTenant } from '@/src/components/shell/TenantProvider';
import { ThemeProvider } from '@/src/components/shell/ThemeProvider';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { DeploymentGuideView } from '@/src/features/foundation/DeploymentGuideView';
import { DesignSystemView } from '@/src/features/foundation/DesignSystemView';
import { FoundationOverview } from '@/src/features/foundation/FoundationOverview';
import { IdentityTenancyView } from '@/src/features/foundation/IdentityTenancyView';
import { MilestonePlanView } from '@/src/features/foundation/MilestonePlanView';
import { ModuleRoadmapView } from '@/src/features/foundation/ModuleRoadmapView';
import { SchemaExplorerView } from '@/src/features/foundation/SchemaExplorerView';
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
  const { activeCompany, setupCompleted, skipSetupWizard } = useTenant();
  const { user, authReady, syncWorkspacePresence } = useFirebase();

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
        mod?.layer === 'industry' ? 'Industry' : 'Business Apps',
        mod?.name ?? slug,
      ];
    }
    switch (activeRoute) {
      case 'setup':
        return ['WENDORO', 'Core Platform', 'Setup Wizard'];
      case 'deploy':
        return ['WENDORO', 'Core Platform', 'Deploy & Distribute'];
      case 'schema':
        return ['WENDORO', 'Core Platform', 'Architecture & Schema'];
      case 'identity':
        return ['WENDORO', 'Core Platform', 'Identity & Multi-Tenancy'];
      case 'design':
        return ['WENDORO', 'Core Platform', 'Design System'];
      case 'milestone':
        return ['WENDORO', 'Core Platform', 'Milestone 1 & Gates'];
      case 'overview':
      default:
        return ['WENDORO', 'Core Platform', 'Executive Shell'];
    }
  }, [activeRoute]);

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
      return (
        <ModuleRoadmapView
          moduleSlug={slug}
          onBack={() => setActiveRoute('overview')}
        />
      );
    }

    switch (activeRoute) {
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
      case 'schema':
        return <SchemaExplorerView />;
      case 'identity':
        return <IdentityTenancyView />;
      case 'design':
        return <DesignSystemView />;
      case 'milestone':
        return <MilestonePlanView />;
      case 'overview':
      default:
        return <FoundationOverview onNavigate={setActiveRoute} />;
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
            <WorkspaceRouter />
          </TenantProvider>
        </FirebaseProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
