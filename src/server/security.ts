import type { NextFunction, Request, Response } from 'express';
import { CompanyMembership, SessionPrincipal, hasPermission } from '@/src/core/contracts/tenancy';
import { createUuid, nowIso } from '@/src/core/engine/accountingEngine';
import { AuditLogRecord } from '@/src/core/store/erpTypes';

export const COMPANY_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: [
    'sales.*',
    'purchase.*',
    'inventory.*',
    'finance.*',
    'hr.*',
    'crm.*',
    'catalogue.*',
    'system.backup.export',
    'system.backup.restore',
    'audit.logs.read',
  ],
  accountant: [
    'finance.*',
    'sales.invoice.read',
    'sales.payment.allocate',
    'purchase.order.read',
    'purchase.payment.allocate',
    'hr.payroll.run',
    'audit.logs.read',
  ],
  inventory_manager: [
    'catalogue.*',
    'inventory.*',
    'sales.order.dispatch',
    'purchase.order.receive',
  ],
  sales_rep: [
    'crm.*',
    'catalogue.item.read',
    'sales.order.create',
    'sales.invoice.post',
    'sales.order.read',
  ],
  viewer: [
    'catalogue.item.read',
    'crm.contact.read',
    'sales.order.read',
    'purchase.order.read',
    'inventory.stock.read',
    'finance.journal.read',
  ],
};

export class AuthorizationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface AuthorizedContext {
  principal: SessionPrincipal;
  membership: CompanyMembership;
}

export type AuditSink = (entry: AuditLogRecord) => void;

export function resolveEffectivePermissions(membership: CompanyMembership): string[] {
  const roleDefaults = COMPANY_ROLE_PERMISSIONS[membership.roleSlug] ?? [];
  return Array.from(new Set([...membership.permissions, ...roleDefaults]));
}

/**
 * Authorizes an operation strictly on the backend against the authenticated
 * user's organization memberships and company-specific role permissions.
 * Never trusts client-supplied company filters without matching a server-side membership.
 */
export function authorizeCompanyAccess(
  principal: SessionPrincipal | null | undefined,
  requestedCompanyId: string,
  requiredPermission: string,
  auditSink?: AuditSink,
): AuthorizedContext {
  if (!principal || !principal.userId) {
    throw new AuthorizationError(401, 'UNAUTHENTICATED', 'Authentication session required.');
  }

  const membership = principal.memberships.find((m) => m.companyId === requestedCompanyId);
  if (!membership) {
    auditSink?.({
      id: createUuid(),
      companyId: requestedCompanyId,
      actorUserId: principal.userId,
      actorRole: 'none',
      action: requiredPermission,
      resourceType: 'company_scope',
      resourceId: requestedCompanyId,
      outcome: 'denied',
      details: `Cross-company access blocked for user ${principal.email} targeting company ${requestedCompanyId}`,
      createdAt: nowIso(),
    });
    throw new AuthorizationError(
      403,
      'CROSS_COMPANY_ACCESS_DENIED',
      `Access denied: user does not hold an active membership for company ${requestedCompanyId}.`,
    );
  }

  const effectivePerms = resolveEffectivePermissions(membership);
  const allowed = hasPermission({ permissions: effectivePerms }, requiredPermission);

  if (!allowed) {
    auditSink?.({
      id: createUuid(),
      companyId: requestedCompanyId,
      actorUserId: principal.userId,
      actorRole: membership.roleSlug,
      action: requiredPermission,
      resourceType: 'rbac_permission',
      resourceId: requestedCompanyId,
      outcome: 'denied',
      details: `Role "${membership.roleSlug}" lacks required permission "${requiredPermission}".`,
      createdAt: nowIso(),
    });
    throw new AuthorizationError(
      403,
      'INSUFFICIENT_ROLE_PERMISSION',
      `Role "${membership.roleName}" is not authorized for "${requiredPermission}".`,
    );
  }

  auditSink?.({
    id: createUuid(),
    companyId: requestedCompanyId,
    actorUserId: principal.userId,
    actorRole: membership.roleSlug,
    action: requiredPermission,
    resourceType: 'company_scope',
    resourceId: requestedCompanyId,
    outcome: 'success',
    details: `Authorized ${principal.email} (${membership.roleSlug}) for ${requiredPermission}`,
    createdAt: nowIso(),
  });

  return { principal, membership };
}

export interface AuthenticatedRequest extends Request {
  authContext?: AuthorizedContext;
}

export function createRequireCompanyPermission(
  resolvePrincipal: (req: Request) => Promise<SessionPrincipal | null>,
  auditSink?: AuditSink,
) {
  return (requiredPermission: string) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const companyId = req.params.companyId;
        if (!companyId) {
          res.status(400).json({ error: 'MISSING_COMPANY_ID', message: 'Company ID path parameter is required.' });
          return;
        }
        const principal = await resolvePrincipal(req);
        req.authContext = authorizeCompanyAccess(
          principal,
          companyId,
          requiredPermission,
          auditSink,
        );
        next();
      } catch (err) {
        if (err instanceof AuthorizationError) {
          res.status(err.statusCode).json({ error: err.code, message: err.message });
          return;
        }
        res.status(500).json({ error: 'AUTH_INTERNAL_ERROR', message: 'Authorization check failed.' });
      }
    };
}
