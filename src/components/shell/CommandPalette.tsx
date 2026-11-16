import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Building2,
  CloudUpload,
  Layers,
  Moon,
  Rocket,
  Search,
  Shield,
  Store,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { getMarketplaceEntry } from '@/src/core/contracts/marketplace';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { formatNumericCurrency } from '@/src/lib/utils';
import { useToast } from '@/src/components/ui/ToastProvider';
import { useErpData } from './ErpDataProvider';
import { useTheme } from './ThemeProvider';
import { useTenant } from './TenantProvider';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (routeId: string) => void;
}

export type PaletteFilterScope = 'all' | 'modules' | 'crm' | 'inventory';

export interface PaletteItem {
  id: string;
  scope: Exclude<PaletteFilterScope, 'all'> | 'actions';
  group: string;
  label: string;
  detail: string;
  searchKeywords: string;
  badge?: string;
  badgeTone?: 'red' | 'yellow' | 'neutral';
  icon: React.ReactNode;
  action: () => void;
}

export function filterCommandPaletteItems<
  T extends Pick<PaletteItem, 'scope' | 'label' | 'detail' | 'group' | 'searchKeywords'>,
>(items: T[], query: string, activeFilter: PaletteFilterScope = 'all'): T[] {
  const scoped =
    activeFilter === 'all' ? items : items.filter((item) => item.scope === activeFilter);
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return scoped;

  return scoped.filter((item) => {
    const haystack =
      `${item.label} ${item.detail} ${item.group} ${item.searchKeywords}`.toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PaletteFilterScope>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { theme, toggleTheme } = useTheme();
  const { principal, activeCompany, switchCompany, isModuleEntitled } = useTenant();
  const { data, syncState } = useErpData();
  const { pushToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveFilter('all');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const currency = activeCompany.baseCurrency;

  const items: PaletteItem[] = useMemo(() => {
    const coreViews: PaletteItem[] = [
      {
        id: 'nav-overview',
        scope: 'modules',
        group: 'Workspace',
        label: 'Dashboard Overview',
        detail: 'Live KPIs, Recharts trends, PDF/CSV export & active apps launcher',
        searchKeywords: 'dashboard home kpi export charts recharts overview',
        icon: <Layers className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('overview'),
      },
      {
        id: 'nav-bi',
        scope: 'modules',
        group: 'Workspace',
        label: 'BI & Analytics',
        detail: 'Executive profitability, customer & SKU rankings, pipeline funnel & custom reports',
        searchKeywords: 'analytics reports charts bi metrics profit',
        icon: <Layers className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('bi_analytics'),
      },
      {
        id: 'nav-workflow',
        scope: 'modules',
        group: 'Workspace',
        label: 'Workflow Studio',
        detail: 'Configure approval thresholds, custom fields across modules & audit trail',
        searchKeywords: 'workflow approvals studio audit rules custom fields',
        icon: <Shield className="h-4 w-4 text-[#F59E0B]" />,
        action: () => onNavigate('workflow_studio'),
      },
      {
        id: 'nav-marketplace',
        scope: 'modules',
        group: 'Workspace',
        label: 'Module Marketplace',
        detail: 'Browse & purchase standalone ERP modules for your business user type',
        searchKeywords: 'marketplace store buy add-ons user type modules unlock',
        badge: 'STORE',
        badgeTone: 'yellow',
        icon: <Store className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('marketplace'),
      },
      {
        id: 'nav-admin',
        scope: 'modules',
        group: 'Workspace',
        label: 'Modules & Settings',
        detail: 'Enable/disable licensed modules, manage branches, IndexedDB sync & JSON backups',
        searchKeywords: 'admin settings modules branches backup indexeddb dexie sync',
        icon: <Layers className="h-4 w-4 text-[#D97706] dark:text-[#FACC15]" />,
        action: () => onNavigate('admin'),
      },
      {
        id: 'nav-setup',
        scope: 'modules',
        group: 'Workspace',
        label: 'Company Setup & License',
        detail: 'Onboard a new company, regional tax preset & native license activation',
        searchKeywords: 'setup wizard onboarding license register key',
        icon: <Layers className="h-4 w-4 text-[#D97706] dark:text-[#FACC15]" />,
        action: () => onNavigate('setup'),
      },
      {
        id: 'nav-deploy',
        scope: 'modules',
        group: 'Workspace',
        label: 'Desktop & Android Install',
        detail: 'Native Desktop Electron (.exe/.dmg/.AppImage), Android APK & License Auth',
        searchKeywords: 'electron desktop android apk install native download',
        icon: <Rocket className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('deploy'),
      },
      {
        id: 'nav-schema',
        scope: 'modules',
        group: 'Platform Specs',
        label: 'Architecture & Database Schema',
        detail: 'PostgreSQL Drizzle definitions, IndexedDB Dexie tables & RLS specs',
        searchKeywords: 'schema database sql dexie indexeddb tables',
        icon: <Layers className="h-4 w-4 text-[#F59E0B]" />,
        action: () => onNavigate('schema'),
      },
      {
        id: 'nav-identity',
        scope: 'modules',
        group: 'Platform Specs',
        label: 'Identity & Multi-Tenancy Model',
        detail: 'Better Auth separation, RBAC matrix & tenant isolation',
        searchKeywords: 'identity rbac permissions tenancy security',
        icon: <Shield className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('identity'),
      },
    ];

    const moduleItems: PaletteItem[] = WENDORO_MODULES.filter(
      (mod) => mod.layer !== 'core',
    ).map((mod) => {
      const entitled = isModuleEntitled(mod.slug);
      const installed = entitled && activeCompany.enabledModules.includes(mod.slug);
      const listing = getMarketplaceEntry(mod.slug)?.listing;
      return {
        id: `mod-${mod.slug}`,
        scope: 'modules',
        group: mod.layer === 'business' ? 'Business Module' : 'Industry Package',
        label: mod.name,
        detail: mod.description,
        searchKeywords: `${mod.slug} ${mod.name} ${mod.schemaNamespace} ${mod.capabilities.join(' ')} ${listing?.sku ?? ''}`,
        badge: !entitled
          ? 'ADD-ON'
          : installed
            ? 'ACTIVE'
            : 'OWNED',
        badgeTone: !entitled ? 'neutral' : installed ? 'yellow' : 'neutral',
        icon: <Layers className="h-4 w-4 text-[#57534E] dark:text-stone-400" />,
        action: () => {
          onNavigate(`module:${mod.slug}`);
          if (!entitled) {
            pushToast({
              variant: 'info',
              category: 'system',
              title: `${mod.name} Requires Add-On Purchase`,
              description: 'Purchase and unlock this module directly from your workspace.',
              durationMs: 3500,
            });
          }
        },
      };
    });

    const crmItems: PaletteItem[] = data.contacts.map((contact) => ({
      id: `crm-${contact.id}`,
      scope: 'crm',
      group: 'CRM Entry',
      label: contact.organization
        ? `${contact.name} · ${contact.organization}`
        : contact.name,
      detail: `${contact.stage.toUpperCase()} · ${
        contact.email || contact.phone || contact.type
      } · Est. ${formatNumericCurrency(contact.estimatedValue, currency, 0)}`,
      searchKeywords: `${contact.name} ${contact.organization} ${contact.email} ${contact.phone} ${contact.stage} ${contact.type} ${contact.notes} crm contact lead customer vendor`,
      badge: contact.stage.toUpperCase(),
      badgeTone:
        contact.stage === 'customer'
          ? 'yellow'
          : contact.stage === 'lost'
            ? 'neutral'
            : 'red',
      icon: <Users className="h-4 w-4 text-[#DC2626]" />,
      action: () => {
        onNavigate('module:crm');
        pushToast({
          variant: 'info',
          category: 'system',
          title: `Opened CRM for ${contact.name}`,
          description: `${contact.organization || contact.type} · Stage: ${contact.stage.toUpperCase()}`,
          durationMs: 3000,
        });
      },
    }));

    const inventoryItems: PaletteItem[] = data.catalogue.map((item) => {
      const available = item.stockOnHand - item.reservedQty;
      const isLowStock = item.trackStock && available <= item.reorderLevel;
      return {
        id: `inv-${item.id}`,
        scope: 'inventory',
        group: item.trackStock ? 'Inventory SKU' : 'Catalogue Item',
        label: `${item.sku} · ${item.name}`,
        detail: `${item.category} · ${
          item.trackStock
            ? `${item.stockOnHand} ${item.unit} on hand (${available} avail.)`
            : `${item.type} item`
        } · ${formatNumericCurrency(item.sellingPrice, currency, 2)}`,
        searchKeywords: `${item.sku} ${item.name} ${item.category} ${item.type} ${item.unit} inventory stock product item`,
        badge: isLowStock
          ? 'LOW STOCK'
          : item.trackStock
            ? `${item.stockOnHand} ${item.unit}`
            : item.type.toUpperCase(),
        badgeTone: isLowStock ? 'red' : 'yellow',
        icon: isLowStock ? (
          <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
        ) : (
          <Boxes className="h-4 w-4 text-[#D97706] dark:text-[#FACC15]" />
        ),
        action: () => {
          onNavigate(item.trackStock ? 'module:inventory' : 'module:catalogue');
          pushToast({
            variant: isLowStock ? 'warning' : 'info',
            category: 'alert',
            title: `${item.sku} · ${item.name}`,
            description: item.trackStock
              ? `${available} ${item.unit} available (reorder level ${item.reorderLevel})`
              : `${item.category} · ${formatNumericCurrency(item.sellingPrice, currency, 2)}`,
            durationMs: 3500,
          });
        },
      };
    });

    const syncActionItem: PaletteItem[] =
      syncState.pendingCount > 0
        ? [
            {
              id: 'action-sync-now',
              scope: 'actions',
              group: 'Offline Sync',
              label: 'Synchronize Queued IndexedDB Changes',
              detail: `${syncState.pendingCount} pending batch(es) · ${
                syncState.isOnline ? 'Connection available — flush now' : 'Currently offline'
              }`,
              searchKeywords: 'sync offline indexeddb dexie flush queue',
              icon: <CloudUpload className="h-4 w-4 text-[#DC2626]" />,
              action: () => {
                void syncState.triggerSync();
              },
            },
          ]
        : [];

    const companyItems: PaletteItem[] = principal.memberships.map((m) => ({
      id: `company-${m.companyId}`,
      scope: 'actions',
      group: 'Switch Company',
      label: m.companyName,
      detail: `${m.companyCode} · ${m.roleName} · ${m.baseCurrency}`,
      searchKeywords: `${m.companyName} ${m.companyCode} ${m.baseCurrency} company switch`,
      icon: <Building2 className="h-4 w-4 text-[#DC2626]" />,
      action: () => switchCompany(m.companyId),
    }));

    const themeItem: PaletteItem = {
      id: 'action-theme',
      scope: 'actions',
      group: 'Preferences',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      detail: 'Toggle Crimson & Gold workspace appearance',
      searchKeywords: 'theme dark light mode appearance',
      icon:
        theme === 'dark' ? (
          <Sun className="h-4 w-4 text-[#FACC15]" />
        ) : (
          <Moon className="h-4 w-4 text-[#DC2626]" />
        ),
      action: toggleTheme,
    };

    return [
      ...crmItems,
      ...inventoryItems,
      ...moduleItems,
      ...coreViews,
      ...syncActionItem,
      ...companyItems,
      themeItem,
    ];
  }, [
    data.contacts,
    data.catalogue,
    currency,
    syncState,
    principal.memberships,
    activeCompany.enabledModules,
    isModuleEntitled,
    theme,
    onNavigate,
    switchCompany,
    toggleTheme,
    pushToast,
  ]);

  const filtered = useMemo(
    () => filterCommandPaletteItems(items, query, activeFilter).slice(0, 40),
    [items, query, activeFilter],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeFilter]);

  useEffect(() => {
    const activeEl = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      onClose();
    }
  };

  const filterTabs: Array<{ id: PaletteFilterScope; label: string; count: number }> = [
    { id: 'all', label: 'All', count: items.length },
    {
      id: 'modules',
      label: 'Modules',
      count: items.filter((i) => i.scope === 'modules').length,
    },
    { id: 'crm', label: 'CRM', count: data.contacts.length },
    { id: 'inventory', label: 'Inventory', count: data.catalogue.length },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-[#181214]/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1B1417] border border-stone-200 dark:border-[#3A2B31] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-stone-200 dark:border-[#32242A]">
          <Search className="h-4 w-4 text-[#DC2626] dark:text-[#FACC15] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules, CRM contacts, inventory SKUs, or actions..."
            className="w-full bg-transparent text-sm text-[#1C1917] dark:text-stone-100 placeholder:text-[#78716C] dark:placeholder:text-stone-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-stone-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scope Filter Tabs */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-stone-200/80 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013]">
          {filterTabs.map((t) => {
            const active = activeFilter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveFilter(t.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#DC2626] text-white'
                    : 'text-[#57534E] dark:text-stone-400 hover:bg-stone-200/70 dark:hover:bg-[#251B20]'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`font-mono text-[10px] px-1 rounded ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200/80 dark:bg-[#251B20] text-[#57534E] dark:text-stone-300'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#57534E] dark:text-stone-400">
              No matching modules, CRM contacts, or inventory items for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul ref={listRef} role="listbox" className="space-y-0.5">
              {filtered.map((item, idx) => {
                const active = idx === selectedIndex;
                const badgeClass =
                  item.badgeTone === 'red'
                    ? 'bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-red-300'
                    : item.badgeTone === 'yellow'
                      ? 'bg-[#FACC15]/25 text-[#92400E] dark:bg-[#FACC15]/15 dark:text-[#FACC15]'
                      : 'bg-stone-100 text-[#57534E] dark:bg-[#251B20] dark:text-stone-300';

                return (
                  <li key={item.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#DC2626]/8 border-l-2 border-[#DC2626] dark:bg-[#251B20] dark:border-[#FACC15]'
                          : 'border-l-2 border-transparent hover:bg-stone-50 dark:hover:bg-[#251B20]/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#1C1917] dark:text-stone-100 truncate">
                            {item.label}
                          </div>
                          <div className="text-xs text-[#57534E] dark:text-stone-400 truncate">
                            {item.detail}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${badgeClass}`}
                          >
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[11px] text-[#78716C] dark:text-stone-400 whitespace-nowrap">
                          {item.group}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-stone-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013] text-[11px] text-[#57534E] dark:text-stone-400">
          <span>Up/Down to navigate · Enter to jump</span>
          <span>Ctrl+K / Esc</span>
        </div>
      </div>
    </div>
  );
}
