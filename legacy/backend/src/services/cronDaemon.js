/* =====================================================================
   PROMETA ONE — CRON DAEMON
   ---------------------------------------------------------------------
   Sunucu tarafında periyodik bildirim üretme servisi.
   
   Çalışma Sıklığı: Her saat başı (cron: 0 * * * *)
   
   Kontrolleri:
   1. Görev vadesi yaklaşan görevler (1-3 gün) → atanan kişiye bildirim
   2. Vadesi geçen faturalar → ilgili sorumluya bildirim
   3. Bekleyen onaylar 3+ gündür beklemiyor mu → eskalasyon
   4. Vergi takvimi yaklaşan vergiler (3-7 gün) → muhasebe sorumlusu
   5. Çek/senet vadesi yaklaşan → finans sorumlusu
   
   Kullanım:
     const cron = require("./services/cronDaemon");
     cron.start();
     // veya tek seferlik çalıştır:
     await cron.runOnce();
===================================================================== */

const cron = require("node-cron");
const { sendEmail } = require("./emailService"); // SMTP gönderim helper

// ----- KONFIGURASYON -----
const CONFIG = {
  // Cron pattern: dakika saat gün ay haftaningünü
  schedule: process.env.CRON_SCHEDULE || "0 9 * * *",  // Her gün saat 9'da
  // Aktiflik
  enabled: process.env.CRON_ENABLED !== "false",
  // Test modunu açar (kayıt etmez, sadece logla)
  dryRun: process.env.CRON_DRY_RUN === "true",
  // Eşikler
  taskDueWarningDays: 3,      // 3 gün ve daha az kalan görevler
  invoiceOverdueGraceDays: 1, // 1 gün geciken faturalar (overdue)
  approvalStaleDays: 3,        // 3+ gündür bekleyen onaylar eskalasyon
  taxWarningDays: 7,           // 7 gün içinde yaklaşan vergi
  checkDueWarningDays: 5,      // 5 gün içinde vadesi gelen çek/senet
};

// ----- KONTROLLER -----

/**
 * 1. Görev vadesi yaklaşan görevler için bildirim
 */
async function checkTaskDueSoon(db) {
  const today = new Date();
  const warnDate = new Date(today);
  warnDate.setDate(warnDate.getDate() + CONFIG.taskDueWarningDays);
  const todayStr = today.toISOString().slice(0, 10);
  const warnStr = warnDate.toISOString().slice(0, 10);

  const tasks = await db.getTasks();
  const targets = tasks.filter(t =>
    ["todo", "in_progress", "review"].includes(t.status) &&
    t.dueDate && t.dueDate >= todayStr && t.dueDate <= warnStr
  );

  const notifs = [];
  // Kullanıcı bazında topla
  const byUser = {};
  targets.forEach(t => {
    const uname = t.assigneeUsername;
    if (!uname) return;
    if (!byUser[uname]) byUser[uname] = [];
    byUser[uname].push(t);
  });

  Object.entries(byUser).forEach(([uname, userTasks]) => {
    notifs.push({
      recipientUserId: uname,
      kind: "task_due_soon",
      title: `⏰ ${userTasks.length} görevin vadesi yaklaşıyor`,
      body: userTasks.slice(0, 3).map(t => `• ${t.title} (${t.dueDate})`).join("\n"),
      link: "tasks",
      createdBy: "system",
      meta: { taskIds: userTasks.map(t => t.id) },
      sendEmail: true,  // E-posta da gönder
    });
  });

  return notifs;
}

/**
 * 2. Vadesi geçen faturalar (overdue receivables)
 */
async function checkOverdueInvoices(db) {
  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.invoiceOverdueGraceDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const invoices = await db.getInvoices();
  const overdue = invoices.filter(inv => {
    if (!inv.dueDate || inv.dueDate >= cutoffStr) return false;
    const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
    return remaining > 0.01;
  });

  if (overdue.length === 0) return [];

  // Finans/muhasebe sorumlularına toplu bildirim
  const financeRoles = ["admin", "cfo", "manager"];
  const users = await db.getUsers();
  const recipients = users.filter(u => financeRoles.includes(u.role));

  const totalOverdue = overdue.reduce((s, i) =>
    s + ((Number(i.total) || 0) - (Number(i.paidAmount) || 0)), 0);

  return recipients.map(u => ({
    recipientUserId: u.username,
    kind: "invoice_overdue",
    title: `⚠ ${overdue.length} fatura vadesi geçti`,
    body: `Toplam gecikmiş tutar: ${totalOverdue.toFixed(2)} ₺`,
    link: "invoices",
    createdBy: "system",
    meta: { count: overdue.length, totalAmount: totalOverdue },
    sendEmail: true,
  }));
}

/**
 * 3. 3+ gündür bekleyen onaylar — eskalasyon
 */
async function checkStaleApprovals(db) {
  const today = new Date();
  const staleDate = new Date(today);
  staleDate.setDate(staleDate.getDate() - CONFIG.approvalStaleDays);

  const requests = await db.getApprovalRequests();
  const stale = requests.filter(r =>
    r.status === "pending" &&
    new Date(r.requestedAt) < staleDate
  );

  const notifs = [];
  const users = await db.getUsers();

  stale.forEach(r => {
    const currentLevel = r.currentLevel || 0;
    const levelRoles = r.levels?.[currentLevel]?.roles || [];
    const approvers = users.filter(u =>
      levelRoles.includes(u.role) || u.role === "admin"
    );
    approvers.forEach(u => {
      if (u.username === r.requestedBy) return;
      notifs.push({
        recipientUserId: u.username,
        kind: "approval_stale",
        title: `🚨 Geciken onay: ${r.entitySummary}`,
        body: `${CONFIG.approvalStaleDays}+ gündür onay bekliyor. ${r.amount} ${r.currency || "₺"}`,
        link: "approvals",
        createdBy: "system",
        meta: { requestId: r.id, daysWaiting: Math.floor((today - new Date(r.requestedAt)) / (24 * 60 * 60 * 1000)) },
        sendEmail: true,
      });
    });
  });

  return notifs;
}

/**
 * 4. Yaklaşan vergi takvimi (TR)
 */
async function checkTaxDeadlines(db) {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;  // 1-12

  const upcoming = [];

  // KDV (her ayın 24'ü)
  if (day >= 24 - CONFIG.taxWarningDays && day <= 24) {
    upcoming.push({ name: "KDV Beyannamesi", deadline: `${month.toString().padStart(2, "0")}-24`, daysLeft: 24 - day });
  }
  // Muhtasar (her ayın 26'sı)
  if (day >= 26 - CONFIG.taxWarningDays && day <= 26) {
    upcoming.push({ name: "Muhtasar Beyanı", deadline: `${month.toString().padStart(2, "0")}-26`, daysLeft: 26 - day });
  }
  // Geçici vergi (Şubat/Mayıs/Ağustos/Kasım 17'si)
  if ([2, 5, 8, 11].includes(month) && day >= 17 - CONFIG.taxWarningDays && day <= 17) {
    upcoming.push({ name: "Geçici Vergi", deadline: `${month.toString().padStart(2, "0")}-17`, daysLeft: 17 - day });
  }

  if (upcoming.length === 0) return [];

  const users = await db.getUsers();
  const recipients = users.filter(u => ["admin", "cfo", "manager"].includes(u.role));

  return recipients.map(u => ({
    recipientUserId: u.username,
    kind: "tax_deadline_warning",
    title: `📅 ${upcoming.length} vergi tarihi yaklaşıyor`,
    body: upcoming.map(u => `• ${u.name} - ${u.daysLeft} gün kaldı`).join("\n"),
    link: "dashboard",
    createdBy: "system",
    meta: { taxes: upcoming },
    sendEmail: true,
  }));
}

/**
 * 5. Çek/senet vadesi yaklaşan
 */
async function checkUpcomingChecks(db) {
  const today = new Date();
  const warnDate = new Date(today);
  warnDate.setDate(warnDate.getDate() + CONFIG.checkDueWarningDays);
  const todayStr = today.toISOString().slice(0, 10);
  const warnStr = warnDate.toISOString().slice(0, 10);

  const checks = await db.getChecks();
  const upcoming = checks.filter(c =>
    ["portfolio", "in_bank"].includes(c.status) &&
    c.dueDate && c.dueDate >= todayStr && c.dueDate <= warnStr
  );

  if (upcoming.length === 0) return [];

  const users = await db.getUsers();
  const recipients = users.filter(u => ["admin", "cfo", "manager"].includes(u.role));

  return recipients.map(u => ({
    recipientUserId: u.username,
    kind: "check_due_soon",
    title: `📅 ${upcoming.length} çek/senet vadesi yaklaşıyor`,
    body: upcoming.slice(0, 5).map(c => `• ${c.serialNo} - ${c.partyName} (${c.dueDate}) - ${c.amount} ₺`).join("\n"),
    link: "checks",
    createdBy: "system",
    meta: { checkIds: upcoming.map(c => c.id) },
    sendEmail: true,
  }));
}

// ----- ANA RUNNER -----

async function runOnce(db) {
  console.log(`[CRON] Started at ${new Date().toISOString()}`);

  const allChecks = [
    { name: "TasksDueSoon", fn: checkTaskDueSoon },
    { name: "OverdueInvoices", fn: checkOverdueInvoices },
    { name: "StaleApprovals", fn: checkStaleApprovals },
    { name: "TaxDeadlines", fn: checkTaxDeadlines },
    { name: "UpcomingChecks", fn: checkUpcomingChecks },
  ];

  let totalNotifications = 0;
  let totalEmails = 0;

  for (const check of allChecks) {
    try {
      console.log(`[CRON] Running ${check.name}...`);
      const notifs = await check.fn(db);

      if (CONFIG.dryRun) {
        console.log(`[CRON] [DRY-RUN] ${check.name}: ${notifs.length} notifications would be sent`);
        notifs.forEach(n => console.log(`    → ${n.recipientUserId}: ${n.title}`));
        continue;
      }

      // 1) In-app notifications kaydet
      for (const notif of notifs) {
        await db.insertNotification(notif);
        totalNotifications++;

        // 2) E-posta gönder (eğer kullanıcı abone ise)
        if (notif.sendEmail) {
          const user = await db.getUserByUsername(notif.recipientUserId);
          if (user?.email && user?.emailNotifications !== false) {
            await sendEmail({
              to: user.email,
              subject: notif.title,
              text: notif.body,
              html: formatNotificationEmail(notif, user),
            }).catch(err => console.error(`[CRON] Email failed for ${user.email}:`, err.message));
            totalEmails++;
          }
        }
      }

      console.log(`[CRON] ${check.name} complete: ${notifs.length} notifications`);
    } catch (err) {
      console.error(`[CRON] ${check.name} error:`, err.message);
    }
  }

  // === SCHEDULED REPORTS ===
  // data.scheduledReports[] içindeki zamanlanmış raporları çalıştır
  try {
    console.log("[CRON] Running ScheduledReports...");
    const reportsRun = await runScheduledReports(db);
    console.log(`[CRON] ScheduledReports complete: ${reportsRun} sent`);
  } catch (err) {
    console.error("[CRON] ScheduledReports error:", err.message);
  }

  console.log(`[CRON] Finished. Total notifications: ${totalNotifications}, emails: ${totalEmails}`);
  return { totalNotifications, totalEmails };
}

// === Scheduled Reports Runner ===
async function runScheduledReports(db) {
  const data = await db.getData();
  const scheduled = data.scheduledReports || [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentDayOfWeek = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][now.getDay()];
  const currentDayOfMonth = now.getDate();
  const currentHour = String(now.getHours()).padStart(2, "0");
  const currentMin = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${currentHour}:${currentMin}`;

  let sent = 0;

  for (const sch of scheduled) {
    if (!sch.enabled) continue;

    // Bugün için tetiklenmeli mi?
    let shouldRun = false;
    if (sch.frequency === "daily") shouldRun = true;
    if (sch.frequency === "weekly" && sch.dayOfWeek === currentDayOfWeek) shouldRun = true;
    if (sch.frequency === "monthly" && sch.dayOfMonth === currentDayOfMonth) shouldRun = true;

    if (!shouldRun) continue;

    // Bugün zaten gönderilmiş mi?
    if (sch.lastRun && sch.lastRun.slice(0, 10) === todayStr) continue;

    // Saat geldi mi? (basit kontrol — cron daha hassas yapabilir)
    const targetHour = (sch.time || "09:00").split(":")[0];
    if (parseInt(currentHour) < parseInt(targetHour)) continue;

    console.log(`[CRON] Sending scheduled report: ${sch.reportTitle} to ${sch.recipients}`);

    if (CONFIG.dryRun) {
      console.log(`[CRON] [DRY-RUN] Would send ${sch.reportTitle} to ${sch.recipients}`);
      continue;
    }

    // Rapor içeriğini build et (basit özet - tam Excel client-side build edilir)
    const recipientList = (sch.recipients || "").split(",").map(s => s.trim()).filter(Boolean);
    if (recipientList.length === 0) continue;

    const summaryHtml = await buildReportEmailHtml(sch, data);

    for (const email of recipientList) {
      try {
        await sendEmail({
          to: email,
          subject: `📊 ${sch.reportTitle} — ${todayStr}`,
          text: `Scheduled report: ${sch.reportTitle}\n\nGenerated at: ${now.toISOString()}\n\nLog in to the application to download the full Excel file.`,
          html: summaryHtml,
        });
        sent++;
      } catch (err) {
        console.error(`[CRON] Failed to send report to ${email}:`, err.message);
      }
    }

    // lastRun güncelle — db.updateScheduledReport varsa onu kullan, yoksa generic data update
    try {
      if (typeof db.updateScheduledReport === "function") {
        await db.updateScheduledReport(sch.id, { lastRun: now.toISOString() });
      } else {
        // Fallback: genel data güncellemesi
        const freshData = await db.getData();
        const updated = (freshData.scheduledReports || []).map(s =>
          s.id === sch.id ? { ...s, lastRun: now.toISOString() } : s
        );
        if (typeof db.saveData === "function") {
          await db.saveData({ ...freshData, scheduledReports: updated });
        } else if (typeof db.setData === "function") {
          await db.setData({ ...freshData, scheduledReports: updated });
        }
      }
    } catch (updateErr) {
      console.warn(`[CRON] Failed to update lastRun for ${sch.id}:`, updateErr.message);
    }
  }

  return sent;
}

// Rapor için basit HTML email gövdesi (özet)
async function buildReportEmailHtml(sch, data) {
  const appUrl = process.env.APP_URL || "http://localhost:5173";

  // Reporta özel mini özet
  let summary = "";
  if (sch.reportId === "customer_profitability") {
    const projects = data.projects || [];
    summary = `Total active projects: ${projects.filter(p => p.status === "active").length}`;
  } else if (sch.reportId === "project_pnl") {
    summary = `Total projects: ${(data.projects || []).length}`;
  } else if (sch.reportId === "sales_pipeline") {
    const deals = data.crmDeals || [];
    summary = `Open deals: ${deals.filter(d => !["won", "lost"].includes(d.stage)).length}`;
  } else if (sch.reportId === "invoices_open") {
    const open = (data.invoices || []).filter(i => (Number(i.paidAmount) || 0) < (Number(i.total) || 0));
    summary = `Open invoices: ${open.length}`;
  }

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #7c3aed 0%, #0891b2 100%); padding: 20px; color: #fff; }
  .header h1 { margin: 0; font-size: 18pt; }
  .body { padding: 20px; }
  .summary { background: #f0fdfa; padding: 12px; border-left: 3px solid #0891b2; margin: 12px 0; }
  .cta { display: inline-block; padding: 10px 20px; background: #7c3aed; color: #fff !important; text-decoration: none; border-radius: 4px; font-weight: 700; margin-top: 12px; }
  .footer { padding: 16px 20px; background: #f3f4f6; font-size: 9pt; color: #6b7280; text-align: center; }
</style>
</head><body>
  <div class="container">
    <div class="header">
      <h1>📊 ${sch.reportTitle}</h1>
      <div>Otomatik Zamanlanmış Rapor</div>
    </div>
    <div class="body">
      <p><strong>Tarih:</strong> ${new Date().toLocaleString("tr-TR")}</p>
      <p><strong>Sıklık:</strong> ${sch.frequency === "daily" ? "Günlük" : sch.frequency === "weekly" ? "Haftalık" : "Aylık"}</p>
      ${summary ? `<div class="summary">${summary}</div>` : ""}
      <p>Detaylı Excel raporunu indirmek için uygulamada Rapor Merkezi'ne gidin.</p>
      <a href="${appUrl}/?view=reports" class="cta">Rapor Merkezi'ni Aç →</a>
    </div>
    <div class="footer">
      Bu otomatik bir rapordur. Zamanlamayı durdurmak için Rapor Merkezi'nden ayarları değiştirin.
    </div>
  </div>
</body></html>`;
}

// E-posta HTML şablonu
function formatNotificationEmail(notif, user) {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #0f766e 0%, #15803d 100%); padding: 20px; color: #fff; }
  .header h1 { margin: 0; font-size: 18pt; }
  .header .subtitle { opacity: 0.9; font-size: 11pt; margin-top: 4px; }
  .body { padding: 20px; }
  .body h2 { color: #0f766e; font-size: 13pt; margin-top: 0; }
  .body p { line-height: 1.6; font-size: 11pt; white-space: pre-line; }
  .cta { display: inline-block; padding: 10px 20px; background: #0f766e; color: #fff !important; text-decoration: none; border-radius: 4px; font-weight: 700; margin-top: 12px; }
  .footer { padding: 16px 20px; background: #f3f4f6; font-size: 9pt; color: #6b7280; text-align: center; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Prometa One</h1>
      <div class="subtitle">Otomatik Bildirim</div>
    </div>
    <div class="body">
      <h2>${notif.title}</h2>
      <p>${notif.body}</p>
      <a href="${appUrl}/${notif.link || ""}" class="cta">Uygulamayı Aç →</a>
    </div>
    <div class="footer">
      Merhaba ${user.fullName || user.username}, bu otomatik bir bildirimdir.<br>
      E-posta bildirimlerini kapatmak için ayarlarınızı kontrol edin.
    </div>
  </div>
</body></html>`;
}

// Cron schedule başlat
function start(db) {
  if (!CONFIG.enabled) {
    console.log("[CRON] Disabled by config");
    return;
  }
  if (!cron.validate(CONFIG.schedule)) {
    console.error(`[CRON] Invalid schedule: ${CONFIG.schedule}`);
    return;
  }
  console.log(`[CRON] Scheduled with pattern: ${CONFIG.schedule}`);
  cron.schedule(CONFIG.schedule, () => runOnce(db));
}

module.exports = { runOnce, start, CONFIG };
