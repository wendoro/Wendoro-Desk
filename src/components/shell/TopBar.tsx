import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  MapPin,
  Menu,
  Moon,
  Search,
  Sun,
  User,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useTenant } from './TenantProvider';
import { useFirebase } from './FirebaseProvider';

export interface TopBarProps {
  breadcrumb: string[];
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
  onNavigate: (routeId: string) => void;
}

export function TopBar({
  breadcrumb,
  onOpenMobileMenu,
  onOpenCommandPalette,
  onNavigate,
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signInWithGoogle, signOutUser, connectionState } = useFirebase();
  const {
    principal,
    activeCompany,
    activeBranchId,
    switchCompany,
    switchBranch,
    notifications,
    markAllNotificationsRead,
  } = useTenant();

  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setCompanyMenuOpen(false);
        setBranchMenuOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeBranch = activeCompany.branches.find((b) => b.id === activeBranchId);

  return (
    <header
      ref={containerRef}
      className="h-14 shrink-0 bg-white dark:bg-[#101B35] border-b border-slate-200 dark:border-[#223257] px-4 lg:px-6 flex items-center justify-between gap-4"
    >
      {/* Left: Mobile Menu + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 rounded-lg text-[#182238] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162342] cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          {breadcrumb.map((segment, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <React.Fragment key={`${segment}-${index}`}>
                {index > 0 && (
                  <span
                    className="text-slate-400 dark:text-slate-500 select-none"
                    aria-hidden="true"
                  >
                    /
                  </span>
                )}
                <span
                  className={
                    isLast
                      ? 'font-semibold text-[#182238] dark:text-slate-100 truncate'
                      : 'text-[#718096] dark:text-slate-400 hidden sm:inline whitespace-nowrap'
                  }
                >
                  {segment}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Context Switchers, Search, Notifications, Theme, Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Global Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Open global search and command palette"
          className="hidden md:inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-slate-200 dark:border-[#223257] bg-[#F6F8FC] dark:bg-[#0E172E] text-xs text-[#718096] dark:text-slate-400 hover:text-[#182238] dark:hover:text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search or jump...</span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]">
            Ctrl K
          </kbd>
        </button>

        {/* Company Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setCompanyMenuOpen((v) => !v);
              setBranchMenuOpen(false);
              setNotifOpen(false);
              setProfileOpen(false);
            }}
            aria-expanded={companyMenuOpen}
            className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] text-xs font-medium text-[#182238] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Building2 className="h-3.5 w-3.5 text-[#4169F5] shrink-0" />
            <span className="max-w-[130px] truncate">{activeCompany.companyName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#718096] shrink-0" />
          </button>

          {companyMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-72 rounded-xl bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257] shadow-lg p-1.5 z-30">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#718096] dark:text-slate-400">
                Switch Company Context
              </div>
              {principal.memberships.map((m) => {
                const selected = m.companyId === activeCompany.companyId;
                return (
                  <button
                    key={m.companyId}
                    type="button"
                    onClick={() => {
                      switchCompany(m.companyId);
                      setCompanyMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#182238] dark:text-slate-100 truncate">
                        {m.companyName}
                      </div>
                      <div className="text-[11px] text-[#718096] dark:text-slate-400 truncate">
                        {m.roleName} · {m.baseCurrency} · {m.industryClassification}
                      </div>
                    </div>
                    {selected && <Check className="h-4 w-4 text-[#4169F5] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Branch Selector */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => {
              setBranchMenuOpen((v) => !v);
              setCompanyMenuOpen(false);
              setNotifOpen(false);
              setProfileOpen(false);
            }}
            aria-expanded={branchMenuOpen}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] text-xs font-medium text-[#182238] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer whitespace-nowrap shrink-0"
          >
            <MapPin className="h-3.5 w-3.5 text-[#16B8A6] shrink-0" />
            <span className="max-w-[110px] truncate">
              {activeBranch ? activeBranch.code : 'All Branches'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#718096] shrink-0" />
          </button>

          {branchMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257] shadow-lg p-1.5 z-30">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#718096] dark:text-slate-400">
                Branch Filter
              </div>
              <button
                type="button"
                onClick={() => {
                  switchBranch(null);
                  setBranchMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer"
              >
                <span className="font-medium text-[#182238] dark:text-slate-100">
                  All Company Branches
                </span>
                {activeBranchId === null && (
                  <Check className="h-3.5 w-3.5 text-[#4169F5]" />
                )}
              </button>
              {activeCompany.branches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => {
                    switchBranch(branch.id);
                    setBranchMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[#182238] dark:text-slate-100 truncate">
                      {branch.name}
                    </div>
                    <div className="text-[11px] text-[#718096] dark:text-slate-400">
                      {branch.code} · {branch.city ?? branch.countryCode}
                    </div>
                  </div>
                  {activeBranchId === branch.id && (
                    <Check className="h-3.5 w-3.5 text-[#4169F5] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setCompanyMenuOpen(false);
              setBranchMenuOpen(false);
              setProfileOpen(false);
            }}
            aria-label="Open notifications"
            className="relative h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] text-[#182238] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-[#4169F5] text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-xl bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257] shadow-lg overflow-hidden z-30">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-[#223257]">
                <span className="text-xs font-semibold text-[#182238] dark:text-slate-100">
                  Notification Centre
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-[11px] font-medium text-[#4169F5] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-200/80 dark:divide-[#223257] max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 text-xs ${
                      n.isRead
                        ? 'opacity-75'
                        : 'bg-[#F6F8FC]/80 dark:bg-[#162342]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#182238] dark:text-slate-100">
                        {n.title}
                      </span>
                      <span className="text-[11px] text-[#718096] dark:text-slate-400 whitespace-nowrap">
                        {n.timestamp}
                      </span>
                    </div>
                    <p className="mt-1 text-[#718096] dark:text-slate-400 leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Light / Dark Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] text-[#182238] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((v) => !v);
              setCompanyMenuOpen(false);
              setBranchMenuOpen(false);
              setNotifOpen(false);
            }}
            aria-label="Open user profile menu"
            className="h-8 px-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer"
          >
            <div className="h-5 w-5 rounded-md bg-[#101B35] dark:bg-[#4169F5] text-white flex items-center justify-center">
              <User className="h-3 w-3" />
            </div>
            <span className="hidden xl:inline text-xs font-medium text-[#182238] dark:text-slate-100 whitespace-nowrap">
              {user?.displayName ?? principal.fullName}
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257] shadow-lg p-3 z-30 space-y-2.5">
              <div>
                <div className="text-xs font-semibold text-[#182238] dark:text-slate-100">
                  {user?.displayName ?? principal.fullName}
                </div>
                <div className="text-[11px] text-[#718096] dark:text-slate-400 truncate">
                  {user?.email ?? principal.email}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-[#223257] text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#718096] dark:text-slate-400">Active Role</span>
                  <span className="font-medium text-[#182238] dark:text-slate-100">
                    {activeCompany.roleName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096] dark:text-slate-400">Firestore</span>
                  <span className="font-medium text-[#16B8A6] capitalize">
                    {connectionState}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      void signOutUser();
                      setProfileOpen(false);
                    }}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-[#223257] text-xs font-medium text-[#182238] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#162342] cursor-pointer"
                  >
                    Sign Out of Firebase
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void signInWithGoogle();
                      setProfileOpen(false);
                    }}
                    className="w-full h-8 rounded-lg bg-[#4169F5] text-white text-xs font-medium hover:bg-[#3257DB] cursor-pointer"
                  >
                    Sign In with Google
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('identity');
                    setProfileOpen(false);
                  }}
                  className="w-full h-8 rounded-lg bg-[#F6F8FC] dark:bg-[#162342] text-xs font-medium text-[#182238] dark:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-[#1E2F57] cursor-pointer"
                >
                  Inspect Identity & RBAC
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
