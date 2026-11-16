import fs from 'node:fs';
import path from 'node:path';
import {
  CompanySyncCheckpoint,
  SyncPayload,
  SyncPayloadSchema,
} from '@/src/core/contracts/sync';

export { SyncPayloadSchema };
export type { CompanySyncCheckpoint, SyncPayload };

interface SyncLedgerFile {
  checkpoints: Record<string, CompanySyncCheckpoint>;
}

export class ServerSyncStore {
  private readonly filePath: string;
  private ledger: SyncLedgerFile;

  constructor(dataDir = path.resolve(process.cwd(), '.wendoro-data')) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'sync-checkpoints.json');
    this.ledger = this.load();
  }

  private load(): SyncLedgerFile {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { checkpoints: {} };
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SyncLedgerFile>;
      return {
        checkpoints:
          parsed.checkpoints && typeof parsed.checkpoints === 'object'
            ? parsed.checkpoints
            : {},
      };
    } catch {
      return { checkpoints: {} };
    }
  }

  private save() {
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.ledger, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  applySyncCheckpoint(
    payload: SyncPayload,
    licenseKey?: string | null,
  ): {
    ok: true;
    companyId: string;
    outboxId: string;
    checksum: string;
    recordCount: number;
    serverTimestamp: string;
  } {
    const serverTimestamp = new Date().toISOString();
    const maskLicense = (k?: string | null) =>
      k && k.length > 10 ? `${k.slice(0, 9)}...${k.slice(-4)}` : null;

    this.ledger.checkpoints[payload.companyId] = {
      companyId: payload.companyId,
      lastOutboxId: payload.outboxId,
      checksum: payload.checksum,
      recordCount: payload.recordCount,
      changeSummary: payload.changeSummary,
      licenseKeyHint: maskLicense(licenseKey),
      syncedAt: serverTimestamp,
      stateSnapshotJson: payload.stateSnapshotJson,
    };
    this.save();

    return {
      ok: true,
      companyId: payload.companyId,
      outboxId: payload.outboxId,
      checksum: payload.checksum,
      recordCount: payload.recordCount,
      serverTimestamp,
    };
  }

  getCheckpointMeta(companyId: string): Omit<CompanySyncCheckpoint, 'stateSnapshotJson'> | null {
    const cp = this.ledger.checkpoints[companyId];
    if (!cp) return null;
    const { stateSnapshotJson: _omit, ...meta } = cp;
    return meta;
  }
}
