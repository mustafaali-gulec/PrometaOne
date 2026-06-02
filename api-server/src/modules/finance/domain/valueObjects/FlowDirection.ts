/**
 * FlowDirection — nakit akış yönü.
 *
 * DB ENUM `flow_direction` (004): in / out.
 *   in  — para girişi (tahsilat, gelen fatura tahsili, kasa girişi)
 *   out — para çıkışı (ödeme, giden fatura, kasa çıkışı)
 *
 * Invoice.type de bu enum'u kullanır: in=alacak/AR, out=borç/AP.
 */
export type FlowDirection = 'in' | 'out';

export const ALL_FLOW_DIRECTIONS: ReadonlyArray<FlowDirection> = ['in', 'out'];

export function isFlowDirection(value: unknown): value is FlowDirection {
  return (
    typeof value === 'string' && (ALL_FLOW_DIRECTIONS as ReadonlyArray<string>).includes(value)
  );
}
