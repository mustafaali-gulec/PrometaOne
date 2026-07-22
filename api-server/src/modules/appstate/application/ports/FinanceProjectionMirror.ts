/**
 * FinanceProjectionMirror PORT'u — blob FİNANS çekirdeği projeksiyonunun
 * (FinanceProjection) MEVCUT normalize finance tablolarına (banks/bank_accounts/
 * kasa_accounts/categories + cells/kasa_entries/transfers/invoices+
 * invoice_payments) yazılması. Implementasyon: PgFinanceProjectionRepository
 * (048_finance_projection.sql).
 *
 * replaceAll TEK transaction'dır ve yalnız projeksiyon-sahipli satırlara
 * (client_id IS NOT NULL) dokunur: üst entiteler (banks, categories,
 * bank_accounts, kasa_accounts) upsert + prune (serial id kararlı — CRUD
 * FK'ları süpürülmez), hareket/detaylar (cells, kasa_entries, transfers,
 * invoices + invoice_payments) delete-then-insert. Boş projeksiyon,
 * projeksiyon-sahipli tüm satırları budar; finance CRUD'unun kendi satırları
 * (client_id IS NULL) korunur.
 */
import type { FinanceProjection } from '../../domain/FinanceProjection.js';

export interface FinanceProjectionMirror {
  replaceAll(projection: FinanceProjection): Promise<void>;
}
