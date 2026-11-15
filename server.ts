import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toNodeHandler } from 'better-auth/node';
import { SessionPrincipal, SessionPrincipalSchema } from '@/src/core/contracts/tenancy';
import { ErpDomainError } from '@/src/core/engine/accountingEngine';
import { AuditLogRecord } from '@/src/core/store/erpTypes';
import { getPostgresPool, migrateBackupJsonToPostgres } from '@/src/db/client';
import { getAuthReadiness, getBetterAuth } from '@/src/server/auth';
import { encryptCredential } from '@/src/server/crypto';
import { LicenseServerError, createLicenseService } from '@/src/server/licensing';
import {
  AuthenticatedRequest,
  createRequireCompanyPermission,
} from '@/src/server/security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const distDir = path.resolve(__dirname, 'dist');
const licenseService = createLicenseService();

app.disable('x-powered-by');

// Allow native Desktop (Electron) & Android (Capacitor) clients to authenticate licenses
app.use('/api/licenses', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// In-memory security audit ring buffer
const serverAuditBuffer: AuditLogRecord[] = [];
const recordServerAudit = (entry: AuditLogRecord) => {
  serverAuditBuffer.unshift(entry);
  if (serverAuditBuffer.length > 500) {
    serverAuditBuffer.length = 500;
  }
};

// Mount Better Auth handler at /api/auth/* before express.json()
app.all('/api/auth/*', (req, res) => {
  const auth = getBetterAuth();
  if (!auth) {
    res.status(503).json({
      error: 'AUTH_NOT_CONFIGURED',
      message:
        'Configure DATABASE_URL and BETTER_AUTH_SECRET in your server environment to enable Better Auth endpoints.',
    });
    return;
  }
  const handler = toNodeHandler(auth);
  void handler(req, res);
});

app.use(express.json({ limit: '2mb' }));

// Health endpoint for License Server & Desktop/Android ping
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wendoro-license-server',
    runtime: 'node-express',
    timestamp: new Date().toISOString(),
  });
});

// License server readiness check (returns booleans & counts only, zero secrets)
app.get('/api/setup/status', (_req, res) => {
  const readiness = getAuthReadiness();
  const stats = licenseService.getServerStats();

  res.status(200).json({
    runtime: 'node-express',
    licenseServerReady: true,
    registeredAccounts: stats.registeredAccounts,
    issuedLicenses: stats.issuedLicenses,
    activeActivations: stats.activeActivations,
    databaseConfigured: readiness.databaseConfigured,
    authSecretConfigured: readiness.authSecretConfigured,
    betterAuthReady: readiness.betterAuthReady,
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* WENDORO License Registration, Activation & Verification API                */
/* -------------------------------------------------------------------------- */

app.get('/api/licenses/status', (_req, res) => {
  res.status(200).json({
    ...licenseService.getServerStats(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/licenses/register', (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = licenseService.registerAndIssueLicense({
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      fullName: String(body.fullName ?? ''),
      organizationName: String(body.organizationName ?? ''),
      planTier: (body.planTier as never) ?? 'free',
      platform: (body.platform as never) ?? 'both',
      deviceId: body.deviceId ? String(body.deviceId) : undefined,
      deviceName: body.deviceName ? String(body.deviceName) : undefined,
      devicePlatform: (body.devicePlatform as never) ?? 'desktop',
      appVersion: body.appVersion ? String(body.appVersion) : undefined,
    });
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LicenseServerError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    res.status(500).json({
      error: 'LICENSE_REGISTRATION_FAILED',
      message: 'Unable to register license account.',
    });
  }
});

app.post('/api/licenses/login', (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = licenseService.loginAndListLicenses({
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
    });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LicenseServerError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    res.status(500).json({
      error: 'LICENSE_LOGIN_FAILED',
      message: 'Unable to authenticate license account.',
    });
  }
});

app.post('/api/licenses/activate', (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = licenseService.activateLicense({
      licenseKey: String(body.licenseKey ?? ''),
      deviceId: String(body.deviceId ?? ''),
      deviceName: body.deviceName ? String(body.deviceName) : undefined,
      platform: (body.platform as never) ?? 'desktop',
      appVersion: body.appVersion ? String(body.appVersion) : undefined,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LicenseServerError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    res.status(500).json({
      error: 'LICENSE_ACTIVATION_FAILED',
      message: 'Unable to activate license key.',
    });
  }
});

app.post('/api/licenses/verify', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = licenseService.verifyLicense({
    licenseKey: String(body.licenseKey ?? ''),
    deviceId: body.deviceId ? String(body.deviceId) : undefined,
  });
  res.status(result.valid ? 200 : 404).json(result);
});

// Resolve authenticated session principal via Better Auth session validation
async function resolveSessionPrincipal(req: express.Request): Promise<SessionPrincipal | null> {
  const auth = getBetterAuth();
  if (!auth) return null;

  try {
    const sessionData = await auth.api.getSession({
      headers: req.headers as unknown as HeadersInit,
    });
    if (!sessionData?.user) return null;

    const pool = getPostgresPool();
    if (!pool) return null;

    const membershipRows = await pool.query(
      `SELECT m.id AS membership_id, m.tenant_id, m.company_id, c.code AS company_code, c.name AS company_name,
              c.legal_name, c.industry_classification, c.base_currency, c.country_code, c.timezone,
              r.name AS role_name, r.slug AS role_slug, r.scope AS role_scope
         FROM organization.memberships m
         JOIN organization.companies c ON c.id = m.company_id
         LEFT JOIN organization.user_role_assignments ura ON ura.membership_id = m.id
         LEFT JOIN organization.roles r ON r.id = ura.role_id
        WHERE m.user_id = $1 AND m.status = 'active'`,
      [sessionData.user.id],
    );

    if (membershipRows.rows.length === 0) return null;

    const first = membershipRows.rows[0];
    return SessionPrincipalSchema.parse({
      userId: sessionData.user.id,
      email: sessionData.user.email,
      fullName: sessionData.user.name || sessionData.user.email,
      mfaEnabled: false,
      isPlatformAdmin: false,
      activeTenantId: first.tenant_id,
      activeCompanyId: first.company_id,
      activeBranchId: null,
      subscriptionTier: 'self_hosted',
      memberships: membershipRows.rows.map((row) => ({
        membershipId: row.membership_id,
        tenantId: row.tenant_id,
        companyId: row.company_id,
        companyCode: row.company_code,
        companyName: row.company_name,
        legalName: row.legal_name,
        industryClassification: row.industry_classification,
        baseCurrency: row.base_currency,
        countryCode: row.country_code,
        timezone: row.timezone,
        roleName: row.role_name || 'Member',
        roleSlug: row.role_slug || 'viewer',
        roleScope: (row.role_scope || 'company') as 'tenant' | 'company' | 'branch',
        permissions: [],
        enabledModules: [],
        branches: [],
        defaultBranchId: null,
      })),
    });
  } catch {
    return null;
  }
}

const requirePermission = createRequireCompanyPermission(
  resolveSessionPrincipal,
  recordServerAudit,
);

// Protected audit log inspection
app.get(
  '/api/erp/:companyId/audit-logs',
  requirePermission('audit.logs.read'),
  (req: AuthenticatedRequest, res) => {
    const companyId = req.authContext!.membership.companyId;
    res.status(200).json({
      companyId,
      logs: serverAuditBuffer.filter((l) => l.companyId === companyId),
    });
  },
);

// Protected transactional PostgreSQL migration endpoint
app.post(
  '/api/erp/:companyId/migrate',
  requirePermission('system.backup.restore'),
  async (req: AuthenticatedRequest, res) => {
    const pool = getPostgresPool();
    if (!pool) {
      res.status(503).json({
        error: 'DATABASE_NOT_CONFIGURED',
        message: 'PostgreSQL DATABASE_URL must be configured before migrating records.',
      });
      return;
    }

    const client = await pool.connect();
    try {
      const ctx = req.authContext!;
      const payloadText =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      const summary = await migrateBackupJsonToPostgres(
        client,
        {
          tenantId: ctx.membership.tenantId,
          companyId: ctx.membership.companyId,
          userId: ctx.principal.userId,
        },
        payloadText,
      );
      res.status(200).json({ ok: true, summary });
    } catch (err) {
      if (err instanceof ErpDomainError) {
        res.status(400).json({ error: err.code, message: err.message });
        return;
      }
      res.status(500).json({
        error: 'MIGRATION_FAILED',
        message: 'Transactional migration rolled back due to a database error.',
      });
    } finally {
      client.release();
    }
  },
);

// Protected integration credential vault endpoint
app.post(
  '/api/erp/:companyId/credentials',
  requirePermission('system.backup.restore'),
  async (req: AuthenticatedRequest, res) => {
    const pool = getPostgresPool();
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!pool || !secret) {
      res.status(503).json({
        error: 'VAULT_NOT_CONFIGURED',
        message: 'DATABASE_URL and BETTER_AUTH_SECRET are required for credential storage.',
      });
      return;
    }

    const { provider, credential } = (req.body ?? {}) as {
      provider?: string;
      credential?: string;
    };
    if (!provider?.trim() || !credential?.trim()) {
      res.status(400).json({
        error: 'INVALID_CREDENTIAL_INPUT',
        message: 'Provider and credential value are required.',
      });
      return;
    }

    try {
      const ctx = req.authContext!;
      const ciphertext = encryptCredential(credential, secret);
      await pool.query(
        `INSERT INTO integrations.encrypted_credentials (tenant_id, company_id, provider, ciphertext, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, provider)
         DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = now()`,
        [
          ctx.membership.tenantId,
          ctx.membership.companyId,
          provider.trim().toLowerCase(),
          ciphertext,
          ctx.principal.userId,
        ],
      );
      res.status(200).json({
        ok: true,
        provider: provider.trim().toLowerCase(),
        storedEncrypted: true,
      });
    } catch (err) {
      res.status(500).json({
        error: 'VAULT_WRITE_FAILED',
        message: err instanceof Error ? err.message : 'Unable to store encrypted credential.',
      });
    }
  },
);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd || !fs.existsSync(distDir)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`WENDORO License & App server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
