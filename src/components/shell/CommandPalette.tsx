import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Layers, Moon, Rocket, Search, Shield, Sun, X } from 'lucide-react';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { useTheme } from './ThemeProvider';
import { useTenant } from './TenantProvider';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (routeId: string) => void;
}

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { principal, switchCompany } = useTenant();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const items: PaletteItem[] = useMemo(() => {
    const coreViews: PaletteItem[] = [
      {
        id: 'nav-overview',
        group: 'Workspace',
        label: 'Dashboard',
        detail: 'Live KPIs, active apps launcher, recent sales & accounting ledger',
        icon: <Layers className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('overview'),
      },
      {
        id: 'nav-bi',
        group: 'Workspace',
        label: 'BI & Analytics',
        detail: 'Executive profitability, customer & SKU rankings, pipeline funnel & custom reports',
        icon: <Layers className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('bi_analytics'),
      },
      {
        id: 'nav-workflow',
        group: 'Workspace',
        label: 'Workflow Studio',
        detail: 'Configure approval thresholds, custom fields across modules, and audit trail',
        icon: <Shield className="h-4 w-4 text-[#F59E0B]" />,
        action: () => onNavigate('workflow_studio'),
      },
      {
        id: 'nav-admin',
        group: 'Workspace',
        label: 'Modules & Settings',
        detail: 'Enable/disable modules, manage branches, JSON backups & platform specs',
        icon: <Layers className="h-4 w-4 text-[#16B8A6]" />,
        action: () => onNavigate('admin'),
      },
      {
        id: 'nav-setup',
        group: 'Workspace',
        label: 'Company Setup Wizard',
        detail: 'Onboard a new company, regional GST/currency preset & license tier',
        icon: <Layers className="h-4 w-4 text-[#16B8A6]" />,
        action: () => onNavigate('setup'),
      },
      {
        id: 'nav-deploy',
        group: 'Workspace',
        label: 'Desktop & Android Install',
        detail: 'Desktop Electron (.exe/.dmg/.AppImage), Android APK, and License Auth Server',
        icon: <Rocket className="h-4 w-4 text-[#DC2626]" />,
        action: () => onNavigate('deploy'),
      },
      {
        id: 'nav-schema',
        group: 'Platform Specs',
        label: 'Architecture & Database Schema',
        detail: 'PostgreSQL Drizzle definitions, namespaces & RLS migration 0000',
        icon: <Layers className="h-4 w-4 text-[#F59E0B]" />,
        action: () => onNavigate('schema'),
      },
      {
        id: 'nav-identity',
        group: 'Platform Specs',
        label: 'Identity & Multi-Tenancy Model',
        detail: 'Better Auth separation, RBAC matrix & tenant isolation',
        icon: <Shield className="h-4 w-4 text-[#16B8A6]" />,
        action: () => onNavigate('identity'),
      },
    ];

    const companyItems: PaletteItem[] = principal.memberships.map((m) => ({
      id: `company-${m.companyId}`,
      group: 'Switch Company Context',
      label: m.companyName,
      detail: `${m.companyCode} · ${m.roleName} · ${m.baseCurrency}`,
      icon: <Building2 className="h-4 w-4 text-[#DC2626]" />,
      action: () => switchCompany(m.companyId),
    }));

    const moduleItems: PaletteItem[] = WENDORO_MODULES.filter(
      (mod) => mod.layer !== 'core',
    ).map((mod) => ({
      id: `mod-${mod.slug}`,
      group: mod.layer === 'business' ? 'Business Applications' : 'Industry Packages',
      label: mod.name,
      detail: mod.description,
      icon: <Layers className="h-4 w-4 text-[#718096]" />,
      action: () => onNavigate(`module:${mod.slug}`),
    }));

    const themeItem: PaletteItem = {
      id: 'action-theme',
      group: 'Preferences',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      detail: 'Toggle workspace appearance',
      icon:
        theme === 'dark' ? (
          <Sun className="h-4 w-4 text-amber-500" />
        ) : (
          <Moon className="h-4 w-4 text-[#DC2626]" />
        ),
      action: toggleTheme,
    };

    return [...coreViews, ...companyItems, ...moduleItems, themeItem];
  }, [principal.memberships, theme, onNavigate, switchCompany, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-[#1B1417]/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-200 dark:border-[#32242A]">
          <Search className="h-4 w-4 text-[#718096] dark:text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to workspace view, module, or company..."
            className="w-full bg-transparent text-sm text-[#1C1917] dark:text-slate-100 placeholder:text-[#718096] dark:placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded-md text-[#718096] hover:text-[#1C1917] dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#718096] dark:text-slate-400">
              No matching commands or modules.
            </div>
          ) : (
            <ul role="listbox" className="space-y-0.5">
              {filtered.map((item, idx) => {
                const active = idx === selectedIndex;
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
                          ? 'bg-[#EFF3FA] dark:bg-[#251B20]'
                          : 'hover:bg-slate-50 dark:hover:bg-[#251B20]/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#1C1917] dark:text-slate-100 truncate">
                            {item.label}
                          </div>
                          <div className="text-xs text-[#718096] dark:text-slate-400 truncate">
                            {item.detail}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#718096] dark:text-slate-400 whitespace-nowrap shrink-0">
                        {item.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013] text-[11px] text-[#718096] dark:text-slate-400">
          <span>Use Up/Down arrows to select · Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
