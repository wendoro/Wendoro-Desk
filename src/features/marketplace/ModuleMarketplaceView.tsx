import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  FolderKanban,
  KeyRound,
  Layers,
  LifeBuoy,
  Lock,
  Megaphone,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useToast } from '@/src/components/ui/ToastProvider';
import {
  MARKETPLACE_LISTINGS,
  MarketplaceCategory,
  MarketplaceFilterScope,
  PURCHASABLE_MODULE_SLUGS,
  USER_TYPE_PROFILES,
  computeMarketplaceCartPricing,
  expandSelectionWithDependencies,
  filterMarketplaceEntries,
  getMarketplaceCatalog,
  getUserTypeProfile,
  isModulePurchasedForLicense,
} from '@/src/core/contracts/marketplace';
import { UserTypeId } from '@/src/core/contracts/tenancy';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { formatNumericCurrency } from '@/src/lib/utils';

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
  industry_retail: Store,
  industry_manufacturing: Boxes,
  industry_electronics: ShieldCheck,
  industry_realestate: Building2,
  industry_services: BookOpen,
};

export function ModuleMarketplaceView({
  onNavigate,
  highlightSlug,
}: {
  onNavigate: (routeId: string) => void;
  highlightSlug?: string;
}) {
  const {
    principal,
    activeCompany,
    activeUserType,
    licenseActivation,
    purchasedModules,
    entitledModules,
    setCompanyUserType,
    toggleCompanyModule,
    purchaseAndInstallModules,
  } = useTenant();
  const { pushToast } = useToast();

  const [currency, setCurrency] = useState<'INR' | 'USD'>(
    activeCompany.baseCurrency === 'INR' ? 'INR' : 'USD',
  );
  const [scope, setScope] = useState<MarketplaceFilterScope>('all');
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [cartSlugs, setCartSlugs] = useState<string[]>(() =>
    highlightSlug &&
    !isModulePurchasedForLicense(
      highlightSlug,
      principal.subscriptionTier,
      purchasedModules,
    )
      ? [highlightSlug]
      : [],
  );
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const catalog = useMemo(() => getMarketplaceCatalog(), []);
  const moduleNameBySlug = useMemo(
    () => new Map(WENDORO_MODULES.map((m) => [m.slug, m.name])),
    [],
  );
  const listingBySlug = useMemo(
    () => new Map(MARKETPLACE_LISTINGS.map((l) => [l.slug, l])),
    [],
  );

  const userProfile = useMemo(
    () => getUserTypeProfile(activeUserType),
    [activeUserType],
  );

  const ownedPurchasableCount = useMemo(
    () =>
      PURCHASABLE_MODULE_SLUGS.filter((slug) =>
        isModulePurchasedForLicense(slug, principal.subscriptionTier, purchasedModules),
      ).length,
    [principal.subscriptionTier, purchasedModules],
  );

  const installedCount = useMemo(
    () =>
      PURCHASABLE_MODULE_SLUGS.filter(
        (slug) =>
          activeCompany.enabledModules.includes(slug) &&
          isModulePurchasedForLicense(slug, principal.subscriptionTier, purchasedModules),
      ).length,
    [activeCompany.enabledModules, principal.subscriptionTier, purchasedModules],
  );

  // Compute Recommended Pack for active UserType
  const recommendedPackAnalysis = useMemo(() => {
    const missingFromLicense = userProfile.recommendedModules.filter(
      (slug) =>
        !isModulePurchasedForLicense(slug, principal.subscriptionTier, purchasedModules),
    );
    const expansion = expandSelectionWithDependencies(
      missingFromLicense,
      entitledModules,
    );
    const pricing = computeMarketplaceCartPricing(
      expansion.resolvedSlugs,
      currency,
      expansion.resolvedSlugs.length >= 2 ? userProfile.bundleDiscountPct : 0,
    );
    const missingInstallOnly = userProfile.recommendedModules.filter(
      (slug) =>
        isModulePurchasedForLicense(slug, principal.subscriptionTier, purchasedModules) &&
        !activeCompany.enabledModules.includes(slug),
    );
    return {
      missingFromLicense,
      resolvedPurchaseSlugs: expansion.resolvedSlugs,
      missingInstallOnly,
      pricing,
    };
  }, [
    userProfile,
    principal.subscriptionTier,
    purchasedModules,
    entitledModules,
    currency,
    activeCompany.enabledModules,
  ]);

  // Compute Cart Pricing with Dependency Expansion
  const cartExpansion = useMemo(
    () => expandSelectionWithDependencies(cartSlugs, entitledModules),
    [cartSlugs, entitledModules],
  );
  const cartDiscountPct =
    cartExpansion.resolvedSlugs.length >= 3 ? userProfile.bundleDiscountPct : 0;
  const cartPricing = useMemo(
    () =>
      computeMarketplaceCartPricing(
        cartExpansion.resolvedSlugs,
        currency,
        cartDiscountPct,
      ),
    [cartExpansion.resolvedSlugs, currency, cartDiscountPct],
  );

  const filteredEntries = useMemo(
    () =>
      filterMarketplaceEntries(catalog, {
        query,
        scope,
        category,
        userType: activeUserType,
        planTier: principal.subscriptionTier,
        purchasedModules,
      }),
    [
      catalog,
      query,
      scope,
      category,
      activeUserType,
      principal.subscriptionTier,
      purchasedModules,
    ],
  );

  const scopeCounts = useMemo(() => {
    return {
      all: catalog.length,
      recommended: catalog.filter((e) =>
        e.listing.recommendedForUserTypes.includes(activeUserType),
      ).length,
      owned: ownedPurchasableCount,
      available: catalog.length - ownedPurchasableCount,
      industry: catalog.filter((e) => e.listing.category === 'industry').length,
    };
  }, [catalog, activeUserType, ownedPurchasableCount]);

  const handleSelectUserType = (nextType: UserTypeId) => {
    setCompanyUserType(nextType);
    const nextProfile = getUserTypeProfile(nextType);
    pushToast({
      variant: 'info',
      category: 'system',
      title: `User Type: ${nextProfile.title}`,
      description: `Marketplace recommendations tailored to ${nextProfile.recommendedModules.length} core modules.`,
      durationMs: 3000,
    });
  };

  const toggleCartSlug = (slug: string) => {
    setCartSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handlePurchaseSlugs = async (
    targetSlugs: string[],
    sourceLabel: string,
    clearCartAfter = false,
  ) => {
    if (targetSlugs.length === 0) return;
    setCheckingOut(true);
    setBusySlug(targetSlugs.length === 1 ? targetSlugs[0] : 'bundle');
    try {
      const res = await purchaseAndInstallModules(targetSlugs, {
        includeDependencies: true,
        userType: activeUserType,
      });
      if (clearCartAfter) {
        setCartSlugs([]);
      } else {
        setCartSlugs((prev) => prev.filter((s) => !res.addedModules.includes(s)));
      }
      pushToast({
        variant: 'success',
        category: 'system',
        title: `${sourceLabel} Activated`,
        description: `${res.addedModules.length} module(s) purchased onto ${licenseActivation?.licenseKey ?? 'your license'} and installed locally.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        category: 'alert',
        title: 'Marketplace Purchase Failed',
        description:
          err instanceof Error ? err.message : 'Unable to complete module purchase.',
      });
    } finally {
      setBusySlug(null);
      setCheckingOut(false);
    }
  };

  const handleToggleInstallOwned = (slug: string, name: string, installed: boolean) => {
    const ok = toggleCompanyModule(slug);
    if (!ok) {
      pushToast({
        variant: 'warning',
        category: 'alert',
        title: 'Purchase Required',
        description: `Purchase ${name} before enabling it in ${activeCompany.companyName}.`,
      });
      return;
    }
    pushToast({
      variant: 'success',
      category: 'system',
      title: installed ? `${name} Uninstalled` : `${name} Installed`,
      description: installed
        ? `Removed from ${activeCompany.companyName} sidebar (still owned on your license).`
        : `Added ${name} to ${activeCompany.companyName} navigation.`,
      durationMs: 3000,
    });
  };

  const handleInstallIncludedPack = () => {
    for (const slug of recommendedPackAnalysis.missingInstallOnly) {
      toggleCompanyModule(slug);
    }
    pushToast({
      variant: 'success',
      category: 'system',
      title: 'Included Apps Installed',
      description: `Enabled ${recommendedPackAnalysis.missingInstallOnly.length} owned module(s) for ${userProfile.shortLabel}.`,
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header & License Entitlement Summary */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-stone-400 mb-1.5">
            <Store className="h-3.5 w-3.5 text-[#DC2626]" />
            <span>WENDORO App Store</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{principal.subscriptionTier.replace('_', ' ')} Plan</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[#1C1917] dark:text-stone-200">
              {licenseActivation?.licenseKey ?? 'Unbound'}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#1C1917] dark:text-stone-100">
            Module Marketplace
          </h1>
          <p className="mt-1 text-xs text-[#57534E] dark:text-stone-400 max-w-2xl">
            Every ERP module is packaged separately. Pick your business user type to get tailored app recommendations, purchase only the modules you need, and install them directly onto your license.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-stone-100 dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]">
            {(['INR', 'USD'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setCurrency(cur)}
                className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md cursor-pointer transition-colors ${
                  currency === cur
                    ? 'bg-[#DC2626] text-white'
                    : 'text-[#57534E] dark:text-stone-400 hover:text-[#1C1917] dark:hover:text-stone-100'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => onNavigate('admin')}>
            <Layers className="h-3.5 w-3.5 text-[#DC2626]" />
            Installed ({installedCount})
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('setup')}>
            <KeyRound className="h-3.5 w-3.5 text-[#D97706] dark:text-[#FACC15]" />
            License Key
          </Button>
        </div>
      </div>

      {/* Entitlement Metrics Strip (Single-Elevation Hairline Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Surface padding="md">
          <div className="text-[11px] font-medium text-[#57534E] dark:text-stone-400">
            Active User Type
          </div>
          <div className="mt-1 text-sm font-bold text-[#1C1917] dark:text-stone-100 truncate">
            {userProfile.title}
          </div>
        </Surface>
        <Surface padding="md">
          <div className="text-[11px] font-medium text-[#57534E] dark:text-stone-400">
            Licensed Modules Owned
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#DC2626] dark:text-[#FACC15]">
            {ownedPurchasableCount} / {PURCHASABLE_MODULE_SLUGS.length}
          </div>
        </Surface>
        <Surface padding="md">
          <div className="text-[11px] font-medium text-[#57534E] dark:text-stone-400">
            Active in Workspace
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#1C1917] dark:text-stone-100">
            {installedCount} Installed
          </div>
        </Surface>
        <Surface padding="md">
          <div className="text-[11px] font-medium text-[#57534E] dark:text-stone-400">
            Marketplace Add-Ons Bought
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#1C1917] dark:text-stone-100">
            {purchasedModules.length} Add-On{purchasedModules.length === 1 ? '' : 's'}
          </div>
        </Surface>
      </div>

      {/* Step A: User Type Persona Selector & Tailored Starter Bundle */}
      <Surface padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-stone-100">
              1. Choose Your Business User Type
            </h2>
            <p className="text-xs text-[#57534E] dark:text-stone-400 mt-0.5">
              Switch user type anytime to preview tailored module recommendations and pack discounts for {activeCompany.companyName}.
            </p>
          </div>
          <span className="text-xs font-mono text-[#B45309] dark:text-[#FACC15]">
            {userProfile.recommendedModules.length} recommended apps
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {USER_TYPE_PROFILES.map((profile) => {
            const selected = activeUserType === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleSelectUserType(profile.id)}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  selected
                    ? 'border-[#DC2626] bg-[#DC2626]/6 dark:bg-[#DC2626]/15 ring-1 ring-[#DC2626]/30'
                    : 'border-slate-200 dark:border-[#32242A] bg-[#FAF9F7]/60 dark:bg-[#141013] hover:border-[#DC2626]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1C1917] dark:text-stone-100">
                    {profile.title}
                  </span>
                  {selected && (
                    <CheckCircle2 className="h-4 w-4 text-[#DC2626] dark:text-[#FACC15] shrink-0" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[#57534E] dark:text-stone-400 line-clamp-2">
                  {profile.description}
                </p>
                <div className="mt-2 text-[11px] font-mono text-[#78716C] dark:text-stone-400">
                  {profile.recommendedModules.length} modules · {profile.bundleDiscountPct}% pack savings
                </div>
              </button>
            );
          })}
        </div>

        {/* Recommended Pack Summary */}
        <div className="p-4 rounded-xl border border-[#F59E0B]/40 bg-[#FAF9F7] dark:bg-[#141013] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1C1917] dark:text-stone-100">
              <Sparkles className="h-4 w-4 text-[#DC2626] dark:text-[#FACC15] shrink-0" />
              <span>Recommended Pack for {userProfile.title}</span>
              <span className="font-mono text-[11px] text-[#B45309] dark:text-[#FACC15]">
                ({userProfile.recommendedModules.length} modules)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {userProfile.recommendedModules.map((slug) => {
                const owned = isModulePurchasedForLicense(
                  slug,
                  principal.subscriptionTier,
                  purchasedModules,
                );
                return (
                  <span
                    key={slug}
                    className={`px-2 py-0.5 rounded-md border font-medium ${
                      owned
                        ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                        : 'border-amber-300 dark:border-[#FACC15]/40 bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-stone-200'
                    }`}
                  >
                    {owned ? 'Owned: ' : ''}
                    {moduleNameBySlug.get(slug) ?? slug}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {recommendedPackAnalysis.resolvedPurchaseSlugs.length > 0 ? (
              <>
                <div className="text-right">
                  <div className="text-[11px] text-[#57534E] dark:text-stone-400">
                    {recommendedPackAnalysis.resolvedPurchaseSlugs.length} missing module(s)
                    {recommendedPackAnalysis.pricing.discountAmount > 0 &&
                      ` · Save ${formatNumericCurrency(recommendedPackAnalysis.pricing.discountAmount, currency, 0)}`}
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#DC2626] dark:text-[#FACC15]">
                    {formatNumericCurrency(recommendedPackAnalysis.pricing.total, currency, 0)}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={checkingOut}
                  onClick={() =>
                    void handlePurchaseSlugs(
                      recommendedPackAnalysis.resolvedPurchaseSlugs,
                      `${userProfile.shortLabel} Pack`,
                    )
                  }
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {busySlug === 'bundle'
                    ? 'Activating Pack...'
                    : 'Buy & Install Missing Pack'}
                </Button>
              </>
            ) : recommendedPackAnalysis.missingInstallOnly.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={handleInstallIncludedPack}>
                <Plus className="h-3.5 w-3.5" />
                Install {recommendedPackAnalysis.missingInstallOnly.length} Owned App(s)
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                All Recommended Apps Installed
              </span>
            )}
          </div>
        </div>
      </Surface>

      {/* Step B: Filter & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All Modules (${scopeCounts.all})` },
              { id: 'recommended', label: `For ${userProfile.shortLabel} (${scopeCounts.recommended})` },
              { id: 'owned', label: `Owned (${scopeCounts.owned})` },
              { id: 'available', label: `Add-Ons (${scopeCounts.available})` },
              { id: 'industry', label: `Industry Verticals (${scopeCounts.industry})` },
            ] as const
          ).map((tab) => {
            const active = scope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScope(tab.id)}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] text-[#57534E] dark:text-stone-300 hover:border-[#DC2626]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by module category"
            value={category}
            onChange={(e) => setCategory(e.target.value as MarketplaceCategory | 'all')}
            className="h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] text-[#1C1917] dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
          >
            <option value="all">All Categories</option>
            <option value="commerce">Operations &amp; Commerce</option>
            <option value="finance_hr">Finance &amp; People</option>
            <option value="customer_ops">Customer &amp; Growth</option>
            <option value="industry">Industry Verticals</option>
          </select>

          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="h-3.5 w-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search module, capability, or SKU..."
              className="w-full h-9 pl-8 pr-3 rounded-lg text-xs bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] text-[#1C1917] dark:text-stone-100 placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
            />
          </div>
        </div>
      </div>

      {/* Step C: Standalone Module Marketplace Cards */}
      {filteredEntries.length === 0 ? (
        <Surface padding="lg" className="text-center py-12 space-y-2">
          <div className="text-sm font-semibold text-[#1C1917] dark:text-stone-100">
            No modules match your current filter
          </div>
          <p className="text-xs text-[#57534E] dark:text-stone-400">
            Try clearing the search query or switching to All Modules.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setScope('all');
                setCategory('all');
                setQuery('');
              }}
            >
              Reset Marketplace Filters
            </Button>
          </div>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEntries.map(({ listing, module }) => {
            const Icon = MODULE_ICONS[module.slug] ?? Boxes;
            const owned = isModulePurchasedForLicense(
              module.slug,
              principal.subscriptionTier,
              purchasedModules,
            );
            const purchasedAsAddon = purchasedModules.includes(module.slug);
            const installed = owned && activeCompany.enabledModules.includes(module.slug);
            const isRecommended = listing.recommendedForUserTypes.includes(activeUserType);
            const inCart = cartSlugs.includes(module.slug);
            const isHighlighted = highlightSlug === module.slug;
            const priceValue =
              currency === 'INR' ? listing.priceInr : listing.priceUsd;
            const depsExpansion = expandSelectionWithDependencies(
              [module.slug],
              entitledModules,
            );

            return (
              <Surface
                key={module.slug}
                padding="md"
                className={`flex flex-col justify-between gap-4 transition-colors ${
                  isHighlighted
                    ? 'border-[#DC2626] ring-1 ring-[#DC2626]/40'
                    : installed
                      ? 'border-slate-300 dark:border-[#46333B]'
                      : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${
                          owned
                            ? 'bg-[#DC2626]/10 border-[#DC2626]/20 text-[#DC2626]'
                            : 'bg-[#FAF9F7] dark:bg-[#141013] border-slate-200 dark:border-[#32242A] text-[#57534E] dark:text-stone-300'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#1C1917] dark:text-stone-100 truncate">
                          {module.name}
                        </div>
                        <div className="text-[11px] font-mono text-[#78716C] dark:text-stone-400">
                          {listing.sku} · {listing.categoryLabel}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {owned ? (
                        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {purchasedAsAddon ? 'Purchased' : 'In Plan'}
                        </div>
                      ) : (
                        <div className="text-sm font-bold font-mono tabular-nums text-[#DC2626] dark:text-[#FACC15]">
                          {formatNumericCurrency(priceValue, currency, 0)}
                        </div>
                      )}
                      <div className="text-[10px] text-[#78716C] dark:text-stone-400">
                        {owned ? (installed ? 'Installed' : 'Ready') : 'One-Time Add-On'}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#57534E] dark:text-stone-400 leading-relaxed">
                    {listing.tagline}
                  </p>

                  {/* Capabilities */}
                  <ul className="space-y-1">
                    {module.capabilities.slice(0, 3).map((cap) => (
                      <li
                        key={cap}
                        className="flex items-start gap-1.5 text-[11px] text-[#1C1917] dark:text-stone-300"
                      >
                        <Check className="h-3.5 w-3.5 text-[#D97706] dark:text-[#FACC15] shrink-0 mt-0.5" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Persona Match & Dependencies */}
                  <div className="space-y-1 pt-1 text-[11px]">
                    {isRecommended && (
                      <div className="font-medium text-[#B45309] dark:text-[#FACC15]">
                        Recommended for {userProfile.shortLabel}
                      </div>
                    )}
                    {!owned && depsExpansion.addedDependencies.length > 0 && (
                      <div className="text-[#57534E] dark:text-stone-400">
                        Auto-includes prerequisite(s):{' '}
                        <span className="font-medium text-[#1C1917] dark:text-stone-200">
                          {depsExpansion.addedDependencies
                            .map((d) => moduleNameBySlug.get(d) ?? d)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-[#32242A] flex items-center justify-between gap-2">
                  {owned ? (
                    installed ? (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onNavigate(`module:${module.slug}`)}
                        >
                          Open App
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleToggleInstallOwned(module.slug, module.name, true)
                          }
                        >
                          Uninstall
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            handleToggleInstallOwned(module.slug, module.name, false)
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Install in Company
                        </Button>
                        <span className="text-[11px] font-mono text-[#78716C] dark:text-stone-400">
                          Licensed
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <Button
                        variant={inCart ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={checkingOut}
                        onClick={() => toggleCartSlug(module.slug)}
                      >
                        {inCart ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            In Cart
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Add to Cart
                          </>
                        )}
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        disabled={checkingOut}
                        onClick={() =>
                          void handlePurchaseSlugs([module.slug], module.name)
                        }
                      >
                        <Lock className="h-3.5 w-3.5" />
                        {busySlug === module.slug ? 'Unlocking...' : 'Buy & Install'}
                      </Button>
                    </>
                  )}
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      {/* Interactive Cart & Multi-Module Checkout Bar */}
      {cartSlugs.length > 0 && (
        <Surface
          padding="md"
          className="sticky bottom-4 z-30 border-[#DC2626] dark:border-[#FACC15]/60 shadow-xl bg-white/95 dark:bg-[#1B1417]/95 backdrop-blur-sm"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#1C1917] dark:text-stone-100">
                <ShoppingCart className="h-4 w-4 text-[#DC2626] dark:text-[#FACC15]" />
                <span>
                  Marketplace Cart ({cartSlugs.length} selected
                  {cartExpansion.addedDependencies.length > 0
                    ? ` + ${cartExpansion.addedDependencies.length} required dependency`
                    : ''}
                  )
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {cartExpansion.resolvedSlugs.map((slug) => {
                  const isDep = cartExpansion.addedDependencies.includes(slug);
                  const entry = listingBySlug.get(slug);
                  const price =
                    currency === 'INR' ? entry?.priceInr ?? 0 : entry?.priceUsd ?? 0;
                  return (
                    <span
                      key={slug}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013] text-[#1C1917] dark:text-stone-200"
                    >
                      <span>
                        {moduleNameBySlug.get(slug) ?? slug}
                        {isDep ? ' (req.)' : ''}
                      </span>
                      <span className="font-mono text-[#DC2626] dark:text-[#FACC15]">
                        {formatNumericCurrency(price, currency, 0)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="text-right">
                {cartPricing.discountAmount > 0 && (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                    Bundle {cartDiscountPct}% Off (-
                    {formatNumericCurrency(cartPricing.discountAmount, currency, 0)})
                  </div>
                )}
                <div className="text-base font-bold font-mono tabular-nums text-[#1C1917] dark:text-stone-100">
                  Total: {formatNumericCurrency(cartPricing.total, currency, 0)}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={checkingOut}
                onClick={() => setCartSlugs([])}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={checkingOut}
                onClick={() =>
                  void handlePurchaseSlugs(
                    cartExpansion.resolvedSlugs,
                    `${cartExpansion.resolvedSlugs.length} Marketplace Modules`,
                    true,
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                {checkingOut ? 'Processing License...' : 'Complete Purchase & Install'}
              </Button>
            </div>
          </div>
        </Surface>
      )}
    </div>
  );
}
