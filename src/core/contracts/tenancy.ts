import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const SubscriptionTierSchema = z.enum([
  'free',
  'starter',
  'business',
  'professional',
  'enterprise',
  'white_label',
  'self_hosted',
]);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const RoleScopeSchema = z.enum(['tenant', 'company', 'branch']);
export type RoleScope = z.infer<typeof RoleScopeSchema>;

export const PermissionKeySchema = z
  .string()
  .regex(/^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$/, 'Permission must follow module.resource.action');
export type PermissionKey = z.infer<typeof PermissionKeySchema>;

export const BranchSummarySchema = z.object({
  id: UuidSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  isHeadquarters: z.boolean(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
});
export type BranchSummary = z.infer<typeof BranchSummarySchema>;

export const UserTypeSchema = z.enum([
  'retail_pos',
  'wholesale_dist',
  'manufacturer',
  'services_agency',
  'real_estate_ops',
  'enterprise_all',
]);
export type UserTypeId = z.infer<typeof UserTypeSchema>;

export const CompanyMembershipSchema = z.object({
  membershipId: UuidSchema,
  tenantId: UuidSchema,
  companyId: UuidSchema,
  companyCode: z.string().min(1),
  companyName: z.string().min(1),
  legalName: z.string().min(1),
  industryClassification: z.string().min(1),
  userType: UserTypeSchema.optional(),
  baseCurrency: z.string().length(3),
  countryCode: z.string().length(2),
  timezone: z.string().min(1),
  roleName: z.string().min(1),
  roleSlug: z.string().min(1),
  roleScope: RoleScopeSchema,
  permissions: z.array(z.string()),
  enabledModules: z.array(z.string()),
  branches: z.array(BranchSummarySchema),
  defaultBranchId: UuidSchema.nullable(),
});
export type CompanyMembership = z.infer<typeof CompanyMembershipSchema>;

export const SessionPrincipalSchema = z.object({
  userId: UuidSchema,
  email: z.string().email(),
  fullName: z.string().min(1),
  mfaEnabled: z.boolean(),
  isPlatformAdmin: z.boolean(),
  activeTenantId: UuidSchema,
  activeCompanyId: UuidSchema,
  activeBranchId: UuidSchema.nullable(),
  subscriptionTier: SubscriptionTierSchema,
  memberships: z.array(CompanyMembershipSchema).min(1),
});
export type SessionPrincipal = z.infer<typeof SessionPrincipalSchema>;

export const SwitchCompanyRequestSchema = z.object({
  companyId: UuidSchema,
  branchId: UuidSchema.optional(),
});
export type SwitchCompanyRequest = z.infer<typeof SwitchCompanyRequestSchema>;

/**
 * Evaluates whether a membership grants a required capability.
 * Supports wildcard module grants (e.g., `core.*`) or exact `module.resource.action`.
 */
export function hasPermission(
  membership: Pick<CompanyMembership, 'permissions'>,
  required: string,
): boolean {
  if (membership.permissions.includes('*')) {
    return true;
  }
  if (membership.permissions.includes(required)) {
    return true;
  }
  const [moduleSlug] = required.split('.');
  return membership.permissions.includes(`${moduleSlug}.*`);
}
