/**
 * InventoryProvider — stok seviyesi sağlayıcı portu.
 *
 * WMS (Depo/Stok) modülünün henüz backend'i olmadığından, somut adaptör
 * `RequestInventoryProvider` MRP isteğinde gelen inventory dizisini sarmalar.
 * İleride WMS backend'i gelince PgInventoryProvider bu portu uygular ve
 * RunMrpUseCase değişmeden çalışır.
 */
import type { InventoryLevel, InventorySnapshot } from '../../domain/services/MrpCalculator.js';

export interface InventoryProvider {
  /** companyId kapsamındaki materialRef → stok seviyesi anlık görüntüsü. */
  getLevels(companyId: number): Promise<InventorySnapshot>;
}

/**
 * RequestInventoryProvider — isteğin payload'ındaki stok dizisini saran adaptör.
 * (WMS backend'i yokken kullanılır.)
 */
export class RequestInventoryProvider implements InventoryProvider {
  private readonly snapshot: InventorySnapshot;

  constructor(levels: readonly InventoryLevel[]) {
    const map = new Map<string, InventoryLevel>();
    for (const l of levels) {
      map.set(l.materialRef, l);
    }
    this.snapshot = map;
  }

  getLevels(_companyId: number): Promise<InventorySnapshot> {
    return Promise.resolve(this.snapshot);
  }
}
