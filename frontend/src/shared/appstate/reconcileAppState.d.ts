// reconcileAppState.js için tip bildirimleri (modül .js; allowJs:false olduğundan
// .ts tüketiciler — testler — buradan tip alır).

export type RemoteStatus = 'ok' | 'missing' | 'error' | 'offline';

export interface ReconcileDecision {
  action: 'seed-backend' | 'adopt-remote' | 'push-local' | 'keep-local';
  reason: string;
  localScore: number;
  remoteScore: number;
}

export function isValidBlob(blob: unknown): boolean;
export function computeRealScore(blob: unknown): number;
export function reconcileAppState(
  localValue: unknown,
  remoteValue: unknown,
  remoteStatus: RemoteStatus,
): ReconcileDecision;
