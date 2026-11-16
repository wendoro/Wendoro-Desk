import { SubscriptionTier, UserTypeId } from './tenancy';
import { ModuleDefinition, WENDORO_MODULES } from '../registry/modules';

export type MarketplaceCategory =
  | 'commerce'
  | 'finance_hr'
  | 'customer_ops'
  | 'industry';

export type MarketplaceFilterScope =
  | 'all'
  | 'recommended'
  | 'owned'
  | 'available'
  | 'industry';

export interface UserTypeProfile {
  id: UserTypeId;
  title: string;
  shortLabel: string;
  industryClassification: string;
  description: string;
  recommendedModules: string[];
  bundleDiscountPct: number;
}

export interface MarketplaceModuleListing {
  slug: string;
  sku: string;
  category: MarketplaceCategory;
  categoryLabel: string;
  priceInr: number;
  priceUsd: number;
  recommendedForUserTypes: UserTypeId[];
  tagline: string;
}

export const PURCHASABLE_MODULE_SLUGS = [
  'catalogue',
  'crm',
  'sales',
  'purchase',
  'inventory',
  'accounting',
  'hrms',
  'projects',
  'marketing',
  'support',
  'documents',
  'industry_retail',
  'industry_manufacturing',
  'industry_electronics',
  'industry_realestate',
  'industry_services',
] as const;

export type PurchasableModuleSlug = (typeof PURCHASABLE_MODULE_SLUGS)[number];

export const CORE_PLATFORM_MODULE_SLUGS = [
  'core_identity',
  'core_rbac',
  'core_connect',
  'core_ai',
  'bi_analytics',
  'workflow_studio',
] as const;

export const USER_TYPE_PROFILES: UserTypeProfile[] = [
  {
    id: 'retail_pos',
    title: 'Retail & POS Merchant',
    shortLabel: 'Retail & POS',
    industryClassification: 'Retail & Distribution',
    description:
      'Built for shops, showrooms, and multi-store retail counters needing POS registers, barcode catalogue, billing, stock, and GST ledger.',
    recommendedModules: [
      'catalogue',
      'crm',
      'sales',
      'inventory',
      'accounting',
      'industry_retail',
    ],
    bundleDiscountPct: 15,
  },
  {
    id: 'wholesale_dist',
    title: 'Wholesale & Distribution',
    shortLabel: 'Wholesale & Supply',
    industryClassification: 'Wholesale & Supply Chain',
    description:
      'Designed for distributors and trading houses managing supplier RFQs, purchase orders, multi-warehouse stock transfers, and B2B receivables.',
    recommendedModules: [
      'catalogue',
      'crm',
      'sales',
      'purchase',
      'inventory',
      'accounting',
    ],
    bundleDiscountPct: 15,
  },
  {
    id: 'manufacturer',
    title: 'Manufacturer & Assembly',
    shortLabel: 'Manufacturing',
    industryClassification: 'Manufacturing & Hardware',
    description:
      'Tailored for factories and hardware assemblers running multi-level BOMs, shop-floor work orders, procurement, and RMA service.',
    recommendedModules: [
      'catalogue',
      'purchase',
      'inventory',
      'accounting',
      'industry_manufacturing',
      'industry_electronics',
    ],
    bundleDiscountPct: 15,
  },
  {
    id: 'services_agency',
    title: 'Services, Agency & Consulting',
    shortLabel: 'Services & Agency',
    industryClassification: 'Professional Services',
    description:
      'Crafted for consulting teams, agencies, and IT firms tracking client CRM, project tasks, timesheets, retainers, payroll, and contracts.',
    recommendedModules: [
      'crm',
      'sales',
      'projects',
      'accounting',
      'hrms',
      'documents',
      'industry_services',
    ],
    bundleDiscountPct: 15,
  },
  {
    id: 'real_estate_ops',
    title: 'Real Estate & Property Ops',
    shortLabel: 'Real Estate',
    industryClassification: 'Real Estate & Leasing',
    description:
      'Purpose-built for property managers and developers tracking unit inventory, lease contracts, rent schedules, support tickets, and accounting.',
    recommendedModules: [
      'crm',
      'accounting',
      'documents',
      'support',
      'industry_realestate',
    ],
    bundleDiscountPct: 15,
  },
  {
    id: 'enterprise_all',
    title: 'Multi-Division Enterprise',
    shortLabel: 'Full Enterprise',
    industryClassification: 'Multi-Operations Enterprise',
    description:
      'Full cross-functional suite combining finance, supply chain, manufacturing, CRM, marketing automation, HRMS, and support.',
    recommendedModules: [...PURCHASABLE_MODULE_SLUGS],
    bundleDiscountPct: 20,
  },
];

/**
 * Modules included automatically with each base license plan.
 * Any module outside the user's base plan can be purchased separately from the Marketplace.
 */
export const TIER_INCLUDED_MODULES: Record<SubscriptionTier, string[]> = {
  free: ['catalogue', 'crm', 'accounting'],
  starter: ['catalogue', 'crm', 'sales', 'purchase', 'inventory', 'accounting'],
  business: [
    'catalogue',
    'crm',
    'sales',
    'purchase',
    'inventory',
    'accounting',
    'hrms',
    'projects',
    'marketing',
    'support',
    'documents',
  ],
  professional: [...PURCHASABLE_MODULE_SLUGS],
  enterprise: [...PURCHASABLE_MODULE_SLUGS],
  white_label: [...PURCHASABLE_MODULE_SLUGS],
  self_hosted: [...PURCHASABLE_MODULE_SLUGS],
};

export const MARKETPLACE_LISTINGS: MarketplaceModuleListing[] = [
  {
    slug: 'catalogue',
    sku: 'MOD-CAT',
    category: 'commerce',
    categoryLabel: 'Operations & Commerce',
    priceInr: 499,
    priceUsd: 7,
    recommendedForUserTypes: ['retail_pos', 'wholesale_dist', 'manufacturer', 'enterprise_all'],
    tagline: 'Unified SKU catalog for physical stock, services, bundles, and tax classifications.',
  },
  {
    slug: 'crm',
    sku: 'MOD-CRM',
    category: 'customer_ops',
    categoryLabel: 'Customer & Growth',
    priceInr: 799,
    priceUsd: 10,
    recommendedForUserTypes: [
      'retail_pos',
      'wholesale_dist',
      'services_agency',
      'real_estate_ops',
      'enterprise_all',
    ],
    tagline: 'Lead scoring, Kanban opportunity pipelines, customer accounts, and follow-up timeline.',
  },
  {
    slug: 'sales',
    sku: 'MOD-SLS',
    category: 'commerce',
    categoryLabel: 'Operations & Commerce',
    priceInr: 1199,
    priceUsd: 15,
    recommendedForUserTypes: ['retail_pos', 'wholesale_dist', 'services_agency', 'enterprise_all'],
    tagline: 'Quotes, sales orders, tax invoicing, payment allocations, and customer credit notes.',
  },
  {
    slug: 'purchase',
    sku: 'MOD-PRC',
    category: 'commerce',
    categoryLabel: 'Operations & Commerce',
    priceInr: 1199,
    priceUsd: 15,
    recommendedForUserTypes: ['wholesale_dist', 'manufacturer', 'enterprise_all'],
    tagline: 'Purchase requisitions, RFQs, approval-gated POs, GRN receipts, and supplier bills.',
  },
  {
    slug: 'inventory',
    sku: 'MOD-INV',
    category: 'commerce',
    categoryLabel: 'Operations & Commerce',
    priceInr: 1299,
    priceUsd: 16,
    recommendedForUserTypes: ['retail_pos', 'wholesale_dist', 'manufacturer', 'enterprise_all'],
    tagline: 'Multi-warehouse immutable stock ledger, transfers, batch/serial tracking, and valuation.',
  },
  {
    slug: 'accounting',
    sku: 'MOD-ACC',
    category: 'finance_hr',
    categoryLabel: 'Finance & People',
    priceInr: 1499,
    priceUsd: 19,
    recommendedForUserTypes: [
      'retail_pos',
      'wholesale_dist',
      'manufacturer',
      'services_agency',
      'real_estate_ops',
      'enterprise_all',
    ],
    tagline: 'Double-entry GL, trial balance, financial statements, fixed assets, and AP/AR aging.',
  },
  {
    slug: 'hrms',
    sku: 'MOD-HRM',
    category: 'finance_hr',
    categoryLabel: 'Finance & People',
    priceInr: 1299,
    priceUsd: 16,
    recommendedForUserTypes: ['services_agency', 'manufacturer', 'enterprise_all'],
    tagline: 'Employee records, attendance logs, leave workflows, recruitment, and monthly payroll posting.',
  },
  {
    slug: 'projects',
    sku: 'MOD-PRJ',
    category: 'customer_ops',
    categoryLabel: 'Customer & Growth',
    priceInr: 999,
    priceUsd: 12,
    recommendedForUserTypes: ['services_agency', 'enterprise_all'],
    tagline: 'Milestones, Kanban execution boards, billable timesheets, and project budgets.',
  },
  {
    slug: 'marketing',
    sku: 'MOD-MKT',
    category: 'customer_ops',
    categoryLabel: 'Customer & Growth',
    priceInr: 899,
    priceUsd: 11,
    recommendedForUserTypes: ['retail_pos', 'services_agency', 'enterprise_all'],
    tagline: 'Omnichannel email, WhatsApp & SMS campaign builder with attribution tracking.',
  },
  {
    slug: 'support',
    sku: 'MOD-SUP',
    category: 'customer_ops',
    categoryLabel: 'Customer & Growth',
    priceInr: 899,
    priceUsd: 11,
    recommendedForUserTypes: ['real_estate_ops', 'services_agency', 'enterprise_all'],
    tagline: 'Priority SLA helpdesk tickets, resolution workflows, and offline knowledge base.',
  },
  {
    slug: 'documents',
    sku: 'MOD-DOC',
    category: 'finance_hr',
    categoryLabel: 'Finance & People',
    priceInr: 699,
    priceUsd: 9,
    recommendedForUserTypes: ['services_agency', 'real_estate_ops', 'enterprise_all'],
    tagline: 'Versioned contracts, e-signature logs, expiry alerts, and PDF templates.',
  },
  {
    slug: 'industry_retail',
    sku: 'IND-RTL',
    category: 'industry',
    categoryLabel: 'Industry Verticals',
    priceInr: 1799,
    priceUsd: 22,
    recommendedForUserTypes: ['retail_pos', 'enterprise_all'],
    tagline: 'POS register shifts, retail storefront sync, customer loyalty, and shipping fulfilment.',
  },
  {
    slug: 'industry_manufacturing',
    sku: 'IND-MFG',
    category: 'industry',
    categoryLabel: 'Industry Verticals',
    priceInr: 2299,
    priceUsd: 29,
    recommendedForUserTypes: ['manufacturer', 'enterprise_all'],
    tagline: 'Multi-level Bills of Materials, shop-floor work orders, QC checks, and conversion costing.',
  },
  {
    slug: 'industry_electronics',
    sku: 'IND-ELC',
    category: 'industry',
    categoryLabel: 'Industry Verticals',
    priceInr: 1799,
    priceUsd: 22,
    recommendedForUserTypes: ['manufacturer', 'retail_pos', 'enterprise_all'],
    tagline: 'IMEI & serial warranty lifecycle, RMA repair tickets, and spare parts allocation.',
  },
  {
    slug: 'industry_realestate',
    sku: 'IND-RES',
    category: 'industry',
    categoryLabel: 'Industry Verticals',
    priceInr: 1999,
    priceUsd: 25,
    recommendedForUserTypes: ['real_estate_ops', 'enterprise_all'],
    tagline: 'Property units, tenant lease agreements, rent billing schedules, and broker commissions.',
  },
  {
    slug: 'industry_services',
    sku: 'IND-SVC',
    category: 'industry',
    categoryLabel: 'Industry Verticals',
    priceInr: 1699,
    priceUsd: 21,
    recommendedForUserTypes: ['services_agency', 'enterprise_all'],
    tagline: 'Client retainers, milestone invoicing, team utilization, and delivery tracking.',
  },
];

export interface MarketplaceCatalogEntry {
  listing: MarketplaceModuleListing;
  module: ModuleDefinition;
}

export function getMarketplaceCatalog(): MarketplaceCatalogEntry[] {
  const bySlug = new Map(WENDORO_MODULES.map((m) => [m.slug, m]));
  return MARKETPLACE_LISTINGS.flatMap((listing) => {
    const mod = bySlug.get(listing.slug);
    return mod ? [{ listing, module: mod }] : [];
  });
}

export function getMarketplaceEntry(slug: string): MarketplaceCatalogEntry | undefined {
  const listing = MARKETPLACE_LISTINGS.find((l) => l.slug === slug);
  const mod = WENDORO_MODULES.find((m) => m.slug === slug);
  if (!listing || !mod) return undefined;
  return { listing, module: mod };
}

export function normalizePurchasedModules(slugs?: string[]): string[] {
  if (!Array.isArray(slugs)) return [];
  const allowed = new Set<string>(PURCHASABLE_MODULE_SLUGS);
  return Array.from(
    new Set(
      slugs
        .map((s) => String(s).trim())
        .filter((s) => allowed.has(s)),
    ),
  );
}

export function getEntitledModulesForLicense(
  planTier: SubscriptionTier,
  purchasedModules?: string[],
): string[] {
  const tierModules = TIER_INCLUDED_MODULES[planTier] ?? TIER_INCLUDED_MODULES.free;
  const bought = normalizePurchasedModules(purchasedModules);
  return Array.from(
    new Set([
      ...CORE_PLATFORM_MODULE_SLUGS,
      ...tierModules,
      ...bought,
    ]),
  );
}

export function isModulePurchasedForLicense(
  slug: string,
  planTier: SubscriptionTier,
  purchasedModules?: string[],
): boolean {
  if ((CORE_PLATFORM_MODULE_SLUGS as readonly string[]).includes(slug)) {
    return true;
  }
  const tierModules = TIER_INCLUDED_MODULES[planTier] ?? TIER_INCLUDED_MODULES.free;
  if (tierModules.includes(slug)) {
    return true;
  }
  return normalizePurchasedModules(purchasedModules).includes(slug);
}

/**
 * Resolves transitive purchasable module dependencies (ignoring always-on core_* primitives)
 * so buying an app like Sales or Manufacturing automatically shows/includes required prerequisites.
 */
export function resolveTransitiveModuleDependencies(slug: string): string[] {
  const bySlug = new Map(WENDORO_MODULES.map((m) => [m.slug, m]));
  const purchasable = new Set<string>(PURCHASABLE_MODULE_SLUGS);
  const visited = new Set<string>();
  const ordered: string[] = [];

  const visit = (currentSlug: string) => {
    const mod = bySlug.get(currentSlug);
    if (!mod) return;
    for (const dep of mod.dependencies) {
      if (!purchasable.has(dep) || visited.has(dep)) continue;
      visited.add(dep);
      visit(dep);
      ordered.push(dep);
    }
  };

  visit(slug);
  return ordered;
}

export function expandSelectionWithDependencies(
  selectedSlugs: string[],
  alreadyEntitledSlugs: string[],
): {
  resolvedSlugs: string[];
  addedDependencies: string[];
} {
  const entitledSet = new Set(alreadyEntitledSlugs);
  const purchasable = new Set<string>(PURCHASABLE_MODULE_SLUGS);
  const resolved = new Set<string>();
  const addedDeps = new Set<string>();

  for (const raw of selectedSlugs) {
    if (!purchasable.has(raw)) continue;
    const deps = resolveTransitiveModuleDependencies(raw);
    for (const dep of deps) {
      if (!entitledSet.has(dep)) {
        resolved.add(dep);
        if (!selectedSlugs.includes(dep)) {
          addedDeps.add(dep);
        }
      }
    }
    if (!entitledSet.has(raw)) {
      resolved.add(raw);
    }
  }

  return {
    resolvedSlugs: Array.from(resolved),
    addedDependencies: Array.from(addedDeps),
  };
}

export function computeMarketplaceCartPricing(
  moduleSlugs: string[],
  currency: 'INR' | 'USD',
  discountPct = 0,
): {
  items: MarketplaceModuleListing[];
  subtotal: number;
  discountAmount: number;
  total: number;
} {
  const bySlug = new Map(MARKETPLACE_LISTINGS.map((l) => [l.slug, l]));
  const unique = Array.from(new Set(moduleSlugs));
  const items = unique.flatMap((slug) => {
    const entry = bySlug.get(slug);
    return entry ? [entry] : [];
  });
  const subtotal = items.reduce(
    (sum, item) => sum + (currency === 'INR' ? item.priceInr : item.priceUsd),
    0,
  );
  const safeDiscount = Math.max(0, Math.min(50, discountPct));
  const discountAmount = Math.round((subtotal * safeDiscount) / 100);
  return {
    items,
    subtotal,
    discountAmount,
    total: Math.max(0, subtotal - discountAmount),
  };
}

export function getUserTypeProfile(userType?: UserTypeId): UserTypeProfile {
  return USER_TYPE_PROFILES.find((p) => p.id === userType) ?? USER_TYPE_PROFILES[0];
}

export function inferUserTypeFromIndustry(industryClassification?: string): UserTypeId {
  const text = (industryClassification ?? '').toLowerCase();
  if (text.includes('retail') || text.includes('pos') || text.includes('store')) {
    return 'retail_pos';
  }
  if (text.includes('wholesale') || text.includes('dist') || text.includes('supply')) {
    return 'wholesale_dist';
  }
  if (text.includes('manufactur') || text.includes('hardware') || text.includes('factory')) {
    return 'manufacturer';
  }
  if (text.includes('service') || text.includes('agency') || text.includes('consult')) {
    return 'services_agency';
  }
  if (text.includes('real estate') || text.includes('property') || text.includes('lease')) {
    return 'real_estate_ops';
  }
  if (text.includes('enterprise') || text.includes('multi')) {
    return 'enterprise_all';
  }
  return 'retail_pos';
}

export function filterMarketplaceEntries(
  entries: MarketplaceCatalogEntry[],
  params: {
    query: string;
    scope: MarketplaceFilterScope;
    category: MarketplaceCategory | 'all';
    userType: UserTypeId;
    planTier: SubscriptionTier;
    purchasedModules: string[];
  },
): MarketplaceCatalogEntry[] {
  const tokens = params.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return entries.filter(({ listing, module }) => {
    if (params.category !== 'all' && listing.category !== params.category) {
      return false;
    }

    const owned = isModulePurchasedForLicense(
      listing.slug,
      params.planTier,
      params.purchasedModules,
    );
    const recommended = listing.recommendedForUserTypes.includes(params.userType);

    if (params.scope === 'recommended' && !recommended) return false;
    if (params.scope === 'owned' && !owned) return false;
    if (params.scope === 'available' && owned) return false;
    if (params.scope === 'industry' && listing.category !== 'industry') return false;

    if (tokens.length === 0) return true;

    const haystack = [
      module.name,
      module.slug,
      module.description,
      listing.sku,
      listing.tagline,
      listing.categoryLabel,
      ...module.capabilities,
    ]
      .join(' ')
      .toLowerCase();

    return tokens.every((tok) => haystack.includes(tok));
  });
}
