import React, { useEffect, useState } from 'react';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export interface AppShellProps {
  activeRoute: string;
  onNavigate: (routeId: string) => void;
  breadcrumb: string[];
  children: React.ReactNode;
}

export function AppShell({
  activeRoute,
  onNavigate,
  breadcrumb,
  children,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen h-screen flex overflow-hidden bg-[#F6F8FC] dark:bg-[#0B1224] text-[#182238] dark:text-slate-100">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          breadcrumb={breadcrumb}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onNavigate={onNavigate}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-7">
          <div className="max-w-[1360px] mx-auto">{children}</div>
          <footer className="max-w-[1360px] mx-auto mt-12 pt-4 border-t border-slate-200/80 dark:border-[#223257] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#718096] dark:text-slate-400">
            <span>WENDORO ERP · Built in India for Global Business by BakeWeb</span>
            <span>Open-Source Core (Apache-2.0) · Commercial Licensing & Cloudflare Ready</span>
          </footer>
        </main>
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
