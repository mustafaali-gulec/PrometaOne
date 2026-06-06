/**
 * Makine türü (cs_machine_kind aynası) + puantaj gün faktörü.
 * status_code: P=tam(1), Y=yarım(0.5), X=yok(0), I=izin(0).
 */
export const MACHINE_KINDS = ['owned', 'rented', 'subcontractor'] as const;
export type MachineKind = (typeof MACHINE_KINDS)[number];

export function isMachineKind(v: unknown): v is MachineKind {
  return typeof v === 'string' && (MACHINE_KINDS as ReadonlyArray<string>).includes(v);
}

/** Puantaj statü koduna karşılık gelen yevmiye gün faktörü (işçilik maliyeti). */
export function dayFactor(statusCode: string): number {
  switch (statusCode.toUpperCase()) {
    case 'P':
      return 1;
    case 'Y':
      return 0.5;
    default:
      return 0; // X (yok), I/İ (izin)
  }
}
