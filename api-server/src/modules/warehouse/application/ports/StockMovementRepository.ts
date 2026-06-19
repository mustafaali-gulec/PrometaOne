/**
 * StockMovementRepository — stok hareketi kalıcılık portu.
 *
 * Stok bakiyesi saklanmaz; hareketler listelenip StockLedger ile türetilir.
 * Concrete: infrastructure/persistence/PgStockMovementRepository.ts.
 */
import type { StockMovement } from '../../domain/entities/StockMovement.js';
import type { MovementKind } from '../../domain/valueObjects/MovementKind.js';

export interface MovementFilter {
  materialId?: number;
  warehouseId?: number;
  kind?: MovementKind;
  /** YYYY-MM-DD (dahil). */
  dateFrom?: string;
  /** YYYY-MM-DD (dahil). */
  dateTo?: string;
}

export interface StockMovementRepository {
  insert(movement: StockMovement): Promise<StockMovement>;
  findById(id: number, companyId: number): Promise<StockMovement | null>;
  /** Filtreli liste (tarih + id artan). */
  list(companyId: number, filter?: MovementFilter): Promise<ReadonlyArray<StockMovement>>;
  /** Bir malzemenin TÜM hareketleri (stok/maliyet türetme için). */
  listByMaterial(companyId: number, materialId: number): Promise<ReadonlyArray<StockMovement>>;
  /** Bir deponun herhangi bir hareketi var mı (silme bloğu). */
  warehouseHasMovements(companyId: number, warehouseId: number): Promise<boolean>;
  /** Bir malzemenin herhangi bir hareketi var mı (silme bloğu). */
  materialHasMovements(companyId: number, materialId: number): Promise<boolean>;
  /** Yeni hareket no üretmek için tür+yıl bazında bir sonraki sıra. */
  nextSequence(companyId: number, kind: MovementKind, year: number): Promise<number>;
}
