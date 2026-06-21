/**
 * SqlGuard birim testleri — güvenlik kritik.
 * Çalıştır: npm test  (tsx --test)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SqlNotAllowedError } from '../../domain/errors/ReportingErrors.js';
import {
  assertSafeSelect,
  maxPlaceholderIndex,
  sanitizeForScan,
} from '../../domain/sql/SqlGuard.js';

const rejects = (sql: string): void =>
  assert.throws(() => assertSafeSelect(sql), SqlNotAllowedError, `reddetmeliydi: ${sql}`);

const accepts = (sql: string): void =>
  assert.doesNotThrow(() => assertSafeSelect(sql), `kabul etmeliydi: ${sql}`);

describe('SqlGuard.assertSafeSelect — REDDEDER', () => {
  it('boş / boşluk', () => {
    rejects('');
    rejects('   \n  ');
  });

  it('DML / DDL', () => {
    rejects('INSERT INTO invoices (id) VALUES (1)');
    rejects('update invoices set total = 0');
    rejects('DELETE FROM invoices');
    rejects('TRUNCATE invoices');
    rejects('DROP TABLE invoices');
    rejects('ALTER TABLE invoices ADD COLUMN x int');
    rejects('CREATE TABLE x (id int)');
    rejects('GRANT SELECT ON invoices TO public');
    rejects('MERGE INTO t USING s ON (t.id=s.id)');
  });

  it('CTE içinde gizli DML', () => {
    rejects('WITH x AS (DELETE FROM invoices RETURNING *) SELECT * FROM x');
    rejects('WITH x AS (UPDATE invoices SET total=0 RETURNING *) SELECT * FROM x');
  });

  it('birden fazla statement', () => {
    rejects('SELECT 1; DROP TABLE invoices');
    rejects('SELECT 1; SELECT 2');
  });

  it('SELECT/WITH ile başlamayan', () => {
    rejects('TABLE invoices');
    rejects('VALUES (1),(2)');
    rejects('EXPLAIN SELECT 1');
    rejects('SHOW statement_timeout');
    rejects('SELECT 1 INTO new_table FROM invoices');
  });

  it('oturum/GUC ezme', () => {
    rejects('SET statement_timeout = 0');
    rejects("SELECT set_config('statement_timeout','0',true)");
    rejects('DECLARE c CURSOR FOR SELECT 1');
    rejects("SELECT current_setting('is_superuser')");
  });

  it('tehlikeli fonksiyonlar', () => {
    rejects("SELECT pg_read_file('/etc/passwd')");
    rejects('SELECT pg_sleep(10)');
    rejects("SELECT dblink('host=x','SELECT 1')");
    rejects("SELECT lo_import('/etc/passwd')");
    rejects('SELECT pg_terminate_backend(123)');
    rejects("SELECT nextval('s')");
  });

  it('sır içeren sistem katalogları', () => {
    rejects('SELECT * FROM pg_authid');
    rejects('SELECT rolpassword FROM pg_catalog.pg_authid');
    rejects('SELECT * FROM pg_shadow');
  });

  it('sır içeren / kimlik & yetki tabloları', () => {
    rejects('SELECT * FROM users');
    rejects('SELECT password_hash FROM users u');
    rejects('SELECT * FROM sessions');
    rejects('SELECT * FROM access_role_grants');
    rejects('SELECT * FROM einvoice_credentials');
  });

  it('geçersiz placeholder $0', () => {
    rejects('SELECT * FROM invoices WHERE id = $0');
  });
});

describe('SqlGuard.assertSafeSelect — KABUL EDER', () => {
  it('düz SELECT', () => {
    accepts('SELECT * FROM invoices');
    accepts('select id, total from invoices where company_id = $1 order by id desc');
  });

  it('WITH (CTE) salt-okunur', () => {
    accepts('WITH t AS (SELECT id, total FROM invoices) SELECT * FROM t');
  });

  it('tırnak içindeki tehlikeli kelime DEĞİL kabul edilir', () => {
    accepts("SELECT 'DROP TABLE invoices' AS note FROM invoices");
    accepts("SELECT name FROM invoices WHERE note = 'pg_sleep(10)'");
    accepts("SELECT name FROM invoices WHERE note = 'a;b;c'");
  });

  it('comment içindeki kelime maskelenir', () => {
    accepts('SELECT 1 /* drop table invoices */ FROM invoices');
    accepts('SELECT 1 -- delete everything\n FROM invoices');
  });

  it('çift tırnaklı kolon adı yanlış pozitif vermez', () => {
    accepts('SELECT "set", "create" FROM invoices');
  });

  it('information_schema okuması serbest', () => {
    accepts("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  });

  it('cast (::), array slice ve sondaki ; sorun değil', () => {
    accepts('SELECT total::numeric FROM invoices');
    accepts('SELECT 1;');
    accepts('SELECT (ARRAY[1,2,3])[1:2]');
  });
});

describe('sanitizeForScan', () => {
  it('string ve comment içeriğini maskeler, uzunluğu korur', () => {
    const sql = "SELECT 'drop' /* alter */ FROM t";
    const out = sanitizeForScan(sql);
    assert.equal(out.length, sql.length);
    assert.ok(!/drop/i.test(out));
    assert.ok(!/alter/i.test(out));
    assert.ok(/SELECT/.test(out));
    assert.ok(/FROM t/.test(out));
  });
});

describe('maxPlaceholderIndex', () => {
  it('en yüksek $n', () => {
    assert.equal(maxPlaceholderIndex('SELECT * FROM t WHERE a=$1 AND b=$3'), 3);
    assert.equal(maxPlaceholderIndex('SELECT 1'), 0);
    assert.equal(maxPlaceholderIndex("SELECT '$5' FROM t"), 0); // string içi sayılmaz
  });
});
