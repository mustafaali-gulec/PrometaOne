/**
 * SqlGuard — ad-hoc/kayıtlı SQL için salt-okunur SELECT güvenlik kapısı.
 *
 * Bu, derinlemesine savunmanın (defense-in-depth) BİRİNCİ katmanıdır; tek
 * başına yeterli DEĞİLDİR. SafeSqlExecutor her sorguyu ayrıca READ ONLY
 * transaction + SET LOCAL statement_timeout + (tercihen) salt-okunur DB rolü
 * ile çalıştırır ve DAİMA ROLLBACK eder. Bu kapı, niyeti baştan reddederek
 * yüzeyi daraltır ve net hata mesajı verir.
 *
 * Kontrol listesi (assertSafeSelect):
 *   1. Boş değil + uzunluk sınırı.
 *   2. String literal'leri, dollar-quote'ları ve comment'leri tarama kopyasında
 *      maskele — böylece veri içindeki 'DROP' kelimesi tetiklemez, gerçek
 *      kelimeler de saklanamaz.
 *   3. Tek statement (sondaki ';' hariç ';' yok).
 *   4. SELECT veya WITH ile başla.
 *   5. DDL/DML anahtar kelime denylist'i (kelime sınırı).
 *   6. Tehlikeli fonksiyon/katalog denylist'i (kelime sınırı).
 *   7. Placeholder yalnız $1.. biçiminde; $0 yok.
 *
 * İlk başarısızlıkta SqlNotAllowedError fırlatır.
 */
import { SqlNotAllowedError } from '../errors/ReportingErrors.js';

const MAX_SQL_LENGTH = 20_000;

/**
 * DDL/DML ve oturum-değiştiren anahtar kelimeler. `set`/`declare` de bloklanır:
 * kullanıcı transaction guard'larını (statement_timeout, read only) ezemesin.
 * CTE içi DML (`WITH x AS (DELETE ...)`) de buradaki delete/update/insert ile
 * yakalanır.
 */
const FORBIDDEN_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'merge',
  'truncate',
  'drop',
  'alter',
  'create',
  'grant',
  'revoke',
  'comment',
  'reindex',
  'vacuum',
  'analyze',
  'cluster',
  'refresh',
  'call',
  'do',
  'copy',
  'execute',
  'prepare',
  'deallocate',
  'listen',
  'notify',
  'unlisten',
  'lock',
  'set',
  'reset',
  'declare',
  'fetch',
  'move',
  'into', // SELECT ... INTO yeni tablo oluşturur → engelle
  'show', // sunucu konfigürasyonunu sızdırabilir
];

/**
 * Tehlikeli fonksiyonlar (dosya/IO, uyku/DoS, oturum yönetimi, GUC tamper,
 * sequence yazma) ve sır içeren sistem katalogları. `information_schema` ve
 * sıradan `pg_catalog` metadata okuması SERBESTtir (burada yok).
 */
const FORBIDDEN_FUNCTIONS = [
  // Dosya / sunucu IO
  'pg_read_file',
  'pg_read_binary_file',
  'pg_read_server_files',
  'pg_ls_dir',
  'pg_stat_file',
  'pg_write_server_files',
  // Large object IO
  'lo_import',
  'lo_export',
  'lo_get',
  'lo_put',
  'lo_creat',
  'lo_create',
  'lo_unlink',
  'lo_from_bytea',
  // DoS / uyku
  'pg_sleep',
  'pg_sleep_for',
  'pg_sleep_until',
  // Dış bağlantı
  'dblink',
  'dblink_exec',
  'dblink_connect',
  // GUC tamper (timeout/read-only ezme vektörü)
  'set_config',
  'current_setting',
  // Oturum / sunucu yönetimi
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'pg_rotate_logfile',
  'pg_logical_emit_message',
  // Sequence yazma (yan etki)
  'nextval',
  'setval',
  // Sır içeren sistem katalogları
  'pg_authid',
  'pg_shadow',
  'pg_user_mappings',
  'pg_largeobject',
  'pg_largeobject_metadata',
  'pg_read_all_settings',
];

/**
 * Sır içeren / kimlik & yetki tabloları — ham SQL'in bunlara erişimi engellenir
 * (derinlemesine savunma; salt-okunur DB rolü de bunlara SELECT vermemeli).
 * Görsel sorgu kurucu (P2) zaten yalnız allowlist katalogdan üretir.
 */
const BLOCKED_RELATIONS = [
  'users',
  'sessions',
  'password_resets',
  'access_custom_roles',
  'access_role_grants',
  'access_permission_overrides',
  'einvoice_credentials',
];

const KEYWORD_RE = new RegExp(`\\b(?:${FORBIDDEN_KEYWORDS.join('|')})\\b`, 'i');
const FUNCTION_RE = new RegExp(`\\b(?:${FORBIDDEN_FUNCTIONS.join('|')})\\b`, 'i');
const RELATION_RE = new RegExp(`\\b(?:${BLOCKED_RELATIONS.join('|')})\\b`, 'i');

/**
 * String literal'leri, dollar-quote'ları ve comment'leri boşlukla değiştirerek
 * yalnız "kod" iskeletini bırakan tek-geçişli tarayıcı. Offset/satır korunur
 * (içerik boşlukla doldurulur). Güvenlik açısından kritik — naive regex
 * değil, durum makinesi kullanır (iç içe tırnak/comment'e dayanıklı).
 */
export function sanitizeForScan(sql: string): string {
  const out: string[] = [];
  const n = sql.length;
  let i = 0;

  const blank = (ch: string): string => (ch === '\n' || ch === '\r' || ch === '\t' ? ch : ' ');

  while (i < n) {
    const ch = sql[i]!;
    const next = i + 1 < n ? sql[i + 1] : '';

    // Satır comment'i: -- ... \n
    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') {
        out.push(blank(sql[i]!));
        i++;
      }
      continue;
    }

    // Blok comment'i: /* ... */ (iç içe destekle)
    if (ch === '/' && next === '*') {
      let depth = 1;
      out.push(' ', ' ');
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          out.push(' ', ' ');
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          out.push(' ', ' ');
          i += 2;
        } else {
          out.push(blank(sql[i]!));
          i++;
        }
      }
      continue;
    }

    // Tek tırnaklı string: '...' ('' kaçışı)
    if (ch === "'") {
      out.push(' ');
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out.push(' ', ' ');
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          out.push(' ');
          i++;
          break;
        }
        out.push(blank(sql[i]!));
        i++;
      }
      continue;
    }

    // Çift tırnaklı tanımlayıcı: "..." — içeriği kelime taramasından çıkar
    // ("select" gibi bir kolon adı yanlış pozitif vermesin), yapı korunsun.
    if (ch === '"') {
      out.push(' ');
      i++;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          out.push(' ', ' ');
          i += 2;
          continue;
        }
        if (sql[i] === '"') {
          out.push(' ');
          i++;
          break;
        }
        out.push(blank(sql[i]!));
        i++;
      }
      continue;
    }

    // Dollar-quote: $tag$ ... $tag$ (tag opsiyonel, harf/altçizgi/rakam)
    if (ch === '$') {
      const tagMatch = /^\$[A-Za-z_]?[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        out.push(...' '.repeat(tag.length));
        i += tag.length;
        const end = sql.indexOf(tag, i);
        if (end === -1) {
          // Kapanmayan dollar-quote → kalanı boşlukla doldur
          while (i < n) {
            out.push(blank(sql[i]!));
            i++;
          }
        } else {
          while (i < end) {
            out.push(blank(sql[i]!));
            i++;
          }
          out.push(...' '.repeat(tag.length));
          i += tag.length;
        }
        continue;
      }
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

/**
 * SQL'i salt-okunur tek SELECT olarak doğrular. Güvenli değilse
 * SqlNotAllowedError fırlatır; güvenliyse sessizce döner.
 */
export function assertSafeSelect(sql: string): void {
  if (typeof sql !== 'string' || sql.trim().length === 0) {
    throw new SqlNotAllowedError('boş sorgu');
  }
  if (sql.length > MAX_SQL_LENGTH) {
    throw new SqlNotAllowedError(`sorgu çok uzun (> ${MAX_SQL_LENGTH} karakter)`);
  }

  const scan = sanitizeForScan(sql);

  // Tek statement: sondaki tek ';' kabul, içeride ';' red.
  let trimmed = scan.trim();
  if (trimmed.endsWith(';')) {
    trimmed = trimmed.slice(0, -1);
  }
  if (trimmed.includes(';')) {
    throw new SqlNotAllowedError('birden fazla statement çalıştırılamaz');
  }

  // SELECT veya WITH ile başlamalı.
  if (!/^\s*(?:select|with)\b/i.test(trimmed)) {
    throw new SqlNotAllowedError('yalnız SELECT / WITH sorguları çalıştırılabilir');
  }

  // DDL/DML / oturum anahtar kelimeleri.
  const kw = KEYWORD_RE.exec(trimmed);
  if (kw) {
    throw new SqlNotAllowedError(`izin verilmeyen anahtar kelime: ${kw[0].toUpperCase()}`);
  }

  // Tehlikeli fonksiyon / sistem katalogları.
  const fn = FUNCTION_RE.exec(trimmed);
  if (fn) {
    throw new SqlNotAllowedError(`izin verilmeyen fonksiyon/katalog: ${fn[0]}`);
  }

  // Sır içeren / kimlik & yetki tabloları.
  const rel = RELATION_RE.exec(trimmed);
  if (rel) {
    throw new SqlNotAllowedError(`erişime kapalı tablo: ${rel[0]}`);
  }

  // Placeholder yalnız $1.. — $0 yok.
  for (const m of trimmed.matchAll(/\$(\d+)/g)) {
    if (Number(m[1]) < 1) {
      throw new SqlNotAllowedError('geçersiz placeholder ($0)');
    }
  }
}

/** SQL'de geçen en yüksek $n placeholder numarası (yoksa 0). */
export function maxPlaceholderIndex(sql: string): number {
  let max = 0;
  for (const m of sanitizeForScan(sql).matchAll(/\$(\d+)/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}
