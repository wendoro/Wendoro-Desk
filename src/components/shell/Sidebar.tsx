import React from 'react';
import {
  BookOpen,
  Boxes,
  Building2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Palette,
  Receipt,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { useTenant } from './TenantProvider';

export interface SidebarProps {
  activeRoute: string;
  onNavigate: (routeId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  catalogue: Boxes,
  crm: Users,
  sales: Receipt,
  purchase: ShoppingBag,
  inventory: Truck,
  accounting: Wallet,
  hrms: Users,
  projects: FolderKanban,
  marketing: Megaphone,
  support: LifeBuoy,
  documents: FileText,
  industry_retail: ShoppingBag,
  industry_manufacturing: Boxes,
  industry_electronics: ShieldCheck,
  industry_realestate: Building2,
  industry_services: BookOpen,
};

export function Sidebar({
  activeRoute,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { activeCompany } = useTenant();

  const foundationItems = [
    { id: 'overview', label: 'Executive Shell', icon: LayoutDashboard },
    { id: 'setup', label: 'Setup Wizard', icon: SlidersHorizontal },
    { id: 'deploy', label: 'Deploy & Distribute', icon: Rocket },
    { id: 'schema', label: 'Architecture & Schema', icon: Database },
    { id: 'identity', label: 'Identity & Multi-Tenancy', icon: ShieldCheck },
    { id: 'design', label: 'Design System', icon: Palette },
    { id: 'milestone', label: 'Milestone 1 & Gates', icon: CheckSquare },
  ];

  const enabledBusinessModules = WENDORO_MODULES.filter(
    (m) => m.layer === 'business' && activeCompany.enabledModules.includes(m.slug),
  );

  const enabledIndustryModules = WENDORO_MODULES.filter(
    (m) => m.layer === 'industry' && activeCompany.enabledModules.includes(m.slug),
  );

  const renderNavContent = (isMobileDrawer: boolean) => {
    const isCompact = collapsed && !isMobileDrawer;

    return (
      <div className="flex flex-col h-full bg-[#101B35] text-slate-100 border-r border-[#1F2E54] select-none">
        {/* Brand Header */}
        <div
          className={cn(
            'h-14 flex items-center border-b border-[#1F2E54] px-4 shrink-0',
            isCompact ? 'justify-center px-2' : 'justify-between',
          )}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('overview');
              if (isMobileDrawer) onCloseMobile();
            }}
            className="flex items-center gap-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169F5] rounded-md"
          >
            <div className="h-7 w-7 rounded-lg bg-[#4169F5] flex items-center justify-center font-display font-bold text-sm text-white shrink-0">
              W
            </div>
            {!isCompact && (
              <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
                WENDORO
              </span>
            )}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-[#1A294D] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:inline-flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#1A294D] cursor-pointer"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6"
        >
          {/* Layer A — Foundation */}
          <div>
            {!isCompact && (
              <div className="px-2.5 mb-2 text-[11px] font-medium text-slate-400">
                Core Platform
              </div>
            )}
            <ul className="space-y-1">
              {foundationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        if (isMobileDrawer) onCloseMobile();
                      }}
                      title={isCompact ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors cursor-pointer',
                        isCompact && 'justify-center px-0',
                        isActive
                          ? 'bg-[#4169F5] text-white'
                          : 'text-slate-300 hover:bg-[#1A294D] hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCompact && (
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Layer B — Activated Business Applications */}
          <div>
            {!isCompact && (
              <div className="px-2.5 mb-2 text-[11px] font-medium text-slate-400">
                Active Business Apps ({enabledBusinessModules.length})
              </div>
            )}
            <ul className="space-y-1">
              {enabledBusinessModules.map((mod) => {
                const Icon = MODULE_ICONS[mod.slug] ?? Boxes;
                const routeId = `module:${mod.slug}`;
                const isActive = activeRoute === routeId;
                return (
                  <li key={mod.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(routeId);
                        if (isMobileDrawer) onCloseMobile();
                      }}
                      title={isCompact ? mod.name : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors cursor-pointer',
                        isCompact && 'justify-center px-0',
                        isActive
                          ? 'bg-[#4169F5] text-white'
                          : 'text-slate-300 hover:bg-[#1A294D] hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCompact && (
                        <span className="truncate whitespace-nowrap">{mod.name}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Layer C — Active Industry Packages */}
          {enabledIndustryModules.length > 0 && (
            <div>
              {!isCompact && (
                <div className="px-2.5 mb-2 text-[11px] font-medium text-slate-400">
                  Industry Packages ({enabledIndustryModules.length})
                </div>
              )}
              <ul className="space-y-1">
                {enabledIndustryModules.map((mod) => {
                  const Icon = MODULE_ICONS[mod.slug] ?? Building2;
                  const routeId = `module:${mod.slug}`;
                  const isActive = activeRoute === routeId;
                  return (
                    <li key={mod.slug}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(routeId);
                          if (isMobileDrawer) onCloseMobile();
                        }}
                        title={isCompact ? mod.name : undefined}
                        className={cn(
                          'w-full flex items-center gap-3 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors cursor-pointer',
                          isCompact && 'justify-center px-0',
                          isActive
                            ? 'bg-[#8B5CF6] text-white'
                            : 'text-slate-300 hover:bg-[#1A294D] hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!isCompact && (
                          <span className="truncate whitespace-nowrap">{mod.name}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>

        {/* Active Context Footer */}
        {!isCompact && (
          <div className="p-3 border-t border-[#1F2E54] text-xs text-slate-400 space-y-0.5">
            <div className="font-medium text-slate-200 truncate">
              {activeCompany.companyName}
            </div>
            <div className="truncate">
              {activeCompany.roleName} · {activeCompany.baseCurrency}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Rail */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 transition-[width] duration-200',
          collapsed ? 'w-[68px]' : 'w-[260px]',
        )}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <div
            className="fixed inset-0 bg-[#101B35]/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[272px] max-w-[85vw] h-full">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
