import { z } from 'zod';

export const SyncPayloadSchema = z.object({
  outboxId: z.string().min(1).max(128),
  companyId: z.string().min(1).max(128),
  changeSummary: z.string().min(1).max(240),
  recordCount: z.number().int().min(0).max(500_000),
  checksum: z.string().min(4).max(128),
  stateSnapshotJson: z.string().min(2).max(5_000_000),
  createdAt: z.string().min(4).max(64),
});

export type SyncPayload = z.infer<typeof SyncPayloadSchema>;

export interface CompanySyncCheckpoint {
  companyId: string;
  lastOutboxId: string;
  checksum: string;
  recordCount: number;
  changeSummary: string;
  licenseKeyHint: string | null;
  syncedAt: string;
  stateSnapshotJson: string;
}
