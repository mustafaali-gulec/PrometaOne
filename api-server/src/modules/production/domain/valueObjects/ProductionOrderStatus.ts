/**
 * ProductionOrderStatus — üretim emri yaşam döngüsü durum makinesi.
 *
 * Geçerli geçişler:
 *   planned     → released | cancelled
 *   released    → in_progress | cancelled
 *   in_progress → completed | cancelled
 *   completed   → (terminal)
 *   cancelled   → (terminal)
 *
 * `canTransition` ve `assertTransition` ile geçiş kuralları tek noktada
 * zorlanır (UpdateProductionOrderStatusUseCase bunu kullanır).
 */
import { InvalidOrderStatusTransitionError } from '../errors/ProductionErrors.js';

export const PRODUCTION_ORDER_STATUSES = [
  'planned',
  'released',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type ProductionOrderStatusValue = (typeof PRODUCTION_ORDER_STATUSES)[number];

const ALLOWED: Readonly<Record<ProductionOrderStatusValue, readonly ProductionOrderStatusValue[]>> =
  {
    planned: ['released', 'cancelled'],
    released: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

export function isProductionOrderStatus(value: unknown): value is ProductionOrderStatusValue {
  return (
    typeof value === 'string' && (PRODUCTION_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export class ProductionOrderStatus {
  private constructor(public readonly value: ProductionOrderStatusValue) {}

  static of(value: ProductionOrderStatusValue): ProductionOrderStatus {
    return new ProductionOrderStatus(value);
  }

  isTerminal(): boolean {
    return ALLOWED[this.value].length === 0;
  }

  canTransition(to: ProductionOrderStatusValue): boolean {
    return ALLOWED[this.value].includes(to);
  }

  /** Geçiş geçersizse InvalidOrderStatusTransitionError fırlatır, geçerliyse yeni VO döner. */
  assertTransition(to: ProductionOrderStatusValue): ProductionOrderStatus {
    if (!this.canTransition(to)) {
      throw new InvalidOrderStatusTransitionError(this.value, to);
    }
    return new ProductionOrderStatus(to);
  }
}
