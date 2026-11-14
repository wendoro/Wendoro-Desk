/**
 * Portable Infrastructure Adapter Interfaces.
 * Domain services depend on these abstractions rather than directly coupling
 * to Cloudflare Workers, R2, Queues, or Firebase so WENDORO can run on:
 *   1. Cloudflare Workers + Hyperdrive + R2 + Queues (Cloud Hosted)
 *   2. Self-Hosted Linux (Node/Bun + pg + S3/LocalFS + BullMQ)
 *   3. Tauri Desktop / Local Installer (Local Postgres + Local FS)
 */

export type DeploymentTarget = 'cloudflare_workers' | 'self_hosted_linux' | 'desktop_tauri';

export interface StorageObjectMetadata {
  key: string;
  contentType: string;
  sizeBytes: number;
  etag?: string;
  tenantId: string;
  companyId: string;
}

export interface StorageAdapter {
  putObject(params: {
    key: string;
    body: ArrayBuffer | Uint8Array | string;
    contentType: string;
    tenantId: string;
    companyId: string;
  }): Promise<StorageObjectMetadata>;
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export interface QueueJobPayload<TPayload = Record<string, unknown>> {
  jobId: string;
  jobType: string;
  tenantId: string;
  companyId: string;
  idempotencyKey: string;
  payload: TPayload;
  enqueuedAt: string;
}

export interface QueueAdapter {
  enqueue<TPayload>(job: QueueJobPayload<TPayload>): Promise<void>;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export interface AiCompletionRequest {
  tenantId: string;
  companyId: string;
  userId: string;
  provider: AiProviderId;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  allowedTools: string[];
  requireApprovalForSensitiveActions: boolean;
}

export interface AiCompletionResponse {
  provider: AiProviderId;
  model: string;
  outputText: string;
  inputTokens: number;
  outputTokens: number;
  auditLogId: string;
}

export interface AiGatewayAdapter {
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}
