/**
 * AppStateMirror PORT'u — blob projeksiyonunun (BlobProjector) SQL aynasına
 * yazılması. Implementasyon: PgMirrorRepository (app_state_entities).
 *
 * replaceAll TEK transaction'dır: verilen gruplar budanır (rows'ta olmayan
 * client_id'ler silinir; grup boşsa tamamı) ve satırlar upsert edilir.
 * `groups` verilmezse gruplar rows'tan türetilir — o durumda boşalan diziler
 * budanamaz; çağıran projectBlobWithGroups'un groups çıktısını vermelidir.
 */
import type { MirrorGroup, MirrorRow } from '../../domain/BlobProjector.js';

export interface AppStateMirror {
  replaceAll(rows: readonly MirrorRow[], groups?: readonly MirrorGroup[]): Promise<void>;
}
