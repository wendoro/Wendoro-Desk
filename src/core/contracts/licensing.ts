import { SubscriptionTier } from './tenancy';

export type LicenseEdition = 'open_source' | 'commercial' | 'oem_self_hosted';

export interface LicensePlanDefinition {
  tier: SubscriptionTier;
  name: string;
  edition: LicenseEdition;
  targetSegment: string;
  monthlyPriceUsd: string;
  monthlyPriceInr: string;
  maxUsers: number;
  maxCompanies: number;
  maxBranches: number;
  storageLimitMb: number;
  monthlyAiTokens: number;
  ssoEnabled: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  highlights: string[];
}

/**
 * Canonical Open-Source + Commercial License Catalog.
 * Prices are stored as exact decimal strings (PostgreSQL NUMERIC(19, 4) compatible).
 */
export const WENDORO_LICENSE_PLANS: LicensePlanDefinition[] = [
  {
    tier: 'free',
    name: 'Community Open Source',
    edition: 'open_source',
    targetSegment: 'Self-hosters & solo teams',
    monthlyPriceUsd: '0.0000',
    monthlyPriceInr: '0.0000',
    maxUsers: 5,
    maxCompanies: 1,
    maxBranches: 2,
    storageLimitMb: 2048,
    monthlyAiTokens: 50_000,
    ssoEnabled: false,
    customDomain: false,
    whiteLabel: false,
    highlights: ['Apache-2.0 Core', '1 Company · 2 Branches', 'Core CRM, Catalogue & Ledger'],
  },
  {
    tier: 'starter',
    name: 'Starter',
    edition: 'commercial',
    targetSegment: 'Small Indian & global teams',
    monthlyPriceUsd: '29.0000',
    monthlyPriceInr: '1999.0000',
    maxUsers: 15,
    maxCompanies: 1,
    maxBranches: 5,
    storageLimitMb: 10240,
    monthlyAiTokens: 250_000,
    ssoEnabled: false,
    customDomain: false,
    whiteLabel: false,
    highlights: ['GST & Multi-Currency', 'Sales, Purchase & Inventory', 'Email Support'],
  },
  {
    tier: 'business',
    name: 'Business',
    edition: 'commercial',
    targetSegment: 'Scaling multi-branch SMEs',
    monthlyPriceUsd: '99.0000',
    monthlyPriceInr: '6999.0000',
    maxUsers: 50,
    maxCompanies: 3,
    maxBranches: 20,
    storageLimitMb: 51200,
    monthlyAiTokens: 1_000_000,
    ssoEnabled: false,
    customDomain: true,
    whiteLabel: false,
    highlights: ['3 Companies · 20 Branches', 'HRMS, Payroll & E-Invoice', 'WENDORO Connect'],
  },
  {
    tier: 'professional',
    name: 'Professional',
    edition: 'commercial',
    targetSegment: 'Multi-company groups',
    monthlyPriceUsd: '249.0000',
    monthlyPriceInr: '17999.0000',
    maxUsers: 200,
    maxCompanies: 10,
    maxBranches: 100,
    storageLimitMb: 204800,
    monthlyAiTokens: 5_000_000,
    ssoEnabled: true,
    customDomain: true,
    whiteLabel: false,
    highlights: ['10 Companies · SSO/SAML', 'Industry Packages', 'Visual Workflow Engine'],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    edition: 'commercial',
    targetSegment: 'Global enterprises',
    monthlyPriceUsd: '799.0000',
    monthlyPriceInr: '59999.0000',
    maxUsers: 1000,
    maxCompanies: 50,
    maxBranches: 500,
    storageLimitMb: 1048576,
    monthlyAiTokens: 25_000_000,
    ssoEnabled: true,
    customDomain: true,
    whiteLabel: false,
    highlights: ['50 Companies · Custom App Builder', 'Dedicated AI Quotas', '7-Year Audit Retention'],
  },
  {
    tier: 'white_label',
    name: 'White Label',
    edition: 'oem_self_hosted',
    targetSegment: 'SaaS partners & agencies',
    monthlyPriceUsd: '1499.0000',
    monthlyPriceInr: '119999.0000',
    maxUsers: 5000,
    maxCompanies: 250,
    maxBranches: 2500,
    storageLimitMb: 4194304,
    monthlyAiTokens: 100_000_000,
    ssoEnabled: true,
    customDomain: true,
    whiteLabel: true,
    highlights: ['Full Brand & Domain Control', 'Multi-Tenant Reseller Console', 'Priority SLA'],
  },
  {
    tier: 'self_hosted',
    name: 'Self-Hosted Enterprise',
    edition: 'oem_self_hosted',
    targetSegment: 'On-premise & sovereign cloud',
    monthlyPriceUsd: '499.0000',
    monthlyPriceInr: '39999.0000',
    maxUsers: 2000,
    maxCompanies: 100,
    maxBranches: 1000,
    storageLimitMb: 2097152,
    monthlyAiTokens: 0,
    ssoEnabled: true,
    customDomain: true,
    whiteLabel: true,
    highlights: ['Air-Gapped Linux / Docker', 'Bring-Your-Own AI Keys', 'Signed License Key'],
  },
];

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkQuotaEntitlement(
  tier: SubscriptionTier,
  metric: 'users' | 'companies' | 'branches',
  requestedTotal: number,
): EntitlementCheckResult {
  const plan = WENDORO_LICENSE_PLANS.find((p) => p.tier === tier);
  if (!plan) {
    return { allowed: false, reason: `Unknown subscription tier: ${tier}` };
  }

  const limit =
    metric === 'users'
      ? plan.maxUsers
      : metric === 'companies'
        ? plan.maxCompanies
        : plan.maxBranches;

  if (requestedTotal > limit) {
    return {
      allowed: false,
      reason: `Plan "${plan.name}" allows up to ${limit} ${metric}. Upgrade license to exceed quota.`,
    };
  }

  return { allowed: true };
}
