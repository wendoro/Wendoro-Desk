import { pgEnum } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'trial',
  'suspended',
  'archived',
]);

export const companyStatusEnum = pgEnum('company_status', [
  'active',
  'inactive',
  'archived',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'active',
  'invited',
  'suspended',
  'revoked',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const roleScopeEnum = pgEnum('role_scope', [
  'tenant',
  'company',
  'branch',
]);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'free',
  'starter',
  'business',
  'professional',
  'enterprise',
  'white_label',
  'self_hosted',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'trialing',
  'past_due',
  'canceled',
]);

export const moduleLayerEnum = pgEnum('module_layer', [
  'core',
  'business',
  'industry',
]);

export const auditSeverityEnum = pgEnum('audit_severity', [
  'info',
  'warning',
  'critical',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'push',
  'whatsapp',
]);
