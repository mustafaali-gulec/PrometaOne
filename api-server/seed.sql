-- =====================================================================
-- PROMETA ONE — Seed Data
-- 4 demo kullanıcı (admin, mustafa, editor, viewer) + 1 örnek şirket
-- =====================================================================

-- Şifre hash'leri seed.js tarafından güncellenir, burada placeholder
INSERT INTO users (username, password_hash, full_name, email, role, active)
VALUES
  ('admin',   'PLACEHOLDER', 'Sistem Yöneticisi',     'admin@prometahr.com',   'admin',  true),
  ('mustafa', 'PLACEHOLDER', 'Mustafa CFO',            'mustafa@prometahr.com', 'cfo',    true),
  ('editor',  'PLACEHOLDER', 'Düzenleyici Kullanıcı',  'editor@prometahr.com',  'editor', true),
  ('viewer',  'PLACEHOLDER', 'Görüntüleyici',          'viewer@prometahr.com',  'viewer', true)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name;

-- Örnek şirket (sadece companies tablosu varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    INSERT INTO companies (name, color, tax_no, active)
    SELECT 'Prometa HR Teknoloji A.Ş.', '#0f766e', '1234567890', true
    WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Prometa HR Teknoloji A.Ş.');
  END IF;
END $$;

-- Şirket erişimi (user_company_access) — companyId artık access-token'daki
-- `companies` claim'inden yetkilendiriliyor; bu claim user_company_access'ten
-- türetilir. Grant yoksa kullanıcı companies=[] alır → tüm company-scoped
-- endpoint'lerde 403. Her aktif kullanıcıya mevcut her şirkete kendi global
-- rolüyle erişim verilir (migration 042 ile aynı; taze kurulumda kullanıcı+
-- şirket seed'lendikten SONRA çalıştığı için burada da gerekli).
-- Idempotent: ON CONFLICT (user_id, company_id) DO NOTHING.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_company_access') THEN
    INSERT INTO user_company_access (user_id, company_id, role, granted_at)
    SELECT u.id, c.id, u.role, NOW()
    FROM users u CROSS JOIN companies c
    WHERE u.active = TRUE
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;
END $$;


-- =====================================================================
-- HR DEMO VERİSİ (Faz 4) — org ağacı, departman, pozisyon, çalışan,
-- aday ve başvurular. Tamamı idempotent: doğal anahtarlara (code,
-- employee_no, name+company) göre WHERE NOT EXISTS ile korunur, yeniden
-- çalıştırmak satır çoğaltmaz veya hata vermez.
-- Şirket id'si isimden dinamik çözülür ('Prometa HR Teknoloji A.Ş.').
-- =====================================================================
DO $$
DECLARE
  v_company_id INT;
  v_admin_id   INT;

  -- org_units
  v_root_id    INT;
  v_tech_id    INT;
  v_ops_id     INT;
  v_sales_ou   INT;

  -- departments
  v_dep_yazilim INT;
  v_dep_ik      INT;
  v_dep_finans  INT;
  v_dep_satis   INT;

  -- positions
  v_pos_be     INT;  -- open
  v_pos_fe     INT;  -- open
  v_pos_ik_uzm INT;  -- closed
  v_pos_muh    INT;  -- draft
  v_pos_satis  INT;  -- open
  v_pos_lead   INT;  -- closed

  -- employees
  v_emp_ahmet   INT;
  v_emp_zeynep  INT;
  v_emp_mehmet  INT;
  v_emp_elif    INT;
  v_emp_can     INT;
  v_emp_burak   INT;
  v_emp_seda    INT;

  -- candidates
  v_cand_deniz  INT;
  v_cand_gizem  INT;
  v_cand_kerem  INT;
  v_cand_aylin  INT;
  v_cand_emre   INT;
BEGIN
  -- HR tabloları yoksa (012_hr.sql migrate edilmemişse) sessizce çık.
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_units') THEN
    RAISE NOTICE 'HR tabloları yok — HR seed atlandı';
    RETURN;
  END IF;

  SELECT id INTO v_company_id
  FROM companies WHERE name = 'Prometa HR Teknoloji A.Ş.' LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Demo şirket bulunamadı — HR seed atlandı';
    RETURN;
  END IF;

  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' LIMIT 1;

  -- -----------------------------------------------------------------
  -- ORG UNITS — kök + 3 alt birim (code üzerinden idempotent)
  -- -----------------------------------------------------------------
  INSERT INTO org_units (company_id, parent_id, name, code, sort_order)
  SELECT v_company_id, NULL, 'Genel Müdürlük', 'GM', 0
  WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE company_id = v_company_id AND code = 'GM');
  SELECT id INTO v_root_id FROM org_units WHERE company_id = v_company_id AND code = 'GM';

  INSERT INTO org_units (company_id, parent_id, name, code, sort_order)
  SELECT v_company_id, v_root_id, 'Teknoloji', 'TEK', 1
  WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE company_id = v_company_id AND code = 'TEK');
  SELECT id INTO v_tech_id FROM org_units WHERE company_id = v_company_id AND code = 'TEK';

  INSERT INTO org_units (company_id, parent_id, name, code, sort_order)
  SELECT v_company_id, v_root_id, 'Operasyon', 'OPS', 2
  WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE company_id = v_company_id AND code = 'OPS');
  SELECT id INTO v_ops_id FROM org_units WHERE company_id = v_company_id AND code = 'OPS';

  INSERT INTO org_units (company_id, parent_id, name, code, sort_order)
  SELECT v_company_id, v_root_id, 'Satış & Pazarlama', 'SAT', 3
  WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE company_id = v_company_id AND code = 'SAT');
  SELECT id INTO v_sales_ou FROM org_units WHERE company_id = v_company_id AND code = 'SAT';

  -- -----------------------------------------------------------------
  -- DEPARTMENTS — org_unit'lere bağlı (code üzerinden idempotent)
  -- -----------------------------------------------------------------
  INSERT INTO departments (company_id, org_unit_id, name, code)
  SELECT v_company_id, v_tech_id, 'Yazılım Geliştirme', 'DEP-YAZ'
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = v_company_id AND code = 'DEP-YAZ');
  SELECT id INTO v_dep_yazilim FROM departments WHERE company_id = v_company_id AND code = 'DEP-YAZ';

  INSERT INTO departments (company_id, org_unit_id, name, code)
  SELECT v_company_id, v_ops_id, 'İnsan Kaynakları', 'DEP-IK'
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = v_company_id AND code = 'DEP-IK');
  SELECT id INTO v_dep_ik FROM departments WHERE company_id = v_company_id AND code = 'DEP-IK';

  INSERT INTO departments (company_id, org_unit_id, name, code)
  SELECT v_company_id, v_ops_id, 'Finans & Muhasebe', 'DEP-FIN'
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = v_company_id AND code = 'DEP-FIN');
  SELECT id INTO v_dep_finans FROM departments WHERE company_id = v_company_id AND code = 'DEP-FIN';

  INSERT INTO departments (company_id, org_unit_id, name, code)
  SELECT v_company_id, v_sales_ou, 'Satış', 'DEP-SAT'
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = v_company_id AND code = 'DEP-SAT');
  SELECT id INTO v_dep_satis FROM departments WHERE company_id = v_company_id AND code = 'DEP-SAT';

  -- -----------------------------------------------------------------
  -- POSITIONS — karışık statü (en az 2 'open'). title+company doğal anahtar.
  -- -----------------------------------------------------------------
  INSERT INTO positions (company_id, department_id, title, description, status, headcount_target, min_salary, max_salary)
  SELECT v_company_id, v_dep_yazilim, 'Backend Geliştirici', 'Node.js / TypeScript API geliştirme', 'open', 2, 90000, 140000
  WHERE NOT EXISTS (SELECT 1 FROM positions WHERE company_id = v_company_id AND title = 'Backend Geliştirici');
  SELECT id INTO v_pos_be FROM positions WHERE company_id = v_company_id AND title = 'Backend Geliştirici';

  INSERT INTO positions (company_id, department_id, title, description, status, headcount_target, min_salary, max_salary)
  SELECT v_company_id, v_dep_yazilim, 'Frontend Geliştirici', 'React / Vite arayüz geliştirme', 'open', 1, 85000, 130000
  WHERE NOT EXISTS (SELECT 1 FROM positions WHERE company_id = v_company_id AND title = 'Frontend Geliştirici');
  SELECT id INTO v_pos_fe FROM positions WHERE company_id = v_company_id AND title = 'Frontend Geliştirici';

  INSERT INTO positions (company_id, department_id, title, description, status, headcount_target, min_salary, max_salary)
  SELECT v_company_id, v_dep_ik, 'İK Uzmanı', 'İşe alım ve özlük süreçleri', 'closed', 1, 60000, 90000
  WHERE NOT EXISTS (SELECT 1 FROM positions WHERE company_id = v_company_id AND title = 'İK Uzmanı');
  SELECT id INTO v_pos_ik_uzm FROM positions WHERE company_id = v_company_id AND title = 'İK Uzmanı';

  INSERT INTO positions (company_id, department_id, title, description, status, headcount_target, min_salary, max_salary)
  SELECT v_company_id, v_dep_finans, 'Muhasebe Uzmanı', 'Genel muhasebe ve raporlama', 'draft', 1, 70000, 100000
  WHERE NOT EXISTS (SELECT 1 FROM positions WHERE company_id = v_company_id AND title = 'Muhasebe Uzmanı');
  SELECT id INTO v_pos_muh FROM positions WHERE company_id = v_company_id AND title = 'Muhasebe Uzmanı';

  INSERT INTO positions (company_id, department_id, title, description, status, headcount_target, min_salary, max_salary)
  SELECT v_company_id, v_dep_satis, 'Satış Temsilcisi', 'Kurumsal satış ve müşteri ilişkileri', 'open', 3, 55000, 95000
  WHERE NOT EXISTS (SELECT 1 FROM positions WHERE company_id = v_company_id AND title = 'Satış Temsilcisi');
  SELECT id INTO v_pos_satis FROM positions WHERE company_id = v_company_id AND title = 'Satış Temsilcisi';

  INSERT INTO positions (company_id, department_id, title, description, status, headcount_target, min_salary, max_salary)
  SELECT v_company_id, v_dep_yazilim, 'Takım Lideri', 'Yazılım ekip yönetimi', 'closed', 1, 130000, 180000
  WHERE NOT EXISTS (SELECT 1 FROM positions WHERE company_id = v_company_id AND title = 'Takım Lideri');
  SELECT id INTO v_pos_lead FROM positions WHERE company_id = v_company_id AND title = 'Takım Lideri';

  -- -----------------------------------------------------------------
  -- EMPLOYEES — employee_no (şirket içi benzersiz) doğal anahtar.
  -- -----------------------------------------------------------------
  INSERT INTO employees (company_id, department_id, position_id, employee_no, first_name, last_name, email, phone, hire_date, status, employment_type)
  SELECT v_company_id, v_dep_yazilim, v_pos_lead, 'EMP-001', 'Ahmet', 'Yılmaz', 'ahmet.yilmaz@prometahr.com', '+905301112201', DATE '2021-03-01', 'active', 'full_time'
  WHERE NOT EXISTS (SELECT 1 FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-001');
  SELECT id INTO v_emp_ahmet FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-001';

  INSERT INTO employees (company_id, department_id, position_id, employee_no, first_name, last_name, email, phone, hire_date, status, employment_type)
  SELECT v_company_id, v_dep_yazilim, v_pos_be, 'EMP-002', 'Zeynep', 'Kaya', 'zeynep.kaya@prometahr.com', '+905301112202', DATE '2022-06-15', 'active', 'full_time'
  WHERE NOT EXISTS (SELECT 1 FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-002');
  SELECT id INTO v_emp_zeynep FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-002';

  INSERT INTO employees (company_id, department_id, position_id, employee_no, first_name, last_name, email, phone, hire_date, status, employment_type)
  SELECT v_company_id, v_dep_yazilim, v_pos_fe, 'EMP-003', 'Mehmet', 'Demir', 'mehmet.demir@prometahr.com', '+905301112203', DATE '2024-11-01', 'probation', 'full_time'
  WHERE NOT EXISTS (SELECT 1 FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-003');
  SELECT id INTO v_emp_mehmet FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-003';

  INSERT INTO employees (company_id, department_id, position_id, employee_no, first_name, last_name, email, phone, hire_date, status, employment_type)
  SELECT v_company_id, v_dep_ik, v_pos_ik_uzm, 'EMP-004', 'Elif', 'Şahin', 'elif.sahin@prometahr.com', '+905301112204', DATE '2020-09-10', 'active', 'full_time'
  WHERE NOT EXISTS (SELECT 1 FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-004');
  SELECT id INTO v_emp_elif FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-004';

  INSERT INTO employees (company_id, department_id, position_id, employee_no, first_name, last_name, email, phone, hire_date, status, employment_type)
  SELECT v_company_id, v_dep_finans, v_pos_muh, 'EMP-005', 'Can', 'Aydın', 'can.aydin@prometahr.com', '+905301112205', DATE '2023-01-20', 'active', 'full_time'
  WHERE NOT EXISTS (SELECT 1 FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-005');
  SELECT id INTO v_emp_can FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-005';

  INSERT INTO employees (company_id, department_id, position_id, employee_no, first_name, last_name, email, phone, hire_date, status, employment_type)
  SELECT v_company_id, v_dep_satis, v_pos_satis, 'EMP-006', 'Burak', 'Çelik', 'burak.celik@prometahr.com', '+905301112206', DATE '2022-04-05', 'active', 'full_time'
  WHERE NOT EXISTS (SELECT 1 FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-006');
  SELECT id INTO v_emp_burak FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-006';

  INSERT INTO employees (company_id, department_id, position_id, employee_no, first_name, last_name, email, phone, hire_date, status, employment_type)
  SELECT v_company_id, v_dep_satis, v_pos_satis, 'EMP-007', 'Seda', 'Arslan', 'seda.arslan@prometahr.com', '+905301112207', DATE '2024-12-02', 'probation', 'part_time'
  WHERE NOT EXISTS (SELECT 1 FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-007');
  SELECT id INTO v_emp_seda FROM employees WHERE company_id = v_company_id AND employee_no = 'EMP-007';

  -- Departman yöneticilerini ata (idempotent — sadece NULL ise güncelle)
  UPDATE departments SET manager_employee_id = v_emp_ahmet
    WHERE id = v_dep_yazilim AND manager_employee_id IS NULL;
  UPDATE departments SET manager_employee_id = v_emp_elif
    WHERE id = v_dep_ik AND manager_employee_id IS NULL;
  UPDATE departments SET manager_employee_id = v_emp_can
    WHERE id = v_dep_finans AND manager_employee_id IS NULL;
  UPDATE departments SET manager_employee_id = v_emp_burak
    WHERE id = v_dep_satis AND manager_employee_id IS NULL;

  -- -----------------------------------------------------------------
  -- CANDIDATES — email+company doğal anahtar, farklı kaynaklar.
  -- -----------------------------------------------------------------
  INSERT INTO candidates (company_id, first_name, last_name, email, phone, source, notes)
  SELECT v_company_id, 'Deniz', 'Yıldız', 'deniz.yildiz@example.com', '+905321112301', 'linkedin', 'Güçlü Node.js geçmişi'
  WHERE NOT EXISTS (SELECT 1 FROM candidates WHERE company_id = v_company_id AND email = 'deniz.yildiz@example.com');
  SELECT id INTO v_cand_deniz FROM candidates WHERE company_id = v_company_id AND email = 'deniz.yildiz@example.com';

  INSERT INTO candidates (company_id, first_name, last_name, email, phone, source, notes)
  SELECT v_company_id, 'Gizem', 'Aksoy', 'gizem.aksoy@example.com', '+905321112302', 'referral', 'Çalışan referansı'
  WHERE NOT EXISTS (SELECT 1 FROM candidates WHERE company_id = v_company_id AND email = 'gizem.aksoy@example.com');
  SELECT id INTO v_cand_gizem FROM candidates WHERE company_id = v_company_id AND email = 'gizem.aksoy@example.com';

  INSERT INTO candidates (company_id, first_name, last_name, email, phone, source, notes)
  SELECT v_company_id, 'Kerem', 'Doğan', 'kerem.dogan@example.com', '+905321112303', 'jobboard', 'Kariyer.net başvurusu'
  WHERE NOT EXISTS (SELECT 1 FROM candidates WHERE company_id = v_company_id AND email = 'kerem.dogan@example.com');
  SELECT id INTO v_cand_kerem FROM candidates WHERE company_id = v_company_id AND email = 'kerem.dogan@example.com';

  INSERT INTO candidates (company_id, first_name, last_name, email, phone, source, notes)
  SELECT v_company_id, 'Aylin', 'Koç', 'aylin.koc@example.com', '+905321112304', 'agency', 'Danışmanlık firması'
  WHERE NOT EXISTS (SELECT 1 FROM candidates WHERE company_id = v_company_id AND email = 'aylin.koc@example.com');
  SELECT id INTO v_cand_aylin FROM candidates WHERE company_id = v_company_id AND email = 'aylin.koc@example.com';

  INSERT INTO candidates (company_id, first_name, last_name, email, phone, source, notes)
  SELECT v_company_id, 'Emre', 'Polat', 'emre.polat@example.com', '+905321112305', 'direct', 'Doğrudan başvuru'
  WHERE NOT EXISTS (SELECT 1 FROM candidates WHERE company_id = v_company_id AND email = 'emre.polat@example.com');
  SELECT id INTO v_cand_emre FROM candidates WHERE company_id = v_company_id AND email = 'emre.polat@example.com';

  -- -----------------------------------------------------------------
  -- APPLICATIONS — açık pozisyonlara, farklı stage'ler (funnel için).
  -- Doğal anahtar: (candidate_id, position_id). Trigger stage_history'yi
  -- otomatik yazar — manuel ekleme YOK.
  -- -----------------------------------------------------------------
  INSERT INTO applications (company_id, candidate_id, position_id, stage, stage_changed_by, salary_expectation, notes)
  SELECT v_company_id, v_cand_deniz, v_pos_be, 'screening', v_admin_id, 125000, 'Telefon görüşmesi yapıldı'
  WHERE NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = v_cand_deniz AND position_id = v_pos_be);

  INSERT INTO applications (company_id, candidate_id, position_id, stage, stage_changed_by, salary_expectation, notes)
  SELECT v_company_id, v_cand_gizem, v_pos_be, 'new', v_admin_id, 110000, 'Yeni başvuru'
  WHERE NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = v_cand_gizem AND position_id = v_pos_be);

  INSERT INTO applications (company_id, candidate_id, position_id, stage, stage_changed_by, salary_expectation, notes)
  SELECT v_company_id, v_cand_kerem, v_pos_fe, 'interview', v_admin_id, 120000, 'Teknik mülakat planlandı'
  WHERE NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = v_cand_kerem AND position_id = v_pos_fe);

  INSERT INTO applications (company_id, candidate_id, position_id, stage, stage_changed_by, salary_expectation, notes)
  SELECT v_company_id, v_cand_aylin, v_pos_satis, 'offer', v_admin_id, 90000, 'Teklif hazırlanıyor'
  WHERE NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = v_cand_aylin AND position_id = v_pos_satis);

  INSERT INTO applications (company_id, candidate_id, position_id, stage, stage_changed_by, salary_expectation, notes)
  SELECT v_company_id, v_cand_emre, v_pos_satis, 'new', v_admin_id, 80000, 'Yeni başvuru'
  WHERE NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = v_cand_emre AND position_id = v_pos_satis);

  INSERT INTO applications (company_id, candidate_id, position_id, stage, stage_changed_by, salary_expectation, notes)
  SELECT v_company_id, v_cand_deniz, v_pos_fe, 'screening', v_admin_id, 118000, 'İkinci pozisyon değerlendirmesi'
  WHERE NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = v_cand_deniz AND position_id = v_pos_fe);

  RAISE NOTICE 'HR seed tamamlandı (company_id=%)', v_company_id;
END $$;
