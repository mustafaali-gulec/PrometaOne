-- ============================================================================
-- 008_views.sql
-- Promet CF — Hesaplanan değerler için view'lar
-- ============================================================================

-- ============================================================================
-- Banka hesabı bakiyesi (opening + tüm transfer girişleri - tüm transfer çıkışları + faturadan gelen ödemeler)
-- ============================================================================
CREATE OR REPLACE VIEW v_bank_balances AS
SELECT
  ba.id,
  ba.company_id,
  ba.bank_id,
  ba.name,
  ba.currency,
  ba.opening_balance
    + COALESCE((
        SELECT SUM(CASE
          WHEN t.to_type = 'bank' AND t.to_id = ba.id THEN t.to_amount
          ELSE 0
        END)
        FROM transfers t
        WHERE t.to_type = 'bank' AND t.to_id = ba.id
      ), 0)
    - COALESCE((
        SELECT SUM(CASE
          WHEN t.from_type = 'bank' AND t.from_id = ba.id THEN t.from_amount
          ELSE 0
        END)
        FROM transfers t
        WHERE t.from_type = 'bank' AND t.from_id = ba.id
      ), 0)
    - COALESCE((
        -- borç faturalarımızın bu hesaptan ödemeleri (out)
        SELECT SUM(p.amount)
        FROM invoice_payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE p.bank_account_id = ba.id AND i.type = 'in'
      ), 0)
    + COALESCE((
        -- alacaklarımızdan bu hesaba tahsilatlar (in)
        SELECT SUM(p.amount)
        FROM invoice_payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE p.bank_account_id = ba.id AND i.type = 'out'
      ), 0)
    AS balance
FROM bank_accounts ba
WHERE ba.active = TRUE;

-- ============================================================================
-- Kasa hesabı bakiyesi
-- ============================================================================
CREATE OR REPLACE VIEW v_kasa_balances AS
SELECT
  ka.id,
  ka.company_id,
  ka.name,
  ka.currency,
  ka.opening_balance
    + COALESCE((
        SELECT SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END)
        FROM kasa_entries
        WHERE kasa_account_id = ka.id
      ), 0)
    + COALESCE((
        SELECT SUM(t.to_amount)
        FROM transfers t
        WHERE t.to_type = 'kasa' AND t.to_id = ka.id
      ), 0)
    - COALESCE((
        SELECT SUM(t.from_amount)
        FROM transfers t
        WHERE t.from_type = 'kasa' AND t.from_id = ka.id
      ), 0)
    - COALESCE((
        SELECT SUM(p.amount)
        FROM invoice_payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE p.kasa_account_id = ka.id AND i.type = 'in'
      ), 0)
    + COALESCE((
        SELECT SUM(p.amount)
        FROM invoice_payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE p.kasa_account_id = ka.id AND i.type = 'out'
      ), 0)
    AS balance
FROM kasa_accounts ka
WHERE ka.active = TRUE;

-- ============================================================================
-- Şirket için aktif yıl özeti (Dashboard için)
-- ============================================================================
CREATE OR REPLACE VIEW v_company_summary AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  c.fiscal_year,
  c.fiscal_start_month,
  c.opening_cash,
  COALESCE(SUM(CASE WHEN cat.section = 'inflows' THEN cl.value ELSE 0 END), 0)
    AS total_inflow,
  COALESCE(SUM(CASE WHEN cat.section = 'outflows' THEN cl.value ELSE 0 END), 0)
    AS total_outflow,
  COALESCE(SUM(CASE WHEN cat.section = 'nonPnlOutflows' THEN cl.value ELSE 0 END), 0)
    AS total_non_pnl,
  c.opening_cash
    + COALESCE(SUM(CASE WHEN cat.section = 'inflows' THEN cl.value ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN cat.section = 'outflows' THEN cl.value ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN cat.section = 'nonPnlOutflows' THEN cl.value ELSE 0 END), 0)
    AS projected_closing_cash
FROM companies c
LEFT JOIN categories cat ON cat.company_id = c.id
LEFT JOIN cells cl ON cl.category_id = cat.id AND cl.fiscal_year = c.fiscal_year
GROUP BY c.id;

-- ============================================================================
-- Pending invoices count for notification badge
-- ============================================================================
CREATE OR REPLACE VIEW v_invoice_alerts AS
SELECT
  i.company_id,
  COUNT(*) FILTER (WHERE i.due_date < CURRENT_DATE AND i.paid_amount < i.total) AS overdue_count,
  COUNT(*) FILTER (WHERE i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
                    AND i.paid_amount < i.total) AS due_soon_count,
  COALESCE(SUM(CASE
    WHEN i.due_date < CURRENT_DATE AND i.paid_amount < i.total THEN i.total - i.paid_amount
    ELSE 0
  END), 0) AS overdue_total,
  COALESCE(SUM(CASE
    WHEN i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
         AND i.paid_amount < i.total THEN i.total - i.paid_amount
    ELSE 0
  END), 0) AS due_soon_total
FROM invoices i
GROUP BY i.company_id;
