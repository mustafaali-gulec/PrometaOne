import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, Area, AreaChart
} from "recharts";
import {
  Lock, LogOut, LayoutDashboard, Table2, FolderTree, Users, History,
  Settings, Plus, Trash2, Edit3, Save, X, ChevronRight, ChevronDown,
  TrendingUp, TrendingDown, Wallet, AlertCircle, Eye, EyeOff,
  Download, Upload, Search, Shield, FileSpreadsheet, BarChart3,
  ArrowUpRight, ArrowDownRight, Building2, Check, Calendar,
  FileDown, FileUp, FileText, RefreshCw, AlertTriangle, Info,
  Landmark, Coins, CreditCard, Copy, ArrowDownToLine, ArrowUpFromLine,
  Banknote, CircleDollarSign, ChevronsUpDown, Filter,
  ArrowLeftRight, ArrowRightLeft, Tag, Layers,
  Receipt, FileCheck, FileClock, Menu, LineChart as LineChartIcon,
  Mail, Bell, Sparkles, BellRing, ClipboardCopy,
  Briefcase, UserPlus, UserCheck, UserX, GripVertical, MapPin,
  Phone, AtSign, GraduationCap, Award, MessageSquare, Star,
  Clock, ExternalLink, Send, Bot, Trash, Maximize2, Minimize2, ArrowLeft
} from "lucide-react";

// CalendarClock ve Linkedin lucide'in eski sürümlerinde yok — bunlar için
// var olan icon'larla composite alias'lar:
const CalendarClock = Clock;
const Linkedin = ExternalLink;

/* =====================================================================
   PROMET NAKİT AKIŞ — Geliştirilebilir mimari
   ---------------------------------------------------------------------
   Storage katmanı: window.storage (key-value).
   İlerleyen aşamada Supabase'e geçiş için tüm I/O burada izole edilmiştir.
   Roller: admin > cfo > editor > viewer
===================================================================== */

const TR_MONTHS = ["OCA","ŞUB","MAR","NİS","MAY","HAZ","TEM","AĞU","EYL","EKİ","KAS","ARA"];

/* =====================================================================
   I18N — Çoklu Dil Altyapısı (TR/EN/DE/AR)
   ---------------------------------------------------------------------
   • LANGUAGES: desteklenen diller, RTL bilgisi
   • I18N_DICT: TR temel sözlük + manuel çeviriler (EN/DE/AR)
   • t(key, lang): çeviri helper
   • Eksik anahtar: TR fallback, console'a uyarı
===================================================================== */

const LANGUAGES = {
  tr: { code: "tr", name: "Türkçe",   nameNative: "Türkçe",   flag: "🇹🇷", rtl: false, locale: "tr-TR" },
  en: { code: "en", name: "İngilizce", nameNative: "English",  flag: "🇬🇧", rtl: false, locale: "en-US" },
  de: { code: "de", name: "Almanca",   nameNative: "Deutsch",  flag: "🇩🇪", rtl: false, locale: "de-DE" },
  ar: { code: "ar", name: "Arapça",    nameNative: "العربية",  flag: "🇸🇦", rtl: true,  locale: "ar-SA" },
};

// Tarayıcı dilinden Promet One'in desteklediği bir dile map'le
function detectBrowserLanguage() {
  if (typeof navigator === "undefined") return "tr";
  const langs = navigator.languages || [navigator.language || "tr"];
  for (const l of langs) {
    const code = l.toLowerCase().split("-")[0];
    if (LANGUAGES[code]) return code;
  }
  return "tr";
}

/* ---------- ÇEVIRI SÖZLÜĞÜ ----------
   Her metin "namespace.key" formatında. TR ana dildir, diğerleri opsiyonel.
   Eksik diller için TR fallback olur. Aşamalı genişlemeye uygundur.
*/
const I18N_DICT = {
  tr: {
    // ====== APP / GENEL ======
    "app.name": "Prometa One",
    "app.tagline": "Finance & HR Platform",
    "app.tagline.tr": "Finans ve İK Platformu",
    "common.save": "Kaydet",
    "common.cancel": "İptal",
    "common.delete": "Sil",
    "common.edit": "Düzenle",
    "common.add": "Ekle",
    "common.close": "Kapat",
    "common.confirm": "Onayla",
    "common.yes": "Evet",
    "common.no": "Hayır",
    "common.search": "Ara",
    "common.filter": "Filtrele",
    "common.export": "Dışa Aktar",
    "common.import": "İçe Aktar",
    "common.refresh": "Yenile",
    "common.loading": "Yükleniyor...",
    "common.empty": "Kayıt yok",
    "common.required": "Zorunlu",
    "common.optional": "İsteğe bağlı",
    "common.actions": "İşlemler",
    "common.status": "Durum",
    "common.date": "Tarih",
    "common.amount": "Tutar",
    "common.description": "Açıklama",
    "common.total": "Toplam",
    "common.name": "Ad",
    "common.code": "Kod",
    "common.color": "Renk",
    "common.type": "Tür",
    "common.note": "Not",
    "common.notes": "Notlar",
    "common.active": "Aktif",
    "common.inactive": "Pasif",
    "common.all": "Tümü",
    "common.none": "Yok",
    "common.select": "Seçiniz",
    "common.back": "Geri",
    "common.next": "İleri",
    "common.previous": "Önceki",
    "common.create": "Oluştur",
    "common.update": "Güncelle",
    "common.view": "Görüntüle",
    "common.details": "Detaylar",
    "common.settings": "Ayarlar",
    "common.language": "Dil",
    "common.currency": "Para Birimi",

    // ====== LOGIN ======
    "login.title": "Giriş",
    "login.subtitle": "Hesabınıza giriş yapın",
    "login.username": "Kullanıcı Adı",
    "login.password": "Parola",
    "login.submit": "Giriş Yap",
    "login.error.invalid": "Kullanıcı adı veya parola hatalı",
    "login.error.inactive": "Hesabınız aktif değil",
    "login.error.locked": "Çok fazla başarısız deneme. Lütfen birkaç dakika bekleyin.",
    "login.welcome": "Tekrar Hoş Geldiniz",
    "login.forgotPassword": "Şifremi unuttum",
    "login.captcha": "Doğrulama",
    "login.captcha.refresh": "Yenile",
    "login.captcha.invalid": "Doğrulama kodu hatalı",
    "login.captcha.placeholder": "Yukarıdaki sonucu yazın",

    "forgot.title": "Şifremi Unuttum",
    "forgot.subtitle": "E-posta veya kullanıcı adınızı girin, sıfırlama bağlantısı gönderelim",
    "forgot.email": "E-posta veya Kullanıcı Adı",
    "forgot.send": "Sıfırlama Bağlantısı Gönder",
    "forgot.back": "Girişe Dön",
    "forgot.success": "Bağlantı gönderildi! Lütfen e-postanızı kontrol edin",
    "forgot.notFound": "Kullanıcı bulunamadı",
    "forgot.demo.notice": "Demo modu: token konsola yazıldı (F12)",
    "forgot.tokenSent": "Sıfırlama kodu",
    "forgot.checkInbox": "Gelen kutunuzu kontrol edin",

    "reset.title": "Yeni Şifre Belirle",
    "reset.subtitle": "Yeni şifrenizi iki kere girin",
    "reset.token": "Sıfırlama Kodu",
    "reset.newPassword": "Yeni Şifre",
    "reset.confirmPassword": "Şifreyi Onayla",
    "reset.submit": "Şifreyi Sıfırla",
    "reset.error.mismatch": "Şifreler eşleşmiyor",
    "reset.error.weak": "Şifre en az 6 karakter olmalı",
    "reset.error.invalidToken": "Geçersiz veya süresi dolmuş kod",
    "reset.success": "Şifreniz başarıyla sıfırlandı",

    // ====== MENÜ ======
    "menu.dashboard": "Genel Bakış",
    "menu.cashflow": "Nakit Akış",
    "menu.banks": "Bankalar",
    "menu.kasa": "Kasa",
    "menu.loans": "Krediler",
    "menu.invoices": "Faturalar",
    "menu.transfers": "Transferler",
    "menu.hr": "HR",
    "menu.fx": "Kur Farkı",
    "menu.ai": "AI Tahmin",
    "menu.reports": "Raporlar",
    "menu.categories": "Kategoriler",
    "menu.users": "Kullanıcılar",
    "menu.audit": "Denetim",
    "menu.settings": "Ayarlar",

    // ====== DASHBOARD ======
    "dashboard.title": "Genel Bakış",
    "dashboard.subtitle": "Şirketinizin finansal pozisyonu",
    "dashboard.cashPosition": "Nakit Pozisyonu",
    "dashboard.monthlyInflow": "Aylık Giriş",
    "dashboard.monthlyOutflow": "Aylık Çıkış",
    "dashboard.netCashFlow": "Net Nakit Akışı",
    "dashboard.receivables": "Alacaklar",
    "dashboard.payables": "Borçlar",
    "dashboard.overdue": "Vadesi Geçmiş",
    "dashboard.thisMonth": "Bu Ay",
    "dashboard.thisYear": "Bu Yıl",

    // ====== BANKA ======
    "banks.title": "Banka Hesapları",
    "banks.newAccount": "Yeni Hesap",
    "banks.accountName": "Hesap Adı",
    "banks.bankName": "Banka Adı",
    "banks.iban": "IBAN",
    "banks.balance": "Bakiye",
    "banks.openingBalance": "Açılış Bakiyesi",
    "banks.movements": "Hareketler",
    "banks.addMovement": "Hareket Ekle",
    "banks.importExcel": "Excel'den İçe Aktar",
    "banks.deposit": "Yatırma",
    "banks.withdrawal": "Çekme",

    // ====== KASA ======
    "kasa.title": "Kasa Yönetimi",
    "kasa.newKasa": "Yeni Kasa",
    "kasa.entry": "Giriş",
    "kasa.exit": "Çıkış",
    "kasa.addEntry": "Hareket Ekle",
    "kasa.category": "Kategori",

    // ====== FATURA ======
    "invoices.title": "Faturalar",
    "invoices.subtitle": "Gelen ve giden faturalarınızı yönetin",
    "invoices.newInvoice": "Yeni Fatura",
    "invoices.incoming": "Gelen Faturalar",
    "invoices.outgoing": "Giden Faturalar",
    "invoices.manual": "Manuel Faturalar",
    "invoices.einvoice": "e-Fatura",
    "invoices.invoiceNo": "Fatura No",
    "invoices.counterparty": "Karşı Taraf",
    "invoices.issueDate": "Düzenleme Tarihi",
    "invoices.dueDate": "Vade Tarihi",
    "invoices.netAmount": "Net Tutar",
    "invoices.vat": "KDV",
    "invoices.paid": "Ödendi",
    "invoices.unpaid": "Ödenmedi",
    "invoices.partiallyPaid": "Kısmi Ödenmiş",
    "invoices.overdue": "Vadesi Geçmiş",
    "invoices.recordPayment": "Ödeme Kaydet",

    // ====== KREDİ ======
    "loans.title": "Krediler",
    "loans.newLoan": "Yeni Kredi",
    "loans.principal": "Ana Para",
    "loans.interestRate": "Faiz Oranı",
    "loans.term": "Vade (Ay)",
    "loans.installment": "Taksit",
    "loans.remainingBalance": "Kalan Bakiye",
    "loans.payment": "Ödeme",
    "loans.payInstallment": "Taksit Öde",

    // ====== HR ======
    "hr.title": "İnsan Kaynakları",
    "hr.organization": "Organizasyon",
    "hr.recruitment": "İşe Alım",
    "hr.employees": "Personel",
    "hr.payroll": "Bordro",
    "hr.leave": "Devam/İzin",
    "hr.orgUnits": "Organizasyon Birimleri",
    "hr.departments": "Departmanlar",
    "hr.jobTitles": "Pozisyonlar",
    "hr.newOrgUnit": "Yeni Org. Birimi",
    "hr.newDepartment": "Yeni Departman",
    "hr.newJobTitle": "Yeni Pozisyon",
    "hr.newEmployee": "Yeni Çalışan",
    "hr.firstName": "Ad",
    "hr.lastName": "Soyad",
    "hr.tcNo": "T.C. Kimlik No",
    "hr.sgkNo": "SGK Sicil No",
    "hr.startDate": "İşe Başlama",
    "hr.brutSalary": "Brüt Maaş",
    "hr.netSalary": "Net Maaş",
    "hr.employerCost": "İşveren Maliyeti",
    "hr.candidates": "Adaylar",
    "hr.interviews": "Mülakatlar",
    "hr.pipeline": "Süreç",
    "hr.positions": "Açık Pozisyonlar",

    // ====== AYARLAR ======
    "settings.title": "Ayarlar",
    "settings.language": "Dil",
    "settings.language.subtitle": "Arayüz dili",
    "settings.currency": "Para Birimi",
    "settings.currency.display": "Gösterim Para Birimi",
    "settings.theme": "Tema",
    "settings.notifications": "Bildirimler",
    "settings.profile": "Profilim",

    // ====== KULLANICI / ROL ======
    "users.title": "Kullanıcılar & Yetkiler",
    "users.users": "Kullanıcılar",
    "users.roles": "Roller",
    "users.grants": "Yetki Atamaları",
    "users.overrides": "İstisnalar",
    "users.newUser": "Yeni Kullanıcı",
    "users.newRole": "Yeni Rol",
    "users.linkedEmployee": "Bağlı Çalışan",
    "users.role": "Rol",
    "users.permissions": "İzinler",
    "users.myPermissions": "Benim Yetkilerim",

    // ====== AI ======
    "ai.assistant": "Prometa AI",
    "ai.placeholder": "Sorunuzu yazın...",
    "ai.welcome": "Merhaba! Ben Prometa AI — şirketinizin finansal ve İK verilerine erişimim var. Aşağıdaki gibi sorular sorabilirsiniz:",
    "ai.suggestions.cash": "Bu ay toplam nakit girişim ne kadar?",
    "ai.suggestions.overdue": "Vadesi geçmiş faturalarım var mı?",
    "ai.suggestions.activity": "Bugün hangi işlemler yapıldı?",
    "ai.suggestions.employees": "Aktif çalışan sayım kaç?",
    "ai.clearChat": "Sohbeti temizle",
    "ai.thinking": "Düşünüyor...",

    // ====== DENETİM ======
    "audit.title": "Denetim Kayıtları",
    "audit.user": "Kullanıcı",
    "audit.action": "İşlem",
    "audit.timestamp": "Zaman",
    "audit.details": "Detaylar",

    // ====== TOAST/BİLDİRİM ======
    "toast.saved": "Kaydedildi",
    "toast.deleted": "Silindi",
    "toast.updated": "Güncellendi",
    "toast.error": "Bir hata oluştu",
    "toast.copied": "Kopyalandı",
    "toast.created": "Oluşturuldu",
    "toast.imported": "İçe aktarıldı",
    "toast.exported": "Dışa aktarıldı",
    "toast.noPermission": "Bu işlem için yetkiniz yok",
    "toast.confirmDelete": "Silmek istediğinizden emin misiniz?",

    // ====== DASHBOARD GENİŞ ======
    "dashboard.subtitle.long": "Şirketinizin güncel finansal pozisyonu",
    "dashboard.kpi.cashTotal": "Toplam Nakit",
    "dashboard.kpi.bankBalance": "Banka Bakiyesi",
    "dashboard.kpi.kasaBalance": "Kasa Bakiyesi",
    "dashboard.kpi.totalLoans": "Toplam Kredi",
    "dashboard.kpi.openInvoices": "Açık Faturalar",
    "dashboard.kpi.overdueInvoices": "Vadesi Geçmiş",
    "dashboard.section.recentMovements": "Son Hareketler",
    "dashboard.section.upcomingDue": "Yaklaşan Vadeler",
    "dashboard.section.cashflowChart": "Aylık Akış",
    "dashboard.empty": "Henüz veri yok. Hesap ekleyerek başlayın",

    // ====== BANKA GENİŞ ======
    "banks.empty": "Henüz banka hesabı eklenmemiş",
    "banks.totalBalance": "Toplam Bakiye",
    "banks.recordCount": "{n} kayıt",
    "banks.currency": "Para Birimi",
    "banks.editAccount": "Hesabı Düzenle",
    "banks.deleteAccount": "Hesabı Sil",
    "banks.confirmDelete": "Hesabı silmek üzeresiniz. Tüm hareketleri de silinecek. Emin misiniz?",
    "banks.movementType": "Hareket Tipi",
    "banks.movement.incoming": "Gelen",
    "banks.movement.outgoing": "Giden",
    "banks.totalIn": "Toplam Giriş",
    "banks.totalOut": "Toplam Çıkış",
    "banks.netMovement": "Net Hareket",

    // ====== KASA GENİŞ ======
    "kasa.empty": "Henüz kasa eklenmemiş",
    "kasa.totalBalance": "Toplam Bakiye",
    "kasa.openingBalance": "Açılış Bakiyesi",
    "kasa.editKasa": "Kasayı Düzenle",
    "kasa.deleteKasa": "Kasayı Sil",
    "kasa.transferTo": "Transfer Et",

    // ====== FATURA GENİŞ ======
    "invoices.in.short": "Gelen",
    "invoices.out.short": "Giden",
    "invoices.status.all": "Tüm Faturalar",
    "invoices.status.open": "Açık",
    "invoices.status.paid": "Ödendi",
    "invoices.status.overdue": "Vadesi Geçmiş",
    "invoices.editInvoice": "Faturayı Düzenle",
    "invoices.deleteInvoice": "Faturayı Sil",
    "invoices.payment.amount": "Ödeme Tutarı",
    "invoices.payment.date": "Ödeme Tarihi",
    "invoices.payment.source": "Ödeme Kaynağı",
    "invoices.payment.notes": "Açıklama",
    "invoices.balance": "Kalan",
    "invoices.totalCount": "{n} fatura",
    "invoices.search": "Fatura ara",

    // ====== KREDİ GENİŞ ======
    "loans.empty": "Henüz kredi kaydı yok",
    "loans.bank": "Banka",
    "loans.startDate": "Başlangıç Tarihi",
    "loans.endDate": "Bitiş Tarihi",
    "loans.monthlyPayment": "Aylık Taksit",
    "loans.totalPaid": "Toplam Ödenen",
    "loans.editLoan": "Krediyi Düzenle",
    "loans.deleteLoan": "Krediyi Sil",
    "loans.schedule": "Ödeme Planı",
    "loans.installmentNo": "Taksit No",
    "loans.dueDate": "Vade",
    "loans.principal.short": "Anapara",
    "loans.interest.short": "Faiz",

    // ====== HR GENİŞ ======
    "hr.subtitle.long": "Personel yönetimi ve insan kaynakları süreçleri",
    "hr.tabs.organization": "Organizasyon",
    "hr.tabs.recruitment": "İşe Alım",
    "hr.tabs.employees": "Personel",
    "hr.tabs.payroll": "Bordro",
    "hr.org.empty": "Organizasyon yapısı henüz tanımlanmamış",
    "hr.org.add.unit": "Birim Ekle",
    "hr.org.add.dept": "Departman Ekle",
    "hr.org.add.jt": "Pozisyon Ekle",
    "hr.org.add.employee": "Çalışan Ekle",
    "hr.org.tree": "Ağaç Görünümü",
    "hr.org.chart": "Org Şema",
    "hr.org.flat": "Düz Liste",
    "hr.employee.status.active": "Aktif",
    "hr.employee.status.probation": "Deneme",
    "hr.employee.status.onLeave": "İzinde",
    "hr.employee.status.maternity": "Doğum İzni",
    "hr.employee.status.military": "Askerlik",
    "hr.employee.status.suspended": "Askıya Alındı",
    "hr.employee.status.terminated": "İşten Ayrıldı",
    "hr.email": "E-posta",
    "hr.phone": "Telefon",
    "hr.address": "Adres",
    "hr.totalEmployees": "Toplam Çalışan",
    "hr.activeEmployees": "Aktif",
    "hr.headcount": "Kadro",
    "hr.openPositions": "Açık Pozisyon",

    // ====== AYARLAR GENİŞ ======
    "settings.tabs.general": "Genel",
    "settings.tabs.company": "Şirket",
    "settings.tabs.currency": "Para Birimi",
    "settings.tabs.notifications": "Bildirimler",
    "settings.tabs.tcmb": "TCMB Entegrasyonu",
    "settings.tabs.einvoice": "e-Fatura",
    "settings.tabs.archive": "Arşiv",
    "settings.companies": "Şirketler",
    "settings.addCompany": "Yeni Şirket",
    "settings.activeCompany": "Aktif Şirket",
    "settings.taxNo": "Vergi No",
    "settings.taxOffice": "Vergi Dairesi",
    "settings.tcmb.apiKey": "API Anahtarı",
    "settings.tcmb.fetchRates": "Kurları Çek",
    "settings.tcmb.lastFetch": "Son Güncelleme",

    // ====== MODAL ORTAK ======
    "modal.title.new": "Yeni",
    "modal.title.edit": "Düzenle",
    "modal.title.delete": "Sil",
    "modal.confirm.title": "Onay Gerekli",
    "modal.confirm.delete": "Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",

    // ====== ARAMA / FİLTRE ======
    "filter.from": "Başlangıç",
    "filter.to": "Bitiş",
    "filter.clear": "Filtreleri Temizle",
    "filter.results": "{n} sonuç",
  },

  en: {
    "app.name": "Prometa One",
    "app.tagline": "Finance & HR Platform",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.add": "Add",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.yes": "Yes",
    "common.no": "No",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.export": "Export",
    "common.import": "Import",
    "common.refresh": "Refresh",
    "common.loading": "Loading...",
    "common.empty": "No records",
    "common.required": "Required",
    "common.optional": "Optional",
    "common.actions": "Actions",
    "common.status": "Status",
    "common.date": "Date",
    "common.amount": "Amount",
    "common.description": "Description",
    "common.total": "Total",
    "common.name": "Name",
    "common.code": "Code",
    "common.color": "Color",
    "common.type": "Type",
    "common.note": "Note",
    "common.notes": "Notes",
    "common.active": "Active",
    "common.inactive": "Inactive",
    "common.all": "All",
    "common.none": "None",
    "common.select": "Select",
    "common.back": "Back",
    "common.next": "Next",
    "common.previous": "Previous",
    "common.create": "Create",
    "common.update": "Update",
    "common.view": "View",
    "common.details": "Details",
    "common.settings": "Settings",
    "common.language": "Language",
    "common.currency": "Currency",

    "login.title": "Sign In",
    "login.subtitle": "Sign in to your account",
    "login.username": "Username",
    "login.password": "Password",
    "login.submit": "Sign In",
    "login.error.invalid": "Invalid username or password",
    "login.error.inactive": "Your account is not active",
    "login.error.locked": "Too many failed attempts. Please wait a few minutes.",
    "login.welcome": "Welcome Back",
    "login.forgotPassword": "Forgot password?",
    "login.captcha": "Verification",
    "login.captcha.refresh": "Refresh",
    "login.captcha.invalid": "Incorrect verification code",
    "login.captcha.placeholder": "Type the result above",

    "forgot.title": "Forgot Password",
    "forgot.subtitle": "Enter your email or username and we'll send a reset link",
    "forgot.email": "Email or Username",
    "forgot.send": "Send Reset Link",
    "forgot.back": "Back to Sign In",
    "forgot.success": "Link sent! Please check your email",
    "forgot.notFound": "User not found",
    "forgot.demo.notice": "Demo mode: token written to console (F12)",
    "forgot.tokenSent": "Reset code",
    "forgot.checkInbox": "Check your inbox",

    "reset.title": "Set New Password",
    "reset.subtitle": "Enter your new password twice",
    "reset.token": "Reset Code",
    "reset.newPassword": "New Password",
    "reset.confirmPassword": "Confirm Password",
    "reset.submit": "Reset Password",
    "reset.error.mismatch": "Passwords don't match",
    "reset.error.weak": "Password must be at least 6 characters",
    "reset.error.invalidToken": "Invalid or expired code",
    "reset.success": "Password reset successfully",

    "menu.dashboard": "Dashboard",
    "menu.cashflow": "Cash Flow",
    "menu.banks": "Banks",
    "menu.kasa": "Cash Box",
    "menu.loans": "Loans",
    "menu.invoices": "Invoices",
    "menu.transfers": "Transfers",
    "menu.hr": "HR",
    "menu.fx": "FX Revaluation",
    "menu.ai": "AI Forecast",
    "menu.reports": "Reports",
    "menu.categories": "Categories",
    "menu.users": "Users",
    "menu.audit": "Audit",
    "menu.settings": "Settings",

    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Your company's financial position",
    "dashboard.cashPosition": "Cash Position",
    "dashboard.monthlyInflow": "Monthly Inflow",
    "dashboard.monthlyOutflow": "Monthly Outflow",
    "dashboard.netCashFlow": "Net Cash Flow",
    "dashboard.receivables": "Receivables",
    "dashboard.payables": "Payables",
    "dashboard.overdue": "Overdue",
    "dashboard.thisMonth": "This Month",
    "dashboard.thisYear": "This Year",

    "banks.title": "Bank Accounts",
    "banks.newAccount": "New Account",
    "banks.accountName": "Account Name",
    "banks.bankName": "Bank Name",
    "banks.iban": "IBAN",
    "banks.balance": "Balance",
    "banks.openingBalance": "Opening Balance",
    "banks.movements": "Movements",
    "banks.addMovement": "Add Movement",
    "banks.importExcel": "Import from Excel",
    "banks.deposit": "Deposit",
    "banks.withdrawal": "Withdrawal",

    "kasa.title": "Cash Box",
    "kasa.newKasa": "New Cash Box",
    "kasa.entry": "Inflow",
    "kasa.exit": "Outflow",
    "kasa.addEntry": "Add Entry",
    "kasa.category": "Category",

    "invoices.title": "Invoices",
    "invoices.subtitle": "Manage your incoming and outgoing invoices",
    "invoices.newInvoice": "New Invoice",
    "invoices.incoming": "Incoming",
    "invoices.outgoing": "Outgoing",
    "invoices.manual": "Manual Invoices",
    "invoices.einvoice": "e-Invoice",
    "invoices.invoiceNo": "Invoice No.",
    "invoices.counterparty": "Counterparty",
    "invoices.issueDate": "Issue Date",
    "invoices.dueDate": "Due Date",
    "invoices.netAmount": "Net Amount",
    "invoices.vat": "VAT",
    "invoices.paid": "Paid",
    "invoices.unpaid": "Unpaid",
    "invoices.partiallyPaid": "Partially Paid",
    "invoices.overdue": "Overdue",
    "invoices.recordPayment": "Record Payment",

    "loans.title": "Loans",
    "loans.newLoan": "New Loan",
    "loans.principal": "Principal",
    "loans.interestRate": "Interest Rate",
    "loans.term": "Term (Months)",
    "loans.installment": "Installment",
    "loans.remainingBalance": "Remaining Balance",
    "loans.payment": "Payment",
    "loans.payInstallment": "Pay Installment",

    "hr.title": "Human Resources",
    "hr.organization": "Organization",
    "hr.recruitment": "Recruitment",
    "hr.employees": "Employees",
    "hr.payroll": "Payroll",
    "hr.leave": "Attendance/Leave",
    "hr.orgUnits": "Organization Units",
    "hr.departments": "Departments",
    "hr.jobTitles": "Job Titles",
    "hr.newOrgUnit": "New Org. Unit",
    "hr.newDepartment": "New Department",
    "hr.newJobTitle": "New Job Title",
    "hr.newEmployee": "New Employee",
    "hr.firstName": "First Name",
    "hr.lastName": "Last Name",
    "hr.tcNo": "National ID",
    "hr.sgkNo": "SSN",
    "hr.startDate": "Start Date",
    "hr.brutSalary": "Gross Salary",
    "hr.netSalary": "Net Salary",
    "hr.employerCost": "Employer Cost",
    "hr.candidates": "Candidates",
    "hr.interviews": "Interviews",
    "hr.pipeline": "Pipeline",
    "hr.positions": "Open Positions",

    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.language.subtitle": "Interface language",
    "settings.currency": "Currency",
    "settings.currency.display": "Display Currency",
    "settings.theme": "Theme",
    "settings.notifications": "Notifications",
    "settings.profile": "My Profile",

    "users.title": "Users & Permissions",
    "users.users": "Users",
    "users.roles": "Roles",
    "users.grants": "Permission Grants",
    "users.overrides": "Overrides",
    "users.newUser": "New User",
    "users.newRole": "New Role",
    "users.linkedEmployee": "Linked Employee",
    "users.role": "Role",
    "users.permissions": "Permissions",
    "users.myPermissions": "My Permissions",

    "ai.assistant": "Prometa AI",
    "ai.placeholder": "Type your question...",
    "ai.welcome": "Hi! I'm Prometa AI — I have access to your financial and HR data. You can ask me questions like:",
    "ai.suggestions.cash": "What is my total cash inflow this month?",
    "ai.suggestions.overdue": "Do I have any overdue invoices?",
    "ai.suggestions.activity": "What actions were taken today?",
    "ai.suggestions.employees": "How many active employees do I have?",
    "ai.clearChat": "Clear chat",
    "ai.thinking": "Thinking...",

    "audit.title": "Audit Log",
    "audit.user": "User",
    "audit.action": "Action",
    "audit.timestamp": "Timestamp",
    "audit.details": "Details",

    "toast.saved": "Saved",
    "toast.deleted": "Deleted",
    "toast.updated": "Updated",
    "toast.error": "An error occurred",
    "toast.copied": "Copied",
    "toast.created": "Created",
    "toast.imported": "Imported",
    "toast.exported": "Exported",
    "toast.noPermission": "You don't have permission for this action",
    "toast.confirmDelete": "Are you sure you want to delete?",

    "dashboard.subtitle.long": "Your company's current financial position",
    "dashboard.kpi.cashTotal": "Total Cash",
    "dashboard.kpi.bankBalance": "Bank Balance",
    "dashboard.kpi.kasaBalance": "Cash Box Balance",
    "dashboard.kpi.totalLoans": "Total Loans",
    "dashboard.kpi.openInvoices": "Open Invoices",
    "dashboard.kpi.overdueInvoices": "Overdue",
    "dashboard.section.recentMovements": "Recent Movements",
    "dashboard.section.upcomingDue": "Upcoming Due Dates",
    "dashboard.section.cashflowChart": "Monthly Flow",
    "dashboard.empty": "No data yet. Start by adding an account",

    "banks.empty": "No bank accounts added yet",
    "banks.totalBalance": "Total Balance",
    "banks.recordCount": "{n} records",
    "banks.currency": "Currency",
    "banks.editAccount": "Edit Account",
    "banks.deleteAccount": "Delete Account",
    "banks.confirmDelete": "You're about to delete this account. All its movements will be deleted too. Are you sure?",
    "banks.movementType": "Movement Type",
    "banks.movement.incoming": "Incoming",
    "banks.movement.outgoing": "Outgoing",
    "banks.totalIn": "Total In",
    "banks.totalOut": "Total Out",
    "banks.netMovement": "Net Movement",

    "kasa.empty": "No cash boxes added yet",
    "kasa.totalBalance": "Total Balance",
    "kasa.openingBalance": "Opening Balance",
    "kasa.editKasa": "Edit Cash Box",
    "kasa.deleteKasa": "Delete Cash Box",
    "kasa.transferTo": "Transfer",

    "invoices.in.short": "In",
    "invoices.out.short": "Out",
    "invoices.status.all": "All Invoices",
    "invoices.status.open": "Open",
    "invoices.status.paid": "Paid",
    "invoices.status.overdue": "Overdue",
    "invoices.editInvoice": "Edit Invoice",
    "invoices.deleteInvoice": "Delete Invoice",
    "invoices.payment.amount": "Payment Amount",
    "invoices.payment.date": "Payment Date",
    "invoices.payment.source": "Payment Source",
    "invoices.payment.notes": "Notes",
    "invoices.balance": "Balance",
    "invoices.totalCount": "{n} invoices",
    "invoices.search": "Search invoices",

    "loans.empty": "No loan records yet",
    "loans.bank": "Bank",
    "loans.startDate": "Start Date",
    "loans.endDate": "End Date",
    "loans.monthlyPayment": "Monthly Payment",
    "loans.totalPaid": "Total Paid",
    "loans.editLoan": "Edit Loan",
    "loans.deleteLoan": "Delete Loan",
    "loans.schedule": "Payment Schedule",
    "loans.installmentNo": "Installment #",
    "loans.dueDate": "Due Date",
    "loans.principal.short": "Principal",
    "loans.interest.short": "Interest",

    "hr.subtitle.long": "Personnel management and HR processes",
    "hr.tabs.organization": "Organization",
    "hr.tabs.recruitment": "Recruitment",
    "hr.tabs.employees": "Employees",
    "hr.tabs.payroll": "Payroll",
    "hr.org.empty": "Organization structure not defined yet",
    "hr.org.add.unit": "Add Unit",
    "hr.org.add.dept": "Add Department",
    "hr.org.add.jt": "Add Position",
    "hr.org.add.employee": "Add Employee",
    "hr.org.tree": "Tree View",
    "hr.org.chart": "Org Chart",
    "hr.org.flat": "Flat List",
    "hr.employee.status.active": "Active",
    "hr.employee.status.probation": "Probation",
    "hr.employee.status.onLeave": "On Leave",
    "hr.employee.status.maternity": "Maternity",
    "hr.employee.status.military": "Military",
    "hr.employee.status.suspended": "Suspended",
    "hr.employee.status.terminated": "Terminated",
    "hr.email": "Email",
    "hr.phone": "Phone",
    "hr.address": "Address",
    "hr.totalEmployees": "Total Employees",
    "hr.activeEmployees": "Active",
    "hr.headcount": "Headcount",
    "hr.openPositions": "Open Position",

    "settings.tabs.general": "General",
    "settings.tabs.company": "Company",
    "settings.tabs.currency": "Currency",
    "settings.tabs.notifications": "Notifications",
    "settings.tabs.tcmb": "TCMB Integration",
    "settings.tabs.einvoice": "e-Invoice",
    "settings.tabs.archive": "Archive",
    "settings.companies": "Companies",
    "settings.addCompany": "New Company",
    "settings.activeCompany": "Active Company",
    "settings.taxNo": "Tax No.",
    "settings.taxOffice": "Tax Office",
    "settings.tcmb.apiKey": "API Key",
    "settings.tcmb.fetchRates": "Fetch Rates",
    "settings.tcmb.lastFetch": "Last Update",

    "modal.title.new": "New",
    "modal.title.edit": "Edit",
    "modal.title.delete": "Delete",
    "modal.confirm.title": "Confirmation Required",
    "modal.confirm.delete": "Are you sure you want to delete this record? This cannot be undone.",

    "filter.from": "From",
    "filter.to": "To",
    "filter.clear": "Clear Filters",
    "filter.results": "{n} results",
  },

  de: {
    "app.name": "Prometa One",
    "app.tagline": "Finanz- & HR-Plattform",
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.delete": "Löschen",
    "common.edit": "Bearbeiten",
    "common.add": "Hinzufügen",
    "common.close": "Schließen",
    "common.confirm": "Bestätigen",
    "common.yes": "Ja",
    "common.no": "Nein",
    "common.search": "Suchen",
    "common.filter": "Filtern",
    "common.export": "Exportieren",
    "common.import": "Importieren",
    "common.refresh": "Aktualisieren",
    "common.loading": "Wird geladen...",
    "common.empty": "Keine Einträge",
    "common.required": "Erforderlich",
    "common.optional": "Optional",
    "common.actions": "Aktionen",
    "common.status": "Status",
    "common.date": "Datum",
    "common.amount": "Betrag",
    "common.description": "Beschreibung",
    "common.total": "Gesamt",
    "common.name": "Name",
    "common.code": "Code",
    "common.color": "Farbe",
    "common.type": "Typ",
    "common.note": "Notiz",
    "common.notes": "Notizen",
    "common.active": "Aktiv",
    "common.inactive": "Inaktiv",
    "common.all": "Alle",
    "common.none": "Keine",
    "common.select": "Auswählen",
    "common.back": "Zurück",
    "common.next": "Weiter",
    "common.previous": "Vorherige",
    "common.create": "Erstellen",
    "common.update": "Aktualisieren",
    "common.view": "Ansehen",
    "common.details": "Details",
    "common.settings": "Einstellungen",
    "common.language": "Sprache",
    "common.currency": "Währung",

    "login.title": "Anmelden",
    "login.subtitle": "Melden Sie sich bei Ihrem Konto an",
    "login.username": "Benutzername",
    "login.password": "Passwort",
    "login.submit": "Anmelden",
    "login.error.invalid": "Ungültiger Benutzername oder Passwort",
    "login.error.inactive": "Ihr Konto ist nicht aktiv",
    "login.error.locked": "Zu viele Fehlversuche. Bitte warten Sie einige Minuten.",
    "login.welcome": "Willkommen zurück",
    "login.forgotPassword": "Passwort vergessen?",
    "login.captcha": "Verifizierung",
    "login.captcha.refresh": "Aktualisieren",
    "login.captcha.invalid": "Falscher Verifizierungscode",
    "login.captcha.placeholder": "Ergebnis oben eingeben",

    "forgot.title": "Passwort vergessen",
    "forgot.subtitle": "Geben Sie Ihre E-Mail oder Benutzernamen ein, wir senden einen Reset-Link",
    "forgot.email": "E-Mail oder Benutzername",
    "forgot.send": "Reset-Link senden",
    "forgot.back": "Zurück zur Anmeldung",
    "forgot.success": "Link gesendet! Bitte prüfen Sie Ihre E-Mails",
    "forgot.notFound": "Benutzer nicht gefunden",
    "forgot.demo.notice": "Demo-Modus: Token in Konsole geschrieben (F12)",
    "forgot.tokenSent": "Reset-Code",
    "forgot.checkInbox": "Prüfen Sie Ihren Posteingang",

    "reset.title": "Neues Passwort festlegen",
    "reset.subtitle": "Geben Sie Ihr neues Passwort zweimal ein",
    "reset.token": "Reset-Code",
    "reset.newPassword": "Neues Passwort",
    "reset.confirmPassword": "Passwort bestätigen",
    "reset.submit": "Passwort zurücksetzen",
    "reset.error.mismatch": "Passwörter stimmen nicht überein",
    "reset.error.weak": "Passwort muss mindestens 6 Zeichen lang sein",
    "reset.error.invalidToken": "Ungültiger oder abgelaufener Code",
    "reset.success": "Passwort erfolgreich zurückgesetzt",

    "menu.dashboard": "Übersicht",
    "menu.cashflow": "Cashflow",
    "menu.banks": "Banken",
    "menu.kasa": "Kasse",
    "menu.loans": "Kredite",
    "menu.invoices": "Rechnungen",
    "menu.transfers": "Transfers",
    "menu.hr": "HR",
    "menu.fx": "Währungsdifferenz",
    "menu.ai": "KI-Prognose",
    "menu.reports": "Berichte",
    "menu.categories": "Kategorien",
    "menu.users": "Benutzer",
    "menu.audit": "Audit",
    "menu.settings": "Einstellungen",

    "dashboard.title": "Übersicht",
    "dashboard.subtitle": "Finanzielle Lage Ihres Unternehmens",
    "dashboard.cashPosition": "Liquiditätsposition",
    "dashboard.monthlyInflow": "Monatlicher Zufluss",
    "dashboard.monthlyOutflow": "Monatlicher Abfluss",
    "dashboard.netCashFlow": "Netto-Cashflow",
    "dashboard.receivables": "Forderungen",
    "dashboard.payables": "Verbindlichkeiten",
    "dashboard.overdue": "Überfällig",
    "dashboard.thisMonth": "Diesen Monat",
    "dashboard.thisYear": "Dieses Jahr",

    "banks.title": "Bankkonten",
    "banks.newAccount": "Neues Konto",
    "banks.accountName": "Kontoname",
    "banks.bankName": "Bankname",
    "banks.iban": "IBAN",
    "banks.balance": "Saldo",
    "banks.openingBalance": "Eröffnungssaldo",
    "banks.movements": "Bewegungen",
    "banks.addMovement": "Bewegung hinzufügen",
    "banks.importExcel": "Aus Excel importieren",
    "banks.deposit": "Einzahlung",
    "banks.withdrawal": "Abhebung",

    "kasa.title": "Kasse",
    "kasa.newKasa": "Neue Kasse",
    "kasa.entry": "Eingang",
    "kasa.exit": "Ausgang",
    "kasa.addEntry": "Bewegung hinzufügen",
    "kasa.category": "Kategorie",

    "invoices.title": "Rechnungen",
    "invoices.subtitle": "Verwalten Sie Eingangs- und Ausgangsrechnungen",
    "invoices.newInvoice": "Neue Rechnung",
    "invoices.incoming": "Eingehend",
    "invoices.outgoing": "Ausgehend",
    "invoices.manual": "Manuelle Rechnungen",
    "invoices.einvoice": "E-Rechnung",
    "invoices.invoiceNo": "Rechnungsnummer",
    "invoices.counterparty": "Geschäftspartner",
    "invoices.issueDate": "Ausstellungsdatum",
    "invoices.dueDate": "Fälligkeitsdatum",
    "invoices.netAmount": "Nettobetrag",
    "invoices.vat": "MwSt",
    "invoices.paid": "Bezahlt",
    "invoices.unpaid": "Unbezahlt",
    "invoices.partiallyPaid": "Teilweise bezahlt",
    "invoices.overdue": "Überfällig",
    "invoices.recordPayment": "Zahlung erfassen",

    "loans.title": "Kredite",
    "loans.newLoan": "Neuer Kredit",
    "loans.principal": "Kapital",
    "loans.interestRate": "Zinssatz",
    "loans.term": "Laufzeit (Monate)",
    "loans.installment": "Rate",
    "loans.remainingBalance": "Restbetrag",
    "loans.payment": "Zahlung",
    "loans.payInstallment": "Rate bezahlen",

    "hr.title": "Personalwesen",
    "hr.organization": "Organisation",
    "hr.recruitment": "Personalbeschaffung",
    "hr.employees": "Mitarbeiter",
    "hr.payroll": "Gehaltsabrechnung",
    "hr.leave": "Anwesenheit/Urlaub",
    "hr.orgUnits": "Organisationseinheiten",
    "hr.departments": "Abteilungen",
    "hr.jobTitles": "Positionen",
    "hr.newOrgUnit": "Neue Org.-Einheit",
    "hr.newDepartment": "Neue Abteilung",
    "hr.newJobTitle": "Neue Position",
    "hr.newEmployee": "Neuer Mitarbeiter",
    "hr.firstName": "Vorname",
    "hr.lastName": "Nachname",
    "hr.tcNo": "Personalausweisnummer",
    "hr.sgkNo": "Sozialversicherungsnummer",
    "hr.startDate": "Einstellungsdatum",
    "hr.brutSalary": "Bruttogehalt",
    "hr.netSalary": "Nettogehalt",
    "hr.employerCost": "Arbeitgeberkosten",
    "hr.candidates": "Kandidaten",
    "hr.interviews": "Vorstellungsgespräche",
    "hr.pipeline": "Prozess",
    "hr.positions": "Offene Stellen",

    "settings.title": "Einstellungen",
    "settings.language": "Sprache",
    "settings.language.subtitle": "Oberflächensprache",
    "settings.currency": "Währung",
    "settings.currency.display": "Anzeigewährung",
    "settings.theme": "Design",
    "settings.notifications": "Benachrichtigungen",
    "settings.profile": "Mein Profil",

    "users.title": "Benutzer & Berechtigungen",
    "users.users": "Benutzer",
    "users.roles": "Rollen",
    "users.grants": "Berechtigungszuweisungen",
    "users.overrides": "Ausnahmen",
    "users.newUser": "Neuer Benutzer",
    "users.newRole": "Neue Rolle",
    "users.linkedEmployee": "Verknüpfter Mitarbeiter",
    "users.role": "Rolle",
    "users.permissions": "Berechtigungen",
    "users.myPermissions": "Meine Berechtigungen",

    "ai.assistant": "Prometa AI",
    "ai.placeholder": "Geben Sie Ihre Frage ein...",
    "ai.welcome": "Hallo! Ich bin Prometa AI — ich habe Zugriff auf Ihre Finanz- und HR-Daten. Sie können Fragen stellen wie:",
    "ai.suggestions.cash": "Wie hoch ist mein Geldzufluss diesen Monat?",
    "ai.suggestions.overdue": "Habe ich überfällige Rechnungen?",
    "ai.suggestions.activity": "Welche Aktionen wurden heute durchgeführt?",
    "ai.suggestions.employees": "Wie viele aktive Mitarbeiter habe ich?",
    "ai.clearChat": "Chat löschen",
    "ai.thinking": "Denkt nach...",

    "audit.title": "Audit-Protokoll",
    "audit.user": "Benutzer",
    "audit.action": "Aktion",
    "audit.timestamp": "Zeitstempel",
    "audit.details": "Details",

    "toast.saved": "Gespeichert",
    "toast.deleted": "Gelöscht",
    "toast.updated": "Aktualisiert",
    "toast.error": "Ein Fehler ist aufgetreten",
    "toast.copied": "Kopiert",
    "toast.created": "Erstellt",
    "toast.imported": "Importiert",
    "toast.exported": "Exportiert",
    "toast.noPermission": "Sie haben keine Berechtigung",
    "toast.confirmDelete": "Sind Sie sicher, dass Sie löschen möchten?",

    "dashboard.subtitle.long": "Aktuelle Finanzlage Ihres Unternehmens",
    "dashboard.kpi.cashTotal": "Gesamtbargeld",
    "dashboard.kpi.bankBalance": "Bankguthaben",
    "dashboard.kpi.kasaBalance": "Kassenbestand",
    "dashboard.kpi.totalLoans": "Gesamtkredite",
    "dashboard.kpi.openInvoices": "Offene Rechnungen",
    "dashboard.kpi.overdueInvoices": "Überfällig",
    "dashboard.section.recentMovements": "Letzte Bewegungen",
    "dashboard.section.upcomingDue": "Bevorstehende Fälligkeiten",
    "dashboard.section.cashflowChart": "Monatlicher Fluss",
    "dashboard.empty": "Noch keine Daten. Fügen Sie ein Konto hinzu",

    "banks.empty": "Noch keine Bankkonten hinzugefügt",
    "banks.totalBalance": "Gesamtsaldo",
    "banks.recordCount": "{n} Einträge",
    "banks.currency": "Währung",
    "banks.editAccount": "Konto bearbeiten",
    "banks.deleteAccount": "Konto löschen",
    "banks.confirmDelete": "Sie löschen dieses Konto. Alle Bewegungen werden ebenfalls gelöscht. Sind Sie sicher?",
    "banks.movementType": "Bewegungstyp",
    "banks.movement.incoming": "Eingang",
    "banks.movement.outgoing": "Ausgang",
    "banks.totalIn": "Eingang gesamt",
    "banks.totalOut": "Ausgang gesamt",
    "banks.netMovement": "Nettobewegung",

    "kasa.empty": "Noch keine Kassen hinzugefügt",
    "kasa.totalBalance": "Gesamtsaldo",
    "kasa.openingBalance": "Eröffnungssaldo",
    "kasa.editKasa": "Kasse bearbeiten",
    "kasa.deleteKasa": "Kasse löschen",
    "kasa.transferTo": "Übertragen",

    "invoices.in.short": "Ein",
    "invoices.out.short": "Aus",
    "invoices.status.all": "Alle Rechnungen",
    "invoices.status.open": "Offen",
    "invoices.status.paid": "Bezahlt",
    "invoices.status.overdue": "Überfällig",
    "invoices.editInvoice": "Rechnung bearbeiten",
    "invoices.deleteInvoice": "Rechnung löschen",
    "invoices.payment.amount": "Zahlungsbetrag",
    "invoices.payment.date": "Zahlungsdatum",
    "invoices.payment.source": "Zahlungsquelle",
    "invoices.payment.notes": "Notizen",
    "invoices.balance": "Restbetrag",
    "invoices.totalCount": "{n} Rechnungen",
    "invoices.search": "Rechnungen suchen",

    "loans.empty": "Noch keine Kredite",
    "loans.bank": "Bank",
    "loans.startDate": "Startdatum",
    "loans.endDate": "Enddatum",
    "loans.monthlyPayment": "Monatliche Zahlung",
    "loans.totalPaid": "Gesamt bezahlt",
    "loans.editLoan": "Kredit bearbeiten",
    "loans.deleteLoan": "Kredit löschen",
    "loans.schedule": "Zahlungsplan",
    "loans.installmentNo": "Rate #",
    "loans.dueDate": "Fälligkeit",
    "loans.principal.short": "Kapital",
    "loans.interest.short": "Zinsen",

    "hr.subtitle.long": "Personalverwaltung und HR-Prozesse",
    "hr.tabs.organization": "Organisation",
    "hr.tabs.recruitment": "Personalbeschaffung",
    "hr.tabs.employees": "Mitarbeiter",
    "hr.tabs.payroll": "Gehaltsabrechnung",
    "hr.org.empty": "Organisationsstruktur noch nicht definiert",
    "hr.org.add.unit": "Einheit hinzufügen",
    "hr.org.add.dept": "Abteilung hinzufügen",
    "hr.org.add.jt": "Position hinzufügen",
    "hr.org.add.employee": "Mitarbeiter hinzufügen",
    "hr.org.tree": "Baumansicht",
    "hr.org.chart": "Organigramm",
    "hr.org.flat": "Flache Liste",
    "hr.employee.status.active": "Aktiv",
    "hr.employee.status.probation": "Probezeit",
    "hr.employee.status.onLeave": "Im Urlaub",
    "hr.employee.status.maternity": "Mutterschutz",
    "hr.employee.status.military": "Wehrdienst",
    "hr.employee.status.suspended": "Suspendiert",
    "hr.employee.status.terminated": "Gekündigt",
    "hr.email": "E-Mail",
    "hr.phone": "Telefon",
    "hr.address": "Adresse",
    "hr.totalEmployees": "Gesamtmitarbeiter",
    "hr.activeEmployees": "Aktiv",
    "hr.headcount": "Personalbestand",
    "hr.openPositions": "Offene Stelle",

    "settings.tabs.general": "Allgemein",
    "settings.tabs.company": "Unternehmen",
    "settings.tabs.currency": "Währung",
    "settings.tabs.notifications": "Benachrichtigungen",
    "settings.tabs.tcmb": "TCMB-Integration",
    "settings.tabs.einvoice": "E-Rechnung",
    "settings.tabs.archive": "Archiv",
    "settings.companies": "Unternehmen",
    "settings.addCompany": "Neues Unternehmen",
    "settings.activeCompany": "Aktives Unternehmen",
    "settings.taxNo": "Steuernummer",
    "settings.taxOffice": "Finanzamt",
    "settings.tcmb.apiKey": "API-Schlüssel",
    "settings.tcmb.fetchRates": "Kurse abrufen",
    "settings.tcmb.lastFetch": "Letzte Aktualisierung",

    "modal.title.new": "Neu",
    "modal.title.edit": "Bearbeiten",
    "modal.title.delete": "Löschen",
    "modal.confirm.title": "Bestätigung erforderlich",
    "modal.confirm.delete": "Sind Sie sicher, dass Sie diesen Datensatz löschen möchten?",

    "filter.from": "Von",
    "filter.to": "Bis",
    "filter.clear": "Filter löschen",
    "filter.results": "{n} Ergebnisse",
  },

  ar: {
    "app.name": "بروميتا وان",
    "app.tagline": "منصة المالية والموارد البشرية",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.add": "إضافة",
    "common.close": "إغلاق",
    "common.confirm": "تأكيد",
    "common.yes": "نعم",
    "common.no": "لا",
    "common.search": "بحث",
    "common.filter": "تصفية",
    "common.export": "تصدير",
    "common.import": "استيراد",
    "common.refresh": "تحديث",
    "common.loading": "جاري التحميل...",
    "common.empty": "لا توجد سجلات",
    "common.required": "مطلوب",
    "common.optional": "اختياري",
    "common.actions": "الإجراءات",
    "common.status": "الحالة",
    "common.date": "التاريخ",
    "common.amount": "المبلغ",
    "common.description": "الوصف",
    "common.total": "المجموع",
    "common.name": "الاسم",
    "common.code": "الرمز",
    "common.color": "اللون",
    "common.type": "النوع",
    "common.note": "ملاحظة",
    "common.notes": "ملاحظات",
    "common.active": "نشط",
    "common.inactive": "غير نشط",
    "common.all": "الكل",
    "common.none": "لا شيء",
    "common.select": "اختر",
    "common.back": "رجوع",
    "common.next": "التالي",
    "common.previous": "السابق",
    "common.create": "إنشاء",
    "common.update": "تحديث",
    "common.view": "عرض",
    "common.details": "التفاصيل",
    "common.settings": "الإعدادات",
    "common.language": "اللغة",
    "common.currency": "العملة",

    "login.title": "تسجيل الدخول",
    "login.subtitle": "سجل الدخول إلى حسابك",
    "login.username": "اسم المستخدم",
    "login.password": "كلمة المرور",
    "login.submit": "تسجيل الدخول",
    "login.error.invalid": "اسم المستخدم أو كلمة المرور غير صحيحة",
    "login.error.inactive": "حسابك غير نشط",
    "login.error.locked": "محاولات فاشلة كثيرة. يرجى الانتظار بضع دقائق.",
    "login.welcome": "مرحبا بعودتك",
    "login.forgotPassword": "نسيت كلمة المرور؟",
    "login.captcha": "التحقق",
    "login.captcha.refresh": "تحديث",
    "login.captcha.invalid": "رمز التحقق غير صحيح",
    "login.captcha.placeholder": "اكتب النتيجة أعلاه",

    "forgot.title": "نسيت كلمة المرور",
    "forgot.subtitle": "أدخل بريدك الإلكتروني أو اسم المستخدم وسنرسل رابط إعادة التعيين",
    "forgot.email": "البريد الإلكتروني أو اسم المستخدم",
    "forgot.send": "إرسال رابط إعادة التعيين",
    "forgot.back": "العودة إلى تسجيل الدخول",
    "forgot.success": "تم إرسال الرابط! يرجى التحقق من بريدك الإلكتروني",
    "forgot.notFound": "المستخدم غير موجود",
    "forgot.demo.notice": "وضع تجريبي: تم كتابة الرمز في وحدة التحكم (F12)",
    "forgot.tokenSent": "رمز إعادة التعيين",
    "forgot.checkInbox": "تحقق من صندوق الوارد",

    "reset.title": "تعيين كلمة مرور جديدة",
    "reset.subtitle": "أدخل كلمة المرور الجديدة مرتين",
    "reset.token": "رمز إعادة التعيين",
    "reset.newPassword": "كلمة المرور الجديدة",
    "reset.confirmPassword": "تأكيد كلمة المرور",
    "reset.submit": "إعادة تعيين كلمة المرور",
    "reset.error.mismatch": "كلمات المرور غير متطابقة",
    "reset.error.weak": "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل",
    "reset.error.invalidToken": "رمز غير صالح أو منتهي الصلاحية",
    "reset.success": "تم إعادة تعيين كلمة المرور بنجاح",

    "menu.dashboard": "لوحة المعلومات",
    "menu.cashflow": "التدفق النقدي",
    "menu.banks": "البنوك",
    "menu.kasa": "الصندوق",
    "menu.loans": "القروض",
    "menu.invoices": "الفواتير",
    "menu.transfers": "التحويلات",
    "menu.hr": "الموارد البشرية",
    "menu.fx": "فرق الصرف",
    "menu.ai": "توقع الذكاء الاصطناعي",
    "menu.reports": "التقارير",
    "menu.categories": "الفئات",
    "menu.users": "المستخدمون",
    "menu.audit": "التدقيق",
    "menu.settings": "الإعدادات",

    "dashboard.title": "لوحة المعلومات",
    "dashboard.subtitle": "الوضع المالي لشركتك",
    "dashboard.cashPosition": "المركز النقدي",
    "dashboard.monthlyInflow": "التدفق الشهري الداخل",
    "dashboard.monthlyOutflow": "التدفق الشهري الخارج",
    "dashboard.netCashFlow": "صافي التدفق النقدي",
    "dashboard.receivables": "المستحقات",
    "dashboard.payables": "الالتزامات",
    "dashboard.overdue": "متأخر",
    "dashboard.thisMonth": "هذا الشهر",
    "dashboard.thisYear": "هذه السنة",

    "banks.title": "الحسابات البنكية",
    "banks.newAccount": "حساب جديد",
    "banks.accountName": "اسم الحساب",
    "banks.bankName": "اسم البنك",
    "banks.iban": "IBAN",
    "banks.balance": "الرصيد",
    "banks.openingBalance": "الرصيد الافتتاحي",
    "banks.movements": "الحركات",
    "banks.addMovement": "إضافة حركة",
    "banks.importExcel": "استيراد من Excel",
    "banks.deposit": "إيداع",
    "banks.withdrawal": "سحب",

    "kasa.title": "إدارة الصندوق",
    "kasa.newKasa": "صندوق جديد",
    "kasa.entry": "إيداع",
    "kasa.exit": "صرف",
    "kasa.addEntry": "إضافة حركة",
    "kasa.category": "الفئة",

    "invoices.title": "الفواتير",
    "invoices.subtitle": "إدارة الفواتير الواردة والصادرة",
    "invoices.newInvoice": "فاتورة جديدة",
    "invoices.incoming": "الواردة",
    "invoices.outgoing": "الصادرة",
    "invoices.manual": "الفواتير اليدوية",
    "invoices.einvoice": "الفاتورة الإلكترونية",
    "invoices.invoiceNo": "رقم الفاتورة",
    "invoices.counterparty": "الطرف المقابل",
    "invoices.issueDate": "تاريخ الإصدار",
    "invoices.dueDate": "تاريخ الاستحقاق",
    "invoices.netAmount": "المبلغ الصافي",
    "invoices.vat": "ضريبة القيمة المضافة",
    "invoices.paid": "مدفوعة",
    "invoices.unpaid": "غير مدفوعة",
    "invoices.partiallyPaid": "مدفوعة جزئيا",
    "invoices.overdue": "متأخرة",
    "invoices.recordPayment": "تسجيل الدفع",

    "loans.title": "القروض",
    "loans.newLoan": "قرض جديد",
    "loans.principal": "أصل المبلغ",
    "loans.interestRate": "معدل الفائدة",
    "loans.term": "المدة (أشهر)",
    "loans.installment": "القسط",
    "loans.remainingBalance": "الرصيد المتبقي",
    "loans.payment": "الدفع",
    "loans.payInstallment": "دفع القسط",

    "hr.title": "الموارد البشرية",
    "hr.organization": "التنظيم",
    "hr.recruitment": "التوظيف",
    "hr.employees": "الموظفون",
    "hr.payroll": "الرواتب",
    "hr.leave": "الحضور/الإجازة",
    "hr.orgUnits": "الوحدات التنظيمية",
    "hr.departments": "الأقسام",
    "hr.jobTitles": "المناصب",
    "hr.newOrgUnit": "وحدة تنظيمية جديدة",
    "hr.newDepartment": "قسم جديد",
    "hr.newJobTitle": "منصب جديد",
    "hr.newEmployee": "موظف جديد",
    "hr.firstName": "الاسم الأول",
    "hr.lastName": "اسم العائلة",
    "hr.tcNo": "رقم الهوية الوطنية",
    "hr.sgkNo": "رقم الضمان الاجتماعي",
    "hr.startDate": "تاريخ البدء",
    "hr.brutSalary": "الراتب الإجمالي",
    "hr.netSalary": "الراتب الصافي",
    "hr.employerCost": "تكلفة صاحب العمل",
    "hr.candidates": "المرشحون",
    "hr.interviews": "المقابلات",
    "hr.pipeline": "العملية",
    "hr.positions": "الوظائف الشاغرة",

    "settings.title": "الإعدادات",
    "settings.language": "اللغة",
    "settings.language.subtitle": "لغة الواجهة",
    "settings.currency": "العملة",
    "settings.currency.display": "عملة العرض",
    "settings.theme": "السمة",
    "settings.notifications": "الإشعارات",
    "settings.profile": "ملفي الشخصي",

    "users.title": "المستخدمون والصلاحيات",
    "users.users": "المستخدمون",
    "users.roles": "الأدوار",
    "users.grants": "تعيينات الصلاحيات",
    "users.overrides": "الاستثناءات",
    "users.newUser": "مستخدم جديد",
    "users.newRole": "دور جديد",
    "users.linkedEmployee": "الموظف المرتبط",
    "users.role": "الدور",
    "users.permissions": "الصلاحيات",
    "users.myPermissions": "صلاحياتي",

    "ai.assistant": "بروميتا AI",
    "ai.placeholder": "اكتب سؤالك...",
    "ai.welcome": "مرحبا! أنا بروميتا AI — لدي وصول إلى بياناتك المالية والموارد البشرية. يمكنك طرح أسئلة مثل:",
    "ai.suggestions.cash": "كم هو إجمالي تدفق النقد لدي هذا الشهر؟",
    "ai.suggestions.overdue": "هل لدي فواتير متأخرة؟",
    "ai.suggestions.activity": "ما الإجراءات التي تم اتخاذها اليوم؟",
    "ai.suggestions.employees": "كم عدد الموظفين النشطين لدي؟",
    "ai.clearChat": "مسح المحادثة",
    "ai.thinking": "يفكر...",

    "audit.title": "سجل التدقيق",
    "audit.user": "المستخدم",
    "audit.action": "الإجراء",
    "audit.timestamp": "الوقت",
    "audit.details": "التفاصيل",

    "toast.saved": "تم الحفظ",
    "toast.deleted": "تم الحذف",
    "toast.updated": "تم التحديث",
    "toast.error": "حدث خطأ",
    "toast.copied": "تم النسخ",
    "toast.created": "تم الإنشاء",
    "toast.imported": "تم الاستيراد",
    "toast.exported": "تم التصدير",
    "toast.noPermission": "ليس لديك صلاحية لهذا الإجراء",
    "toast.confirmDelete": "هل أنت متأكد من الحذف؟",

    "dashboard.subtitle.long": "الوضع المالي الحالي لشركتك",
    "dashboard.kpi.cashTotal": "إجمالي النقد",
    "dashboard.kpi.bankBalance": "رصيد البنك",
    "dashboard.kpi.kasaBalance": "رصيد الصندوق",
    "dashboard.kpi.totalLoans": "إجمالي القروض",
    "dashboard.kpi.openInvoices": "الفواتير المفتوحة",
    "dashboard.kpi.overdueInvoices": "متأخر",
    "dashboard.section.recentMovements": "الحركات الأخيرة",
    "dashboard.section.upcomingDue": "الاستحقاقات القادمة",
    "dashboard.section.cashflowChart": "التدفق الشهري",
    "dashboard.empty": "لا توجد بيانات بعد. ابدأ بإضافة حساب",

    "banks.empty": "لم تتم إضافة حسابات بنكية بعد",
    "banks.totalBalance": "الرصيد الإجمالي",
    "banks.recordCount": "{n} سجلات",
    "banks.currency": "العملة",
    "banks.editAccount": "تعديل الحساب",
    "banks.deleteAccount": "حذف الحساب",
    "banks.confirmDelete": "أنت على وشك حذف هذا الحساب. سيتم حذف جميع حركاته أيضًا. هل أنت متأكد؟",
    "banks.movementType": "نوع الحركة",
    "banks.movement.incoming": "وارد",
    "banks.movement.outgoing": "صادر",
    "banks.totalIn": "إجمالي الوارد",
    "banks.totalOut": "إجمالي الصادر",
    "banks.netMovement": "صافي الحركة",

    "kasa.empty": "لم تتم إضافة صناديق بعد",
    "kasa.totalBalance": "الرصيد الإجمالي",
    "kasa.openingBalance": "الرصيد الافتتاحي",
    "kasa.editKasa": "تعديل الصندوق",
    "kasa.deleteKasa": "حذف الصندوق",
    "kasa.transferTo": "تحويل",

    "invoices.in.short": "وارد",
    "invoices.out.short": "صادر",
    "invoices.status.all": "جميع الفواتير",
    "invoices.status.open": "مفتوح",
    "invoices.status.paid": "مدفوع",
    "invoices.status.overdue": "متأخر",
    "invoices.editInvoice": "تعديل الفاتورة",
    "invoices.deleteInvoice": "حذف الفاتورة",
    "invoices.payment.amount": "مبلغ الدفع",
    "invoices.payment.date": "تاريخ الدفع",
    "invoices.payment.source": "مصدر الدفع",
    "invoices.payment.notes": "ملاحظات",
    "invoices.balance": "المتبقي",
    "invoices.totalCount": "{n} فواتير",
    "invoices.search": "بحث الفواتير",

    "loans.empty": "لا توجد قروض بعد",
    "loans.bank": "البنك",
    "loans.startDate": "تاريخ البدء",
    "loans.endDate": "تاريخ الانتهاء",
    "loans.monthlyPayment": "الدفعة الشهرية",
    "loans.totalPaid": "إجمالي المدفوع",
    "loans.editLoan": "تعديل القرض",
    "loans.deleteLoan": "حذف القرض",
    "loans.schedule": "جدول الدفع",
    "loans.installmentNo": "رقم القسط",
    "loans.dueDate": "الاستحقاق",
    "loans.principal.short": "الأصل",
    "loans.interest.short": "الفائدة",

    "hr.subtitle.long": "إدارة شؤون الموظفين وعمليات الموارد البشرية",
    "hr.tabs.organization": "التنظيم",
    "hr.tabs.recruitment": "التوظيف",
    "hr.tabs.employees": "الموظفون",
    "hr.tabs.payroll": "الرواتب",
    "hr.org.empty": "الهيكل التنظيمي غير محدد بعد",
    "hr.org.add.unit": "إضافة وحدة",
    "hr.org.add.dept": "إضافة قسم",
    "hr.org.add.jt": "إضافة منصب",
    "hr.org.add.employee": "إضافة موظف",
    "hr.org.tree": "عرض شجري",
    "hr.org.chart": "مخطط تنظيمي",
    "hr.org.flat": "قائمة مسطحة",
    "hr.employee.status.active": "نشط",
    "hr.employee.status.probation": "تحت الاختبار",
    "hr.employee.status.onLeave": "في إجازة",
    "hr.employee.status.maternity": "إجازة أمومة",
    "hr.employee.status.military": "خدمة عسكرية",
    "hr.employee.status.suspended": "معلق",
    "hr.employee.status.terminated": "منتهي",
    "hr.email": "البريد الإلكتروني",
    "hr.phone": "الهاتف",
    "hr.address": "العنوان",
    "hr.totalEmployees": "إجمالي الموظفين",
    "hr.activeEmployees": "نشط",
    "hr.headcount": "عدد الموظفين",
    "hr.openPositions": "وظيفة شاغرة",

    "settings.tabs.general": "عام",
    "settings.tabs.company": "الشركة",
    "settings.tabs.currency": "العملة",
    "settings.tabs.notifications": "الإشعارات",
    "settings.tabs.tcmb": "تكامل TCMB",
    "settings.tabs.einvoice": "الفاتورة الإلكترونية",
    "settings.tabs.archive": "الأرشيف",
    "settings.companies": "الشركات",
    "settings.addCompany": "شركة جديدة",
    "settings.activeCompany": "الشركة النشطة",
    "settings.taxNo": "الرقم الضريبي",
    "settings.taxOffice": "مكتب الضرائب",
    "settings.tcmb.apiKey": "مفتاح API",
    "settings.tcmb.fetchRates": "جلب الأسعار",
    "settings.tcmb.lastFetch": "آخر تحديث",

    "modal.title.new": "جديد",
    "modal.title.edit": "تعديل",
    "modal.title.delete": "حذف",
    "modal.confirm.title": "التأكيد مطلوب",
    "modal.confirm.delete": "هل أنت متأكد من حذف هذا السجل؟",

    "filter.from": "من",
    "filter.to": "إلى",
    "filter.clear": "مسح المرشحات",
    "filter.results": "{n} نتائج",
  },
};

/* ---------- t() — Çeviri Helper ----------
   Kullanım:
     t("invoices.title")                → aktif dilde değer
     t("invoices.title", "en")          → spesifik dil
     t("foo.bar")                       → eksikse TR fallback, yine yoksa key
*/
function t(key, lang) {
  const useLang = lang || (typeof window !== "undefined" ? window.__PROMETA_LANG__ : null) || "tr";
  const dict = I18N_DICT[useLang] || I18N_DICT.tr;
  if (dict[key] != null) return dict[key];
  // Fallback: TR
  if (I18N_DICT.tr[key] != null) return I18N_DICT.tr[key];
  // Hâlâ yoksa key'i döndür (geliştirici uyarısı)
  if (typeof console !== "undefined") console.warn(`[i18n] Eksik anahtar: ${key}`);
  return key;
}

/* =====================================================================
   /I18N
===================================================================== */

/* =====================================================================
   CAPTCHA — Basit matematik tabanlı doğrulama
   ---------------------------------------------------------------------
   Production'da reCAPTCHA, hCaptcha vb. kullanılır. Bu demo için:
   - "3 + 7 = ?" gibi basit aritmetik
   - Sonuç state'te tutulur, kullanıcı girdiği değerle karşılaştırılır
===================================================================== */

function generateCaptcha() {
  const operations = [
    { op: "+", calc: (a, b) => a + b },
    { op: "-", calc: (a, b) => a - b },
    { op: "×", calc: (a, b) => a * b },
  ];
  const opIdx = Math.floor(Math.random() * operations.length);
  const operation = operations[opIdx];
  let a, b;
  if (operation.op === "×") {
    a = Math.floor(Math.random() * 9) + 1;   // 1-9
    b = Math.floor(Math.random() * 9) + 1;   // 1-9
  } else if (operation.op === "-") {
    a = Math.floor(Math.random() * 20) + 10;  // 10-29
    b = Math.floor(Math.random() * 9) + 1;    // 1-9 (sonuç pozitif)
  } else {
    a = Math.floor(Math.random() * 20) + 1;   // 1-20
    b = Math.floor(Math.random() * 20) + 1;   // 1-20
  }
  return {
    question: `${a} ${operation.op} ${b}`,
    answer: operation.calc(a, b),
  };
}

/* =====================================================================
   FORGOT PASSWORD — Şifre sıfırlama akışı
   ---------------------------------------------------------------------
   Production akışı:
   1. Kullanıcı email/username verir
   2. Backend token üretir (kısa süreli, tek kullanımlık)
   3. Email gönderilir (SMTP/SendGrid/AWS SES vb.)
   4. Kullanıcı tokeni girip yeni şifre belirler

   Demo modu (window.PROMETA_API yoksa):
   - Token rastgele oluşturulur (6 haneli)
   - localStorage'da saklanır, console'a yazılır
   - Kullanıcı manuel olarak kopyalar
   
   Production entegrasyonu (window.PROMETA_API.sendPasswordResetEmail):
   - Backend çağrılır, gerçek email gönderilir
===================================================================== */

function generateResetToken() {
  // 6 haneli numerik token (kullanıcı dostu)
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function requestPasswordReset(emailOrUsername, users) {
  // Email veya username ile kullanıcıyı bul
  const user = users.find(u =>
    u.username === emailOrUsername ||
    u.email === emailOrUsername ||
    u.username?.toLowerCase() === emailOrUsername?.toLowerCase()
  );
  if (!user) {
    return { success: false, reason: "not_found" };
  }
  const token = generateResetToken();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 dakika
  
  // Token'i kayıt et (in-memory ve localStorage)
  const resetEntry = {
    username: user.username,
    email: user.email || null,
    token,
    expiresAt,
    createdAt: Date.now(),
  };
  
  try {
    const existing = await S.get("promet:resetTokens", []);
    // Aynı kullanıcı için eski token'ları temizle
    const filtered = existing.filter(t => t.username !== user.username);
    filtered.push(resetEntry);
    await S.set("promet:resetTokens", filtered);
  } catch (e) {
    console.error("Token kaydı başarısız:", e);
  }
  
  // Production: gerçek email gönder
  if (typeof window !== "undefined" && window.PROMETA_API?.sendPasswordResetEmail) {
    try {
      await window.PROMETA_API.sendPasswordResetEmail({
        username: user.username,
        email: user.email,
        token,
      });
      return { success: true, mode: "email", emailHint: user.email };
    } catch (e) {
      console.error("E-posta gönderim hatası:", e);
      // Fallback: demo mode
    }
  }
  
  // Demo modu: konsola yaz
  console.warn(`📧 [Demo] Şifre sıfırlama tokeni: ${token} (Kullanıcı: ${user.username}, 15 dk geçerli)`);
  return { success: true, mode: "demo", token, emailHint: user.email || user.username };
}

async function verifyResetToken(token) {
  try {
    const tokens = await S.get("promet:resetTokens", []);
    const found = tokens.find(t => t.token === token);
    if (!found) return { valid: false, reason: "not_found" };
    if (found.expiresAt < Date.now()) return { valid: false, reason: "expired" };
    return { valid: true, username: found.username };
  } catch {
    return { valid: false, reason: "error" };
  }
}

async function resetPasswordWithToken(token, newPassword, users, setUsers) {
  // Production modu: backend API üzerinden
  if (typeof window !== "undefined" && window.PROMETA_API?.resetPassword) {
    try {
      const result = await window.PROMETA_API.resetPassword({ token, newPassword });
      if (result?.success) return { success: true, mode: "backend" };
      return { success: false, reason: result?.reason || "error" };
    } catch (e) {
      console.error("Şifre sıfırlama backend hatası:", e);
      return { success: false, reason: "backend_error" };
    }
  }

  // Demo modu: in-memory token doğrulama
  const verification = await verifyResetToken(token);
  if (!verification.valid) {
    return { success: false, reason: verification.reason };
  }
  const updatedUsers = users.map(u =>
    u.username === verification.username ? { ...u, password: newPassword } : u
  );
  setUsers(updatedUsers);
  await S.set("promet:users", updatedUsers);
  
  // Token'i kullan ve sil
  try {
    const tokens = await S.get("promet:resetTokens", []);
    await S.set("promet:resetTokens", tokens.filter(t => t.token !== token));
  } catch {}
  
  return { success: true, mode: "demo" };
}

/* =====================================================================
   /CAPTCHA & FORGOT PASSWORD
===================================================================== */

const ROLES = {
  admin:  { label: "Yönetici",      level: 4, color: "#c2410c" },
  cfo:    { label: "Mali Müdür",    level: 3, color: "#0f766e" },
  editor: { label: "Düzenleyici",   level: 2, color: "#1d4ed8" },
  viewer: { label: "Görüntüleyici", level: 1, color: "#6b7280" },
};

const PERMS = {
  view_dashboard: 1, view_grid: 1, view_reports: 1,
  view_banks: 1, view_kasa: 1, view_transfers: 1, view_invoices: 1,
  view_companies: 1, view_fx_revaluation: 1, view_ai_prediction: 1,
  view_loans: 1,
  view_hr: 1, view_recruitment: 1, view_candidates: 1, view_positions: 1,
  view_org: 1, view_employees: 1,
  edit_cells: 2, add_categories: 2, add_kasa_entry: 2,
  manage_transfers: 2, manage_invoices: 2,
  add_loan_payment: 2, add_loan_transaction: 2,
  add_bank_entry: 2, import_bank_excel: 2,
  manage_candidates: 2, manage_interviews: 2, move_pipeline: 2,
  manage_employees: 2,
  manage_categories: 3, manage_periods: 3, view_audit: 3,
  manage_banks: 3, manage_kasa: 3, manage_currency: 3,
  manage_kasa_categories: 3, manage_fx_revaluation: 3,
  manage_notifications: 3, manage_loans: 3,
  manage_positions: 3, manage_offers: 3, manage_hr_settings: 3,
  manage_org: 3, manage_departments: 3, manage_job_titles: 3,
  manage_org_auth: 3,
  manage_companies: 4,
  manage_users: 4, system_settings: 4,
  manage_roles: 4, manage_grants: 4, manage_overrides: 4,
};

/* =====================================================================
   RBAC — RESOURCES × ACTIONS MATRİSİ
   ---------------------------------------------------------------------
   Her ekran/modül bir "resource". Her resource'ta yapılabilecek aksiyon
   listesi. Custom roller bu matristen seçim yaparak oluşturulur.
===================================================================== */

const ACTIONS = {
  view:   { label: "Görüntüle",   color: "#0ea5e9" },
  create: { label: "Ekle",        color: "#15803d" },
  update: { label: "Değiştir",    color: "#ca8a04" },
  delete: { label: "Sil",         color: "#dc2626" },
  export: { label: "Dışa Aktar",  color: "#7c3aed" },
};

const RESOURCES = {
  // Finans modülleri
  "finance.dashboard":   { module: "Finans", label: "Genel Bakış",     actions: ["view"],                       legacyPerm: "view_dashboard" },
  "finance.cashflow":    { module: "Finans", label: "Nakit Akış Tablosu", actions: ["view","update","export"], legacyPerm: "view_grid" },
  "finance.banks":       { module: "Finans", label: "Bankalar",        actions: ["view","create","update","delete","export"], legacyPerm: "view_banks" },
  "finance.bank_entries":{ module: "Finans", label: "Banka Hareketleri", actions: ["view","create","update","delete"],         legacyPerm: "add_bank_entry" },
  "finance.kasa":        { module: "Finans", label: "Kasa",            actions: ["view","create","update","delete","export"], legacyPerm: "view_kasa" },
  "finance.loans":       { module: "Finans", label: "Krediler",        actions: ["view","create","update","delete"], legacyPerm: "view_loans" },
  "finance.invoices":    { module: "Finans", label: "Faturalar (Manuel)", actions: ["view","create","update","delete","export"], legacyPerm: "view_invoices" },
  "finance.einvoice":    { module: "Finans", label: "e-Fatura (Logo eLogo)", actions: ["view","create","update"], legacyPerm: "view_invoices" },
  "finance.transfers":   { module: "Finans", label: "Transferler",     actions: ["view","create","update","delete"], legacyPerm: "view_transfers" },
  "finance.fx":          { module: "Finans", label: "Kur Farkı Değerlemesi", actions: ["view","create","update","delete"], legacyPerm: "view_fx_revaluation" },
  "finance.ai_prediction": { module: "Finans", label: "AI Tahmin",     actions: ["view"],                       legacyPerm: "view_ai_prediction" },
  "finance.reports":     { module: "Finans", label: "Raporlar",        actions: ["view","export"],              legacyPerm: "view_reports" },
  "finance.categories":  { module: "Finans", label: "Kategoriler",     actions: ["view","create","update","delete"], legacyPerm: "manage_categories" },
  "finance.archives":    { module: "Finans", label: "Arşivler",        actions: ["view","create","delete"],     legacyPerm: "manage_periods" },

  // HR modülleri
  "hr.organization":     { module: "HR", label: "Organizasyon Birimleri", actions: ["view","create","update","delete"], legacyPerm: "view_org" },
  "hr.departments":      { module: "HR", label: "Departmanlar",       actions: ["view","create","update","delete"], legacyPerm: "view_hr" },
  "hr.job_titles":       { module: "HR", label: "Pozisyon Tanımları", actions: ["view","create","update","delete"], legacyPerm: "view_positions" },
  "hr.employees":        { module: "HR", label: "Çalışanlar",         actions: ["view","create","update","delete","export"], legacyPerm: "view_employees" },
  "hr.recruitment":      { module: "HR", label: "İşe Alım Süreci",    actions: ["view","update"],              legacyPerm: "view_recruitment" },
  "hr.positions":        { module: "HR", label: "Açık Pozisyonlar",   actions: ["view","create","update","delete"], legacyPerm: "manage_positions" },
  "hr.candidates":       { module: "HR", label: "Adaylar",            actions: ["view","create","update","delete"], legacyPerm: "view_candidates" },
  "hr.interviews":       { module: "HR", label: "Mülakatlar",         actions: ["view","create","update","delete"], legacyPerm: "manage_interviews" },
  "hr.payroll":          { module: "HR", label: "Bordro (Yakında)",   actions: ["view","create","update","delete","export"], legacyPerm: null },

  // Sistem modülleri
  "system.users":        { module: "Sistem", label: "Kullanıcılar",    actions: ["view","create","update","delete"], legacyPerm: "manage_users" },
  "system.roles":        { module: "Sistem", label: "Roller ve İzinler", actions: ["view","create","update","delete"], legacyPerm: "manage_roles" },
  "system.audit":        { module: "Sistem", label: "Denetim Kayıtları", actions: ["view","export"],            legacyPerm: "view_audit" },
  "system.companies":    { module: "Sistem", label: "Şirketler",       actions: ["view","create","update","delete"], legacyPerm: "manage_companies" },
  "system.settings":     { module: "Sistem", label: "Genel Ayarlar",   actions: ["view","update"],              legacyPerm: "system_settings" },
  "system.notifications":{ module: "Sistem", label: "Bildirim Ayarları", actions: ["view","update"],            legacyPerm: "manage_notifications" },
};

// Grant scope türleri
const GRANT_SCOPE_TYPES = {
  all:        { label: "Tüm Şirket",          icon: "🌐" },
  org_unit:   { label: "Organizasyon Birimi", icon: "🏛️" },
  department: { label: "Departman",           icon: "📁" },
  job_title:  { label: "Pozisyon",            icon: "💼" },
  employee:   { label: "Çalışan",             icon: "👤" },
};

/* =====================================================================
   can() — Yeni Yetki Kontrolü Fonksiyonu (Backward Compatible)
   ---------------------------------------------------------------------
   İki kullanım modu vardır:
   
   1. ESKİ MOD: can(role, "view_dashboard")
      → Sistem rolünün seviyesi PERMS'te tanımlı eşik üstündeyse true
   
   2. YENİ MOD: can(session, "hr.employees.create", { data, users })
      → Üç katmanlı kontrol:
        a) Sistem rolü (legacyPerm üzerinden) erişim veriyor mu?
        b) Override kayıtları (deny varsa kesinlikle reddet)
        c) Kullanıcının grant'larından birinde bu izin var mı?
===================================================================== */

const can = (roleOrSession, permOrResource, opts = {}) => {
  // Mode tespiti
  const isNewMode = typeof permOrResource === "string" && permOrResource.includes(".");
  
  // === ESKİ MOD ===
  if (!isNewMode) {
    const role = typeof roleOrSession === "string" ? roleOrSession : roleOrSession?.role;
    return role && ROLES[role] && ROLES[role].level >= (PERMS[permOrResource] || 99);
  }
  
  // === YENİ MOD: resource.action ===
  const session = typeof roleOrSession === "object" ? roleOrSession : null;
  if (!session) return false;
  
  const parts = permOrResource.split(".");
  const action = parts[parts.length - 1];
  const resource = parts.slice(0, -1).join(".");
  const res = RESOURCES[resource];
  if (!res) return false;
  
  // (a) Sistem rolü check — admin her şeyi yapabilir
  if (session.role === "admin") return true;
  
  // Legacy permission check (sistem rolü o resource'a erişebiliyorsa view'da yetkisi var)
  if (action === "view" && res.legacyPerm && ROLES[session.role]?.level >= (PERMS[res.legacyPerm] || 99)) {
    return true;
  }
  
  // (b) Override kontrolü
  const overrides = opts.overrides || [];
  const userOverrides = overrides.filter(o =>
    o.userId === session.username &&
    o.resource === resource &&
    o.action === action &&
    (!o.expiresAt || new Date(o.expiresAt) >= new Date())
  );
  // Önce deny'leri kontrol et (deny her zaman önceliklidir)
  if (userOverrides.some(o => o.allow === false)) return false;
  // Sonra allow override'ları
  if (userOverrides.some(o => o.allow === true)) return true;
  
  // (c) Custom role grants kontrolü
  const customRoles = opts.customRoles || [];
  const grants = opts.grants || [];
  const userScope = opts.userScope || null;  // {employeeId, jobTitleId, departmentId, orgUnitId}
  const orgUnits = opts.orgUnits || [];
  const departments = opts.departments || [];
  
  const userGrants = grants.filter(g => grantAppliesToUser(g, session, userScope, { orgUnits, departments }));
  for (const g of userGrants) {
    if (g.validFrom && new Date(g.validFrom) > new Date()) continue;
    if (g.validUntil && new Date(g.validUntil) < new Date()) continue;
    const role = customRoles.find(r => r.id === g.roleId);
    if (!role) continue;
    if (role.permissions?.includes(`${resource}.${action}`)) return true;
  }
  
  return false;
};

// Grant kullanıcıya/scope'una uygun mu? Cascade desteği ile
function grantAppliesToUser(grant, session, userScope, opts = {}) {
  if (!grant) return false;
  const cascade = grant.cascade !== false;  // default true
  const orgUnits    = opts.orgUnits    || [];
  const departments = opts.departments || [];

  switch (grant.subjectType) {
    case "user":       return grant.subjectId === session.username;
    case "employee":   return userScope?.employeeId === grant.subjectId;
    case "job_title":  return userScope?.jobTitleId === grant.subjectId;

    case "department": {
      if (!userScope?.departmentId) return false;
      if (userScope.departmentId === grant.subjectId) return true;
      // Cascade: kullanıcının dept'i, grant'lanan dept'in alt dept'i mi?
      if (!cascade) return false;
      return isDescendantDepartment(userScope.departmentId, grant.subjectId, departments);
    }

    case "org_unit": {
      if (!userScope?.orgUnitId) return false;
      if (userScope.orgUnitId === grant.subjectId) return true;
      // Cascade: kullanıcının org birimi, grant'lanan birimin alt birimi mi?
      if (!cascade) return false;
      return isDescendantOrgUnit(userScope.orgUnitId, grant.subjectId, orgUnits);
    }

    default: return false;
  }
}

// Bir dept'in başka bir dept'in alt-dept'i (recursive)
function isDescendantDepartment(childId, ancestorId, departments) {
  if (!childId || !ancestorId) return false;
  const visited = new Set();
  let cur = departments.find(d => d.id === childId);
  while (cur && cur.parentDeptId && !visited.has(cur.id)) {
    visited.add(cur.id);
    if (cur.parentDeptId === ancestorId) return true;
    cur = departments.find(d => d.id === cur.parentDeptId);
  }
  return false;
}

// Bir org birimi, başka bir birimin alt-birimi mi (recursive)
function isDescendantOrgUnit(childId, ancestorId, orgUnits) {
  if (!childId || !ancestorId) return false;
  const visited = new Set();
  let cur = orgUnits.find(o => o.id === childId);
  while (cur && cur.parentId && !visited.has(cur.id)) {
    visited.add(cur.id);
    if (cur.parentId === ancestorId) return true;
    cur = orgUnits.find(o => o.id === cur.parentId);
  }
  return false;
}

// Belirli bir kullanıcının "user scope" bilgisini çıkar (employees → jobTitle → dept → orgUnit)
function resolveUserScope(username, data, users) {
  // Sistem kullanıcısı linked employee'ya bağlanabilir (users[].linkedEmployeeId)
  const u = (users || []).find(x => x.username === username);
  if (!u?.linkedEmployeeId) return null;
  const emp = (data?.hrEmployees || []).find(e => e.id === u.linkedEmployeeId);
  if (!emp) return null;
  const jt = (data?.hrJobTitles || []).find(j => j.id === emp.jobTitleId);
  const dept = jt ? (data?.hrDepartments || []).find(d => d.id === jt.departmentId) : null;
  return {
    employeeId: emp.id,
    jobTitleId: jt?.id,
    departmentId: dept?.id,
    orgUnitId: dept?.orgUnitId,
  };
}

/* =====================================================================
   RBAC — Component-Level Guards
   ---------------------------------------------------------------------
   <Guard canAct={canAct} action="hr.employees.delete">
     <button>Sil</button>
   </Guard>
   
   canAct verilmediği takdirde içeriği gösterir (geriye uyum için).
===================================================================== */
function Guard({ canAct, action, children, fallback = null, mode = "hide" }) {
  // canAct verilmediyse geri-uyumluluk için varsayılan true (içerik görünür)
  const allowed = canAct ? canAct(action) : true;
  if (allowed) return children;
  if (mode === "disable") {
    // Çocuğa disabled prop'unu zorla geç (button gibi)
    return React.cloneElement(children, { disabled: true, title: "Bu işlem için yetkiniz yok" });
  }
  return fallback;
}

/* ---------- Storage helpers ---------- */
const S = {
  async get(key, def = null) {
    try {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : def;
    } catch { return def; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val)); return true; }
    catch { return false; }
  },
  async del(key) { try { await window.storage.delete(key); } catch {} },
};

/* =====================================================================
   HR — İK MODÜLÜ SABİTLERİ
   ---------------------------------------------------------------------
   PER_COMPANY_FIELDS ve createEmptyCompanyData bu sabitleri kullandığı
   için modül başına yakın tanımlanmalıdır (temporal dead zone).
===================================================================== */

// İşe alım süreç aşamaları (her başvuru bu sıraya göre ilerler)
const RECRUITMENT_STAGES = [
  { id: "cv_review",      label: "CV İncelemesi",     color: "#64748b", order: 1 },
  { id: "phone_screen",   label: "Telefon Görüşmesi", color: "#0ea5e9", order: 2 },
  { id: "technical",      label: "Teknik Mülakat",    color: "#8b5cf6", order: 3 },
  { id: "hr_interview",   label: "İK Mülakatı",       color: "#ec4899", order: 4 },
  { id: "reference",      label: "Referans Kontrolü", color: "#f59e0b", order: 5 },
  { id: "offer",          label: "Teklif Aşaması",    color: "#0f766e", order: 6 },
  { id: "hired",          label: "İşe Başladı",       color: "#15803d", order: 7 },
  { id: "rejected",       label: "Reddedildi",        color: "#b91c1c", order: 99 },
  { id: "withdrawn",      label: "Aday Vazgeçti",     color: "#737373", order: 100 },
];

// Pozisyon durumları
const POSITION_STATUS = {
  open:     { label: "Açık",        color: "#0ea5e9" },
  on_hold:  { label: "Beklemede",   color: "#f59e0b" },
  filled:   { label: "Doldu",       color: "#15803d" },
  closed:   { label: "Kapatıldı",   color: "#737373" },
};

// Çalışma şekilleri (Türk iş hukukuna göre)
const EMPLOYMENT_TYPES = {
  full_time:   "Tam Zamanlı",
  part_time:   "Kısmi Zamanlı",
  contract:    "Sözleşmeli",
  intern:      "Stajyer",
  freelance:   "Serbest Çalışan",
};

// Çalışma yeri
const WORK_MODES = {
  office:  "Ofiste",
  hybrid:  "Hibrit",
  remote:  "Uzaktan",
};

// Aday kaynak kanalları
const CANDIDATE_SOURCES = {
  linkedin:    "LinkedIn",
  kariyer_net: "Kariyer.net",
  secretcv:    "SecretCV",
  yenibiris:   "Yenibiris.com",
  referral:    "Çalışan Referansı",
  direct:      "Doğrudan Başvuru",
  agency:      "Danışmanlık Firması",
  university:  "Üniversite",
  social:      "Sosyal Medya",
  other:       "Diğer",
};

// Organizasyon birimi türleri (Genel Müdürlük, Bölge, Şube, Şirket vb.)
const ORG_UNIT_TYPES = {
  headquarters: { label: "Genel Müdürlük",   icon: "🏛️", color: "#7c2d12" },
  region:       { label: "Bölge Müdürlüğü",  icon: "🌐", color: "#1d4ed8" },
  branch:       { label: "Şube",             icon: "🏢", color: "#0f766e" },
  subsidiary:   { label: "Bağlı Şirket",     icon: "🏬", color: "#7c3aed" },
  division:     { label: "Bölüm",            icon: "📍", color: "#dc2626" },
  facility:     { label: "Tesis / Fabrika",  icon: "🏭", color: "#475569" },
};

// Pozisyon seviyeleri (kariyer basamağı)
const JOB_LEVELS = {
  intern:     { label: "Stajyer",            order: 1, color: "#94a3b8" },
  junior:     { label: "Junior",             order: 2, color: "#0ea5e9" },
  mid:        { label: "Orta Seviye",        order: 3, color: "#3b82f6" },
  senior:     { label: "Senior",             order: 4, color: "#8b5cf6" },
  lead:       { label: "Lead / Takım Lideri",order: 5, color: "#ec4899" },
  manager:    { label: "Müdür",              order: 6, color: "#f59e0b" },
  senior_mgr: { label: "Kıdemli Müdür",      order: 7, color: "#dc2626" },
  director:   { label: "Direktör",           order: 8, color: "#7c2d12" },
  vp:         { label: "Genel Müdür Yrd.",   order: 9, color: "#581c87" },
  c_level:    { label: "C-Level / GM",       order: 10, color: "#0f172a" },
};

// Çalışan durumları
const EMPLOYEE_STATUS = {
  active:      { label: "Aktif",        color: "#15803d" },
  probation:   { label: "Deneme Sürecinde", color: "#f59e0b" },
  on_leave:    { label: "İzinde",       color: "#0ea5e9" },
  maternity:   { label: "Doğum İzni",   color: "#ec4899" },
  military:    { label: "Askerlik",     color: "#737373" },
  suspended:   { label: "Askıya Alınmış", color: "#dc2626" },
  terminated:  { label: "Ayrıldı",      color: "#525252" },
};

// Varsayılan organizasyon birimleri (yeni şirkette seed olarak)
const DEFAULT_HR_ORG_UNITS = [
  { id: "ou_gm", name: "Genel Müdürlük", type: "headquarters", parentId: null,
    code: "GM-001", description: "Şirketin genel merkez yönetimi",
    managerEmployeeId: null, authorizedUsers: [] },
];

// Varsayılan departmanlar (Genel Müdürlük'e bağlı olarak)
const DEFAULT_HR_DEPARTMENTS = [
  { id: "dept_yonetim",      name: "Yönetim",          color: "#1d4ed8", orgUnitId: "ou_gm", parentDeptId: null, code: "YON", managerEmployeeId: null, authorizedUsers: [] },
  { id: "dept_finans",       name: "Finans",           color: "#0f766e", orgUnitId: "ou_gm", parentDeptId: null, code: "FIN", managerEmployeeId: null, authorizedUsers: [] },
  { id: "dept_satis",        name: "Satış",            color: "#dc2626", orgUnitId: "ou_gm", parentDeptId: null, code: "SAT", managerEmployeeId: null, authorizedUsers: [] },
  { id: "dept_pazarlama",    name: "Pazarlama",        color: "#ea580c", orgUnitId: "ou_gm", parentDeptId: null, code: "PAZ", managerEmployeeId: null, authorizedUsers: [] },
  { id: "dept_yazilim",      name: "Yazılım",          color: "#7c3aed", orgUnitId: "ou_gm", parentDeptId: null, code: "YZL", managerEmployeeId: null, authorizedUsers: [] },
  { id: "dept_ik",           name: "İnsan Kaynakları", color: "#db2777", orgUnitId: "ou_gm", parentDeptId: null, code: "IK",  managerEmployeeId: null, authorizedUsers: [] },
  { id: "dept_operasyon",    name: "Operasyon",        color: "#475569", orgUnitId: "ou_gm", parentDeptId: null, code: "OP",  managerEmployeeId: null, authorizedUsers: [] },
  { id: "dept_muhasebe",     name: "Muhasebe",         color: "#0891b2", orgUnitId: "ou_gm", parentDeptId: null, code: "MUH", managerEmployeeId: null, authorizedUsers: [] },
];

// SGK + Vergi maliyet faktörleri (2026 Türkiye değerleri, brüt maaş üzerinden)
const PAYROLL_FACTORS = {
  employer_sgk_rate:        0.205,
  employer_sgk_discount:    0.05,
  employee_sgk_rate:        0.14,
  employee_unemployment:    0.01,
  income_tax_first_bracket: 0.15,
  damga_vergisi:            0.00759,
};

// İşveren brüt maliyetini hesapla (yaklaşık)
function computeEmployerCost(brutAylik) {
  const b = Number(brutAylik) || 0;
  const employerContrib = b * (PAYROLL_FACTORS.employer_sgk_rate - PAYROLL_FACTORS.employer_sgk_discount);
  return b + employerContrib;
}

// Yaklaşık net maaş hesabı
function computeNetFromGross(brutAylik) {
  const b = Number(brutAylik) || 0;
  const sgkEmployee = b * PAYROLL_FACTORS.employee_sgk_rate;
  const unemployment = b * PAYROLL_FACTORS.employee_unemployment;
  const taxBase = b - sgkEmployee - unemployment;
  const incomeTax = taxBase * PAYROLL_FACTORS.income_tax_first_bracket;
  const stampTax = b * PAYROLL_FACTORS.damga_vergisi;
  return Math.max(0, b - sgkEmployee - unemployment - incomeTax - stampTax);
}

/* =====================================================================
   /HR SABİTLERİ
===================================================================== */

/* =====================================================================
   ÇOKLU ŞİRKET ALTYAPISI
   ---------------------------------------------------------------------
   Veri modeli iki katmanlıdır:
   - Global alanlar (companies, activeCompanyId, exchangeRates, tcmb,
     rateHistory, banks (entity), displayCurrency)
   - Şirket başına alanlar (companyData[companyId]) — her şirketin kendi
     nakit akış, hesap, kasa, fatura, transfer kayıtları
   Component'lar düz "effective data" görür; saveData() ise updates'i
   doğru katmana yazar.
===================================================================== */
const PER_COMPANY_FIELDS = [
  "fiscalYear", "fiscalStartMonth", "openingCash",
  "inflows", "outflows", "nonPnlOutflows", "cells",
  "bankAccounts", "bankEntries",
  "kasaAccounts", "kasaEntries", "kasaCategories",
  "transfers", "invoices", "revaluations",
  "loans", "loanTransactions",
  "hrOrgUnits", "hrDepartments", "hrJobTitles", "hrEmployees",
  "hrPositions", "hrCandidates", "hrApplications", "hrInterviews",
  "hrCustomRoles", "hrRoleGrants", "hrPermOverrides",
  "notificationSettings", "archives",
];

// Yeni şirket için varsayılan kategori şablonu
const DEFAULT_KASA_CATEGORIES = [
  { id: "kc_personel",  name: "Personel Ödemesi" },
  { id: "kc_kira",      name: "Kira" },
  { id: "kc_fatura",    name: "Fatura (Su/Elektrik/Gaz)" },
  { id: "kc_telefon",   name: "Telefon/İnternet" },
  { id: "kc_yemek",     name: "Yemek/İkram" },
  { id: "kc_yakit",     name: "Yakıt" },
  { id: "kc_kirtasiye", name: "Kırtasiye/Ofis" },
  { id: "kc_temsil",    name: "Temsil & Ağırlama" },
  { id: "kc_vergi",     name: "Vergi & SGK" },
  { id: "kc_satis",     name: "Satış Geliri" },
  { id: "kc_avans",     name: "Personel Avansı" },
  { id: "kc_diger",     name: "Diğer" },
];

// Yeni şirket eklendiğinde içeriği — boş veya kopyalanmış
function createEmptyCompanyData(opts = {}) {
  const ts = Date.now();
  return {
    fiscalYear: opts.fiscalYear || new Date().getFullYear(),
    fiscalStartMonth: opts.fiscalStartMonth ?? 0,
    openingCash: opts.openingCash || 0,
    inflows: opts.inflows || [],
    outflows: opts.outflows || [],
    nonPnlOutflows: opts.nonPnlOutflows || [],
    cells: {},
    bankAccounts: [],
    bankEntries: [],
    kasaAccounts: [
      { id: "ksa_" + ts, name: "Merkez Kasa", currency: "TRY", openingBalance: 0, active: true },
    ],
    kasaEntries: [],
    kasaCategories: opts.kasaCategories || [...DEFAULT_KASA_CATEGORIES],
    transfers: [],
    invoices: [],
    revaluations: [],
    loans: [],
    loanTransactions: [],
    hrOrgUnits: opts.hrOrgUnits || [...DEFAULT_HR_ORG_UNITS],
    hrDepartments: opts.hrDepartments || [...DEFAULT_HR_DEPARTMENTS],
    hrJobTitles: [],
    hrEmployees: [],
    hrPositions: [],
    hrCandidates: [],
    hrApplications: [],
    hrInterviews: [],
    hrCustomRoles: [],
    hrRoleGrants: [],
    hrPermOverrides: [],
    notificationSettings: createDefaultNotificationSettings(),
    archives: [],
  };
}

function createDefaultNotificationSettings() {
  return {
    enabled: false,
    recipients: [],
    alertThresholdDays: 7,
    includeOverdue: true,
    includeDueSoon: true,
    includeUpcoming30: true,
    includeCashPosition: true,
    includeFxPositions: true,
    lastGeneratedAt: null,
    lastSentAt: null,
    browserNotifyEnabled: false,
  };
}

// Active şirketin verisini düz bir yapıya çıkarır (component'lar bunu görür)
function selectCompanyData(data) {
  if (!data) return null;
  const activeId = data.activeCompanyId;
  const co = data.companyData?.[activeId] || {};
  const out = { ...data };
  PER_COMPANY_FIELDS.forEach(f => {
    out[f] = co[f] !== undefined ? co[f] : (Array.isArray(createEmptyCompanyData()[f]) ? [] : createEmptyCompanyData()[f]);
  });
  return out;
}

// component onChange çağrılarını uygun katmana yönlendirir
function updateCompanyData(currentData, next) {
  if (!currentData) return next;
  const isSwitchingCompany = next.activeCompanyId && next.activeCompanyId !== currentData.activeCompanyId;

  const companyUpdates = {};
  const globalNext = { ...next };

  PER_COMPANY_FIELDS.forEach(f => {
    if (next[f] !== undefined) {
      if (!isSwitchingCompany) companyUpdates[f] = next[f];
      delete globalNext[f];
    }
  });

  // Şirket değiştiriliyorsa eski şirketin company-data'sını kaydetme, yalnızca global'leri uygula
  if (isSwitchingCompany) {
    // Eski şirketin verisi 'currentData.companyData' içinde zaten kayıtlı, değiştirmeyiz
    return { ...currentData, ...globalNext };
  }

  return {
    ...currentData,
    ...globalNext,
    companyData: {
      ...(currentData.companyData || {}),
      [currentData.activeCompanyId]: {
        ...(currentData.companyData?.[currentData.activeCompanyId] || {}),
        ...companyUpdates,
      },
    },
  };
}

/* ---------- İlk kurulum: seed data ---------- */
const DEFAULT_COMPANY_ID = "comp_promet";

const DEFAULT_SEED = {
  // === GLOBAL alanlar ===
  exchangeRates: { USD: 34.02, EUR: 38.13 },
  displayCurrency: "TRY",
  tcmb: {
    apiKey: "",
    corsProxy: "",
    rateType: "selling",
    autoFetchOnLogin: false,
    lastFetched: null,
    lastFetchStatus: null,
    lastFetchMessage: "",
  },
  rateHistory: [],
  banks: [
    { id: "bnk_yapikredi", name: "Yapı Kredi Bankası", code: "YKB", color: "#003a70" },
    { id: "bnk_garanti",   name: "Garanti BBVA",       code: "GAR", color: "#00866d" },
    { id: "bnk_teb",       name: "TEB",                code: "TEB", color: "#0a3d62" },
    { id: "bnk_isbank",    name: "Türkiye İş Bankası", code: "ISB", color: "#0046ad" },
    { id: "bnk_vakif",     name: "VakıfBank",          code: "VKB", color: "#ffd700" },
    { id: "bnk_halk",      name: "Halkbank",           code: "HLK", color: "#003892" },
  ],
  companies: [
    {
      id: DEFAULT_COMPANY_ID,
      name: "Promet AŞ",
      taxNo: "",
      color: "#dc2626",
      createdAt: new Date().toISOString(),
    },
  ],
  activeCompanyId: DEFAULT_COMPANY_ID,
  // === Şirket başına alanlar ===
  companyData: {
    [DEFAULT_COMPANY_ID]: {
      fiscalYear: 2025,
      fiscalStartMonth: 8, // Eylül
      openingCash: 3887000,
      inflows: [
        { id: "in_1",  name: "Nakit Satışlar" },
        { id: "in_2",  name: "Turksat Aş. Ulaştırma Bakanlığı Hakediş" },
        { id: "in_3",  name: "Turksat Aş. Devlet Su İşleri Hakediş" },
        { id: "in_4",  name: "Şeker Fabrikaları Genel Müdürlüğü" },
        { id: "in_5",  name: "Kredi Garanti Fonu Yerinde Destek" },
        { id: "in_6",  name: "Aselsan Aş." },
        { id: "in_7",  name: "Merkez Bankası Aş." },
        { id: "in_8",  name: "Alacak hesaplarından tahsil edilenler" },
        { id: "in_9",  name: "Promet Enerji Aş. Alınan Borçlar" },
        { id: "in_10", name: "Araç Satış Geliri" },
      ],
      outflows: [
        { id: "out_1",  name: "Exclusive Çek Ödemesi (Roketsan)" },
        { id: "out_2",  name: "Arena Bilgisayar SDS Bakım" },
        { id: "out_3",  name: "Redington Çek Ödemesi" },
        { id: "out_4",  name: "Longline" },
        { id: "out_5",  name: "Promet TEB Bankası BCH Kredi" },
        { id: "out_6",  name: "Cynox Bilişim (Roketsan)" },
        { id: "out_7",  name: "Morten Bilişim (KGF)" },
        { id: "out_8",  name: "Yes Bilişim (Merkez Bankası)" },
        { id: "out_9",  name: "Kira" },
        { id: "out_10", name: "Telefon" },
        { id: "out_11", name: "Su - Elektrik - Doğalgaz" },
        { id: "out_12", name: "SGK Ödemeleri" },
        { id: "out_13", name: "Vergi Ödemeleri" },
        { id: "out_14", name: "Personel Ücretleri (Ulaştırma)" },
        { id: "out_15", name: "Personel Ücretleri (DSİ)" },
        { id: "out_16", name: "Personel Ücretleri (Yazılım)" },
        { id: "out_17", name: "Personel Ücretleri (Diğer)" },
        { id: "out_18", name: "Personel Ücretleri (Yemek)" },
        { id: "out_19", name: "Devre Sonu Faizleri" },
        { id: "out_20", name: "Active Aş Kredileri" },
        { id: "out_21", name: "Promet Aş Kredileri" },
        { id: "out_22", name: "Kredi Kartı Ödemeleri" },
        { id: "out_23", name: "Fiat Kredi" },
      ],
      nonPnlOutflows: [
        { id: "npo_1", name: "Kredi Anapara Ödemesi YKB" },
        { id: "npo_2", name: "Kredi Anapara Ödemesi TEB" },
        { id: "npo_3", name: "Sermaye / Satın Alma İşlemleri" },
        { id: "npo_4", name: "Diğer Başlangıç Maliyetleri" },
        { id: "npo_5", name: "Rezerv ve/veya Alıkoyma" },
        { id: "npo_6", name: "Şirket Sahiplerinin Çektiği Tutar" },
      ],
      cells: {},
      bankAccounts: [],
      bankEntries: [],
      kasaAccounts: [
        { id: "ksa_merkez", name: "Merkez Kasa", currency: "TRY", openingBalance: 0, active: true },
      ],
      kasaEntries: [],
      kasaCategories: [...DEFAULT_KASA_CATEGORIES],
      transfers: [],
      invoices: [],
      revaluations: [],
      loans: [],
      loanTransactions: [],
      hrOrgUnits: [...DEFAULT_HR_ORG_UNITS],
      hrDepartments: [...DEFAULT_HR_DEPARTMENTS],
      hrJobTitles: [],
      hrEmployees: [],
      hrPositions: [],
      hrCandidates: [],
      hrApplications: [],
      hrInterviews: [],
      hrCustomRoles: [],
      hrRoleGrants: [],
      hrPermOverrides: [],
      notificationSettings: {
        enabled: false,
        recipients: [],
        alertThresholdDays: 7,
        includeOverdue: true,
        includeDueSoon: true,
        includeUpcoming30: true,
        includeCashPosition: true,
        includeFxPositions: true,
        lastGeneratedAt: null,
        lastSentAt: null,
        browserNotifyEnabled: false,
      },
      archives: [],
    },
  },
};

/* ---------- ESKİ veri yapısını yeni yapıya migrate eder ---------- */
function migrateLegacyData(d) {
  if (!d) return null;
  // Eğer companies & companyData zaten varsa, eski formatta değil
  if (d.companies && d.companyData) return { data: d, migrated: false };

  // Eski format: tüm per-company alanlar üst düzeyde
  const newCompanyId = "comp_legacy_" + Date.now();
  const companyData = {};
  PER_COMPANY_FIELDS.forEach(f => {
    if (d[f] !== undefined) {
      companyData[f] = d[f];
      delete d[f];
    }
  });

  // Default değerleri tamamla
  const defaults = createEmptyCompanyData({
    fiscalYear: companyData.fiscalYear,
    fiscalStartMonth: companyData.fiscalStartMonth,
  });
  PER_COMPANY_FIELDS.forEach(f => {
    if (companyData[f] === undefined) companyData[f] = defaults[f];
  });

  d.companies = [{
    id: newCompanyId,
    name: "Promet AŞ",
    taxNo: "",
    color: "#dc2626",
    createdAt: new Date().toISOString(),
  }];
  d.activeCompanyId = newCompanyId;
  d.companyData = { [newCompanyId]: companyData };
  return { data: d, migrated: true };
}


const DEFAULT_USERS = [
  { id: "u_admin", username: "admin",   password: "admin123",  fullName: "Sistem Yöneticisi", role: "admin",  active: true },
  { id: "u_cfo",   username: "mustafa", password: "promet",    fullName: "Mustafa",           role: "cfo",    active: true },
  { id: "u_view",  username: "viewer",  password: "viewer",    fullName: "Görüntüleyici",     role: "viewer", active: true },
];

/* ---------- Format ---------- */
const fmtTL = (n) => {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.round(Number(n)));
};
const fmtTLSign = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Math.round(Number(n));
  const s = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.abs(v));
  return v < 0 ? `(${s})` : s;
};

/* =====================================================================
   LOCALE-AWARE FORMAT HELPERS — Çok dilli format desteği
   ---------------------------------------------------------------------
   Aktif dilin locale ayarına göre sayı/para/tarih biçimlendirir.
   Mevcut fmtTL/fmtTL2 vb. korunur (geriye uyumluluk).
===================================================================== */

// Aktif dile göre locale string'i döner (window.__PROMETA_LANG__ üzerinden)
function getActiveLocale(lang) {
  const useLang = lang || (typeof window !== "undefined" ? window.__PROMETA_LANG__ : null) || "tr";
  return LANGUAGES[useLang]?.locale || "tr-TR";
}

// Sayı formatla — dile duyarlı (tr: 1.234,56 | en: 1,234.56 | de: 1.234,56 | ar: 1,234.56)
function fmtNumber(n, opts = {}) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return opts.empty || "";
  const locale = getActiveLocale(opts.lang);
  const decimals = opts.decimals != null ? opts.decimals : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n));
}

function fmtNumberSign(n, opts = {}) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  const formatted = fmtNumber(Math.abs(v), opts);
  return v < 0 ? `(${formatted})` : formatted;
}

// Para birimi formatla — sembolüyle birlikte
// fmtCurrency(1234.56, "TRY") → "1.234,56 ₺" (tr-TR)
// fmtCurrency(1234.56, "USD") → "$1,234.56" (en-US)
// fmtCurrency(1234.56, "EUR") → "1.234,56 €"  (de-DE)
function fmtCurrency(n, currency = "TRY", opts = {}) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return opts.empty || "";
  const locale = getActiveLocale(opts.lang);
  const decimals = opts.decimals != null ? opts.decimals : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(n));
  } catch {
    // Bilinmeyen para birimi için fallback
    return `${fmtNumber(n, opts)} ${currency}`;
  }
}

// Tarih formatla — dile duyarlı
// fmtDate("2026-05-13", lang="tr") → "13.05.2026"
// fmtDate("2026-05-13", lang="en") → "5/13/2026"
// fmtDate("2026-05-13", lang="de") → "13.5.2026"
// fmtDate("2026-05-13", lang="ar") → "١٣‏/٥‏/٢٠٢٦"
function fmtDate(dateInput, opts = {}) {
  if (!dateInput) return "";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);
  const locale = getActiveLocale(opts.lang);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: opts.month || "2-digit",
    day: "2-digit",
  }).format(date);
}

// Tarih + saat
function fmtDateTime(dateInput, opts = {}) {
  if (!dateInput) return "";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);
  const locale = getActiveLocale(opts.lang);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Göreceli zaman ("2 saat önce", "2 hours ago", "vor 2 Stunden", "منذ ساعتين")
function fmtRelativeTime(dateInput, opts = {}) {
  if (!dateInput) return "";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  const locale = getActiveLocale(opts.lang);
  const diff = (date.getTime() - Date.now()) / 1000;  // saniye
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), "second");
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (Math.abs(diff) < 2592000) return rtf.format(Math.round(diff / 86400), "day");
  if (Math.abs(diff) < 31536000) return rtf.format(Math.round(diff / 2592000), "month");
  return rtf.format(Math.round(diff / 31536000), "year");
}

/* =====================================================================
   /LOCALE FORMAT HELPERS
===================================================================== */

// 2 ondalıklı Türk format — kuruş hassasiyeti gereken yerler için (banka hareketleri, faturalar)
const fmtTL2 = (n) => {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "";
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));
};
const fmtTLSign2 = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  const s = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  return v < 0 ? `(${s})` : s;
};

// Excel hücre değerini gösterilecek string'e çevir (sayıysa Türk format, değilse olduğu gibi)
const fmtCellValue = (v) => {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    // Tam sayı ise ondalık göstermeden, kesirli ise 2 ondalık
    if (Number.isInteger(v)) {
      return new Intl.NumberFormat("tr-TR").format(v);
    }
    return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  return String(v);
};

/* ---------- Para birimi ---------- */
const CURRENCY_SYMBOLS = { TRY: "₺", USD: "$", EUR: "€" };
const CURRENCY_LABELS = { TRY: "Türk Lirası", USD: "ABD Doları", EUR: "Euro" };

// TL'den hedef para birimine çevirir
const convertFromTRY = (tlAmount, targetCurrency, rates) => {
  if (!tlAmount || targetCurrency === "TRY") return Number(tlAmount || 0);
  const rate = Number(rates?.[targetCurrency] || 1);
  return rate > 0 ? Number(tlAmount) / rate : 0;
};

// Hedef para biriminden TL'ye çevirir
const convertToTRY = (amount, sourceCurrency, rates) => {
  if (!amount || sourceCurrency === "TRY") return Number(amount || 0);
  const rate = Number(rates?.[sourceCurrency] || 1);
  return Number(amount) * rate;
};

// Format eden ana fonksiyon: para birimine uygun gösterir
const fmtMoney = (tlAmount, displayCurrency = "TRY", rates = {}) => {
  if (tlAmount === null || tlAmount === undefined || tlAmount === "" || isNaN(tlAmount)) return "";
  const value = convertFromTRY(tlAmount, displayCurrency, rates);
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: displayCurrency === "TRY" ? 0 : 2 }).format(Math.round(value * 100) / 100);
};

const fmtMoneySign = (tlAmount, displayCurrency = "TRY", rates = {}) => {
  if (tlAmount === null || tlAmount === undefined || isNaN(tlAmount)) return "—";
  const value = convertFromTRY(tlAmount, displayCurrency, rates);
  const rounded = displayCurrency === "TRY" ? Math.round(value) : Math.round(value * 100) / 100;
  const s = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: displayCurrency === "TRY" ? 0 : 2 }).format(Math.abs(rounded));
  return rounded < 0 ? `(${s})` : s;
};

/* =====================================================================
   KREDİLER — Türk bankacılığı tipleri ve hesaplamalar
   ---------------------------------------------------------------------
   Desteklenen kredi türleri:
   - installment: Taksitli ticari kredi (eşit aylık taksit, annuity)
   - spot:        Spot kredi (vade sonu tek seferde anapara + faiz)
   - bch:         Borçlu Cari Hesap (revolving, kullanılan tutar üzerinden faiz)
   - kmh:         Kredili Mevduat Hesabı (overdraft, banka hesabına bağlı)
   - rotatif:     Rotatif kredi (limit dahilinde çekim/yatırım, kullanım günü × faiz)

   Hesaplama (taksitli):
     i = yıllık faiz / 12  (aylık faiz)
     A = P · i · (1+i)^n / ((1+i)^n - 1)  (annuity / sabit taksit)
     Her ay: faiz = kalan_anapara · i ; anapara = A - faiz
     BSMV = faiz · bsmvRate  (genelde %10, ticari kredilerde uygulanır)
     KKDF = faiz · kkdfRate  (bireysel %15, kurumsal %0)

   Spot kredi: tek satır = vade sonu (anapara + toplam faiz + BSMV)
   BCH/KMH/Rotatif: schedule boş, hareketler loanTransactions üzerinden
===================================================================== */
const LOAN_TYPES = {
  installment: { label: "Taksitli Ticari",  short: "Taksitli", color: "#0f766e" },
  spot:        { label: "Spot Kredi",       short: "Spot",     color: "#1d4ed8" },
  bch:         { label: "Borçlu Cari Hesap (BCH)", short: "BCH", color: "#7c3aed" },
  kmh:         { label: "Kredili Mevduat (KMH)",   short: "KMH", color: "#b45309" },
  rotatif:     { label: "Rotatif Kredi",    short: "Rotatif",  color: "#9333ea" },
};

// Türkiye ticari kredilerde standart oran varsayılanları
const LOAN_DEFAULTS = {
  bsmvRate: 0.10,   // BSMV: faizin %10'u (banka tarafından kesilir, müşteriye yansıtılır)
  kkdfRate: 0.00,   // KKDF: ticari kredilerde %0, bireyselde %15
};

function loanMonthlyRate(loan) {
  // interestRate yıllık yüzde olarak saklanır (örn. 0.045 = %4.5 yıllık)
  // Bazı kullanıcılar aylık girmiş olabilir → eğer 0.10'dan büyükse muhtemelen yıllık
  const r = Number(loan.interestRate) || 0;
  return r / 12;
}

function generateAmortizationSchedule(loan) {
  if (!loan) return [];
  const P = Number(loan.principal) || 0;
  const n = Number(loan.termMonths) || 0;
  if (P <= 0 || n <= 0) return [];

  const i = loanMonthlyRate(loan);
  const bsmvRate = loan.bsmvRate ?? LOAN_DEFAULTS.bsmvRate;
  const kkdfRate = loan.kkdfRate ?? LOAN_DEFAULTS.kkdfRate;

  // Taksitli — annuity
  if (loan.type === "installment") {
    const A = i === 0 ? P / n : (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const startDate = new Date(loan.disbursementDate || new Date().toISOString().slice(0, 10));
    const paymentDay = Number(loan.paymentDay) || startDate.getDate();
    const schedule = [];
    let remaining = P;
    for (let k = 0; k < n; k++) {
      const interest = remaining * i;
      const principal = Math.min(A - interest, remaining);
      remaining = Math.max(0, remaining - principal);
      const bsmv = interest * bsmvRate;
      const kkdf = interest * kkdfRate;
      const due = new Date(startDate);
      due.setMonth(due.getMonth() + k + 1);
      due.setDate(Math.min(paymentDay, 28)); // güvenli gün
      schedule.push({
        idx: k,
        dueDate: due.toISOString().slice(0, 10),
        principal: round2(principal),
        interest: round2(interest),
        bsmv: round2(bsmv),
        kkdf: round2(kkdf),
        total: round2(principal + interest + bsmv + kkdf),
        remaining: round2(remaining),
        paid: false,
        paidDate: null,
        paidAmount: 0,
      });
    }
    return schedule;
  }

  // Spot — tek satır, vade sonu
  if (loan.type === "spot") {
    const totalInterest = P * i * n;
    const bsmv = totalInterest * bsmvRate;
    const kkdf = totalInterest * kkdfRate;
    const startDate = new Date(loan.disbursementDate || new Date().toISOString().slice(0, 10));
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + n);
    return [{
      idx: 0,
      dueDate: due.toISOString().slice(0, 10),
      principal: round2(P),
      interest: round2(totalInterest),
      bsmv: round2(bsmv),
      kkdf: round2(kkdf),
      total: round2(P + totalInterest + bsmv + kkdf),
      remaining: 0,
      paid: false,
      paidDate: null,
      paidAmount: 0,
    }];
  }

  // BCH/KMH/Rotatif: dinamik, hareketlere göre, schedule boş
  return [];
}

function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

// Kredinin güncel kalan anaparası — kayıtlı schedule + loanTransactions'a göre
function computeLoanBalance(loanId, data) {
  const loan = (data.loans || []).find(l => l.id === loanId);
  if (!loan) return 0;
  const P = Number(loan.principal) || 0;

  if (loan.type === "installment" || loan.type === "spot") {
    // Ödenmemiş taksitlerin anaparalarının toplamı = kalan borç
    const sch = loan.schedule || generateAmortizationSchedule(loan);
    const unpaidPrincipal = sch.filter(s => !s.paid).reduce((sum, s) => sum + s.principal, 0);
    return round2(unpaidPrincipal);
  }

  // BCH/KMH/Rotatif: hareketlere göre
  const txs = (data.loanTransactions || []).filter(t => t.loanId === loanId);
  let used = 0;
  txs.forEach(t => {
    if (t.type === "draw")  used += Number(t.amount) || 0;
    if (t.type === "repay") used -= Number(t.amount) || 0;
  });
  return round2(Math.max(0, used));
}

// Kredinin kullanılabilir kalan limiti (BCH/KMH/Rotatif için)
function computeLoanAvailableLimit(loan, data) {
  if (!loan) return 0;
  const limit = Number(loan.principal) || 0;
  const used = computeLoanBalance(loan.id, data);
  return Math.max(0, limit - used);
}

// Kredinin toplam ödenen anapara + faiz + BSMV + KKDF
function computeLoanPaidTotals(loan, data) {
  if (!loan) return { principal: 0, interest: 0, bsmv: 0, kkdf: 0 };
  if (loan.type === "installment" || loan.type === "spot") {
    const sch = loan.schedule || [];
    const paid = sch.filter(s => s.paid);
    return {
      principal: round2(paid.reduce((s, x) => s + x.principal, 0)),
      interest:  round2(paid.reduce((s, x) => s + x.interest, 0)),
      bsmv:      round2(paid.reduce((s, x) => s + (x.bsmv || 0), 0)),
      kkdf:      round2(paid.reduce((s, x) => s + (x.kkdf || 0), 0)),
    };
  }
  // BCH/KMH/Rotatif
  const txs = (data.loanTransactions || []).filter(t => t.loanId === loan.id);
  return {
    principal: round2(txs.filter(t => t.type === "repay").reduce((s, t) => s + (Number(t.amount) || 0), 0)),
    interest:  round2(txs.filter(t => t.type === "interest").reduce((s, t) => s + (Number(t.amount) || 0), 0)),
    bsmv:      0,
    kkdf:      0,
  };
}

/* =====================================================================
   /KREDİLER
===================================================================== */

/* =====================================================================
   BANKA EXCEL IMPORT — Akıllı sütun tespiti + tarih/tutar parse
   ---------------------------------------------------------------------
   Türk bankalarının extreleri farklı formatlarda gelir:
   - YKB:      Tarih | Açıklama | Tutar (- = borç) | Bakiye
   - Garanti:  İşlem Tar. | Açıklama | Tutar TL | Bakiye TL
   - İş Bank:  İşlem Tarihi | Açıklama | Borç | Alacak | Bakiye
   - TEB:      Tarih | Valör | Açıklama | Borç | Alacak | Bakiye
   - Akbank:   Tarih | Açıklama | Borç | Alacak | Bakiye
   - Halkbank: İşlem Tarihi | Açıklama | Tutar | Bakiye
   Bu modül tüm bunları otomatik tanıyacak şekilde yazılmıştır.
===================================================================== */

// Sütun başlığını normalize et (Türkçe karakterler, boşluk, büyük/küçük)
function normalizeHeader(s) {
  return String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Bir header satırına bakıp hangi kolon ne anlam taşıyor diye tespit et
function detectBankColumns(headers) {
  const map = { date: -1, valueDate: -1, description: -1, amount: -1, debit: -1, credit: -1, balance: -1, reference: -1 };
  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (n === "") return;
    // Tarih
    if (map.date === -1 && /^(islem|valor|hareket|kayit|muh|operasyon)?tar/.test(n)) {
      // Valör veya işlem - işlem tarihini tercih et
      if (n.includes("valor")) {
        if (map.valueDate === -1) map.valueDate = i;
      } else {
        map.date = i;
      }
    } else if (map.valueDate === -1 && n.includes("valor")) {
      map.valueDate = i;
    }
    // Açıklama
    else if (map.description === -1 && /(aciklama|detay|islemturu|tip|aktivite|narrative|description)/.test(n)) {
      map.description = i;
    }
    // Borç (debit) - genelde negatif/çıkış
    else if (map.debit === -1 && (n === "borc" || n === "borctl" || n === "borctutari" || n === "debit" || n === "cikis")) {
      map.debit = i;
    }
    // Alacak (credit) - genelde pozitif/giriş
    else if (map.credit === -1 && (n === "alacak" || n === "alacaktl" || n === "alacaktutari" || n === "credit" || n === "giris")) {
      map.credit = i;
    }
    // Bakiye
    else if (map.balance === -1 && /^bakiye|^kalan|^balance/.test(n)) {
      map.balance = i;
    }
    // Tutar (tek kolon)
    else if (map.amount === -1 && (n === "tutar" || n === "amount" || n === "miktar" || n === "tutartl" || n.startsWith("tutar"))) {
      map.amount = i;
    }
    // Referans
    else if (map.reference === -1 && /(referans|reference|islemno|fisno|dekontno|sirano)/.test(n)) {
      map.reference = i;
    }
  });
  return map;
}

// Türk tarih formatlarını ayrıştır: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, Excel serial number
function parseTRDate(raw) {
  if (raw == null || raw === "") return null;
  // Excel serial number (gün sayısı 1900-01-01'den)
  if (typeof raw === "number" && raw > 1000 && raw < 100000) {
    // Excel serial: 25569 = 1970-01-01 (Unix epoch)
    const date = new Date((raw - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD.MM.YYYY veya DD/MM/YYYY
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // ISO timestamp
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Türk sayı formatını parse et: "1.234,56" veya "1,234.56" veya "1234.56"
function parseTRNumber(raw) {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim();
  if (!s) return 0;
  // Parantez içindeki sayı negatif: (1.234,56) → -1234.56
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) { negative = true; s = s.slice(1, -1); }
  // - işareti
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  // Para birimi sembolleri çıkar
  s = s.replace(/[₺$€\s]/g, "");
  // Türk format: "1.234,56" → "1234.56"
  // Hem nokta hem virgül varsa son ayırıcı ondalık
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) {
      // Türk format: nokta binlik, virgül ondalık
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: virgül binlik, nokta ondalık
      s = s.replace(/,/g, "");
    }
  } else if (lastComma > -1 && lastDot === -1) {
    // Sadece virgül var: muhtemelen ondalık (Türk)
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (isNaN(n)) return 0;
  return negative ? -n : n;
}

// Bir satırı (raw values array) bizim formatımıza dönüştür
function parseExcelRow(row, colMap) {
  const result = {
    date: colMap.date >= 0 ? parseTRDate(row[colMap.date]) : null,
    valueDate: colMap.valueDate >= 0 ? parseTRDate(row[colMap.valueDate]) : null,
    description: colMap.description >= 0 ? String(row[colMap.description] || "").trim() : "",
    reference: colMap.reference >= 0 ? String(row[colMap.reference] || "").trim() : "",
    amount: 0,
    type: "in",
    balance: colMap.balance >= 0 ? parseTRNumber(row[colMap.balance]) : null,
  };

  // Tutar mantığı: borç/alacak iki kolon mu, tek tutar mu?
  if (colMap.debit >= 0 || colMap.credit >= 0) {
    const debit = colMap.debit >= 0 ? parseTRNumber(row[colMap.debit]) : 0;
    const credit = colMap.credit >= 0 ? parseTRNumber(row[colMap.credit]) : 0;
    if (Math.abs(debit) > 0.001) {
      result.amount = Math.abs(debit);
      result.type = "out";
    } else if (Math.abs(credit) > 0.001) {
      result.amount = Math.abs(credit);
      result.type = "in";
    }
  } else if (colMap.amount >= 0) {
    const amt = parseTRNumber(row[colMap.amount]);
    result.amount = Math.abs(amt);
    result.type = amt < 0 ? "out" : "in";
  }

  return result;
}

// Bir Excel sheet'inden header satırını ve hareket satırlarını tespit et
// İlk header bulunan satıra kadar gezer (banka extreleri başlık alanı içerir)
function findHeaderAndRows(rows) {
  // En az 3 sütun + sayı içeren ilk satır + header benzeri sütun isimlerini ara
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 3) continue;
    const map = detectBankColumns(row);
    // Yeterince bilgi var mı?
    if (map.date !== -1 && (map.amount !== -1 || (map.debit !== -1 || map.credit !== -1))) {
      return { headerIdx: i, columnMap: map, rows: rows.slice(i + 1) };
    }
  }
  return null;
}
/* ===================================================================== */

/* ---------- Hesap/Kasa Bakiye Hesaplama (transferler dahil) ---------- */
function computeBankAccountBalance(accId, data) {
  const acc = (data.bankAccounts || []).find(a => a.id === accId);
  if (!acc) return 0;
  let bal = Number(acc.openingBalance) || 0;

  // Manuel/Excel'den girilmiş banka hareketleri
  (data.bankEntries || []).forEach(e => {
    if (e.bankAccountId !== accId) return;
    bal += (e.type === "in" ? 1 : -1) * (Number(e.amount) || 0);
  });

  (data.transfers || []).forEach(t => {
    if (t.fromType === "bank" && t.fromId === accId) bal -= Number(t.fromAmount) || 0;
    if (t.toType === "bank" && t.toId === accId) bal += Number(t.toAmount) || 0;
  });

  // Kredi disbursement → bağlı banka hesabına para girer
  // Kredi taksit ödemesi → bağlı banka hesabından para çıkar
  (data.loans || []).forEach(loan => {
    if (loan.accountId !== accId) return;
    // Disbursement: kullanılan tutar (taksitli/spot için anapara, BCH/KMH/Rot için ilk net kullanım)
    if (loan.type === "installment" || loan.type === "spot") {
      bal += Number(loan.principal) || 0;  // hesaba para girdi
      // Ödenmiş taksitler hesaptan çıktı
      (loan.schedule || []).forEach(s => {
        if (s.paid) bal -= Number(s.paidAmount || s.total) || 0;
      });
    }
  });

  // Loan transactions (BCH/KMH/Rotatif kullanım/geri ödeme)
  (data.loanTransactions || []).forEach(tx => {
    const loan = (data.loans || []).find(l => l.id === tx.loanId);
    if (!loan || loan.accountId !== accId) return;
    if (tx.type === "draw")     bal += Number(tx.amount) || 0;   // çekildi → hesapta artı
    if (tx.type === "repay")    bal -= Number(tx.amount) || 0;   // ödendi → hesaptan eksi
    if (tx.type === "interest") bal -= Number(tx.amount) || 0;   // faiz tahakkuku
  });

  return bal;
}

function computeKasaBalance(kasaId, data) {
  const kasa = (data.kasaAccounts || []).find(k => k.id === kasaId);
  if (!kasa) return 0;
  let bal = Number(kasa.openingBalance) || 0;
  (data.kasaEntries || []).forEach(e => {
    if (e.kasaAccountId === kasaId) {
      bal += (e.type === "in" ? 1 : -1) * (Number(e.amount) || 0);
    }
  });
  (data.transfers || []).forEach(t => {
    if (t.fromType === "kasa" && t.fromId === kasaId) bal -= Number(t.fromAmount) || 0;
    if (t.toType === "kasa" && t.toId === kasaId) bal += Number(t.toAmount) || 0;
  });
  return bal;
}

// Bir transfer noktasının (banka hesabı / kasa) görüntülenecek adını ve para birimini döner
function getEndpointInfo(type, id, data) {
  if (type === "bank") {
    const acc = (data.bankAccounts || []).find(a => a.id === id);
    if (!acc) return { name: "(Silinmiş Hesap)", currency: "TRY", icon: "bank" };
    const bank = (data.banks || []).find(b => b.id === acc.bankId);
    return {
      name: `${bank?.name || "?"} — ${acc.name}`,
      shortName: acc.name,
      currency: acc.currency || "TRY",
      icon: "bank",
      color: bank?.color || "#1d4ed8",
    };
  }
  if (type === "kasa") {
    const k = (data.kasaAccounts || []).find(k => k.id === id);
    if (!k) return { name: "(Silinmiş Kasa)", currency: "TRY", icon: "kasa" };
    return {
      name: k.name,
      shortName: k.name,
      currency: k.currency || "TRY",
      icon: "kasa",
      color: "#0b3d2e",
    };
  }
  return { name: "?", currency: "TRY", icon: "?" };
}

/* ---------- Promet Logo SVG ---------- */
function Logo({ size = 32, variant = "color" }) {
  // variant: "color" (kırmızı/beyaz), "mono-dark" (siyah), "mono-light" (beyaz)
  const bgColor = variant === "color" ? "#dc2626" : (variant === "mono-light" ? "#ffffff" : "#1a1a1a");
  const fgColor = variant === "color" ? "#ffffff" : (variant === "mono-light" ? "#1a1a1a" : "#ffffff");
  const h = size, w = size * (100 / 140);
  return (
    <svg width={w} height={h} viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id={`promet-clip-${variant}`}>
          <path d="M 18 0 L 82 0 Q 100 0 100 18 L 100 95 Q 100 105 92 110 L 50 140 L 0 110 L 0 18 Q 0 0 18 0 Z"/>
        </clipPath>
      </defs>
      {/* Banner shape */}
      <path
        d="M 18 0 L 82 0 Q 100 0 100 18 L 100 95 Q 100 105 92 110 L 50 140 L 0 110 L 0 18 Q 0 0 18 0 Z"
        fill={bgColor}
      />
      {/* Wing feathers */}
      <g fill={fgColor} clipPath={`url(#promet-clip-${variant})`}>
        <path d="M 8 38 Q 50 18 95 12 Q 65 38 28 65 Q 18 58 8 38 Z" />
        <path d="M 6 65 Q 48 42 95 38 Q 60 65 22 92 Q 14 82 6 65 Z" />
        <path d="M 4 92 Q 44 68 95 64 Q 52 92 18 120 Q 10 108 4 92 Z" />
      </g>
    </svg>
  );
}

/* ---------- Wordmark: "Prometa One" ---------- */
function Wordmark({ size = 24, color = "var(--accent)", showSub = true }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="display" style={{ fontSize: size, color, lineHeight: 1, letterSpacing: "-0.03em", fontWeight: 500 }}>
        prometa
      </span>
      <span style={{
        fontSize: size * 0.5, color, lineHeight: 1, fontWeight: 600,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        letterSpacing: "0.05em",
        padding: "2px 6px",
        background: color === "var(--accent)" ? "var(--accent)" : color,
        color: "#f5f3ef",
        borderRadius: 2,
      }}>ONE</span>
    </div>
  );
}


/* =====================================================================
   EXCEL DIŞA AKTARIM (Export)
   ---------------------------------------------------------------------
   - Sheet "Nakit Akış Tablosu": Excel'deki orijinal formatla aynı.
   - Sheet "Kategoriler": Tüm kalem listesi (referans).
   - Sheet "_promet_meta" + "_promet_cells": Roundtrip için (gizli/teknik).
     Bu iki sheet sayesinde dışa aktarılan dosya, hiç veri kaybı
     olmadan tekrar içe aktarılabilir.
===================================================================== */
function exportToExcel(data, options = {}) {
  const { includeProjections = false, includeRealized = false } = options;
  const c = computeCashflow(data, includeProjections || includeRealized);
  const wb = XLSX.utils.book_new();
  const baseCells = data.cells || {};

  // Etkili hücre değeri = base + projeksiyon (opsiyonel) + realized (opsiyonel)
  const getEffCell = (catId, mi) => {
    const base = Number(baseCells[`${catId}:${mi}`] || 0);
    let total = base;
    if (includeProjections) total += c.projections[`${catId}:${mi}`]?.amount || 0;
    if (includeRealized) total += c.realized[`${catId}:${mi}`]?.amount || 0;
    return total;
  };

  // ---- Main sheet ----
  const aoa = [];
  let scopeLabel = "Sadece manuel veri";
  if (includeProjections && includeRealized) scopeLabel = "Manuel + projeksiyon + gerçekleşen ödemeler";
  else if (includeProjections) scopeLabel = "Manuel + açık fatura projeksiyonları";

  aoa.push(["Prometa One — Nakit Akış Tablosu"]);
  aoa.push([`Mali Yıl: ${data.fiscalYear}`, `Başlangıç Ayı: ${TR_MONTHS[data.fiscalStartMonth]}`, `Kapsam: ${scopeLabel}`, `İhraç: ${new Date().toLocaleString("tr-TR")}`]);
  aoa.push([]);

  const header = ["Kalem", ...c.monthLabels, "Toplam"];
  aoa.push(header);

  // Opening cash
  aoa.push(["Eldeki Nakit (dönem başı)", ...c.beginCash, data.openingCash]);
  aoa.push([]);

  // Helper to render a section
  const renderSection = (sectionLabel, items, totals) => {
    aoa.push([sectionLabel]);
    let grand = 0;
    items.forEach(cat => {
      const row = [cat.name];
      let rt = 0;
      for (let i = 0; i < 12; i++) {
        const v = getEffCell(cat.id, i);
        row.push(v || null);
        rt += v;
      }
      row.push(rt || null);
      grand += rt;
      aoa.push(row);
    });
    aoa.push([`Toplam ${sectionLabel}`, ...totals, grand]);
    aoa.push([]);
    return grand;
  };

  renderSection("Tahsil Edilen Nakit", data.inflows, c.inflowTotals);
  // Cash before outflows
  const beforeOut = c.beginCash.map((b, i) => b + c.inflowTotals[i]);
  aoa.push(["Mevcut Toplam Nakit (çıkıştan önce)", ...beforeOut, ""]);
  aoa.push([]);

  renderSection("Ödenen Nakit", data.outflows, c.outflowTotals);
  renderSection("Ödenen Nakit (Kar/Zarar Harici)", data.nonPnlOutflows, c.nonPnlTotals);

  // Total payments
  const totalPaid = c.outflowTotals.map((v, i) => v + c.nonPnlTotals[i]);
  aoa.push(["Ödenen Toplam Nakit", ...totalPaid, totalPaid.reduce((a, b) => a + b, 0)]);
  aoa.push([]);

  // Closing
  aoa.push(["Nakit Durumu (ay sonu)", ...c.endCash, c.endCash[11]]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 48 }, ...Array(12).fill({ wch: 13 }), { wch: 15 }];
  // Merge title row
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }];
  XLSX.utils.book_append_sheet(wb, ws, "Nakit Akış Tablosu");

  // ---- Projeksiyon detay sheet'i (eğer dahil edildiyse) ----
  if (includeProjections || includeRealized) {
    const detailAoa = [["Fatura Projeksiyon Detayı"]];
    detailAoa.push(["Bu sayfa, ana tabloya hangi faturaların hangi tutarda eklendiğini gösterir."]);
    detailAoa.push([]);

    if (includeProjections && Object.keys(c.projections).length > 0) {
      detailAoa.push(["AÇIK FATURALAR (Beklenen)"]);
      detailAoa.push(["Kategori", "Ay", "Fatura No", "Taraf", "Vade Tarihi", "Durum", "Tutar (TRY)"]);
      const allCats = [...(data.inflows || []), ...(data.outflows || []), ...(data.nonPnlOutflows || [])];
      Object.entries(c.projections).forEach(([key, val]) => {
        const [catId, mi] = key.split(":");
        const catName = allCats.find(c2 => c2.id === catId)?.name || catId;
        val.invoices.forEach(inv => {
          detailAoa.push([catName, TR_MONTHS[Number(mi)], inv.no, inv.counterparty, inv.dueDate, inv.status, inv.remainingTRY]);
        });
      });
      detailAoa.push([]);
    }

    if (includeRealized && Object.keys(c.realized).length > 0) {
      detailAoa.push(["GERÇEKLEŞEN ÖDEMELER"]);
      detailAoa.push(["Kategori", "Ay", "Fatura No", "Taraf", "Ödeme Tarihi", "Tutar (TRY)"]);
      const allCats = [...(data.inflows || []), ...(data.outflows || []), ...(data.nonPnlOutflows || [])];
      Object.entries(c.realized).forEach(([key, val]) => {
        const [catId, mi] = key.split(":");
        const catName = allCats.find(c2 => c2.id === catId)?.name || catId;
        val.payments.forEach(p => {
          detailAoa.push([catName, TR_MONTHS[Number(mi)], p.invoiceNo, p.counterparty, p.date, p.amountTRY]);
        });
      });
    }

    const detWs = XLSX.utils.aoa_to_sheet(detailAoa);
    detWs["!cols"] = [{ wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, detWs, "Projeksiyon Detayı");
  }

  // ---- Categories reference sheet ----
  const catAoa = [["Bölüm", "Kategori ID", "Kategori Adı", "12 Aylık Toplam"]];
  const addCats = (label, list) => list.forEach(cat => {
    const t = Array(12).fill(0).reduce((a, _, i) => a + Number(cells[`${cat.id}:${i}`] || 0), 0);
    catAoa.push([label, cat.id, cat.name, t]);
  });
  addCats("Tahsilat", data.inflows);
  addCats("Ödeme", data.outflows);
  addCats("K/Z Harici Ödeme", data.nonPnlOutflows);
  const catWs = XLSX.utils.aoa_to_sheet(catAoa);
  catWs["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 48 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, catWs, "Kategoriler");

  // ---- Hidden meta sheet (roundtrip) ----
  const metaAoa = [
    ["__PROMET_META_V1__"],
    ["fiscalYear", data.fiscalYear],
    ["fiscalStartMonth", data.fiscalStartMonth],
    ["openingCash", data.openingCash],
    [],
    ["section", "id", "name"],
    ...data.inflows.map(c => ["inflows", c.id, c.name]),
    ...data.outflows.map(c => ["outflows", c.id, c.name]),
    ...data.nonPnlOutflows.map(c => ["nonPnlOutflows", c.id, c.name]),
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(metaAoa);
  XLSX.utils.book_append_sheet(wb, metaWs, "_promet_meta");

  // ---- Cells data sheet (roundtrip) ----
  const cellsAoa = [["category_id", "month_idx", "value"]];
  Object.entries(cells).forEach(([k, v]) => {
    if (Number(v) !== 0) {
      const [catId, mi] = k.split(":");
      cellsAoa.push([catId, Number(mi), Number(v)]);
    }
  });
  const cellsWs = XLSX.utils.aoa_to_sheet(cellsAoa);
  XLSX.utils.book_append_sheet(wb, cellsWs, "_promet_cells");

  // Hide internal sheets
  if (!wb.Workbook) wb.Workbook = {};
  if (!wb.Workbook.Sheets) wb.Workbook.Sheets = [];
  wb.SheetNames.forEach((n, idx) => {
    wb.Workbook.Sheets[idx] = { name: n, Hidden: n.startsWith("_") ? 1 : 0 };
  });

  const fname = `promet_nakit_akis_${data.fiscalYear}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  return fname;
}

/* =====================================================================
   EXCEL İÇE AKTARIM (Import)
   ---------------------------------------------------------------------
   İki mod:
   1) ROUNDTRIP: Bizim ihraç ettiğimiz dosya — "_promet_meta" sheet'i
      varsa kategori ID'leri birebir eşleşir, hiç veri kaybı olmaz.
   2) FUZZY: Harici/elle hazırlanmış dosya — kategori adlarına göre
      eşleştirme yapılır, kullanıcı önizleme ekranında onaylar.
===================================================================== */
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        // Roundtrip check
        if (wb.SheetNames.includes("_promet_meta") && wb.SheetNames.includes("_promet_cells")) {
          resolve(parseRoundtrip(wb));
        } else {
          resolve(parseFuzzy(wb));
        }
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsArrayBuffer(file);
  });
}

function parseRoundtrip(wb) {
  const meta = XLSX.utils.sheet_to_json(wb.Sheets["_promet_meta"], { header: 1, defval: null });
  const cellsArr = XLSX.utils.sheet_to_json(wb.Sheets["_promet_cells"], { header: 1, defval: null });

  let fiscalYear = 2025, fiscalStartMonth = 8, openingCash = 0;
  const sections = { inflows: [], outflows: [], nonPnlOutflows: [] };

  meta.forEach(row => {
    if (!row || !row[0]) return;
    if (row[0] === "fiscalYear") fiscalYear = Number(row[1]);
    if (row[0] === "fiscalStartMonth") fiscalStartMonth = Number(row[1]);
    if (row[0] === "openingCash") openingCash = Number(row[1]);
    if (sections[row[0]] && row[1]) {
      sections[row[0]].push({ id: String(row[1]), name: String(row[2]) });
    }
  });

  const cells = {};
  cellsArr.slice(1).forEach(row => {
    if (!row || !row[0]) return;
    const [catId, mi, val] = row;
    cells[`${catId}:${Number(mi)}`] = Number(val) || 0;
  });

  return {
    mode: "roundtrip",
    data: {
      fiscalYear, fiscalStartMonth, openingCash,
      inflows: sections.inflows,
      outflows: sections.outflows,
      nonPnlOutflows: sections.nonPnlOutflows,
      cells,
    },
    summary: {
      kategoriSayısı: sections.inflows.length + sections.outflows.length + sections.nonPnlOutflows.length,
      hücreSayısı: Object.keys(cells).length,
      tahsilatKalemi: sections.inflows.length,
      ödemeKalemi: sections.outflows.length,
      kzHariciKalemi: sections.nonPnlOutflows.length,
    }
  };
}

/* Fuzzy mode: parse first sheet, detect sections, extract rows */
function parseFuzzy(wb) {
  // Try "Nakit Akış Tablosu" first, then first non-internal sheet
  let sheetName = wb.SheetNames.find(n => /nakit/i.test(n)) || wb.SheetNames.find(n => !n.startsWith("_")) || wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });

  // Section detection patterns
  const inflowPatterns = [/tahsil/i, /gelir/i, /alacak/i, /tahsilat/i];
  const outflowPatterns = [/öden/i, /gider/i, /harcama/i];
  const nonPnlPatterns = [/kar.{0,3}zarar.{0,5}harici/i, /k.{0,3}z.{0,3}harici/i, /anapara/i, /sermaye/i];
  const totalPatterns = [/^toplam/i, /mevcut.{0,8}nakit/i, /nakit.{0,5}durum/i, /eldeki.{0,5}nakit/i, /ödenen.{0,5}toplam/i];

  let currentSection = null;
  const rows = [];
  let headerFound = false;

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.every(c => c == null || c === "")) continue;
    const firstCell = String(row[0] || "").trim();
    if (!firstCell) continue;

    // Detect header row
    if (!headerFound && /kalem|kategori/i.test(firstCell) && row.length >= 5) {
      headerFound = true;
      continue;
    }

    // Detect section
    if (nonPnlPatterns.some(p => p.test(firstCell)) && !totalPatterns.some(p => p.test(firstCell))) {
      currentSection = "nonPnlOutflows"; continue;
    }
    if (inflowPatterns.some(p => p.test(firstCell)) && !totalPatterns.some(p => p.test(firstCell))) {
      currentSection = "inflows"; continue;
    }
    if (outflowPatterns.some(p => p.test(firstCell)) && !totalPatterns.some(p => p.test(firstCell))) {
      currentSection = "outflows"; continue;
    }

    // Skip total/aggregate rows
    if (totalPatterns.some(p => p.test(firstCell))) continue;

    // Skip if not in any section yet
    if (!currentSection) continue;

    // Extract numeric values
    const values = [];
    let nonEmpty = 0;
    for (let c = 1; c < row.length && values.length < 12; c++) {
      const cell = row[c];
      if (typeof cell === "number") { values.push(cell); nonEmpty++; }
      else if (typeof cell === "string") {
        const cleaned = cell.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
        const n = parseFloat(cleaned);
        if (!isNaN(n) && cleaned !== "") { values.push(n); nonEmpty++; }
        else values.push(0);
      } else values.push(0);
    }
    // pad if necessary
    while (values.length < 12) values.push(0);

    // Filter: must have at least one non-zero value OR be a real category name
    if (nonEmpty === 0 && firstCell.length < 3) continue;

    rows.push({
      section: currentSection,
      name: firstCell,
      values,
      total: values.reduce((a, b) => a + b, 0),
    });
  }

  return {
    mode: "fuzzy",
    sheetName,
    rows,
    summary: {
      satırSayısı: rows.length,
      tahsilatSatırı: rows.filter(r => r.section === "inflows").length,
      ödemeSatırı: rows.filter(r => r.section === "outflows").length,
      kzHariciSatırı: rows.filter(r => r.section === "nonPnlOutflows").length,
    }
  };
}

/* Apply imported fuzzy data to existing data (with name-based matching) */
function applyFuzzyImport(currentData, importedRows, mode) {
  // mode: "merge" (add to existing) or "replace" (clear and import)
  const newData = mode === "replace"
    ? { ...currentData, inflows: [], outflows: [], nonPnlOutflows: [], cells: {} }
    : { ...currentData, cells: { ...(currentData.cells || {}) } };

  const normalize = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ");

  const findOrCreate = (sectionKey, name) => {
    const existing = newData[sectionKey].find(c => normalize(c.name) === normalize(name));
    if (existing) return existing;
    const newCat = { id: sectionKey.slice(0, 3) + "_imp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5), name };
    newData[sectionKey] = [...newData[sectionKey], newCat];
    return newCat;
  };

  importedRows.forEach(row => {
    if (!row.section || !row.values) return;
    const cat = findOrCreate(row.section, row.name);
    row.values.forEach((v, i) => {
      if (v !== 0) newData.cells[`${cat.id}:${i}`] = Number(v) || 0;
    });
  });

  return newData;
}

/* =====================================================================
   TCMB EVDS API — Günlük Döviz Kuru Otomatik Çekme
   ---------------------------------------------------------------------
   Resmi endpoint: https://evds2.tcmb.gov.tr/service/evds/
   API anahtarı için: https://evds2.tcmb.gov.tr/ → BENİM SAYFAM → API Anahtarı
   Series kodları:
     TP.DK.USD.A.YTL — USD Döviz Alış (Forex Buying)
     TP.DK.USD.S.YTL — USD Döviz Satış (Forex Selling)
     TP.DK.EUR.A.YTL — EUR Döviz Alış
     TP.DK.EUR.S.YTL — EUR Döviz Satış
   Tarih formatı: DD-MM-YYYY
   JSON response key formatı: nokta yerine alt çizgi (TP_DK_USD_S_YTL)
===================================================================== */

// YYYY-MM-DD → DD-MM-YYYY çevirir
const isoToTrDate = (iso) => {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

// EVDS URL'i kurar
function buildTcmbUrl({ series, startDate, endDate, apiKey }) {
  const seriesStr = series.join("-");
  return `https://evds2.tcmb.gov.tr/service/evds/series=${seriesStr}` +
         `&startDate=${isoToTrDate(startDate)}` +
         `&endDate=${isoToTrDate(endDate)}` +
         `&type=json&key=${apiKey}`;
}

// TCMB'den günlük döviz kurlarını çeker
// Hafta sonu ve resmi tatillerde TCMB yayın yapmaz, bu yüzden son 14 günü tarayıp
// en güncel dolu değeri alırız.
async function fetchTcmbRates({ apiKey, rateType = "selling", date, corsProxy }) {
  if (!apiKey || apiKey.trim().length < 8) {
    throw new Error("Geçerli bir TCMB EVDS API anahtarı girilmedi. https://evds2.tcmb.gov.tr/ adresinden ücretsiz alabilirsiniz.");
  }

  const endIso = date || new Date().toISOString().slice(0, 10);
  // Son 14 günü tara (tatiller ve haftasonları için tampon)
  const endTs = new Date(endIso).getTime();
  const startIso = new Date(endTs - 14 * 86400000).toISOString().slice(0, 10);

  const suffix = rateType === "buying" ? "A" : "S"; // A=Alış, S=Satış
  const series = [`TP.DK.USD.${suffix}.YTL`, `TP.DK.EUR.${suffix}.YTL`];

  let url = buildTcmbUrl({ series, startDate: startIso, endDate: endIso, apiKey: apiKey.trim() });
  if (corsProxy && corsProxy.trim()) {
    const proxy = corsProxy.trim();
    // İki yaygın proxy biçimini destekle: prepend (corsproxy.io/?) ya da template ({url})
    url = proxy.includes("{url}") ? proxy.replace("{url}", encodeURIComponent(url)) : (proxy + encodeURIComponent(url));
  }

  let response;
  try {
    response = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
  } catch (err) {
    // Network / CORS hatası
    throw new Error(
      "Bağlantı hatası: Bu büyük olasılıkla CORS engelidir. " +
      "Çözüm: Ayarlarda bir CORS Proxy adresi girin (örn. https://corsproxy.io/?) ya da " +
      "Promet altyapısında bir backend proxy kurun."
    );
  }

  if (!response.ok) {
    throw new Error(`TCMB sunucusu hata döndü: HTTP ${response.status} — ${response.statusText || "Bilinmeyen hata"}`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error("Sunucu cevabı JSON olarak okunamadı. API anahtarınızı kontrol edin.");
  }

  // Hata mesajı kontrol
  if (json && (json.error_message || json.message || json.detay)) {
    throw new Error("TCMB API hatası: " + (json.error_message || json.message || json.detay));
  }

  const items = Array.isArray(json?.items) ? json.items : [];
  if (items.length === 0) {
    throw new Error("Belirtilen tarih aralığında veri bulunamadı.");
  }

  // En yeniden eskiye doğru tara, ilk dolu değeri al
  const usdKey = `TP_DK_USD_${suffix}_YTL`;
  const eurKey = `TP_DK_EUR_${suffix}_YTL`;

  let usd = null, eur = null, valueDate = null;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const u = parseFloat(item[usdKey]);
    const e = parseFloat(item[eurKey]);
    if (!isNaN(u) && usd === null) { usd = u; valueDate = item.Tarih; }
    if (!isNaN(e) && eur === null) eur = e;
    if (usd !== null && eur !== null) break;
  }

  if (usd === null && eur === null) {
    throw new Error("İlgili dönemde USD ve EUR kuru yayınlanmamış (tatil/hafta sonu olabilir).");
  }

  return {
    USD: usd,
    EUR: eur,
    date: valueDate, // DD-MM-YYYY formatında
    rateType,
    series,
    rawItemCount: items.length,
  };
}

/* ===================================================================== */
export default function App() {
  const [boot, setBoot] = useState({ loading: true });
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [lang, setLang] = useState("tr");  // default TR, useEffect içinde tarayıcı/saklanmış değere göre güncellenecek

  // window.__PROMETA_LANG__ global'i sayesinde t() fonksiyonu lang state'ini görebilir
  useEffect(() => {
    if (typeof window !== "undefined") window.__PROMETA_LANG__ = lang;
    // RTL desteği — Arapça veya İbranice gibi sağdan-sola dillerde
    if (typeof document !== "undefined") {
      const isRTL = LANGUAGES[lang]?.rtl === true;
      document.documentElement.dir = isRTL ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
  }, [lang]);

  // Dil değiştirme yardımcısı + persistence
  const changeLang = useCallback(async (newLang) => {
    if (!LANGUAGES[newLang]) return;
    setLang(newLang);
    // Kullanıcı tercihi varsa users içinde, yoksa global olarak sakla
    try {
      await S.set("promet:lang", newLang);
      if (session) {
        // Kullanıcının kendi tercihi olarak da işaretle
        const updatedUsers = users.map(u =>
          u.username === session.username ? { ...u, preferredLanguage: newLang } : u
        );
        setUsers(updatedUsers);
        await S.set("promet:users", updatedUsers);
      }
    } catch {}
  }, [session, users]);

  /* ---- Initial load ---- */
  useEffect(() => {
    (async () => {
      let d = await S.get("promet:data");
      let u = await S.get("promet:users");
      let a = await S.get("promet:audit", []);
      let sess = await S.get("promet:session");

      if (!d) {
        d = DEFAULT_SEED;
      } else {
        // ESKİ yapıyı çoklu şirket yapısına migrate et
        const mig = migrateLegacyData(d);
        d = mig.data;
        let dirty = mig.migrated;

        // Sonra global yeni alanları kontrol et
        ["exchangeRates", "displayCurrency", "banks", "tcmb", "rateHistory", "companies", "activeCompanyId", "companyData"]
          .forEach(f => {
            if (d[f] === undefined) { d[f] = DEFAULT_SEED[f]; dirty = true; }
          });

        // Aktif şirketin per-company alanlarını da kontrol et
        const co = d.companyData?.[d.activeCompanyId];
        if (co) {
          PER_COMPANY_FIELDS.forEach(f => {
            if (co[f] === undefined) {
              co[f] = createEmptyCompanyData()[f];
              dirty = true;
            }
          });
        }
        if (dirty) await S.set("promet:data", d);
      }
      await S.set("promet:data", d);

      if (!u) { u = DEFAULT_USERS; await S.set("promet:users", u); }
      setData(d); setUsers(u); setAudit(a);
      if (sess) setSession(sess);

      // ====== DİL TERCİHİ YÜKLEME ======
      // Öncelik sırası: 1) Kullanıcı kendi preferredLanguage 2) Saklanmış global tercih 3) Tarayıcı dili 4) TR
      let initialLang = "tr";
      const userObj = sess && u.find(usr => usr.username === sess.username);
      if (userObj?.preferredLanguage && LANGUAGES[userObj.preferredLanguage]) {
        initialLang = userObj.preferredLanguage;
      } else {
        const savedLang = await S.get("promet:lang");
        if (savedLang && LANGUAGES[savedLang]) {
          initialLang = savedLang;
        } else {
          initialLang = detectBrowserLanguage();
        }
      }
      setLang(initialLang);
      if (typeof window !== "undefined") window.__PROMETA_LANG__ = initialLang;

      setBoot({ loading: false });
    })();
  }, []);

  // Component'lar için active şirket'in verisini düzleştirilmiş halde sun
  const effectiveData = useMemo(() => data ? selectCompanyData(data) : null, [data]);

  // RBAC: Aktif kullanıcının HR scope'unu (employee/jobTitle/dept/orgUnit) çöz
  const userScope = useMemo(() => {
    if (!session || !effectiveData || !users.length) return null;
    return resolveUserScope(session.username, effectiveData, users);
  }, [session, effectiveData, users]);

  // RBAC: "canAct(resourceDotAction)" — her yerden kullanılabilen yardımcı fonksiyon
  const canAct = useCallback((resourceAction) => {
    if (!session) return false;
    return can(session, resourceAction, {
      customRoles: effectiveData?.hrCustomRoles || [],
      grants: effectiveData?.hrRoleGrants || [],
      overrides: effectiveData?.hrPermOverrides || [],
      orgUnits: effectiveData?.hrOrgUnits || [],
      departments: effectiveData?.hrDepartments || [],
      userScope,
    });
  }, [session, effectiveData, userScope]);

  // canView: View açma yetkisi — yeni resource.view OR eski legacy permission
  const canView = useCallback((legacyPerm, resource) => {
    if (!session) return false;
    if (resource && canAct(`${resource}.view`)) return true;
    return can(session.role, legacyPerm);
  }, [session, canAct]);

  /* ---- Toast ---- */
  const notify = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2500);
  };

  /* ---- Audit ---- */
  const logAudit = async (action, detail) => {
    const entry = {
      id: "a_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      user: session?.username || "system",
      role: session?.role || "system",
      action, detail,
      companyId: data?.activeCompanyId, // hangi şirkette yapıldı
    };
    const next = [entry, ...audit].slice(0, 500);
    setAudit(next);
    await S.set("promet:audit", next);
  };

  /* ---- Persist data ---- */
  // Component'ların onChange ile gönderdiği düz next'i tekrar çoklu-şirket yapısına yazar
  const saveData = async (next) => {
    const merged = updateCompanyData(data, next);
    setData(merged);
    await S.set("promet:data", merged);
  };

  /* ---- Auth ---- */
  const login = async (username, password) => {
    const u = users.find(x => x.username === username && x.password === password && x.active);
    if (!u) return false;
    const sess = { username: u.username, role: u.role, fullName: u.fullName, userId: u.id, ts: Date.now() };
    setSession(sess);
    await S.set("promet:session", sess);
    await logAudit("login", { username });

    // Kullanıcının tercih ettiği dili aktive et (eğer varsa)
    if (u.preferredLanguage && LANGUAGES[u.preferredLanguage]) {
      setLang(u.preferredLanguage);
    }

    // TCMB otomatik kur çekme (eğer açıksa ve bugün çekilmemişse)
    const tcmb = data?.tcmb;
    if (tcmb?.autoFetchOnLogin && tcmb?.apiKey) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const lastFetchedIso = tcmb.lastFetched ? new Date(tcmb.lastFetched).toISOString().slice(0, 10) : null;
      if (lastFetchedIso !== todayIso) {
        // Arka planda çek (login akışını bloklamadan)
        fetchTcmbRates({
          apiKey: tcmb.apiKey,
          rateType: tcmb.rateType || "selling",
          corsProxy: tcmb.corsProxy,
        }).then(async (result) => {
          const newRates = {
            USD: result.USD || data.exchangeRates.USD,
            EUR: result.EUR || data.exchangeRates.EUR,
          };
          const historyEntry = {
            date: result.date, USD: result.USD, EUR: result.EUR,
            type: result.rateType === "buying" ? "Alış" : "Satış",
            source: "TCMB EVDS (Otomatik)",
            ts: new Date().toISOString(),
          };
          const newHistory = [historyEntry, ...(data.rateHistory || [])].slice(0, 100);
          const newTcmb = {
            ...tcmb,
            lastFetched: new Date().toISOString(),
            lastFetchStatus: "success",
            lastFetchMessage: `Otomatik: ${result.date} tarihli kurlar yüklendi`,
          };
          await saveData({ ...data, exchangeRates: newRates, tcmb: newTcmb, rateHistory: newHistory });
          await logAudit("tcmb_autofetch", { tarih: result.date, USD: result.USD, EUR: result.EUR });
          notify(`Günlük TCMB kuru otomatik yüklendi: 1$=${result.USD?.toFixed(3)} ₺`);
        }).catch(async (err) => {
          const newTcmb = {
            ...tcmb,
            lastFetched: new Date().toISOString(),
            lastFetchStatus: "error",
            lastFetchMessage: "Otomatik çekim: " + err.message,
          };
          await saveData({ ...data, tcmb: newTcmb });
          await logAudit("tcmb_fetch_error", { hata: err.message, otomatik: true });
        });
      }
    }

    return true;
  };
  const logout = async () => {
    await logAudit("logout", { username: session?.username });
    setSession(null);
    await S.del("promet:session");
  };

  if (boot.loading || !data || !effectiveData) return <BootScreen />;
  if (!session) return <LoginScreen onLogin={login} lang={lang} changeLang={changeLang} users={users} setUsers={setUsers} />;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Theme />
      <TopBar session={session} onLogout={logout} view={view} setView={setView}
        data={effectiveData} onChangeData={saveData} canAct={canAct}
        lang={lang} changeLang={changeLang}/>
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6">
        {view === "dashboard" && (
          <Dashboard data={effectiveData} session={session} setView={setView} lang={lang} />
        )}
        {view === "grid" && canView("view_grid", "finance.cashflow") && (
          <CashFlowGrid
            data={effectiveData} session={session} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "banks" && canView("view_banks", "finance.banks") && (
          <BanksManager
            data={effectiveData} session={session} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "kasa" && canView("view_kasa", "finance.kasa") && (
          <KasaManager
            data={effectiveData} session={session} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "loans" && canView("view_loans", "finance.loans") && (
          <LoansManager
            data={effectiveData} session={session} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "transfers" && canView("view_transfers", "finance.transfers") && (
          <TransfersView
            data={effectiveData} session={session} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "hr" && canView("view_hr", "hr.organization") && (
          <HRModule
            data={effectiveData} session={session} users={users} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "fx" && canView("view_fx_revaluation", "finance.fx") && (
          <FxRevaluationView
            data={effectiveData} session={session} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "ai" && canView("view_ai_prediction", "finance.ai_prediction") && (
          <AiPredictionView
            data={effectiveData} session={session} lang={lang}
          />
        )}
        {view === "invoices" && canView("view_invoices", "finance.invoices") && (
          <InvoicesUnified
            data={effectiveData} session={session} canAct={canAct} lang={lang}
            onChange={saveData} logAudit={logAudit} notify={notify}
          />
        )}
        {view === "categories" && canView("manage_categories", "finance.categories") && (
          <CategoriesManager
            data={effectiveData} onChange={saveData} canAct={canAct}
            logAudit={logAudit} notify={notify}
          />
        )}
        {view === "users" && canView("manage_users", "system.users") && (
          <AccessControlView
            data={effectiveData} session={session} canAct={canAct}
            users={users} setUsers={setUsers}
            onChange={saveData}
            logAudit={logAudit} notify={notify}
          />
        )}
        {view === "audit" && canView("view_audit", "system.audit") && (
          <AuditLog audit={audit} companies={data.companies || []} />
        )}
        {view === "reports" && canView("view_reports", "finance.reports") && (
          <Reports data={effectiveData} />
        )}
        {view === "settings" && canView("system_settings", "system.settings") && (
          <SettingsView
            data={effectiveData} onChange={saveData}
            audit={audit} users={users} setUsers={setUsers}
            notify={notify} logAudit={logAudit} session={session}
          />
        )}
      </div>
      {toast && <Toast {...toast} />}
      {/* AI Asistan — tüm view'lerde gözükür */}
      <AIAssistantWidget
        data={effectiveData} session={session}
        users={users} audit={audit}
      />
    </div>
  );
}

/* ===================================================================== */
function Theme() {
  return (
    <style>{`
      :root {
        --bg: #f5f3ef;
        --bg-alt: #ebe6dd;
        --paper: #ffffff;
        --ink: #1a1a1a;
        --ink-soft: #4a4a4a;
        --ink-mute: #8a8580;
        --line: #d9d3c7;
        --line-soft: #e8e3d8;
        --accent: #0b3d2e;
        --accent-soft: #d4e4dc;
        --positive: #0f766e;
        --negative: #b91c1c;
        --warning: #b45309;
        --shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04);
      }
      body { font-family: 'Söhne', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; color: var(--ink); }
      .display { font-family: 'Fraunces','Cormorant Garamond','Playfair Display',Georgia,serif; font-weight: 400; letter-spacing: -0.02em; }
      .mono { font-family: 'JetBrains Mono','IBM Plex Mono',ui-monospace,'SF Mono',monospace; }
      .num { font-variant-numeric: tabular-nums; }
      .card { background: var(--paper); border: 1px solid var(--line); border-radius: 4px; }
      .btn { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:3px; font-size:13px; font-weight:500; transition: all 0.15s; border: 1px solid transparent; cursor:pointer; }
      .btn-primary { background: var(--accent); color: #f5f3ef; }
      .btn-primary:hover { background: #0a3328; }
      .btn-ghost { background: transparent; color: var(--ink); border-color: var(--line); }
      .btn-ghost:hover { background: var(--bg-alt); }
      .btn-danger { background: transparent; color: var(--negative); border-color: var(--line); }
      .btn-danger:hover { background: #fee2e2; border-color: var(--negative); }
      .input { background: var(--paper); border: 1px solid var(--line); border-radius: 3px; padding: 7px 10px; font-size: 13px; width: 100%; transition: border-color 0.15s; }
      .input:focus { outline: none; border-color: var(--accent); }
      .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-mute); font-weight: 500; }
      .chip { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:2px; font-size:11px; font-weight:500; letter-spacing:0.04em; text-transform:uppercase; }
      table.grid { width:100%; border-collapse: collapse; }
      table.grid th, table.grid td { border-bottom: 1px solid var(--line-soft); padding: 9px 10px; font-size: 12.5px; text-align: right; vertical-align: middle; }
      table.grid th { background: var(--bg); font-weight: 500; color: var(--ink-soft); border-bottom-color: var(--line); position: sticky; top: 56px; z-index:5; }
      @media (max-width: 768px) {
        table.grid th, table.grid td { padding: 7px 8px; font-size: 11.5px; }
        .display { letter-spacing: -0.01em; }
        .nav-item { padding: 8px 10px; }
      }
      table.grid td.label-cell, table.grid th.label-cell { text-align: left; }
      table.grid tr.section-head td { background: var(--accent); color: #f5f3ef; font-family: 'Fraunces',serif; font-size: 13px; padding: 8px 12px; letter-spacing: 0.02em; }
      table.grid tr.subtotal td { background: var(--bg); font-weight: 600; border-top: 1px solid var(--line); border-bottom: 2px solid var(--ink); }
      table.grid tr.grand-total td { background: var(--accent-soft); font-weight: 600; border-top: 2px solid var(--accent); border-bottom: 2px solid var(--accent); }
      table.grid td.cell-edit { padding: 0; }
      table.grid td.cell-edit input { width: 100%; padding: 9px 10px; border: none; background: transparent; text-align: right; font-size: 12.5px; font-variant-numeric: tabular-nums; }
      table.grid td.cell-edit input:focus { outline: 2px solid var(--accent); outline-offset: -2px; background: #fff8e1; }
      .nav-item { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:3px; font-size:13px; color: var(--ink-soft); cursor:pointer; transition: all 0.15s; }
      .nav-item:hover { background: var(--bg-alt); color: var(--ink); }
      .nav-item.active { background: var(--ink); color: var(--bg); }
      .nav-item.active svg { color: var(--bg); }
    `}</style>
  );
}

/* ===================================================================== */
function BootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f3ef" }}>
      <Theme />
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Logo size={48}/>
          <Wordmark size={36}/>
        </div>
        <div className="label">Yükleniyor...</div>
      </div>
    </div>
  );
}

/* ===================================================================== */
function LoginScreen({ onLogin, lang, changeLang, users, setUsers }) {
  // Mode: "login" | "forgot" | "reset"
  const [mode, setMode] = useState("login");

  // Login state
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // Captcha
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);

  // Captcha sadece 2+ başarısız denemeden sonra zorunlu olsun
  const captchaRequired = failedAttempts >= 2;

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  };

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");

    // Hesap kilitli mi?
    if (lockedUntil && Date.now() < lockedUntil) {
      const sec = Math.ceil((lockedUntil - Date.now()) / 1000);
      setErr(`${t("login.error.locked", lang)} (${sec}s)`);
      return;
    }

    // Captcha zorunluysa kontrol et
    if (captchaRequired) {
      if (Number(captchaInput) !== captcha.answer) {
        setErr(t("login.captcha.invalid", lang));
        refreshCaptcha();
        return;
      }
    }

    setLoading(true);
    const ok = await onLogin(u.trim(), p);
    setLoading(false);

    if (!ok) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setErr(t("login.error.invalid", lang));
      refreshCaptcha();
      // 5 başarısız → 30 saniye kilit
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 30000);
        setFailedAttempts(0);
      }
    } else {
      setFailedAttempts(0);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f5f3ef" }}>
      <Theme />
      <div className="w-full max-w-md">
        {/* Login öncesi dil seçici */}
        {changeLang && (
          <div className="flex justify-end mb-2">
            <div className="relative">
              <button onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="btn btn-ghost flex items-center gap-1 text-xs">
                <span style={{ fontSize: 14 }}>{LANGUAGES[lang]?.flag}</span>
                <span className="uppercase font-medium">{lang}</span>
                <ChevronDown size={10}/>
              </button>
              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setLangMenuOpen(false)}/>
                  <div className="absolute right-0 mt-1 rounded shadow-lg z-30 min-w-[160px]"
                    style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                    {Object.values(LANGUAGES).map(L => (
                      <button key={L.code} onClick={() => { changeLang(L.code); setLangMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                        <span style={{ fontSize: 16 }}>{L.flag}</span>
                        <span className="flex-1">{L.nameNative}</span>
                        {L.code === lang && <Check size={12} style={{ color: "var(--accent)" }}/>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <div className="mb-10 flex flex-col items-center">
          <Logo size={64}/>
          <div className="mt-4"><Wordmark size={36}/></div>
          <div className="label mt-2">{t("app.tagline", lang)}</div>
        </div>

        {mode === "login" && (
          <>
            <div className="card p-8" style={{ boxShadow: "var(--shadow)" }}>
              <div className="mb-6">
                <h2 className="display text-2xl mb-1">{t("login.title", lang)}</h2>
                <p className="text-sm" style={{ color: "var(--ink-mute)" }}>{t("login.subtitle", lang)}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="label mb-1.5">{t("login.username", lang)}</div>
                  <input className="input" value={u} onChange={e => setU(e.target.value)} autoFocus
                    onKeyDown={e => e.key === "Enter" && submit()} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="label">{t("login.password", lang)}</span>
                    <button type="button" onClick={() => setMode("forgot")}
                      className="text-xs hover:underline"
                      style={{ color: "var(--accent)" }}>
                      {t("login.forgotPassword", lang)}
                    </button>
                  </div>
                  <div className="relative">
                    <input className="input pr-10" type={showPwd ? "text" : "password"} value={p}
                      onChange={e => setP(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && submit()} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-stone-100"
                      style={{ color: "var(--ink-mute)" }}>
                      {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                </div>

                {/* Captcha — sadece 2+ başarısız sonra göster */}
                {captchaRequired && (
                  <div>
                    <div className="label mb-1.5">{t("login.captcha", lang)}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded font-bold select-none"
                        style={{
                          background: "linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)",
                          fontFamily: "'JetBrains Mono', monospace",
                          letterSpacing: "0.15em",
                          fontSize: 16,
                          color: "#374151",
                          textDecoration: "line-through wavy #9ca3af",
                          textDecorationSkipInk: "none",
                        }}>
                        {captcha.question} =
                      </div>
                      <input className="input flex-1" type="text" inputMode="numeric"
                        value={captchaInput}
                        onChange={e => setCaptchaInput(e.target.value)}
                        placeholder={t("login.captcha.placeholder", lang)}
                        onKeyDown={e => e.key === "Enter" && submit()}/>
                      <button type="button" onClick={refreshCaptcha}
                        className="btn btn-ghost p-2"
                        title={t("login.captcha.refresh", lang)}>
                        <RefreshCw size={14}/>
                      </button>
                    </div>
                  </div>
                )}

                {err && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded" style={{ background: "#fee2e2", color: "var(--negative)" }}>
                    <AlertCircle size={13}/> {err}
                  </div>
                )}
                <button onClick={submit} disabled={loading}
                  className="btn btn-primary w-full justify-center mt-2" style={{ padding: "10px" }}>
                  <Lock size={14}/> {loading ? t("common.loading", lang) : t("login.submit", lang)}
                </button>
              </div>
            </div>
            <div className="mt-6 text-center text-xs" style={{ color: "var(--ink-mute)" }}>
              Demo: <span className="mono">admin / admin123</span> · <span className="mono">mustafa / promet</span> · <span className="mono">viewer / viewer</span>
            </div>
          </>
        )}

        {mode === "forgot" && (
          <ForgotPasswordForm lang={lang} users={users}
            onBack={() => setMode("login")}
            onSuccess={() => setMode("reset")}/>
        )}

        {mode === "reset" && (
          <ResetPasswordForm lang={lang} users={users} setUsers={setUsers}
            onBack={() => setMode("login")}
            onSuccess={() => { setMode("login"); setErr(""); }}/>
        )}
      </div>
    </div>
  );
}

/* ---------- Forgot Password Form ---------- */
function ForgotPasswordForm({ lang, users, onBack, onSuccess }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);

  const submit = async () => {
    if (!email.trim()) {
      setErr(t("forgot.notFound", lang));
      return;
    }
    setErr("");
    setLoading(true);
    const result = await requestPasswordReset(email.trim(), users);
    setLoading(false);
    if (!result.success) {
      setErr(t("forgot.notFound", lang));
      return;
    }
    setInfo(result);
    // 2 saniye sonra reset moduna geç
    setTimeout(() => onSuccess(), 2000);
  };

  return (
    <div className="card p-8" style={{ boxShadow: "var(--shadow)" }}>
      <div className="mb-6">
        <h2 className="display text-2xl mb-1">{t("forgot.title", lang)}</h2>
        <p className="text-sm" style={{ color: "var(--ink-mute)" }}>{t("forgot.subtitle", lang)}</p>
      </div>
      {info && info.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm px-3 py-3 rounded"
            style={{ background: "#d1fae5", color: "#065f46" }}>
            <Check size={16}/>
            <div>
              <div className="font-medium">{t("forgot.success", lang)}</div>
              {info.mode === "demo" && (
                <div className="text-xs mt-1 opacity-80">
                  {t("forgot.demo.notice", lang)}
                </div>
              )}
            </div>
          </div>
          {info.mode === "demo" && info.token && (
            <div className="p-3 rounded font-mono text-center text-lg font-bold"
              style={{ background: "var(--bg)", color: "var(--accent)", letterSpacing: "0.1em" }}>
              {t("forgot.tokenSent", lang)}: {info.token}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">{t("forgot.email", lang)}</div>
            <input className="input" value={email} autoFocus
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="mustafa@prometahr.com" />
          </div>
          {err && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded"
              style={{ background: "#fee2e2", color: "var(--negative)" }}>
              <AlertCircle size={13}/> {err}
            </div>
          )}
          <button onClick={submit} disabled={loading}
            className="btn btn-primary w-full justify-center mt-2" style={{ padding: "10px" }}>
            <Mail size={14}/> {loading ? t("common.loading", lang) : t("forgot.send", lang)}
          </button>
          <button onClick={onBack}
            className="btn btn-ghost w-full justify-center text-sm">
            <ArrowLeft size={13}/> {t("forgot.back", lang)}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Reset Password Form ---------- */
function ResetPasswordForm({ lang, users, setUsers, onBack, onSuccess }) {
  const [token, setToken] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    if (newPwd.length < 6) {
      setErr(t("reset.error.weak", lang));
      return;
    }
    if (newPwd !== confirmPwd) {
      setErr(t("reset.error.mismatch", lang));
      return;
    }
    setLoading(true);
    const result = await resetPasswordWithToken(token.trim(), newPwd, users, setUsers);
    setLoading(false);
    if (!result.success) {
      setErr(t("reset.error.invalidToken", lang));
      return;
    }
    setSuccess(true);
    setTimeout(() => onSuccess(), 2000);
  };

  return (
    <div className="card p-8" style={{ boxShadow: "var(--shadow)" }}>
      <div className="mb-6">
        <h2 className="display text-2xl mb-1">{t("reset.title", lang)}</h2>
        <p className="text-sm" style={{ color: "var(--ink-mute)" }}>{t("reset.subtitle", lang)}</p>
      </div>
      {success ? (
        <div className="flex items-center gap-2 text-sm px-3 py-3 rounded"
          style={{ background: "#d1fae5", color: "#065f46" }}>
          <Check size={16}/> {t("reset.success", lang)}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">{t("reset.token", lang)}</div>
            <input className="input mono text-center font-bold" autoFocus
              value={token} maxLength={6}
              onChange={e => setToken(e.target.value)}
              placeholder="123456"
              style={{ letterSpacing: "0.2em" }}/>
          </div>
          <div>
            <div className="label mb-1.5">{t("reset.newPassword", lang)}</div>
            <input className="input" type="password" value={newPwd}
              onChange={e => setNewPwd(e.target.value)}/>
          </div>
          <div>
            <div className="label mb-1.5">{t("reset.confirmPassword", lang)}</div>
            <input className="input" type="password" value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}/>
          </div>
          {err && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded"
              style={{ background: "#fee2e2", color: "var(--negative)" }}>
              <AlertCircle size={13}/> {err}
            </div>
          )}
          <button onClick={submit} disabled={loading}
            className="btn btn-primary w-full justify-center mt-2" style={{ padding: "10px" }}>
            <Lock size={14}/> {loading ? t("common.loading", lang) : t("reset.submit", lang)}
          </button>
          <button onClick={onBack}
            className="btn btn-ghost w-full justify-center text-sm">
            <ArrowLeft size={13}/> {t("forgot.back", lang)}
          </button>
        </div>
      )}
    </div>
  );
}

/* ===================================================================== */
function TopBar({ session, onLogout, view, setView, data, onChangeData, canAct, lang, changeLang }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // Bildirim sayısı: 7 gün içinde vadesi olan veya geçmiş açık faturalar
  const invoiceAlertCount = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(today); limit.setDate(limit.getDate() + 7);
    let count = 0;
    (data.invoices || []).forEach(inv => {
      if (!inv.dueDate) return;
      const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
      if (remaining <= 0.01) return;
      const due = new Date(inv.dueDate);
      if (isNaN(due.getTime())) return;
      if (due <= limit) count++; // bugünden 7 gün sonrasına kadar + geçmişler
    });
    return count;
  }, [data.invoices]);

  const items = [
    { id: "dashboard",  label: t("menu.dashboard", lang),  icon: LayoutDashboard, perm: "view_dashboard", resource: "finance.dashboard" },
    { id: "grid",       label: t("menu.cashflow", lang),   icon: Table2,          perm: "view_grid",      resource: "finance.cashflow" },
    { id: "banks",      label: t("menu.banks", lang),      icon: Landmark,        perm: "view_banks",     resource: "finance.banks" },
    { id: "kasa",       label: t("menu.kasa", lang),       icon: Wallet,          perm: "view_kasa",      resource: "finance.kasa" },
    { id: "loans",      label: t("menu.loans", lang),      icon: Banknote,        perm: "view_loans",     resource: "finance.loans" },
    { id: "invoices",   label: t("menu.invoices", lang),   icon: Receipt,         perm: "view_invoices",  resource: "finance.invoices", badge: invoiceAlertCount },
    { id: "transfers",  label: t("menu.transfers", lang),  icon: ArrowLeftRight,  perm: "view_transfers", resource: "finance.transfers" },
    { id: "hr",         label: t("menu.hr", lang),         icon: Briefcase,       perm: "view_hr",        resource: "hr.organization" },
    { id: "fx",         label: t("menu.fx", lang),         icon: TrendingUp,      perm: "view_fx_revaluation", resource: "finance.fx" },
    { id: "ai",         label: t("menu.ai", lang),         icon: Sparkles,        perm: "view_ai_prediction",  resource: "finance.ai_prediction" },
    { id: "reports",    label: t("menu.reports", lang),    icon: BarChart3,       perm: "view_reports",   resource: "finance.reports" },
    { id: "categories", label: t("menu.categories", lang), icon: FolderTree,      perm: "manage_categories", resource: "finance.categories" },
    { id: "users",      label: t("menu.users", lang),      icon: Users,           perm: "manage_users",   resource: "system.users" },
    { id: "audit",      label: t("menu.audit", lang),      icon: History,         perm: "view_audit",     resource: "system.audit" },
    { id: "settings",   label: t("menu.settings", lang),   icon: Settings,        perm: "system_settings", resource: "system.settings" },
  ];

  const setDisplayCurrency = async (cur) => {
    await onChangeData({ ...data, displayCurrency: cur });
  };

  const switchCompany = async (companyId) => {
    await onChangeData({ ...data, activeCompanyId: companyId });
    setCompanyMenuOpen(false);
    setMobileOpen(false);
  };

  // Görünür item'lar: yeni resource.action varsa onu kontrol et, yoksa eski perm
  // canAct sayesinde custom rol grant'leri de devreye girer
  const visibleItems = items.filter(i => {
    if (canAct && i.resource && canAct(`${i.resource}.view`)) return true;
    return can(session.role, i.perm);
  });
  const currentItem = visibleItems.find(i => i.id === view);
  const companies = data.companies || [];
  const activeCompany = companies.find(c => c.id === data.activeCompanyId) || companies[0];

  return (
    <div className="sticky top-0 z-30" style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}>
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 h-14 flex items-center gap-2 md:gap-5">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Logo size={26}/>
          <div className="hidden sm:block"><Wordmark size={18}/></div>
        </div>

        {/* Şirket seçici */}
        {companies.length > 0 && activeCompany && (
          <div className="relative flex-shrink-0">
            <button onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
              className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ background: "var(--bg)", color: "var(--ink)" }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: activeCompany.color }}/>
              <span className="hidden md:inline truncate max-w-[160px]">{activeCompany.name}</span>
              <ChevronDown size={11} className={`transition-transform ${companyMenuOpen ? "rotate-180" : ""}`}/>
            </button>
            {companyMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setCompanyMenuOpen(false)}/>
                <div className="absolute left-0 mt-1 rounded shadow-lg z-30 min-w-[240px]"
                  style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <div className="p-2 border-b" style={{ borderColor: "var(--line-soft)" }}>
                    <div className="label">Aktif Şirket</div>
                  </div>
                  <div className="max-h-80 overflow-y-auto py-1">
                    {companies.map(c => (
                      <button key={c.id} onClick={() => switchCompany(c.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }}/>
                        <span className="flex-1 truncate">{c.name}</span>
                        {c.taxNo && <span className="text-xs mono" style={{ color: "var(--ink-mute)" }}>{c.taxNo}</span>}
                        {c.id === data.activeCompanyId && <Check size={12} style={{ color: "var(--accent)" }}/>}
                      </button>
                    ))}
                  </div>
                  {can(session.role, "manage_companies") && (
                    <div className="p-2 border-t" style={{ borderColor: "var(--line-soft)" }}>
                      <button onClick={() => { setCompanyMenuOpen(false); setView("settings"); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-stone-50"
                        style={{ color: "var(--accent)" }}>
                        <Settings size={11}/> Şirketleri Yönet
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobil aktif sayfa göstergesi */}
        {currentItem && (
          <div className="md:hidden flex items-center gap-1.5 text-sm font-medium flex-1 truncate">
            <currentItem.icon size={14}/>
            <span className="truncate">{currentItem.label}</span>
          </div>
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
          {visibleItems.map(i => {
            const Ic = i.icon;
            return (
              <div key={i.id}
                className={`nav-item ${view === i.id ? "active" : ""}`}
                onClick={() => setView(i.id)}>
                <Ic size={14}/>{i.label}
                {i.badge > 0 && (
                  <span className="ml-1 rounded-full text-white font-bold flex items-center justify-center"
                    style={{ background: "#dc2626", fontSize: 9, minWidth: 16, height: 16, padding: "0 4px" }}>
                    {i.badge > 99 ? "99+" : i.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sağ taraf */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {/* Para birimi seçici — sm+ */}
          <div className="hidden sm:flex items-center gap-1 rounded text-xs" style={{ background: "var(--bg)", padding: 2 }}>
            {["TRY", "USD", "EUR"].map(c => (
              <button key={c} onClick={() => setDisplayCurrency(c)}
                className="px-2 py-1 rounded font-medium transition-colors"
                style={{
                  background: data.displayCurrency === c ? "var(--accent)" : "transparent",
                  color: data.displayCurrency === c ? "#f5f3ef" : "var(--ink-mute)",
                }}>
                {CURRENCY_SYMBOLS[c]}<span className="hidden lg:inline"> {c}</span>
              </button>
            ))}
          </div>
          {/* Kullanıcı bilgisi — md+ */}
          <div className="hidden md:block text-right">
            <div className="text-xs font-medium">{session.fullName}</div>
            <div className="chip" style={{ background: ROLES[session.role].color + "15", color: ROLES[session.role].color }}>
              <Shield size={9}/> {ROLES[session.role].label}
            </div>
          </div>
          {/* Dil seçici */}
          {changeLang && (
            <div className="relative">
              <button onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="btn btn-ghost flex items-center gap-1"
                title={t("common.language", lang)}>
                <span style={{ fontSize: 14 }}>{LANGUAGES[lang]?.flag}</span>
                <span className="hidden md:inline text-xs font-medium uppercase">{lang}</span>
                <ChevronDown size={10} className={`transition-transform ${langMenuOpen ? "rotate-180" : ""}`}/>
              </button>
              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setLangMenuOpen(false)}/>
                  <div className="absolute right-0 mt-1 rounded shadow-lg z-30 min-w-[180px]"
                    style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                    <div className="p-2 border-b" style={{ borderColor: "var(--line-soft)" }}>
                      <div className="label">{t("common.language", lang)}</div>
                    </div>
                    <div className="py-1">
                      {Object.values(LANGUAGES).map(L => (
                        <button key={L.code} onClick={() => { changeLang(L.code); setLangMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                          <span style={{ fontSize: 16 }}>{L.flag}</span>
                          <span className="flex-1">{L.nameNative}</span>
                          {L.code === lang && <Check size={12} style={{ color: "var(--accent)" }}/>}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={onLogout} className="btn btn-ghost hidden md:inline-flex" title={t("login.submit", lang)}>
            <LogOut size={13}/>
          </button>
          {/* Mobil menü tuşu */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden btn btn-ghost p-2 relative" title="Menü">
            {mobileOpen ? <X size={16}/> : <Menu size={16}/>}
            {!mobileOpen && invoiceAlertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 rounded-full text-white font-bold flex items-center justify-center"
                style={{ background: "#dc2626", fontSize: 8, minWidth: 14, height: 14, padding: "0 3px" }}>
                {invoiceAlertCount > 9 ? "9+" : invoiceAlertCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobil dropdown menü */}
      {mobileOpen && (
        <div className="md:hidden border-t" style={{ background: "var(--paper)", borderColor: "var(--line)" }}>
          <div className="px-3 py-3 space-y-1 max-h-[80vh] overflow-y-auto">
            {/* Mobilde kullanıcı + para birimi */}
            <div className="flex items-center justify-between p-3 mb-2 rounded" style={{ background: "var(--bg)" }}>
              <div>
                <div className="text-sm font-medium">{session.fullName}</div>
                <div className="chip mt-0.5" style={{ background: ROLES[session.role].color + "15", color: ROLES[session.role].color }}>
                  <Shield size={9}/> {ROLES[session.role].label}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded text-xs" style={{ background: "var(--paper)", padding: 2 }}>
                {["TRY", "USD", "EUR"].map(c => (
                  <button key={c} onClick={() => setDisplayCurrency(c)}
                    className="px-2 py-1 rounded font-medium"
                    style={{
                      background: data.displayCurrency === c ? "var(--accent)" : "transparent",
                      color: data.displayCurrency === c ? "#f5f3ef" : "var(--ink-mute)",
                    }}>
                    {CURRENCY_SYMBOLS[c]} {c}
                  </button>
                ))}
              </div>
            </div>
            {visibleItems.map(i => {
              const Ic = i.icon;
              return (
                <div key={i.id}
                  className={`nav-item ${view === i.id ? "active" : ""}`}
                  style={{ padding: "10px 12px" }}
                  onClick={() => { setView(i.id); setMobileOpen(false); }}>
                  <Ic size={15}/>{i.label}
                  {i.badge > 0 && (
                    <span className="ml-auto rounded-full text-white font-bold flex items-center justify-center"
                      style={{ background: "#dc2626", fontSize: 10, minWidth: 18, height: 18, padding: "0 5px" }}>
                      {i.badge > 99 ? "99+" : i.badge}
                    </span>
                  )}
                </div>
              );
            })}
            <button onClick={onLogout}
              className="nav-item w-full"
              style={{ padding: "10px 12px", color: "var(--negative)" }}>
              <LogOut size={15}/> Çıkış Yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================================================================== */
function Dashboard({ data, session, setView, lang }) {
  const compute = useMemo(() => computeCashflow(data), [data]);
  const dc = data.displayCurrency || "TRY";
  const rates = data.exchangeRates || {};
  const sym = CURRENCY_SYMBOLS[dc];

  const totalInflow = compute.inflowTotals.reduce((a, b) => a + b, 0);
  const totalOutflow = compute.outflowTotals.reduce((a, b) => a + b, 0) + compute.nonPnlTotals.reduce((a, b) => a + b, 0);
  const finalCash = compute.endCash[compute.endCash.length - 1];
  const netChange = finalCash - data.openingCash;

  const chartData = compute.endCash.map((v, i) => ({
    ay: compute.monthLabels[i],
    nakit: Math.round(convertFromTRY(v, dc, rates)),
    giris: Math.round(convertFromTRY(compute.inflowTotals[i], dc, rates)),
    cikis: -Math.round(convertFromTRY(compute.outflowTotals[i] + compute.nonPnlTotals[i], dc, rates)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">{t("login.welcome", lang)}</div>
          <h1 className="display text-3xl md:text-4xl">{session.fullName.split(" ")[0]}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
            {t("dashboard.subtitle.long", lang)}
            <span className="ml-2 chip" style={{ background: "var(--bg-alt)", color: "var(--ink-mute)" }}>
              <Coins size={9}/> {sym} {dc}
            </span>
          </p>
        </div>
        <div className="text-right">
          <div className="label mb-1">{t("common.date", lang)}</div>
          <div className="text-sm">{fmtDate(new Date(), { lang, month: "long" })}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="Açılış Nakdi" value={data.openingCash} icon={Wallet} accent="#0f766e" dc={dc} rates={rates}/>
        <KpiCard label="Toplam Tahsilat" value={totalInflow} icon={TrendingUp} accent="#0f766e" dc={dc} rates={rates}/>
        <KpiCard label="Toplam Ödeme" value={totalOutflow} icon={TrendingDown} accent="#b91c1c" dc={dc} rates={rates}/>
        <KpiCard label="Dönem Sonu Nakit" value={finalCash}
          icon={finalCash >= 0 ? ArrowUpRight : ArrowDownRight}
          accent={finalCash >= 0 ? "#0f766e" : "#b91c1c"}
          dc={dc} rates={rates}
          sub={`Net değişim: ${fmtMoneySign(netChange, dc, rates)} ${sym}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 md:col-span-2" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="display text-xl">Nakit Pozisyonu Seyri</h3>
              <p className="text-xs" style={{ color: "var(--ink-mute)" }}>Ay sonu nakit durumu ({sym})</p>
            </div>
            <button onClick={() => setView("reports")} className="btn btn-ghost text-xs">
              Detaylı raporlar <ChevronRight size={12}/>
            </button>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0b3d2e" stopOpacity={0.18}/>
                    <stop offset="100%" stopColor="#0b3d2e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#d9d3c7" vertical={false}/>
                <XAxis dataKey="ay" tick={{ fontSize: 11, fill: "#8a8580" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}
                  tickFormatter={v => dc === "TRY" ? (v / 1000000).toFixed(0) + "M" : (v / 1000).toFixed(0) + "K"}/>
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #d9d3c7", borderRadius: 3, fontSize: 12 }}
                  formatter={(v) => fmtTL(v) + " " + sym} />
                <ReferenceLine y={0} stroke="#b91c1c" strokeDasharray="3 3"/>
                <Area type="monotone" dataKey="nakit" stroke="#0b3d2e" strokeWidth={2} fill="url(#g1)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <h3 className="display text-xl mb-4">Hızlı Erişim</h3>
          <div className="space-y-2">
            <QuickAction onClick={() => setView("grid")} icon={Table2}
              title="Nakit Akış Tablosu" desc="Aylık tahsilat ve ödemeleri düzenle" />
            <QuickAction onClick={() => setView("invoices")} icon={Receipt}
              title="Faturalar" desc="Gelen ve giden faturaları takip et" />
            <QuickAction onClick={() => setView("banks")} icon={Landmark}
              title="Bankalar" desc="Banka hesapları ve IBAN'lar" />
            <QuickAction onClick={() => setView("kasa")} icon={Wallet}
              title="Kasa" desc="Günlük kasa hareketleri" />
            <QuickAction onClick={() => setView("reports")} icon={BarChart3}
              title="Detaylı Raporlar" desc="Grafikler ve analizler" />
          </div>
        </div>
      </div>

      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="display text-xl">Aylık Giriş-Çıkış</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#0f766e" }}/> Tahsilat</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#b91c1c" }}/> Ödeme</span>
          </div>
        </div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#d9d3c7" vertical={false}/>
              <XAxis dataKey="ay" tick={{ fontSize: 11, fill: "#8a8580" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}
                tickFormatter={v => dc === "TRY" ? (Math.abs(v) / 1000000).toFixed(0) + "M" : (Math.abs(v) / 1000).toFixed(0) + "K"}/>
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d9d3c7", borderRadius: 3, fontSize: 12 }}
                formatter={(v) => fmtTL(Math.abs(v)) + " " + sym} />
              <ReferenceLine y={0} stroke="#1a1a1a"/>
              <Bar dataKey="giris" fill="#0f766e"/>
              <Bar dataKey="cikis" fill="#b91c1c"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <UpcomingInvoicesWidget data={data} setView={setView}/>
    </div>
  );
}

/* =====================================================================
   Dashboard widget: Önümüzdeki 30 günde tahsilat & ödeme
===================================================================== */
function UpcomingInvoicesWidget({ data, setView }) {
  const dc = data.displayCurrency || "TRY";
  const rates = data.exchangeRates || {};
  const sym = CURRENCY_SYMBOLS[dc];

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(today); limit.setDate(limit.getDate() + 30);
    const buckets = { receivables: [], payables: [], overdueReceivables: [], overduePayables: [] };
    (data.invoices || []).forEach(inv => {
      if (!inv.dueDate) return;
      const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
      if (remaining <= 0.01) return;
      const due = new Date(inv.dueDate);
      if (isNaN(due.getTime())) return;
      const isOverdue = due < today;
      const inWindow = due >= today && due <= limit;
      if (!isOverdue && !inWindow) return;
      const remainingTRY = convertToTRY(remaining, inv.currency || "TRY", rates);
      const entry = {
        id: inv.id, no: inv.invoiceNo, counterparty: inv.counterparty,
        dueDate: inv.dueDate, remaining, remainingTRY, currency: inv.currency,
        daysUntil: Math.round((due - today) / 86400000),
      };
      const target = inv.type === "out"
        ? (isOverdue ? buckets.overdueReceivables : buckets.receivables)
        : (isOverdue ? buckets.overduePayables : buckets.payables);
      target.push(entry);
    });
    Object.values(buckets).forEach(arr => arr.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    return buckets;
  }, [data.invoices, rates]);

  const totRec = upcoming.receivables.reduce((s, i) => s + i.remainingTRY, 0);
  const totPay = upcoming.payables.reduce((s, i) => s + i.remainingTRY, 0);
  const totOvRec = upcoming.overdueReceivables.reduce((s, i) => s + i.remainingTRY, 0);
  const totOvPay = upcoming.overduePayables.reduce((s, i) => s + i.remainingTRY, 0);
  const totalCount = upcoming.receivables.length + upcoming.payables.length + upcoming.overdueReceivables.length + upcoming.overduePayables.length;

  if (totalCount === 0) {
    return (
      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h3 className="display text-xl mb-2 flex items-center gap-2">
          <Calendar size={16} style={{ color: "var(--accent)" }}/>
          Önümüzdeki 30 Gün
        </h3>
        <div className="text-sm text-center py-8" style={{ color: "var(--ink-mute)" }}>
          <Calendar size={28} className="mx-auto mb-2 opacity-40"/>
          Önümüzdeki 30 günde vadesi gelen veya geciken açık fatura yok.
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 md:p-5" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="display text-xl flex items-center gap-2">
          <Calendar size={16} style={{ color: "var(--accent)" }}/>
          Önümüzdeki 30 Gün
        </h3>
        <button onClick={() => setView("invoices")}
          className="btn btn-ghost text-xs">
          <Receipt size={11}/> Tüm Faturalar
        </button>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        <div className="p-3 rounded" style={{ background: "#dcfce7" }}>
          <div className="text-xs font-medium" style={{ color: "#15803d" }}>Tahsilat (30 gün)</div>
          <div className="num display text-xl mt-0.5" style={{ color: "#15803d" }}>{fmtMoney(totRec, dc, rates)} {sym}</div>
          <div className="text-xs mt-0.5" style={{ color: "#15803d" }}>{upcoming.receivables.length} fatura</div>
        </div>
        <div className="p-3 rounded" style={{ background: "#fee2e2" }}>
          <div className="text-xs font-medium" style={{ color: "#b91c1c" }}>Ödeme (30 gün)</div>
          <div className="num display text-xl mt-0.5" style={{ color: "#b91c1c" }}>{fmtMoney(totPay, dc, rates)} {sym}</div>
          <div className="text-xs mt-0.5" style={{ color: "#b91c1c" }}>{upcoming.payables.length} fatura</div>
        </div>
        <div className="p-3 rounded border" style={{ background: "#fef3c7", borderColor: "#d97706" }}>
          <div className="text-xs font-medium flex items-center gap-1" style={{ color: "#854d0e" }}>
            <AlertTriangle size={11}/> Geciken Tahsilat
          </div>
          <div className="num display text-xl mt-0.5" style={{ color: "#854d0e" }}>{fmtMoney(totOvRec, dc, rates)} {sym}</div>
          <div className="text-xs mt-0.5" style={{ color: "#854d0e" }}>{upcoming.overdueReceivables.length} fatura</div>
        </div>
        <div className="p-3 rounded border" style={{ background: "#fef3c7", borderColor: "#d97706" }}>
          <div className="text-xs font-medium flex items-center gap-1" style={{ color: "#854d0e" }}>
            <AlertTriangle size={11}/> Geciken Ödeme
          </div>
          <div className="num display text-xl mt-0.5" style={{ color: "#854d0e" }}>{fmtMoney(totOvPay, dc, rates)} {sym}</div>
          <div className="text-xs mt-0.5" style={{ color: "#854d0e" }}>{upcoming.overduePayables.length} fatura</div>
        </div>
      </div>

      {/* Faturalar listesi: tahsilat ve ödeme yan yana */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <UpcomingList title="Tahsilat" color="#0f766e" icon={ArrowDownToLine}
          items={[...upcoming.overdueReceivables, ...upcoming.receivables].slice(0, 6)} dc={dc} rates={rates}/>
        <UpcomingList title="Ödeme" color="#b91c1c" icon={ArrowUpFromLine}
          items={[...upcoming.overduePayables, ...upcoming.payables].slice(0, 6)} dc={dc} rates={rates}/>
      </div>
    </div>
  );
}

function UpcomingList({ title, color, icon: Ic, items, dc, rates }) {
  const sym = CURRENCY_SYMBOLS[dc];
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b" style={{ borderColor: "var(--line-soft)" }}>
        <Ic size={12} style={{ color }}/>
        <div className="text-xs font-medium" style={{ color }}>{title}</div>
        <div className="text-xs ml-auto" style={{ color: "var(--ink-mute)" }}>{items.length} fatura</div>
      </div>
      {items.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: "var(--ink-mute)" }}>—</div>
      ) : (
        <div className="space-y-1.5">
          {items.map(it => {
            const isOverdue = it.daysUntil < 0;
            return (
              <div key={it.id} className="flex items-start gap-2 p-2 rounded text-xs"
                style={{ background: isOverdue ? "#fef3c7" : "var(--bg)" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.counterparty}</div>
                  <div className="flex items-center gap-2 mt-0.5" style={{ color: "var(--ink-mute)" }}>
                    <span className="mono">{it.no}</span>
                    <span>·</span>
                    <span>vade {it.dueDate}</span>
                    <span className="chip" style={{ background: isOverdue ? "#b91c1c20" : "#1d4ed820", color: isOverdue ? "#b91c1c" : "#1d4ed8", fontSize: 9 }}>
                      {isOverdue ? `${-it.daysUntil}g gecikti` : (it.daysUntil === 0 ? "bugün" : `${it.daysUntil}g sonra`)}
                    </span>
                  </div>
                </div>
                <div className="num text-xs font-semibold flex-shrink-0" style={{ color }}>
                  {fmtMoney(it.remainingTRY, dc, rates)} {sym}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Ic, accent, sub, dc = "TRY", rates = {} }) {
  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="label">{label}</div>
        <Ic size={16} style={{ color: accent }}/>
      </div>
      <div className="num display text-3xl flex items-baseline gap-1.5" style={{ color: value < 0 ? "var(--negative)" : "var(--ink)" }}>
        {fmtMoneySign(value, dc, rates)}
        <span style={{ fontSize: 14, color: "var(--ink-mute)", fontWeight: 400 }}>{CURRENCY_SYMBOLS[dc]}</span>
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
        {sub || CURRENCY_LABELS[dc]}
      </div>
    </div>
  );
}

function QuickAction({ onClick, icon: Ic, title, desc }) {
  return (
    <div onClick={onClick}
      className="flex items-center gap-3 p-3 rounded cursor-pointer hover:bg-stone-50 transition-colors group">
      <div className="p-2 rounded" style={{ background: "var(--bg)" }}>
        <Ic size={15} style={{ color: "var(--accent)" }}/>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs" style={{ color: "var(--ink-mute)" }}>{desc}</div>
      </div>
      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--ink-mute)" }}/>
    </div>
  );
}

/* ===================================================================== */
/* ---------- Açık faturalardan + kasa hareketlerinden + transferlerden projeksiyon ---------- */
// İki katman döner:
// - projected: açık/kısmi faturaların kalan tutarı, vade ayı sütununa (beklenen)
// - realized: gerçek olaylar (fatura ödemesi, kasa hareketi, transfer)
// Her birinde `items` arrayi, item.kind ile ayrıştırılır.
// "committedToCells: true" olan kayıtlar atlanır.
function computeInvoiceProjections(data) {
  const projected = {}; // "catId:monthIdx" → { amount, invoices, items }
  const realized = {};  // "catId:monthIdx" → { amount, payments, kasaEntries, transfers, items }
  if (!data) return { projected, realized };
  const rates = data.exchangeRates || {};
  const fiscalYear = data.fiscalYear;

  const ensureProj = (key) => {
    if (!projected[key]) projected[key] = { amount: 0, invoices: [], items: [] };
  };
  const ensureReal = (key) => {
    if (!realized[key]) realized[key] = { amount: 0, payments: [], kasaEntries: [], transfers: [], items: [] };
  };

  // ===== FATURALAR (projeksiyon + ödemeler) =====
  (data.invoices || []).forEach(inv => {
    if (!inv.cashflowCatId || inv.committedToCells) return;

    const status = getInvoiceStatus(inv);

    // PROJECTED: açık/kısmi → kalan tutar, vade ayında
    if (status !== "paid" && inv.dueDate) {
      const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
      if (remaining > 0.01) {
        const due = new Date(inv.dueDate);
        if (!isNaN(due.getTime()) && due.getFullYear() === fiscalYear) {
          const monthIdx = due.getMonth();
          const key = `${inv.cashflowCatId}:${monthIdx}`;
          const remainingTRY = convertToTRY(remaining, inv.currency || "TRY", rates);
          ensureProj(key);
          projected[key].amount += remainingTRY;
          const item = {
            kind: "invoice", id: inv.id, type: inv.type, no: inv.invoiceNo,
            counterparty: inv.counterparty, dueDate: inv.dueDate,
            remaining, remainingTRY, currency: inv.currency, status,
          };
          projected[key].invoices.push(item);
          projected[key].items.push(item);
        }
      }
    }

    // REALIZED: ödemeler
    (inv.payments || []).forEach(p => {
      if (!p.date || !p.amount) return;
      const pDate = new Date(p.date);
      if (isNaN(pDate.getTime()) || pDate.getFullYear() !== fiscalYear) return;
      const monthIdx = pDate.getMonth();
      const key = `${inv.cashflowCatId}:${monthIdx}`;
      const amountTRY = convertToTRY(Number(p.amount) || 0, p.currency || inv.currency || "TRY", rates);
      ensureReal(key);
      realized[key].amount += amountTRY;
      const item = {
        kind: "payment", invoiceId: inv.id, invoiceNo: inv.invoiceNo,
        counterparty: inv.counterparty, date: p.date,
        amount: Number(p.amount), amountTRY, currency: p.currency || inv.currency,
      };
      realized[key].payments.push(item);
      realized[key].items.push(item);
    });
  });

  // ===== KASA HAREKETLERİ =====
  (data.kasaEntries || []).forEach(e => {
    if (!e.cashflowCatId || e.committedToCells) return;
    if (!e.date) return;
    const d = new Date(e.date);
    if (isNaN(d.getTime()) || d.getFullYear() !== fiscalYear) return;
    const kasa = (data.kasaAccounts || []).find(k => k.id === e.kasaAccountId);
    const key = `${e.cashflowCatId}:${d.getMonth()}`;
    const amountTRY = convertToTRY(Number(e.amount) || 0, kasa?.currency || "TRY", rates);
    ensureReal(key);
    realized[key].amount += amountTRY;
    const item = {
      kind: "kasa", id: e.id, type: e.type, date: e.date,
      amount: Number(e.amount), amountTRY,
      description: e.description, category: e.category,
      kasaName: kasa?.name || "?", currency: kasa?.currency || "TRY",
    };
    realized[key].kasaEntries.push(item);
    realized[key].items.push(item);
  });

  // ===== TRANSFERLER =====
  (data.transfers || []).forEach(t => {
    if (!t.cashflowCatId || t.committedToCells) return;
    if (!t.date) return;
    const d = new Date(t.date);
    if (isNaN(d.getTime()) || d.getFullYear() !== fiscalYear) return;
    const key = `${t.cashflowCatId}:${d.getMonth()}`;
    const amountTRY = convertToTRY(Number(t.fromAmount) || 0, t.fromCurrency || "TRY", rates);
    ensureReal(key);
    realized[key].amount += amountTRY;
    const fromInfo = getEndpointInfo(t.fromType, t.fromId, data);
    const toInfo = getEndpointInfo(t.toType, t.toId, data);
    const item = {
      kind: "transfer", id: t.id, date: t.date,
      amount: Number(t.fromAmount), amountTRY, currency: t.fromCurrency,
      from: fromInfo.shortName, fromType: t.fromType,
      to: toInfo.shortName, toType: t.toType,
      description: t.description,
    };
    realized[key].transfers.push(item);
    realized[key].items.push(item);
  });

  // ===== BANKA HAREKETLERİ (manuel/Excel) =====
  (data.bankEntries || []).forEach(e => {
    if (!e.cashflowCatId || e.committedToCells || !e.date) return;
    const d = new Date(e.date);
    if (isNaN(d.getTime()) || d.getFullYear() !== fiscalYear) return;
    const acc = (data.bankAccounts || []).find(a => a.id === e.bankAccountId);
    const key = `${e.cashflowCatId}:${d.getMonth()}`;
    const amountTRY = convertToTRY(Number(e.amount) || 0, acc?.currency || "TRY", rates);
    ensureReal(key);
    realized[key].amount += amountTRY;
    realized[key].bankEntries = realized[key].bankEntries || [];
    const item = {
      kind: "bank", id: e.id, type: e.type, date: e.date,
      amount: Number(e.amount), amountTRY,
      description: e.description, category: e.category,
      bankName: acc?.name || "?", currency: acc?.currency || "TRY",
      reference: e.reference,
    };
    realized[key].bankEntries.push(item);
    realized[key].items.push(item);
  });

  // ===== KREDİLER =====
  // Taksitli/Spot kredilerin ödenmemiş taksitleri → projected, ödenmişler → realized
  // BCH/KMH/Rotatif hareketleri → realized (geri ödemeler + faiz tahakkukları)
  (data.loans || []).forEach(loan => {
    if (!loan.cashflowCatId || loan.committedToCells) return;
    const sch = loan.schedule || [];

    if (loan.type === "installment" || loan.type === "spot") {
      sch.forEach(s => {
        if (!s.dueDate) return;
        const d = new Date(s.dueDate);
        if (isNaN(d.getTime()) || d.getFullYear() !== fiscalYear) return;
        const mi = d.getMonth();
        const key = `${loan.cashflowCatId}:${mi}`;
        const amtTRY = convertToTRY(s.total, loan.currency || "TRY", rates);

        if (s.paid) {
          // GERÇEKLEŞEN: ödenmiş taksit
          ensureReal(key);
          realized[key].amount += amtTRY;
          realized[key].loanPayments = realized[key].loanPayments || [];
          const item = {
            kind: "loan_payment", loanId: loan.id, loanName: loan.name,
            loanType: loan.type, idx: s.idx, dueDate: s.dueDate,
            paidDate: s.paidDate, amount: s.total, amountTRY: amtTRY,
            currency: loan.currency || "TRY",
            principal: s.principal, interest: s.interest, bsmv: s.bsmv, kkdf: s.kkdf,
          };
          realized[key].loanPayments.push(item);
          realized[key].items.push(item);
        } else {
          // BEKLENEN: açık taksit
          ensureProj(key);
          projected[key].amount += amtTRY;
          projected[key].loanInstallments = projected[key].loanInstallments || [];
          const item = {
            kind: "loan_installment", loanId: loan.id, loanName: loan.name,
            loanType: loan.type, idx: s.idx, dueDate: s.dueDate,
            amount: s.total, amountTRY: amtTRY, currency: loan.currency || "TRY",
            principal: s.principal, interest: s.interest, bsmv: s.bsmv, kkdf: s.kkdf,
            overdue: d < new Date(),
          };
          projected[key].loanInstallments.push(item);
          projected[key].items.push(item);
        }
      });
    }
  });

  // Loan transactions (BCH/KMH/Rotatif: geri ödeme + faiz tahakkuku)
  (data.loanTransactions || []).forEach(tx => {
    if (!tx.cashflowCatId || tx.committedToCells) return;
    if (!tx.date) return;
    const d = new Date(tx.date);
    if (isNaN(d.getTime()) || d.getFullYear() !== fiscalYear) return;

    const loan = (data.loans || []).find(l => l.id === tx.loanId);
    if (!loan) return;
    const mi = d.getMonth();
    const key = `${tx.cashflowCatId}:${mi}`;
    const amtTRY = convertToTRY(Number(tx.amount) || 0, loan.currency || "TRY", rates);

    // draw = kredi kullanımı (banka hesabına para gelir, nakit AKIŞINA yansımaz)
    // repay = geri ödeme (banka hesabından çıkar, nakit akışta GİDER)
    // interest = faiz tahakkuku (banka hesabından çıkar, nakit akışta GİDER)
    if (tx.type === "repay" || tx.type === "interest") {
      ensureReal(key);
      realized[key].amount += amtTRY;
      realized[key].loanTxs = realized[key].loanTxs || [];
      const item = {
        kind: "loan_tx", loanId: loan.id, loanName: loan.name, loanType: loan.type,
        txType: tx.type, id: tx.id, date: tx.date,
        amount: Number(tx.amount), amountTRY: amtTRY, currency: loan.currency || "TRY",
        description: tx.description,
      };
      realized[key].loanTxs.push(item);
      realized[key].items.push(item);
    }
  });

  return { projected, realized };
}

function computeCashflow(data, includeProjections = false) {
  // 12 months starting from fiscalStartMonth
  const monthLabels = [];
  for (let i = 0; i < 12; i++) {
    monthLabels.push(TR_MONTHS[(data.fiscalStartMonth + i) % 12]);
  }
  const cells = data.cells || {};
  const { projected, realized } = includeProjections
    ? computeInvoiceProjections(data)
    : { projected: {}, realized: {} };

  const get = (catId, mi) => {
    const base = Number(cells[`${catId}:${mi}`] || 0);
    const proj = projected[`${catId}:${mi}`]?.amount || 0;
    const real = realized[`${catId}:${mi}`]?.amount || 0;
    return base + proj + real;
  };

  const inflowTotals = Array(12).fill(0);
  const outflowTotals = Array(12).fill(0);
  const nonPnlTotals = Array(12).fill(0);

  data.inflows.forEach(c => {
    for (let i = 0; i < 12; i++) inflowTotals[i] += get(c.id, i);
  });
  data.outflows.forEach(c => {
    for (let i = 0; i < 12; i++) outflowTotals[i] += get(c.id, i);
  });
  data.nonPnlOutflows.forEach(c => {
    for (let i = 0; i < 12; i++) nonPnlTotals[i] += get(c.id, i);
  });

  // Beginning/end cash for each month
  const beginCash = Array(12).fill(0);
  const endCash = Array(12).fill(0);
  let running = Number(data.openingCash || 0);
  for (let i = 0; i < 12; i++) {
    beginCash[i] = running;
    const net = inflowTotals[i] - outflowTotals[i] - nonPnlTotals[i];
    running = running + net;
    endCash[i] = running;
  }
  return { monthLabels, inflowTotals, outflowTotals, nonPnlTotals, beginCash, endCash, projections: projected, realized };
}

/* ===================================================================== */
function CashFlowGrid({ data, session, canAct, onChange, logAudit, notify }) {
  const canEdit           = canAct ? canAct("finance.cashflow.update") || can(session.role, "edit_cells")       : can(session.role, "edit_cells");
  const canExport         = canAct ? canAct("finance.cashflow.export") || can(session.role, "edit_cells")       : can(session.role, "edit_cells");
  const canManageInvoices = canAct ? canAct("finance.invoices.update") || can(session.role, "manage_invoices")  : can(session.role, "manage_invoices");
  const [showProjections, setShowProjections] = useState(true);
  const compute = useMemo(() => computeCashflow(data, showProjections), [data, showProjections]);
  const projections = compute.projections || {};
  const realized = compute.realized || {};
  const projectionsActive = showProjections && (Object.keys(projections).length > 0 || Object.keys(realized).length > 0);
  const [search, setSearch] = useState("");
  const [excelMenuOpen, setExcelMenuOpen] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);

  // Yansıtılmamış (committed olmayan) tüm kayıtları topla: faturalar + kasa hareketleri + transferler
  const pendingItems = useMemo(() => {
    const result = { invoices: [], kasaEntries: [], transfers: [], loans: [], loanTxs: [], bankEntries: [] };
    (data.invoices || []).forEach(inv => {
      if (inv.committedToCells || !inv.cashflowCatId) return;
      const status = getInvoiceStatus(inv);
      const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
      const hasProjection = status !== "paid" && remaining > 0.01 && inv.dueDate &&
        new Date(inv.dueDate).getFullYear() === data.fiscalYear;
      const hasRealized = (inv.payments || []).some(p => {
        const d = new Date(p.date);
        return !isNaN(d.getTime()) && d.getFullYear() === data.fiscalYear;
      });
      if (hasProjection || hasRealized) result.invoices.push(inv);
    });
    (data.kasaEntries || []).forEach(e => {
      if (e.committedToCells || !e.cashflowCatId || !e.date) return;
      const d = new Date(e.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === data.fiscalYear) result.kasaEntries.push(e);
    });
    (data.transfers || []).forEach(t => {
      if (t.committedToCells || !t.cashflowCatId || !t.date) return;
      const d = new Date(t.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === data.fiscalYear) result.transfers.push(t);
    });
    (data.loans || []).forEach(loan => {
      if (loan.committedToCells || !loan.cashflowCatId) return;
      if (loan.type !== "installment" && loan.type !== "spot") return;
      const hasInYear = (loan.schedule || []).some(s => {
        const d = new Date(s.dueDate);
        return !isNaN(d.getTime()) && d.getFullYear() === data.fiscalYear;
      });
      if (hasInYear) result.loans.push(loan);
    });
    (data.loanTransactions || []).forEach(tx => {
      if (tx.committedToCells || !tx.cashflowCatId || !tx.date) return;
      if (tx.type !== "repay" && tx.type !== "interest") return;
      const d = new Date(tx.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === data.fiscalYear) result.loanTxs.push(tx);
    });
    (data.bankEntries || []).forEach(e => {
      if (e.committedToCells || !e.cashflowCatId || !e.date) return;
      const d = new Date(e.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === data.fiscalYear) result.bankEntries.push(e);
    });
    return result;
  }, [data.invoices, data.kasaEntries, data.transfers, data.loans, data.loanTransactions, data.bankEntries, data.fiscalYear]);

  const pendingTotalCount = pendingItems.invoices.length + pendingItems.kasaEntries.length
    + pendingItems.transfers.length + pendingItems.loans.length + pendingItems.loanTxs.length
    + pendingItems.bankEntries.length;

  const setCell = async (catId, mi, val) => {
    if (!canEdit) return;
    const key = `${catId}:${mi}`;
    const numeric = val === "" || val === "-" ? 0 : Number(String(val).replace(/[^\d.-]/g, ""));
    const next = { ...data, cells: { ...(data.cells || {}), [key]: numeric } };
    await onChange(next);
  };

  // Toplu commit: tüm bekleyen kayıtları (fatura + kasa + transfer) cells'e ekle
  const handleBulkCommit = async () => {
    const newCells = { ...(data.cells || {}) };
    const rates = data.exchangeRates || {};

    // Faturalar
    const updatedInvoices = (data.invoices || []).map(inv => {
      if (inv.committedToCells || !inv.cashflowCatId) return inv;
      let touched = false;
      const status = getInvoiceStatus(inv);
      if (status !== "paid" && inv.dueDate) {
        const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
        if (remaining > 0.01) {
          const due = new Date(inv.dueDate);
          if (!isNaN(due.getTime()) && due.getFullYear() === data.fiscalYear) {
            const key = `${inv.cashflowCatId}:${due.getMonth()}`;
            const trAmt = convertToTRY(remaining, inv.currency || "TRY", rates);
            newCells[key] = (Number(newCells[key]) || 0) + trAmt;
            touched = true;
          }
        }
      }
      (inv.payments || []).forEach(p => {
        const pDate = new Date(p.date);
        if (isNaN(pDate.getTime()) || pDate.getFullYear() !== data.fiscalYear) return;
        const key = `${inv.cashflowCatId}:${pDate.getMonth()}`;
        const trAmt = convertToTRY(Number(p.amount) || 0, p.currency || inv.currency || "TRY", rates);
        newCells[key] = (Number(newCells[key]) || 0) + trAmt;
        touched = true;
      });
      if (!touched) return inv;
      return { ...inv, committedToCells: true, committedAt: new Date().toISOString() };
    });

    // Kasa hareketleri
    const updatedKasaEntries = (data.kasaEntries || []).map(e => {
      if (e.committedToCells || !e.cashflowCatId || !e.date) return e;
      const d = new Date(e.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== data.fiscalYear) return e;
      const kasa = (data.kasaAccounts || []).find(k => k.id === e.kasaAccountId);
      const key = `${e.cashflowCatId}:${d.getMonth()}`;
      const trAmt = convertToTRY(Number(e.amount) || 0, kasa?.currency || "TRY", rates);
      newCells[key] = (Number(newCells[key]) || 0) + trAmt;
      return { ...e, committedToCells: true, committedAt: new Date().toISOString() };
    });

    // Transferler
    const updatedTransfers = (data.transfers || []).map(t => {
      if (t.committedToCells || !t.cashflowCatId || !t.date) return t;
      const d = new Date(t.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== data.fiscalYear) return t;
      const key = `${t.cashflowCatId}:${d.getMonth()}`;
      const trAmt = convertToTRY(Number(t.fromAmount) || 0, t.fromCurrency || "TRY", rates);
      newCells[key] = (Number(newCells[key]) || 0) + trAmt;
      return { ...t, committedToCells: true, committedAt: new Date().toISOString() };
    });

    // Krediler — taksitli/spot tüm taksitler (ödenmiş+bekleyen), ilgili aylara dağıtarak
    const updatedLoans = (data.loans || []).map(loan => {
      if (loan.committedToCells || !loan.cashflowCatId) return loan;
      if (loan.type !== "installment" && loan.type !== "spot") return loan;
      let touched = false;
      (loan.schedule || []).forEach(s => {
        if (!s.dueDate) return;
        const d = new Date(s.dueDate);
        if (isNaN(d.getTime()) || d.getFullYear() !== data.fiscalYear) return;
        const key = `${loan.cashflowCatId}:${d.getMonth()}`;
        const trAmt = convertToTRY(s.total, loan.currency || "TRY", rates);
        newCells[key] = (Number(newCells[key]) || 0) + trAmt;
        touched = true;
      });
      if (!touched) return loan;
      return { ...loan, committedToCells: true, committedAt: new Date().toISOString() };
    });

    // Kredi hareketleri (BCH/KMH/Rotatif geri ödeme + faiz)
    const updatedLoanTxs = (data.loanTransactions || []).map(tx => {
      if (tx.committedToCells || !tx.cashflowCatId || !tx.date) return tx;
      if (tx.type !== "repay" && tx.type !== "interest") return tx;  // draw'lar nakit akışa yansımaz
      const d = new Date(tx.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== data.fiscalYear) return tx;
      const loan = (data.loans || []).find(l => l.id === tx.loanId);
      const key = `${tx.cashflowCatId}:${d.getMonth()}`;
      const trAmt = convertToTRY(Number(tx.amount) || 0, loan?.currency || "TRY", rates);
      newCells[key] = (Number(newCells[key]) || 0) + trAmt;
      return { ...tx, committedToCells: true, committedAt: new Date().toISOString() };
    });

    // Banka hareketleri (Excel'den içe aktarılmış veya manuel girilmiş)
    const updatedBankEntries = (data.bankEntries || []).map(e => {
      if (e.committedToCells || !e.cashflowCatId || !e.date) return e;
      const d = new Date(e.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== data.fiscalYear) return e;
      const acc = (data.bankAccounts || []).find(a => a.id === e.bankAccountId);
      const key = `${e.cashflowCatId}:${d.getMonth()}`;
      const trAmt = convertToTRY(Number(e.amount) || 0, acc?.currency || "TRY", rates);
      newCells[key] = (Number(newCells[key]) || 0) + trAmt;
      return { ...e, committedToCells: true, committedAt: new Date().toISOString() };
    });

    const invCount = updatedInvoices.filter((u, idx) => u.committedToCells && !data.invoices[idx]?.committedToCells).length;
    const kasaCount = updatedKasaEntries.filter((u, idx) => u.committedToCells && !data.kasaEntries[idx]?.committedToCells).length;
    const trfCount = updatedTransfers.filter((u, idx) => u.committedToCells && !data.transfers[idx]?.committedToCells).length;
    const loanCount = updatedLoans.filter((u, idx) => u.committedToCells && !data.loans?.[idx]?.committedToCells).length;
    const loanTxCount = updatedLoanTxs.filter((u, idx) => u.committedToCells && !data.loanTransactions?.[idx]?.committedToCells).length;
    const bankCount = updatedBankEntries.filter((u, idx) => u.committedToCells && !data.bankEntries?.[idx]?.committedToCells).length;
    const totalCount = invCount + kasaCount + trfCount + loanCount + loanTxCount + bankCount;

    await onChange({
      ...data, cells: newCells,
      invoices: updatedInvoices,
      kasaEntries: updatedKasaEntries,
      transfers: updatedTransfers,
      loans: updatedLoans,
      loanTransactions: updatedLoanTxs,
      bankEntries: updatedBankEntries,
    });
    await logAudit("invoices_bulk_commit", {
      fatura: invCount, kasa: kasaCount, transfer: trfCount,
      kredi: loanCount, kredi_hareket: loanTxCount, banka: bankCount,
      toplam: totalCount,
    });
    notify(`${totalCount} kayıt nakit akış tablosuna gömüldü`);
    setShowCommitModal(false);
  };

  const onCellBlur = async (catId, catName, mi, oldVal, newVal) => {
    if (!canEdit) return;
    const v = newVal === "" ? 0 : Number(String(newVal).replace(/[^\d.-]/g, ""));
    if (v !== Number(oldVal || 0)) {
      await logAudit("cell_edit", { kategori: catName, ay: compute.monthLabels[mi], eski: oldVal || 0, yeni: v });
    }
  };

  const setOpening = async (val) => {
    if (!can(session.role, "manage_periods")) return;
    const numeric = Number(String(val).replace(/[^\d.-]/g, "")) || 0;
    const oldVal = data.openingCash;
    await onChange({ ...data, openingCash: numeric });
    if (oldVal !== numeric) {
      await logAudit("opening_cash_change", { eski: oldVal, yeni: numeric });
      notify("Açılış nakdi güncellendi");
    }
  };

  const filter = (list) =>
    !search ? list : list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const totalIn = compute.inflowTotals.reduce((a, b) => a + b, 0);
  const totalOut = compute.outflowTotals.reduce((a, b) => a + b, 0);
  const totalNonPnl = compute.nonPnlTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="label mb-1">Mali Yıl {data.fiscalYear}</div>
          <h1 className="display text-2xl md:text-3xl">Nakit Akış Tablosu</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-mute)" }}/>
            <input className="input pl-7" placeholder="Kalem ara..." style={{ width: 200 }}
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <button onClick={() => setShowProjections(!showProjections)}
            className="btn btn-ghost text-xs flex items-center gap-1.5"
            title={showProjections ? "Fatura projeksiyonları gösteriliyor — kapatmak için tıkla" : "Açık faturaları yansıtmak için tıkla"}
            style={{
              background: projectionsActive ? "#dbeafe" : undefined,
              color: projectionsActive ? "#1d4ed8" : undefined,
            }}>
            <Receipt size={12}/>
            <span className="hidden sm:inline">Faturaları Yansıt</span>
            <span className={"w-7 h-3.5 rounded-full relative transition-colors"}
              style={{ background: showProjections ? "#1d4ed8" : "#cbd5e1" }}>
              <span className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all"
                style={{ left: showProjections ? "15px" : "2px" }}/>
            </span>
          </button>
          {canManageInvoices && pendingTotalCount > 0 && (
            <button onClick={() => setShowCommitModal(true)} className="btn btn-ghost text-xs"
              title="Bekleyen tüm fatura, kasa hareketi ve transferleri nakit akış tablosuna kalıcı olarak gömer">
              <Save size={12}/>
              <span className="hidden md:inline">Toplu Yansıt</span>
              <span className="chip ml-1" style={{ background: "#fef3c7", color: "#854d0e", fontSize: 9 }}>{pendingTotalCount}</span>
            </button>
          )}
          <div className="relative">
            <button onClick={() => setExcelMenuOpen(!excelMenuOpen)} className="btn btn-ghost"
              title="Excel'e aktar">
              <FileDown size={13}/> Excel <ChevronDown size={11} className={excelMenuOpen ? "rotate-180 transition-transform" : "transition-transform"}/>
            </button>
            {excelMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setExcelMenuOpen(false)}/>
                <div className="absolute right-0 mt-1 rounded shadow-lg z-30 min-w-[260px]"
                  style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <ExcelOption label="Sadece Manuel Veri" desc="Yalnızca elle girilen hücreler" icon={Table2}
                    onClick={async () => {
                      try {
                        const fname = exportToExcel(data, {});
                        await logAudit("excel_export", { dosya: fname, kapsam: "manuel" });
                        notify("Excel indirildi: " + fname);
                      } catch (err) { notify("Hata: " + err.message, "err"); }
                      setExcelMenuOpen(false);
                    }}/>
                  <ExcelOption label="Manuel + Açık Faturalar" desc="Manuel + bekleyen tahsilat/ödeme projeksiyonları" icon={Receipt}
                    onClick={async () => {
                      try {
                        const fname = exportToExcel(data, { includeProjections: true });
                        await logAudit("excel_export", { dosya: fname, kapsam: "manuel+projeksiyon" });
                        notify("Excel indirildi (projeksiyon dahil): " + fname);
                      } catch (err) { notify("Hata: " + err.message, "err"); }
                      setExcelMenuOpen(false);
                    }}/>
                  <ExcelOption label="Tam Görünüm" desc="Manuel + projeksiyon + gerçekleşen ödemeler" icon={Layers}
                    onClick={async () => {
                      try {
                        const fname = exportToExcel(data, { includeProjections: true, includeRealized: true });
                        await logAudit("excel_export", { dosya: fname, kapsam: "tam" });
                        notify("Excel indirildi (tam görünüm): " + fname);
                      } catch (err) { notify("Hata: " + err.message, "err"); }
                      setExcelMenuOpen(false);
                    }}/>
                </div>
              </>
            )}
          </div>
          {!canEdit && (
            <div className="chip" style={{ background: "var(--bg-alt)", color: "var(--ink-mute)" }}>
              <Eye size={9}/> Salt okunur
            </div>
          )}
        </div>
      </div>

      {/* Projeksiyon bilgi bandı */}
      {projectionsActive && (
        <div className="card p-3 flex items-start gap-2.5 text-xs"
          style={{ background: "#dbeafe", borderColor: "#93c5fd", color: "#1e3a8a", boxShadow: "var(--shadow)" }}>
          <Receipt size={13} className="mt-0.5 flex-shrink-0"/>
          <div className="flex-1">
            <div>
              <strong>{Object.values(projections).reduce((s, p) => s + (p.items || p.invoices || []).length, 0)} açık fatura</strong>
              {" "}vade tarihine göre {Object.keys(projections).length} hücreye yansıtılıyor (beklenen tahsilat/ödeme)
              {" + "}<strong>{Object.values(realized).reduce((s, r) => s + (r.items || []).length, 0)} gerçek kayıt</strong>{" "}
              (fatura ödemesi, kasa hareketi, transfer) {Object.keys(realized).length} hücreye yansıtılıyor.
            </div>
            <div className="mt-1 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#1d4ed8" }}/> Beklenen: <strong>{fmtTL(Object.values(projections).reduce((s, p) => s + p.amount, 0))} ₺</strong></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#0f766e" }}/> Gerçekleşen: <strong>{fmtTL(Object.values(realized).reduce((s, r) => s + r.amount, 0))} ₺</strong></span>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto" style={{ boxShadow: "var(--shadow)" }}>
        <table className="grid">
          <thead>
            <tr>
              <th className="label-cell" style={{ minWidth: 280 }}>Kalem</th>
              {compute.monthLabels.map((m, i) => (
                <th key={i} style={{ minWidth: 95 }}>{m}</th>
              ))}
              <th style={{ minWidth: 110, background: "var(--accent-soft)" }}>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening cash */}
            <tr>
              <td className="label-cell font-medium">Eldeki Nakit (dönem başı)</td>
              {compute.beginCash.map((v, i) => (
                <td key={i} className="num" style={{ color: v < 0 ? "var(--negative)" : "var(--ink-soft)" }}>
                  {i === 0 ? (
                    can(session.role, "manage_periods") ? (
                      <input
                        className="text-right num"
                        style={{ background: "transparent", border: "none", width: "100%", fontSize: 12.5 }}
                        defaultValue={data.openingCash || ""}
                        onBlur={e => setOpening(e.target.value)}
                      />
                    ) : fmtTLSign(data.openingCash)
                  ) : fmtTLSign(v)}
                </td>
              ))}
              <td className="num font-medium">{fmtTLSign(data.openingCash)}</td>
            </tr>

            {/* INFLOWS */}
            <SectionHead label="Tahsil Edilen Nakit" colspan={14}/>
            {filter(data.inflows).map(cat => (
              <CatRow key={cat.id} cat={cat} data={data} canEdit={canEdit} projections={projections} realized={realized}
                setCell={setCell} onBlur={onCellBlur}/>
            ))}
            <SubtotalRow label="Toplam Tahsilat" values={compute.inflowTotals} total={totalIn}/>
            <tr>
              <td className="label-cell italic" style={{ color: "var(--ink-mute)" }}>Mevcut Toplam Nakit (çıkıştan önce)</td>
              {compute.beginCash.map((b, i) => {
                const v = b + compute.inflowTotals[i];
                return <td key={i} className="num italic" style={{ color: v < 0 ? "var(--negative)" : "var(--ink-soft)" }}>{fmtTLSign(v)}</td>;
              })}
              <td className="num italic">—</td>
            </tr>

            {/* OUTFLOWS */}
            <SectionHead label="Ödenen Nakit" colspan={14}/>
            {filter(data.outflows).map(cat => (
              <CatRow key={cat.id} cat={cat} data={data} canEdit={canEdit} projections={projections} realized={realized}
                setCell={setCell} onBlur={onCellBlur}/>
            ))}
            <SubtotalRow label="Toplam Ödeme" values={compute.outflowTotals} total={totalOut}/>

            {/* NON-PNL */}
            <SectionHead label="Ödenen Nakit (Kar/Zarar Harici)" colspan={14}/>
            {filter(data.nonPnlOutflows).map(cat => (
              <CatRow key={cat.id} cat={cat} data={data} canEdit={canEdit} projections={projections} realized={realized}
                setCell={setCell} onBlur={onCellBlur}/>
            ))}
            <SubtotalRow label="Toplam K/Z Harici" values={compute.nonPnlTotals} total={totalNonPnl}/>

            <tr className="subtotal">
              <td className="label-cell">Ödenen Toplam Nakit</td>
              {compute.outflowTotals.map((v, i) => (
                <td key={i} className="num">{fmtTLSign(v + compute.nonPnlTotals[i])}</td>
              ))}
              <td className="num">{fmtTLSign(totalOut + totalNonPnl)}</td>
            </tr>

            {/* CLOSING */}
            <tr className="grand-total">
              <td className="label-cell">Nakit Durumu (ay sonu)</td>
              {compute.endCash.map((v, i) => (
                <td key={i} className="num" style={{ color: v < 0 ? "var(--negative)" : "var(--accent)" }}>
                  {fmtTLSign(v)}
                </td>
              ))}
              <td className="num" style={{ color: compute.endCash[11] < 0 ? "var(--negative)" : "var(--accent)" }}>
                {fmtTLSign(compute.endCash[11])}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-xs flex items-center gap-4" style={{ color: "var(--ink-mute)" }}>
        <span>Tüm değişiklikler otomatik kaydedilir.</span>
        {canEdit && <span>Hücreye tıklayarak değer girebilirsiniz.</span>}
      </div>

      {/* Toplu commit modali */}
      {showCommitModal && (
        <BulkCommitModal
          data={data}
          pendingItems={pendingItems}
          pendingTotalCount={pendingTotalCount}
          onClose={() => setShowCommitModal(false)}
          onConfirm={handleBulkCommit}
        />
      )}
    </div>
  );
}

/* =====================================================================
   TOPLU FATURA / KASA / TRANSFER YANSITMA MODALI
===================================================================== */
function BulkCommitModal({ data, pendingItems, pendingTotalCount, onClose, onConfirm }) {
  const rates = data.exchangeRates || {};
  const fiscalYear = data.fiscalYear;

  // Hücre bazında etki dökümü
  const breakdown = useMemo(() => {
    const cellImpacts = {}; // catId:monthIdx → { addition, items: [{ kind, label, amount }] }
    const ensure = (key) => { if (!cellImpacts[key]) cellImpacts[key] = { addition: 0, items: [] }; };

    // Faturalar
    pendingItems.invoices.forEach(inv => {
      const status = getInvoiceStatus(inv);
      if (status !== "paid" && inv.dueDate) {
        const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
        if (remaining > 0.01) {
          const due = new Date(inv.dueDate);
          if (!isNaN(due.getTime()) && due.getFullYear() === fiscalYear) {
            const key = `${inv.cashflowCatId}:${due.getMonth()}`;
            const trAmt = convertToTRY(remaining, inv.currency || "TRY", rates);
            ensure(key);
            cellImpacts[key].addition += trAmt;
            cellImpacts[key].items.push({ kind: "projection", label: `Açık fatura ${inv.invoiceNo} (${inv.counterparty})`, amount: trAmt });
          }
        }
      }
      (inv.payments || []).forEach(p => {
        const pDate = new Date(p.date);
        if (isNaN(pDate.getTime()) || pDate.getFullYear() !== fiscalYear) return;
        const key = `${inv.cashflowCatId}:${pDate.getMonth()}`;
        const trAmt = convertToTRY(Number(p.amount) || 0, p.currency || inv.currency || "TRY", rates);
        ensure(key);
        cellImpacts[key].addition += trAmt;
        cellImpacts[key].items.push({ kind: "payment", label: `Fatura ödemesi ${inv.invoiceNo}`, amount: trAmt });
      });
    });

    // Kasa hareketleri
    pendingItems.kasaEntries.forEach(e => {
      const d = new Date(e.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== fiscalYear) return;
      const kasa = (data.kasaAccounts || []).find(k => k.id === e.kasaAccountId);
      const key = `${e.cashflowCatId}:${d.getMonth()}`;
      const trAmt = convertToTRY(Number(e.amount) || 0, kasa?.currency || "TRY", rates);
      ensure(key);
      cellImpacts[key].addition += trAmt;
      cellImpacts[key].items.push({ kind: "kasa", label: `Kasa ${kasa?.name || ""}: ${e.description || ""}`, amount: trAmt });
    });

    // Transferler
    pendingItems.transfers.forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== fiscalYear) return;
      const key = `${t.cashflowCatId}:${d.getMonth()}`;
      const trAmt = convertToTRY(Number(t.fromAmount) || 0, t.fromCurrency || "TRY", rates);
      const fromName = getEndpointInfo(t.fromType, t.fromId, data).shortName;
      const toName = getEndpointInfo(t.toType, t.toId, data).shortName;
      ensure(key);
      cellImpacts[key].addition += trAmt;
      cellImpacts[key].items.push({ kind: "transfer", label: `Transfer ${fromName} → ${toName}`, amount: trAmt });
    });

    return cellImpacts;
  }, [pendingItems, fiscalYear, rates, data]);

  const totalAddition = Object.values(breakdown).reduce((s, v) => s + v.addition, 0);
  const cellCount = Object.keys(breakdown).length;
  const counts = {
    projection: Object.values(breakdown).reduce((s, v) => s + v.items.filter(i => i.kind === "projection").length, 0),
    payment:    Object.values(breakdown).reduce((s, v) => s + v.items.filter(i => i.kind === "payment").length, 0),
    kasa:       Object.values(breakdown).reduce((s, v) => s + v.items.filter(i => i.kind === "kasa").length, 0),
    transfer:   Object.values(breakdown).reduce((s, v) => s + v.items.filter(i => i.kind === "transfer").length, 0),
  };

  const catNames = useMemo(() => {
    const m = {};
    [...(data.inflows || []), ...(data.outflows || []), ...(data.nonPnlOutflows || [])].forEach(c => m[c.id] = c.name);
    return m;
  }, [data]);

  const kindMeta = {
    projection: { label: "Açık Fatura", color: "#1d4ed8", bg: "#dbeafe" },
    payment:    { label: "Fatura Ödemesi", color: "#0f766e", bg: "#dcfce7" },
    kasa:       { label: "Kasa Hareketi", color: "#0b3d2e", bg: "#d1fae5" },
    transfer:   { label: "Transfer", color: "#7c3aed", bg: "#ede9fe" },
  };

  return (
    <Modal title="Kayıtları Nakit Akışa Göm" icon={Save} maxWidth="max-w-2xl"
      onClose={onClose} onSave={onConfirm} saveLabel={`${pendingTotalCount} Kaydı Yansıt`}>
      <div className="space-y-4">
        <div className="p-3 rounded text-sm" style={{ background: "#fef3c7", color: "#854d0e" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0"/>
            <div>
              <strong>{pendingTotalCount} kayıt</strong> ({counts.projection + counts.payment} fatura, {counts.kasa} kasa hareketi, {counts.transfer} transfer)
              aşağıdaki hücrelere kalıcı olarak gömülecek.
              Yansıtma sonrası bu kayıtlar projeksiyonda görünmeyecek; hücrelerde kalıcı değerler olarak kalacak.
              Kaydı sonradan silmek veya tutarını değiştirmek <strong>hücreyi otomatik geri almaz</strong>.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatBlock label="Etkilenen Hücre" value={cellCount}/>
          <StatBlock label="Açık Fatura" value={counts.projection} color="#1d4ed8"/>
          <StatBlock label="Fatura Ödemesi" value={counts.payment} color="#0f766e"/>
          <StatBlock label="Kasa / Transfer" value={counts.kasa + counts.transfer} color="#7c3aed"/>
          <StatBlock label="Toplam (₺)" value={fmtTL(totalAddition)} large/>
        </div>

        <div>
          <div className="label mb-2">Hücre Bazında Önizleme</div>
          <div className="card overflow-x-auto" style={{ maxHeight: 360 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th className="label-cell" style={{ width: "28%" }}>Kategori</th>
                  <th className="label-cell" style={{ width: 80 }}>Ay</th>
                  <th style={{ width: 110 }}>Mevcut</th>
                  <th style={{ width: 110 }}>Eklenecek</th>
                  <th style={{ width: 110 }}>Yeni Değer</th>
                  <th className="label-cell" style={{ width: 140 }}>Kaynaklar</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(breakdown)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, v]) => {
                    const [catId, mi] = key.split(":");
                    const currentVal = Number((data.cells || {})[key]) || 0;
                    const kindCounts = {};
                    v.items.forEach(it => { kindCounts[it.kind] = (kindCounts[it.kind] || 0) + 1; });
                    return (
                      <tr key={key}>
                        <td className="label-cell text-xs">{catNames[catId] || catId}</td>
                        <td className="label-cell text-xs">{TR_MONTHS[Number(mi)]}</td>
                        <td className="num text-xs" style={{ color: "var(--ink-mute)" }}>{currentVal ? fmtTL(currentVal) : "—"}</td>
                        <td className="num text-xs font-medium" style={{ color: "var(--accent)" }}>+{fmtTL(v.addition)}</td>
                        <td className="num text-xs font-semibold">{fmtTL(currentVal + v.addition)}</td>
                        <td className="label-cell text-xs">
                          <div className="flex items-center gap-1 flex-wrap">
                            {Object.entries(kindCounts).map(([k, n]) => (
                              <span key={k} className="chip" style={{ background: kindMeta[k].bg, color: kindMeta[k].color, fontSize: 9 }}>
                                {n}{k === "projection" ? "f" : (k === "payment" ? "ö" : (k === "kasa" ? "k" : "t"))}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function StatBlock({ label, value, color, large }) {
  return (
    <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
      <div className="label">{label}</div>
      <div className={`display num ${large ? "text-base" : "text-xl"}`} style={{ color: color || "var(--ink)" }}>{value}</div>
    </div>
  );
}

function SectionHead({ label, colspan }) {
  return <tr className="section-head"><td colSpan={colspan} className="label-cell">{label}</td></tr>;
}

function SubtotalRow({ label, values, total }) {
  return (
    <tr className="subtotal">
      <td className="label-cell">{label}</td>
      {values.map((v, i) => <td key={i} className="num">{fmtTLSign(v)}</td>)}
      <td className="num">{fmtTLSign(total)}</td>
    </tr>
  );
}

function CatRow({ cat, data, canEdit, setCell, onBlur, projections, realized }) {
  const cells = data.cells || {};
  const proj = projections || {};
  const real = realized || {};
  // Satır toplamı = base + projeksiyon + gerçekleşen
  const rowTotal = Array(12).fill(0).reduce((acc, _, i) => {
    const base = Number(cells[`${cat.id}:${i}`] || 0);
    const pa = proj[`${cat.id}:${i}`]?.amount || 0;
    const ra = real[`${cat.id}:${i}`]?.amount || 0;
    return acc + base + pa + ra;
  }, 0);
  const hasAnyProj = Array(12).fill(0).some((_, i) => proj[`${cat.id}:${i}`]);
  const hasAnyReal = Array(12).fill(0).some((_, i) => real[`${cat.id}:${i}`]);
  return (
    <tr>
      <td className="label-cell" style={{ fontSize: 12 }}>
        <div className="flex items-center gap-1.5">
          <span>{cat.name}</span>
          {hasAnyProj && (
            <span title="Bu kategoride açık fatura projeksiyonu var">
              <Receipt size={9} style={{ color: "#1d4ed8" }}/>
            </span>
          )}
          {hasAnyReal && (
            <span title="Bu kategoride gerçekleşen fatura ödemesi var">
              <Check size={9} style={{ color: "#0f766e" }}/>
            </span>
          )}
        </div>
      </td>
      {Array(12).fill(0).map((_, i) => {
        const v = cells[`${cat.id}:${i}`];
        const projItem = proj[`${cat.id}:${i}`];
        const realItem = real[`${cat.id}:${i}`];
        const projAmt = projItem?.amount || 0;
        const realAmt = realItem?.amount || 0;
        const cellTotal = Number(v || 0) + projAmt + realAmt;
        const tooltipProj = projItem && projItem.items?.length
          ? `BEKLENEN (Açık Faturalar):\n${projItem.items.map(it => `• ${it.no} · ${it.counterparty} · vade ${it.dueDate} · ${fmtTL(it.remainingTRY)} ₺`).join("\n")}`
          : "";
        const tooltipReal = realItem && realItem.items?.length
          ? `GERÇEKLEŞEN:\n${realItem.items.map(it => {
              if (it.kind === "payment") return `• Fatura ${it.invoiceNo} · ${it.counterparty} · ${it.date} · ${fmtTL(it.amountTRY)} ₺`;
              if (it.kind === "kasa") return `• Kasa ${it.kasaName} · ${it.description || "—"} · ${it.date} · ${fmtTL(it.amountTRY)} ₺`;
              if (it.kind === "transfer") return `• Transfer ${it.from} → ${it.to} · ${it.date} · ${fmtTL(it.amountTRY)} ₺`;
              return `• ${fmtTL(it.amountTRY)} ₺`;
            }).join("\n")}`
          : "";
        const tooltip = [tooltipProj, tooltipReal].filter(Boolean).join("\n\n");
        const cellBg = projAmt > 0 && realAmt > 0 ? "#f0fdf4" : (projAmt > 0 ? "#dbeafe40" : (realAmt > 0 ? "#dcfce740" : undefined));
        return canEdit ? (
          <td key={i} className="cell-edit" style={{ position: "relative" }}>
            <input
              type="text"
              defaultValue={v ? fmtTL(v) : ""}
              onFocus={(e) => { e.target.value = v || ""; e.target.select(); }}
              onBlur={(e) => {
                const newVal = e.target.value;
                setCell(cat.id, i, newVal);
                onBlur(cat.id, cat.name, i, v, newVal);
                e.target.value = newVal === "" || newVal === "0" ? "" : fmtTL(Number(String(newVal).replace(/[^\d.-]/g, "")));
              }}
              placeholder={projAmt || realAmt ? "0" : "—"}
              style={cellBg ? { background: cellBg } : undefined}
            />
            {(projAmt > 0 || realAmt > 0) && (
              <div className="px-1 pb-0.5 flex flex-col gap-px text-xs leading-tight"
                style={{ fontSize: 9 }} title={tooltip}>
                {projAmt > 0 && (
                  <div className="flex items-center gap-0.5" style={{ color: "#1d4ed8" }}>
                    <Receipt size={7}/>
                    <span className="num">+{fmtTL(projAmt)}</span>
                    <span style={{ opacity: 0.7 }}>·{(projItem.items || projItem.invoices || []).length}f</span>
                  </div>
                )}
                {realAmt > 0 && (
                  <div className="flex items-center gap-0.5" style={{ color: "#0f766e" }}>
                    <Check size={7}/>
                    <span className="num">+{fmtTL(realAmt)}</span>
                    <span style={{ opacity: 0.7 }}>·{(realItem.items || []).length}k</span>
                  </div>
                )}
              </div>
            )}
          </td>
        ) : (
          <td key={i} className="num" style={{ color: cellTotal ? "var(--ink)" : "var(--ink-mute)", position: "relative", background: cellBg }}>
            {cellTotal ? fmtTL(cellTotal) : "—"}
            {(projAmt > 0 || realAmt > 0) && (
              <div className="text-xs leading-tight" style={{ fontSize: 9 }} title={tooltip}>
                {projAmt > 0 && <span style={{ color: "#1d4ed8" }}><Receipt size={7} className="inline"/> +{fmtTL(projAmt)} </span>}
                {realAmt > 0 && <span style={{ color: "#0f766e" }}><Check size={7} className="inline"/> +{fmtTL(realAmt)}</span>}
              </div>
            )}
          </td>
        );
      })}
      <td className="num font-medium" style={{ color: rowTotal > 0 ? "var(--ink)" : "var(--ink-mute)" }}>
        {rowTotal ? fmtTL(rowTotal) : "—"}
      </td>
    </tr>
  );
}

/* ---------- Küçük ExcelOption / ExcelOption — Dropdown öğesi ---------- */
function ExcelOption({ label, desc, icon: Ic, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full text-left p-3 hover:bg-stone-50 flex items-start gap-2 border-b"
      style={{ borderColor: "var(--line-soft)" }}>
      <Ic size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}/>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs" style={{ color: "var(--ink-mute)" }}>{desc}</div>
      </div>
    </button>
  );
}

/* ===================================================================== */
function CategoriesManager({ data, onChange, canAct, logAudit, notify }) {
  const [editingSection, setEditingSection] = useState(null);
  const [newName, setNewName] = useState("");

  // RBAC kontrolleri (canAct yoksa hep true)
  const canCreate = canAct ? canAct("finance.categories.create") : true;
  const canUpdate = canAct ? canAct("finance.categories.update") : true;
  const canDelete = canAct ? canAct("finance.categories.delete") : true;

  const sections = [
    { key: "inflows",        label: "Tahsilat Kalemleri",         color: "#0f766e", desc: "Nakit Akış tablosundaki gelir kalemleri" },
    { key: "outflows",       label: "Ödeme Kalemleri",            color: "#b91c1c", desc: "Nakit Akış tablosundaki gider kalemleri" },
    { key: "nonPnlOutflows", label: "K/Z Harici Ödemeler",        color: "#b45309", desc: "Kredi anaparası, sermaye gibi kalemler" },
    { key: "kasaCategories", label: "Kasa Kategorileri",          color: "#0b3d2e", desc: "Kasa hareketlerinde kullanılır" },
  ];

  const add = async (sectionKey) => {
    if (!newName.trim()) return;
    const id = sectionKey.slice(0, 3) + "_" + Date.now();
    const next = { ...data, [sectionKey]: [...data[sectionKey], { id, name: newName.trim() }] };
    await onChange(next);
    await logAudit("category_add", { bölüm: sectionKey, ad: newName.trim() });
    notify("Kategori eklendi");
    setNewName(""); setEditingSection(null);
  };

  const rename = async (sectionKey, id, oldName, name) => {
    if (!name.trim() || name.trim() === oldName) return;
    const next = {
      ...data,
      [sectionKey]: data[sectionKey].map(c => c.id === id ? { ...c, name: name.trim() } : c),
    };
    await onChange(next);
    await logAudit("category_rename", { bölüm: sectionKey, eski: oldName, yeni: name.trim() });
    notify("Kategori adı güncellendi");
  };

  const remove = async (sectionKey, cat) => {
    if (!confirm(`"${cat.name}" kalemi ve tüm verileri silinecek. Emin misiniz?`)) return;
    // Also remove cell data
    const cells = { ...(data.cells || {}) };
    Object.keys(cells).forEach(k => { if (k.startsWith(cat.id + ":")) delete cells[k]; });
    const next = { ...data, [sectionKey]: data[sectionKey].filter(c => c.id !== cat.id), cells };
    await onChange(next);
    await logAudit("category_delete", { bölüm: sectionKey, ad: cat.name });
    notify("Kategori silindi");
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-1">Yapılandırma</div>
        <h1 className="display text-2xl md:text-3xl">Kategori Yönetimi</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
          Nakit akış tablosundaki tahsilat ve ödeme kalemlerini yönetin
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {sections.map(s => (
          <div key={s.key} className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: s.color }}/>
                <div>
                  <h3 className="display text-lg">{s.label}</h3>
                  {s.desc && <p className="text-xs mt-0.5" style={{ color: "var(--ink-mute)" }}>{s.desc}</p>}
                </div>
              </div>
              <span className="chip" style={{ background: "var(--bg)", color: "var(--ink-mute)" }}>
                {(data[s.key] || []).length}
              </span>
            </div>

            <div className="space-y-1 mb-3 max-h-80 overflow-y-auto">
              {(data[s.key] || []).map(c => (
                <CategoryRow key={c.id} cat={c} sectionKey={s.key}
                  onRename={rename} onRemove={remove}/>
              ))}
            </div>

            {editingSection === s.key ? (
              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
                <input className="input" autoFocus placeholder="Kategori adı..."
                  value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") add(s.key);
                    if (e.key === "Escape") { setEditingSection(null); setNewName(""); }
                  }}/>
                <button onClick={() => add(s.key)} className="btn btn-primary"><Check size={13}/></button>
                <button onClick={() => { setEditingSection(null); setNewName(""); }} className="btn btn-ghost"><X size={13}/></button>
              </div>
            ) : (
              <button onClick={() => { setEditingSection(s.key); setNewName(""); }}
                className="btn btn-ghost w-full justify-center mt-2">
                <Plus size={13}/> Kalem ekle
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ cat, sectionKey, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 rounded" style={{ background: "var(--bg)" }}>
        <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { onRename(sectionKey, cat.id, cat.name, name); setEditing(false); }
            if (e.key === "Escape") { setName(cat.name); setEditing(false); }
          }}/>
        <button onClick={() => { onRename(sectionKey, cat.id, cat.name, name); setEditing(false); }}
          className="p-1.5 rounded hover:bg-stone-200"><Check size={12}/></button>
        <button onClick={() => { setName(cat.name); setEditing(false); }}
          className="p-1.5 rounded hover:bg-stone-200"><X size={12}/></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 rounded text-sm group hover:bg-stone-50">
      <div className="flex-1 truncate">{cat.name}</div>
      <button onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-stone-200" title="Düzenle">
        <Edit3 size={11} style={{ color: "var(--ink-mute)" }}/>
      </button>
      <button onClick={() => onRemove(sectionKey, cat)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50" title="Sil">
        <Trash2 size={11} style={{ color: "var(--negative)" }}/>
      </button>
    </div>
  );
}

/* =====================================================================
   BANKALAR & HESAPLAR
===================================================================== */
function BanksManager({ data, session, canAct, onChange, logAudit, notify }) {
  // Yeni RBAC: canAct prop'u verilirse o üzerinden kontrol; yoksa eski sistem
  const canManage   = canAct ? canAct("finance.banks.update")  || can(session.role, "manage_banks")  : can(session.role, "manage_banks");
  const canCreate   = canAct ? canAct("finance.banks.create")  || can(session.role, "manage_banks")  : can(session.role, "manage_banks");
  const canDelete   = canAct ? canAct("finance.banks.delete")  || can(session.role, "manage_banks")  : can(session.role, "manage_banks");
  const canTransfer = canAct ? canAct("finance.transfers.create") || can(session.role, "manage_transfers") : can(session.role, "manage_transfers");
  const canEntry    = canAct ? canAct("finance.bank_entries.create") || can(session.role, "add_bank_entry") : can(session.role, "add_bank_entry");
  const canImport   = canAct ? canAct("finance.bank_entries.create") || can(session.role, "import_bank_excel") : can(session.role, "import_bank_excel");
  const dc = data.displayCurrency || "TRY";
  const rates = data.exchangeRates || {};
  const [expanded, setExpanded] = useState({});
  const [bankDraft, setBankDraft] = useState(null);
  const [accountDraft, setAccountDraft] = useState(null);
  const [transferPrefill, setTransferPrefill] = useState(null);
  // Banka hareketleri için
  const [entryDraft, setEntryDraft] = useState(null);          // { bankAccountId, ... }
  const [importingAccountId, setImportingAccountId] = useState(null);
  const [entriesView, setEntriesView] = useState({});          // { accId: boolean } - hareket panelini aç/kapat

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleEntriesView = (accId) => setEntriesView(prev => ({ ...prev, [accId]: !prev[accId] }));

  // Banka hareket ekle/sil
  const saveBankEntry = async () => {
    if (!entryDraft) return;
    if (!entryDraft.date) { alert("Tarih zorunlu"); return; }
    const amt = parseTRNumber(entryDraft.amount);
    if (!amt || amt <= 0) { alert("Geçerli tutar girin"); return; }
    const newEntry = {
      id: "be_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      bankAccountId: entryDraft.bankAccountId,
      date: entryDraft.date,
      valueDate: entryDraft.valueDate || null,
      type: entryDraft.type || "in",
      amount: amt,
      description: (entryDraft.description || "").trim(),
      category: (entryDraft.category || "").trim(),
      reference: (entryDraft.reference || "").trim(),
      cashflowCatId: entryDraft.cashflowCatId || null,
      committedToCells: false,
      source: "manual",
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    const updated = [...(data.bankEntries || []), newEntry];
    await onChange({ ...data, bankEntries: updated });
    await logAudit("bank_entry_add", {
      hesap: (data.bankAccounts || []).find(a => a.id === entryDraft.bankAccountId)?.name,
      tip: newEntry.type === "in" ? "giriş" : "çıkış",
      tutar: amt, açıklama: newEntry.description
    });
    notify("Hareket kaydedildi");
    setEntryDraft(null);
  };

  const removeBankEntry = async (entry) => {
    if (!confirm("Bu hareketi silmek istediğinizden emin misiniz?")) return;
    const updated = (data.bankEntries || []).filter(e => e.id !== entry.id);
    await onChange({ ...data, bankEntries: updated });
    await logAudit("bank_entry_delete", { tutar: entry.amount, açıklama: entry.description });
    notify("Hareket silindi");
  };

  const bulkImportEntries = async (entries) => {
    if (!entries || entries.length === 0) { notify("İçe aktarılacak kayıt yok", "err"); return; }
    const merged = [...(data.bankEntries || []), ...entries];
    await onChange({ ...data, bankEntries: merged });
    await logAudit("bank_entries_import", {
      hesap: (data.bankAccounts || []).find(a => a.id === entries[0]?.bankAccountId)?.name,
      adet: entries.length
    });
    notify(`${entries.length} hareket içe aktarıldı`);
    setImportingAccountId(null);
  };

  // Banka işlemleri
  const saveBankNew = async () => {
    if (!bankDraft.name.trim()) return notify("Banka adı zorunlu", "err");
    const newBank = {
      id: "bnk_" + Date.now(),
      name: bankDraft.name.trim(),
      code: bankDraft.code.trim() || bankDraft.name.slice(0, 3).toUpperCase(),
      color: bankDraft.color || "#1d4ed8",
    };
    await onChange({ ...data, banks: [...(data.banks || []), newBank] });
    await logAudit("bank_add", { banka: newBank.name });
    notify("Banka eklendi");
    setBankDraft(null);
  };

  const removeBank = async (bank) => {
    const accountsCount = (data.bankAccounts || []).filter(a => a.bankId === bank.id).length;
    const msg = accountsCount > 0
      ? `"${bank.name}" bankasını ve altındaki ${accountsCount} hesabı silmek istediğinizden emin misiniz?`
      : `"${bank.name}" bankasını silmek istediğinizden emin misiniz?`;
    if (!confirm(msg)) return;
    await onChange({
      ...data,
      banks: data.banks.filter(b => b.id !== bank.id),
      bankAccounts: (data.bankAccounts || []).filter(a => a.bankId !== bank.id),
    });
    await logAudit("bank_delete", { banka: bank.name });
    notify("Banka silindi");
  };

  // Hesap işlemleri
  const saveAccountNew = async () => {
    if (!accountDraft.name.trim() || !accountDraft.bankId) return notify("Hesap adı ve banka zorunlu", "err");
    const newAcc = {
      id: "acc_" + Date.now(),
      bankId: accountDraft.bankId,
      name: accountDraft.name.trim(),
      iban: (accountDraft.iban || "").replace(/\s+/g, "").toUpperCase(),
      currency: accountDraft.currency || "TRY",
      openingBalance: Number(accountDraft.openingBalance) || 0,
      cashflowCatId: accountDraft.cashflowCatId || null,
      active: true,
    };
    await onChange({ ...data, bankAccounts: [...(data.bankAccounts || []), newAcc] });
    await logAudit("account_add", { hesap: newAcc.name, iban: newAcc.iban, eşleşme: accountDraft.cashflowCatId || "—" });
    notify("Hesap eklendi");
    setAccountDraft(null);
  };

  const updateAccount = async (id, updates) => {
    await onChange({
      ...data,
      bankAccounts: data.bankAccounts.map(a => a.id === id ? { ...a, ...updates } : a),
    });
    await logAudit("account_edit", { hesap: id, ...updates });
    notify("Hesap güncellendi");
  };

  const removeAccount = async (acc) => {
    if (!confirm(`"${acc.name}" hesabını silmek istediğinizden emin misiniz?`)) return;
    await onChange({
      ...data,
      bankAccounts: data.bankAccounts.filter(a => a.id !== acc.id),
    });
    await logAudit("account_delete", { hesap: acc.name });
    notify("Hesap silindi");
  };

  // Toplam bakiye (TL bazlı, görüntüleme para birimine çevriliyor) — transferler dahil
  const totalBalanceTRY = (data.bankAccounts || []).reduce((sum, acc) => {
    const bal = computeBankAccountBalance(acc.id, data);
    return sum + convertToTRY(bal, acc.currency, rates);
  }, 0);

  const banksList = data.banks || [];
  const accounts = data.bankAccounts || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">Finansal Varlıklar</div>
          <h1 className="display text-2xl md:text-3xl">Bankalar & Hesaplar</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
            Tüm banka hesaplarınızı ve IBAN bilgilerinizi tek yerden yönetin
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canTransfer && accounts.length > 0 && (
            <button onClick={() => setTransferPrefill({ fromType: "bank", toType: "kasa" })} className="btn btn-ghost">
              <ArrowLeftRight size={13}/> Transfer
            </button>
          )}
          {canManage && (
            <button onClick={() => setBankDraft({ name: "", code: "", color: "#1d4ed8" })} className="btn btn-primary">
              <Plus size={13}/> Yeni Banka
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="Toplam Banka" value={banksList.length} icon={Landmark} accent="#1d4ed8" dc="TRY" rates={rates}/>
        <KpiCard label="Toplam Hesap" value={accounts.length} icon={CreditCard} accent="#0f766e" dc="TRY" rates={rates}/>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="label">Toplam Bakiye</div>
            <Banknote size={16} style={{ color: "#0f766e" }}/>
          </div>
          <div className="num display text-3xl flex items-baseline gap-1.5">
            {fmtMoneySign(totalBalanceTRY, dc, rates)}
            <span style={{ fontSize: 14, color: "var(--ink-mute)" }}>{CURRENCY_SYMBOLS[dc]}</span>
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>Tüm hesapların toplamı</div>
        </div>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="label">Para Birimi Dağılımı</div>
            <CircleDollarSign size={16} style={{ color: "#b45309" }}/>
          </div>
          <div className="text-xs space-y-1 mt-2">
            {["TRY", "USD", "EUR"].map(c => {
              const cnt = accounts.filter(a => a.currency === c).length;
              return cnt > 0 ? (
                <div key={c} className="flex justify-between">
                  <span>{CURRENCY_SYMBOLS[c]} {c}</span>
                  <span className="font-medium">{cnt} hesap</span>
                </div>
              ) : null;
            })}
            {accounts.length === 0 && <div style={{ color: "var(--ink-mute)" }}>Henüz hesap yok</div>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {banksList.length === 0 ? (
          <div className="card p-10 text-center" style={{ boxShadow: "var(--shadow)" }}>
            <Landmark size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
            <p className="text-sm" style={{ color: "var(--ink-mute)" }}>Henüz banka eklenmemiş.</p>
            {canManage && (
              <button onClick={() => setBankDraft({ name: "", code: "", color: "#1d4ed8" })} className="btn btn-primary mt-4">
                <Plus size={13}/> İlk bankayı ekle
              </button>
            )}
          </div>
        ) : banksList.map(bank => {
          const bankAccs = accounts.filter(a => a.bankId === bank.id);
          const bankTotal = bankAccs.reduce((s, a) => s + convertToTRY(computeBankAccountBalance(a.id, data), a.currency, rates), 0);
          const isOpen = expanded[bank.id] !== false; // default open
          return (
            <div key={bank.id} className="card overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-stone-50"
                onClick={() => toggleExpand(bank.id)}>
                <div className="flex items-center justify-center rounded text-white font-semibold text-xs"
                  style={{ background: bank.color, width: 40, height: 40 }}>
                  {bank.code}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{bank.name}</div>
                  <div className="text-xs" style={{ color: "var(--ink-mute)" }}>{bankAccs.length} hesap</div>
                </div>
                <div className="text-right">
                  <div className="num font-medium">{fmtMoneySign(bankTotal, dc, rates)} {CURRENCY_SYMBOLS[dc]}</div>
                  <div className="text-xs" style={{ color: "var(--ink-mute)" }}>toplam bakiye</div>
                </div>
                {canManage && (
                  <button onClick={(e) => { e.stopPropagation(); removeBank(bank); }}
                    className="p-1.5 rounded hover:bg-red-50">
                    <Trash2 size={12} style={{ color: "var(--negative)" }}/>
                  </button>
                )}
                {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              </div>

              {isOpen && (
                <div className="border-t" style={{ borderColor: "var(--line-soft)" }}>
                  {bankAccs.length === 0 ? (
                    <div className="p-4 text-center text-xs" style={{ color: "var(--ink-mute)" }}>
                      Bu banka için hesap eklenmemiş
                    </div>
                  ) : (
                    <table className="grid">
                      <thead>
                        <tr>
                          <th className="label-cell" style={{ width: "30%" }}>Hesap Adı</th>
                          <th className="label-cell" style={{ width: "35%" }}>IBAN</th>
                          <th className="label-cell" style={{ width: 70 }}>Birim</th>
                          <th style={{ width: 140 }}>Bakiye</th>
                          {(canManage || canTransfer || canEntry || canImport) && <th style={{ width: 150 }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {bankAccs.map(acc => {
                          const entryCount = (data.bankEntries || []).filter(e => e.bankAccountId === acc.id).length;
                          return (
                            <React.Fragment key={acc.id}>
                              <AccountRow acc={acc}
                                canManage={canManage} canTransfer={canTransfer}
                                canEntry={canEntry} canImport={canImport}
                                onUpdate={updateAccount} onRemove={removeAccount}
                                onTransfer={(a) => setTransferPrefill({ fromType: "bank", fromId: a.id, toType: "kasa" })}
                                onAddEntry={(a) => setEntryDraft({
                                  bankAccountId: a.id,
                                  date: new Date().toISOString().slice(0, 10),
                                  type: "out", amount: "", description: "", category: "", reference: "",
                                  cashflowCatId: a.cashflowCatId || ""
                                })}
                                onImport={(a) => setImportingAccountId(a.id)}
                                onShowEntries={(a) => toggleEntriesView(a.id)}
                                entryCount={entryCount}
                                dc={dc} rates={rates} data={data}/>
                              {entriesView[acc.id] && (
                                <tr>
                                  <td colSpan={(canManage || canTransfer || canEntry || canImport) ? 5 : 4}
                                    style={{ padding: 0, background: "var(--bg)" }}>
                                    <BankAccountEntries
                                      account={acc} data={data}
                                      onDelete={removeBankEntry}
                                      canEntry={canEntry}
                                      cashflowCats={[...(data?.inflows || []), ...(data?.outflows || []), ...(data?.nonPnlOutflows || [])]}
                                      onPatchEntry={async (entry, patch) => {
                                        const updated = (data.bankEntries || []).map(e =>
                                          e.id === entry.id ? { ...e, ...patch } : e
                                        );
                                        await onChange({ ...data, bankEntries: updated });
                                      }}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {canManage && (
                    <div className="p-3 border-t" style={{ borderColor: "var(--line-soft)", background: "var(--bg)" }}>
                      <button onClick={() => setAccountDraft({ bankId: bank.id, name: "", iban: "", currency: "TRY", openingBalance: 0, cashflowCatId: "" })}
                        className="btn btn-ghost text-xs">
                        <Plus size={12}/> Hesap ekle
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Banka ekleme modali */}
      {bankDraft && (
        <Modal title="Yeni Banka Ekle" onClose={() => setBankDraft(null)}
          onSave={saveBankNew} icon={Landmark}>
          <div className="space-y-3">
            <div>
              <div className="label mb-1">Banka Adı *</div>
              <input className="input" autoFocus value={bankDraft.name}
                onChange={e => setBankDraft({ ...bankDraft, name: e.target.value })}
                placeholder="Örn: Akbank"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Kısa Kod</div>
                <input className="input mono uppercase" value={bankDraft.code}
                  onChange={e => setBankDraft({ ...bankDraft, code: e.target.value.toUpperCase().slice(0, 4) })}
                  placeholder="AKB"/>
              </div>
              <div>
                <div className="label mb-1">Renk</div>
                <input className="input" type="color" value={bankDraft.color}
                  onChange={e => setBankDraft({ ...bankDraft, color: e.target.value })}
                  style={{ padding: 4, height: 36 }}/>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Hesap ekleme modali */}
      {accountDraft && (
        <Modal title="Yeni Hesap Ekle" onClose={() => setAccountDraft(null)}
          onSave={saveAccountNew} icon={CreditCard}>
          <div className="space-y-3">
            <div>
              <div className="label mb-1">Hesap Adı *</div>
              <input className="input" autoFocus value={accountDraft.name}
                onChange={e => setAccountDraft({ ...accountDraft, name: e.target.value })}
                placeholder="Örn: Ana Vadesiz TL Hesabı"/>
            </div>
            <div>
              <div className="label mb-1">IBAN</div>
              <input className="input mono" value={accountDraft.iban}
                onChange={e => setAccountDraft({ ...accountDraft, iban: e.target.value.toUpperCase() })}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                maxLength="34"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Para Birimi</div>
                <select className="input" value={accountDraft.currency}
                  onChange={e => setAccountDraft({ ...accountDraft, currency: e.target.value })}>
                  <option value="TRY">{CURRENCY_SYMBOLS.TRY} Türk Lirası</option>
                  <option value="USD">{CURRENCY_SYMBOLS.USD} ABD Doları</option>
                  <option value="EUR">{CURRENCY_SYMBOLS.EUR} Euro</option>
                </select>
              </div>
              <div>
                <div className="label mb-1">Açılış Bakiyesi</div>
                <input className="input num" type="number" value={accountDraft.openingBalance}
                  onChange={e => setAccountDraft({ ...accountDraft, openingBalance: e.target.value })}/>
              </div>
            </div>
            <div>
              <div className="label mb-1">Nakit Akış Kalemi Eşleştirme</div>
              <select className="input" value={accountDraft.cashflowCatId || ""}
                onChange={e => setAccountDraft({ ...accountDraft, cashflowCatId: e.target.value })}>
                <option value="">— Otomatik eşleştirme yok —</option>
                <optgroup label="Tahsilat Kalemleri">
                  {(data.inflows || []).map(c => (
                    <option key={c.id} value={c.id}>↓ {c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Ödeme Kalemleri">
                  {(data.outflows || []).map(c => (
                    <option key={c.id} value={c.id}>↑ {c.name}</option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Bu hesaptan yapılan ödemeler/tahsilatlar otomatik olarak bu kaleme bağlanır
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer modali */}
      {transferPrefill && (
        <TransferModal
          data={data}
          prefill={transferPrefill}
          onClose={() => setTransferPrefill(null)}
          onSave={async (formData) => {
            const newT = {
              id: "trf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
              ts: new Date().toISOString(),
              userId: session.userId,
              ...formData,
            };
            await onChange({ ...data, transfers: [...(data.transfers || []), newT] });
            const fromName = getEndpointInfo(newT.fromType, newT.fromId, data).shortName;
            const toName = getEndpointInfo(newT.toType, newT.toId, data).shortName;
            await logAudit("transfer_add", {
              kaynak: fromName, hedef: toName,
              tutar: newT.fromAmount, birim: newT.fromCurrency,
              açıklama: newT.description || "—",
            });
            notify(`Transfer kaydedildi: ${fromName} → ${toName}`);
            setTransferPrefill(null);
          }}
        />
      )}

      {/* Banka hareketi ekleme modali */}
      {entryDraft && (
        <BankEntryModal
          draft={entryDraft} setDraft={setEntryDraft}
          account={(data.bankAccounts || []).find(a => a.id === entryDraft.bankAccountId)}
          cashflowCats={[...(data?.inflows || []), ...(data?.outflows || []), ...(data?.nonPnlOutflows || [])]}
          onClose={() => setEntryDraft(null)}
          onSave={saveBankEntry}
        />
      )}

      {/* Excel import modali */}
      {importingAccountId && (
        <BankExcelImportModal
          account={(data.bankAccounts || []).find(a => a.id === importingAccountId)}
          cashflowCats={[...(data?.inflows || []), ...(data?.outflows || []), ...(data?.nonPnlOutflows || [])]}
          existingEntries={(data.bankEntries || []).filter(e => e.bankAccountId === importingAccountId)}
          username={session.username}
          onClose={() => setImportingAccountId(null)}
          onConfirm={bulkImportEntries}
        />
      )}
    </div>
  );
}

function AccountRow({ acc, canManage, canTransfer, canEntry, canImport, onUpdate, onRemove, onTransfer, onAddEntry, onImport, onShowEntries, entryCount = 0, dc, rates, data }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(acc);
  const sym = CURRENCY_SYMBOLS[acc.currency];

  const copyIban = () => {
    if (acc.iban) {
      navigator.clipboard?.writeText(acc.iban);
    }
  };

  if (editing) {
    return (
      <tr style={{ background: "#fff8e1" }}>
        <td><input className="input" value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}/></td>
        <td><input className="input mono" value={draft.iban}
          onChange={e => setDraft({ ...draft, iban: e.target.value.toUpperCase() })}/></td>
        <td>
          <select className="input" value={draft.currency}
            onChange={e => setDraft({ ...draft, currency: e.target.value })}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </td>
        <td><input className="input num text-right" type="number" value={draft.openingBalance}
          onChange={e => setDraft({ ...draft, openingBalance: e.target.value })}/></td>
        <td>
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => { onUpdate(acc.id, { name: draft.name, iban: draft.iban.replace(/\s+/g, ""), currency: draft.currency, openingBalance: Number(draft.openingBalance) || 0 }); setEditing(false); }}
              className="btn btn-primary"><Check size={11}/></button>
            <button onClick={() => { setDraft(acc); setEditing(false); }}
              className="btn btn-ghost"><X size={11}/></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="label-cell font-medium text-xs">
        <div>{acc.name}</div>
        {acc.cashflowCatId && (() => {
          const cat = [...(data?.inflows || []), ...(data?.outflows || [])].find(c => c.id === acc.cashflowCatId);
          if (!cat) return null;
          const isInflow = (data?.inflows || []).some(c => c.id === acc.cashflowCatId);
          return (
            <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: isInflow ? "#0f766e" : "#b45309" }}>
              <Tag size={9}/>
              <span className="truncate" style={{ maxWidth: 200 }}>{cat.name}</span>
            </div>
          );
        })()}
      </td>
      <td className="label-cell mono text-xs" style={{ color: "var(--ink-soft)" }}>
        <div className="flex items-center gap-2">
          <span>{acc.iban ? acc.iban.replace(/(.{4})/g, "$1 ").trim() : "—"}</span>
          {acc.iban && (
            <button onClick={copyIban} className="opacity-40 hover:opacity-100" title="IBAN kopyala">
              <Copy size={10}/>
            </button>
          )}
        </div>
      </td>
      <td className="label-cell">
        <span className="chip" style={{ background: "var(--bg)", color: "var(--ink-soft)" }}>
          {sym} {acc.currency}
        </span>
      </td>
      <td className="num text-xs">
        {(() => {
          const liveBalance = data ? computeBankAccountBalance(acc.id, data) : acc.openingBalance;
          const transfersAffected = liveBalance !== Number(acc.openingBalance);
          return (
            <>
              <div className="font-medium" style={{ color: liveBalance < 0 ? "var(--negative)" : "var(--ink)" }}>
                {fmtTLSign(liveBalance)} {sym}
              </div>
              {transfersAffected && (
                <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                  açılış: {fmtTL(acc.openingBalance) || "0"} {sym}
                </div>
              )}
              {acc.currency !== dc && (
                <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                  ≈ {fmtMoney(convertToTRY(liveBalance, acc.currency, rates), dc, rates)} {CURRENCY_SYMBOLS[dc]}
                </div>
              )}
            </>
          );
        })()}
      </td>
      {(canManage || canTransfer || canEntry || canImport) && (
        <td>
          <div className="flex items-center gap-1 justify-end">
            {canEntry && (
              <button onClick={() => onShowEntries && onShowEntries(acc)}
                className="p-1.5 rounded hover:bg-stone-100" title="Hareketleri Göster/Gizle">
                <Receipt size={11} style={{ color: "var(--ink-soft)" }}/>
                {entryCount > 0 && (
                  <span className="ml-1 text-xs" style={{ color: "var(--ink-mute)" }}>{entryCount}</span>
                )}
              </button>
            )}
            {canImport && (
              <button onClick={() => onImport && onImport(acc)}
                className="p-1.5 rounded hover:bg-stone-100" title="Excel'den İçe Aktar">
                <FileUp size={11} style={{ color: "#0f766e" }}/>
              </button>
            )}
            {canEntry && (
              <button onClick={() => onAddEntry && onAddEntry(acc)}
                className="p-1.5 rounded hover:bg-stone-100" title="Hareket Ekle">
                <Plus size={11} style={{ color: "var(--accent)" }}/>
              </button>
            )}
            {canTransfer && (
              <button onClick={() => onTransfer && onTransfer(acc)} className="p-1.5 rounded hover:bg-stone-100" title="Transfer">
                <ArrowLeftRight size={11} style={{ color: "var(--accent)" }}/>
              </button>
            )}
            {canManage && (
              <>
                <button onClick={() => { setDraft(acc); setEditing(true); }}
                  className="p-1.5 rounded hover:bg-stone-100"><Edit3 size={11}/></button>
                <button onClick={() => onRemove(acc)} className="p-1.5 rounded hover:bg-red-50">
                  <Trash2 size={11} style={{ color: "var(--negative)" }}/>
                </button>
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

/* ---------- Banka Hesap Hareketleri Paneli (AccountRow altında açılan) ---------- */
function BankAccountEntries({ account, data, canEntry, cashflowCats, onDelete, onPatchEntry }) {
  const [filter, setFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const entries = useMemo(() => {
    let list = (data.bankEntries || []).filter(e => e.bankAccountId === account.id);
    if (from) list = list.filter(e => e.date >= from);
    if (to)   list = list.filter(e => e.date <= to);
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(e =>
        (e.description || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q) ||
        (e.reference || "").toLowerCase().includes(q));
    }
    return list.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  }, [data.bankEntries, account.id, filter, from, to]);

  // Running balance ileri sıralı hesaplanır, sonra reverse'lenir
  const withBalance = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
    let running = Number(account.openingBalance) || 0;
    const out = sorted.map(e => {
      running += (e.type === "in" ? 1 : -1) * (Number(e.amount) || 0);
      return { ...e, runningBalance: running };
    });
    out.reverse();
    return out;
  }, [entries, account.openingBalance]);

  const sym = CURRENCY_SYMBOLS[account.currency];
  const totalIn = entries.filter(e => e.type === "in").reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalOut = entries.filter(e => e.type === "out").reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="p-3" style={{ borderTop: "1px solid var(--line-soft)" }}>
      {/* Filtre + özet */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input type="date" className="input text-xs" style={{ width: 130 }}
          value={from} onChange={e => setFrom(e.target.value)} placeholder="Başlangıç"/>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>—</span>
        <input type="date" className="input text-xs" style={{ width: 130 }}
          value={to} onChange={e => setTo(e.target.value)} placeholder="Bitiş"/>
        <input className="input text-xs flex-1 min-w-[200px]" placeholder="Açıklama/kategori ara..."
          value={filter} onChange={e => setFilter(e.target.value)}/>
        <div className="text-xs ml-auto flex items-center gap-3">
          <span><span style={{ color: "#0f766e" }}>↓</span> {fmtTL2(totalIn)} {sym}</span>
          <span><span style={{ color: "#b91c1c" }}>↑</span> {fmtTL2(totalOut)} {sym}</span>
          <span style={{ color: "var(--ink-mute)" }}>· {entries.length} kayıt</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-6 text-xs" style={{ color: "var(--ink-mute)" }}>
          Bu hesap için kayıtlı hareket bulunamadı.
          <span className="block mt-1">Hareketleri Excel'den içe aktarmak için tablo başındaki <FileUp size={11} style={{display:"inline"}}/> butonunu kullanın.</span>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ maxHeight: 400 }}>
          <table className="grid w-full text-xs">
            <thead style={{ position: "sticky", top: 0, background: "var(--paper)", zIndex: 1 }}>
              <tr>
                <th className="label-cell" style={{ width: 90 }}>Tarih</th>
                <th className="label-cell">Açıklama</th>
                <th className="label-cell" style={{ width: 110 }}>Kategori</th>
                <th className="label-cell" style={{ width: 130 }}>NA Kalemi</th>
                <th style={{ width: 110 }}>Tutar</th>
                <th style={{ width: 110 }}>Bakiye</th>
                <th className="label-cell" style={{ width: 60 }}>Yansıtma</th>
                {canEntry && <th style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {withBalance.map(e => {
                const isIn = e.type === "in";
                return (
                  <tr key={e.id}>
                    <td className="label-cell mono">{new Date(e.date).toLocaleDateString("tr-TR")}</td>
                    <td className="label-cell">
                      {e.description || <span style={{ color: "var(--ink-mute)" }}>—</span>}
                      {e.reference && (
                        <span className="ml-2 text-xs mono" style={{ color: "var(--ink-mute)" }}>#{e.reference}</span>
                      )}
                      {e.source === "excel" && (
                        <span className="ml-1 text-xs px-1 rounded" style={{ background: "#dcfce7", color: "#15803d" }}>Excel</span>
                      )}
                    </td>
                    <td className="label-cell">
                      {canEntry ? (
                        <input className="input text-xs"
                          value={e.category || ""}
                          onChange={ev => onPatchEntry(e, { category: ev.target.value })}
                          placeholder="—"/>
                      ) : (e.category || "—")}
                    </td>
                    <td className="label-cell">
                      {canEntry ? (
                        <select className="input text-xs"
                          value={e.cashflowCatId || ""}
                          onChange={ev => onPatchEntry(e, { cashflowCatId: ev.target.value || null })}>
                          <option value="">—</option>
                          {cashflowCats.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        cashflowCats.find(c => c.id === e.cashflowCatId)?.name || "—"
                      )}
                    </td>
                    <td className="num mono text-right" style={{ color: isIn ? "#0f766e" : "#b91c1c" }}>
                      {isIn ? "+" : "−"}{fmtTL2(e.amount)} {sym}
                    </td>
                    <td className="num mono text-right" style={{ color: "var(--ink-mute)" }}>
                      {fmtTLSign2(e.runningBalance)}
                    </td>
                    <td className="label-cell text-center">
                      {e.committedToCells ? (
                        <span className="text-xs" style={{ color: "#0f766e" }} title={e.committedAt}>✓</span>
                      ) : e.cashflowCatId ? (
                        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>○</span>
                      ) : "—"}
                    </td>
                    {canEntry && (
                      <td className="label-cell">
                        <button onClick={() => onDelete(e)}
                          className="p-1 rounded hover:bg-red-50">
                          <Trash2 size={10} style={{ color: "var(--negative)" }}/>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Banka Hareketi Modal (manuel ekleme) ---------- */
function BankEntryModal({ draft, setDraft, account, cashflowCats, onClose, onSave }) {
  const sym = CURRENCY_SYMBOLS[account?.currency || "TRY"];
  return (
    <Modal title={`Hareket Ekle · ${account?.name || ""}`} icon={Plus}
      onClose={onClose} onSave={onSave} maxWidth="max-w-lg">
      <div className="space-y-3">
        <div>
          <div className="label mb-2">Hareket Tipi *</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "in",  label: "Giriş (Alacak)",   color: "#0f766e" },
              { v: "out", label: "Çıkış (Borç)",     color: "#b91c1c" },
            ].map(opt => (
              <button key={opt.v} type="button"
                onClick={() => setDraft({ ...draft, type: opt.v })}
                className="px-3 py-2 rounded text-xs font-medium transition-all border"
                style={{
                  background: draft.type === opt.v ? opt.color : "var(--paper)",
                  color: draft.type === opt.v ? "#fff" : "var(--ink)",
                  borderColor: draft.type === opt.v ? opt.color : "var(--line)",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Tarih *</div>
            <input className="input w-full" type="date"
              value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Tutar ({sym}) *</div>
            <input className="input w-full mono text-right" type="text" placeholder="0,00"
              value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })}
              onBlur={e => {
                // Türk format'a normalize et: girilen değeri parse edip 2 ondalıklı göster
                const parsed = parseTRNumber(e.target.value);
                if (parsed > 0) {
                  setDraft({ ...draft, amount: fmtTL2(parsed) });
                }
              }}/>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Format: 1.234,56 (nokta binlik, virgül ondalık)
            </div>
          </div>
        </div>
        <div>
          <div className="label mb-1">Açıklama</div>
          <input className="input w-full"
            value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Kategori</div>
            <input className="input w-full" placeholder="Örn: Personel ödemesi"
              value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Referans / Fiş No</div>
            <input className="input w-full mono text-xs"
              value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })}/>
          </div>
        </div>
        <div>
          <div className="label mb-1">Nakit Akış Kalemi</div>
          <select className="input w-full"
            value={draft.cashflowCatId} onChange={e => setDraft({ ...draft, cashflowCatId: e.target.value })}>
            <option value="">— (yansıtma yok)</option>
            {cashflowCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            Boş bırakırsanız nakit akış tablosuna yansımaz
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Banka Excel Import Modal ---------- */
function BankExcelImportModal({ account, cashflowCats, existingEntries, username, onClose, onConfirm }) {
  const [step, setStep] = useState("upload"); // upload | mapping | preview
  const [rawRows, setRawRows] = useState([]);
  const [headerIdx, setHeaderIdx] = useState(0);
  const [columnMap, setColumnMap] = useState({ date: -1, valueDate: -1, description: -1, amount: -1, debit: -1, credit: -1, balance: -1, reference: -1 });
  const [parsedEntries, setParsedEntries] = useState([]);
  const [defaultCashflowCatId, setDefaultCashflowCatId] = useState(account?.cashflowCatId || "");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [err, setErr] = useState(null);

  const sym = CURRENCY_SYMBOLS[account?.currency || "TRY"];

  // Excel dosyası yükle
  const handleFile = async (file) => {
    setErr(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
      if (rows.length < 2) throw new Error("Dosya boş veya çok kısa");
      setRawRows(rows);

      // Otomatik tespit
      const detected = findHeaderAndRows(rows);
      if (detected) {
        setHeaderIdx(detected.headerIdx);
        setColumnMap(detected.columnMap);
        setStep("mapping");
      } else {
        // Manuel mapping gerekli
        setHeaderIdx(0);
        setStep("mapping");
      }
    } catch (e) {
      setErr("Excel okuma hatası: " + e.message);
    }
  };

  // Mapping sonrası satırları parse et ve önizlemeye geç
  const proceedToPreview = () => {
    if (columnMap.date < 0) { alert("Tarih sütunu seçilmeli"); return; }
    if (columnMap.amount < 0 && columnMap.debit < 0 && columnMap.credit < 0) {
      alert("Tutar veya Borç/Alacak sütunu seçilmeli"); return;
    }
    const dataRows = rawRows.slice(headerIdx + 1);
    const parsed = [];
    dataRows.forEach((row, i) => {
      if (!Array.isArray(row) || row.length === 0) return;
      const r = parseExcelRow(row, columnMap);
      if (!r.date) return;          // tarihsiz satır atla
      if (r.amount === 0) return;   // sıfır tutar atla
      parsed.push({
        ...r,
        _rowIdx: i,
        cashflowCatId: defaultCashflowCatId || null,
        _selected: true,
      });
    });
    setParsedEntries(parsed);
    setStep("preview");
  };

  // Onayla → bulkImportEntries'e gönder
  const confirmImport = () => {
    let selected = parsedEntries.filter(p => p._selected);
    // Dublike kontrolü: aynı tarih + tutar + açıklama
    if (skipDuplicates && existingEntries.length > 0) {
      selected = selected.filter(p => !existingEntries.some(e =>
        e.date === p.date &&
        Math.abs(Number(e.amount) - p.amount) < 0.001 &&
        (e.description || "").trim() === (p.description || "").trim()
      ));
    }
    if (selected.length === 0) { alert("İçe aktarılacak yeni kayıt yok (dublikeler atlandı)"); return; }
    const now = new Date().toISOString();
    const entries = selected.map((p, i) => ({
      id: "be_" + Date.now() + "_" + i,
      bankAccountId: account.id,
      date: p.date,
      valueDate: p.valueDate || null,
      type: p.type,
      amount: p.amount,
      description: p.description || "",
      category: "",
      reference: p.reference || "",
      cashflowCatId: p.cashflowCatId || null,
      committedToCells: false,
      source: "excel",
      importedBalance: p.balance,
      createdAt: now,
      createdBy: username,
    }));
    onConfirm(entries);
  };

  const headers = rawRows[headerIdx] || [];
  const previewRows = rawRows.slice(headerIdx + 1, headerIdx + 6);  // ilk 5 satır

  return (
    <Modal title={`Excel'den İçe Aktar · ${account?.name || ""}`} icon={FileUp}
      onClose={onClose}
      onSave={step === "preview" ? confirmImport : (step === "mapping" ? proceedToPreview : null)}
      saveLabel={step === "preview" ? "İçe Aktar" : "İleri →"}
      maxWidth="max-w-5xl">
      <div className="space-y-4">
        {err && (
          <div className="p-3 rounded text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
            {err}
          </div>
        )}

        {/* ============ STEP 1: UPLOAD ============ */}
        {step === "upload" && (
          <div>
            <div className="card p-6 text-center" style={{ background: "var(--bg)", border: "2px dashed var(--line)" }}>
              <FileSpreadsheet size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
              <div className="font-semibold mb-1">Banka extresini yükle</div>
              <div className="text-xs mb-4" style={{ color: "var(--ink-mute)" }}>
                .xlsx, .xls veya .csv formatında, bankadan indirilen dosya
              </div>
              <label className="btn btn-primary inline-flex items-center cursor-pointer">
                <Upload size={13}/> Dosya Seç
                <input type="file" hidden accept=".xlsx,.xls,.csv,.xlsm"
                  onChange={e => e.target.files[0] && handleFile(e.target.files[0])}/>
              </label>
              <div className="text-xs mt-4" style={{ color: "var(--ink-mute)" }}>
                Sütunlar otomatik tanınır (YKB, Garanti, İş Bankası, TEB, Akbank, Halkbank, vb.)
              </div>
            </div>
          </div>
        )}

        {/* ============ STEP 2: COLUMN MAPPING ============ */}
        {step === "mapping" && (
          <div className="space-y-3">
            <div className="card p-3 text-xs flex items-center gap-2" style={{ background: "var(--bg)" }}>
              <Info size={12} style={{ color: "#1d4ed8" }}/>
              <span>Toplam <b>{rawRows.length}</b> satır okundu. Sütun başlığı satırını ve her bir alanı doğrulayın.</span>
            </div>

            <div>
              <div className="label mb-1">Başlık Satırı (#{headerIdx + 1})</div>
              <input type="number" className="input" min="0" max={Math.min(20, rawRows.length - 1)}
                value={headerIdx}
                onChange={e => setHeaderIdx(Math.max(0, Math.min(rawRows.length - 1, parseInt(e.target.value) || 0)))}/>
              <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Excel'in hangi satırı sütun başlığı olarak içerdiği (0 = ilk satır)
              </div>
            </div>

            {/* Sütun eşleştirme */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ColumnPicker label="Tarih *" required value={columnMap.date} headers={headers}
                onChange={v => setColumnMap({ ...columnMap, date: v })}/>
              <ColumnPicker label="Valör Tarihi" value={columnMap.valueDate} headers={headers}
                onChange={v => setColumnMap({ ...columnMap, valueDate: v })}/>
              <ColumnPicker label="Açıklama" value={columnMap.description} headers={headers}
                onChange={v => setColumnMap({ ...columnMap, description: v })}/>
              <ColumnPicker label="Referans / Fiş No" value={columnMap.reference} headers={headers}
                onChange={v => setColumnMap({ ...columnMap, reference: v })}/>
            </div>

            <div className="card p-3" style={{ background: "var(--bg)" }}>
              <div className="text-xs font-semibold mb-2">Tutar Sütunu — biri seçilmeli</div>
              <div className="text-xs mb-2" style={{ color: "var(--ink-mute)" }}>
                Bankalar farklı format kullanır: ya tek "Tutar" sütunu (negatif = çıkış), ya da ayrı "Borç" + "Alacak" sütunları
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ColumnPicker label="Tek Tutar Sütunu" value={columnMap.amount} headers={headers}
                  onChange={v => setColumnMap({ ...columnMap, amount: v, debit: v >= 0 ? -1 : columnMap.debit, credit: v >= 0 ? -1 : columnMap.credit })}/>
                <ColumnPicker label="Borç (Çıkış)" value={columnMap.debit} headers={headers}
                  onChange={v => setColumnMap({ ...columnMap, debit: v, amount: v >= 0 ? -1 : columnMap.amount })}/>
                <ColumnPicker label="Alacak (Giriş)" value={columnMap.credit} headers={headers}
                  onChange={v => setColumnMap({ ...columnMap, credit: v, amount: v >= 0 ? -1 : columnMap.amount })}/>
              </div>
            </div>

            <ColumnPicker label="Bakiye (opsiyonel, kontrol için)" value={columnMap.balance} headers={headers}
              onChange={v => setColumnMap({ ...columnMap, balance: v })}/>

            <div>
              <div className="label mb-1">Varsayılan Nakit Akış Kalemi</div>
              <select className="input w-full" value={defaultCashflowCatId}
                onChange={e => setDefaultCashflowCatId(e.target.value)}>
                <option value="">— (önce yansıtma yapma)</option>
                {cashflowCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Tüm içe aktarılan hareketler bu kaleme bağlanacak. Sonradan tek tek değiştirebilirsiniz.
              </div>
            </div>

            {/* Önizleme — ham satırlar */}
            <div>
              <div className="label mb-1 text-xs">Ham Veri Önizlemesi</div>
              <div className="overflow-x-auto card" style={{ maxHeight: 200 }}>
                <table className="grid w-full text-xs">
                  <thead style={{ position: "sticky", top: 0, background: "var(--paper)" }}>
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="label-cell" style={{
                          background: Object.values(columnMap).includes(i) ? "var(--accent-soft)" : undefined,
                          color: Object.values(columnMap).includes(i) ? "var(--accent)" : undefined,
                        }}>{String(h || "(boş)")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {headers.map((_, j) => (
                          <td key={j} className="label-cell mono text-xs"
                            style={{
                              background: Object.values(columnMap).includes(j) ? "rgba(220, 38, 38, 0.05)" : undefined,
                              textAlign: typeof row[j] === "number" ? "right" : "left",
                            }}>
                            {fmtCellValue(row[j])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============ STEP 3: PREVIEW & CONFIRM ============ */}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="card p-3 flex items-center gap-3 flex-wrap" style={{ background: "var(--bg)" }}>
              <div className="text-xs space-x-2">
                <span><span style={{ color: "var(--ink-mute)" }}>Bulunan kayıt:</span> <b>{parsedEntries.length}</b></span>
                <span style={{ color: "var(--ink-mute)" }}>·</span>
                <span><span style={{ color: "#0f766e" }}>↓</span> <b>{parsedEntries.filter(p => p._selected && p.type === "in").length}</b> giriş /
                  <span className="mono ml-1">{fmtTL2(parsedEntries.filter(p => p._selected && p.type === "in").reduce((s, p) => s + p.amount, 0))} {sym}</span></span>
                <span style={{ color: "var(--ink-mute)" }}>·</span>
                <span><span style={{ color: "#b91c1c" }}>↑</span> <b>{parsedEntries.filter(p => p._selected && p.type === "out").length}</b> çıkış /
                  <span className="mono ml-1">{fmtTL2(parsedEntries.filter(p => p._selected && p.type === "out").reduce((s, p) => s + p.amount, 0))} {sym}</span></span>
              </div>
              <label className="ml-auto flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)}/>
                Dublikeleri atla (aynı tarih+tutar+açıklama)
              </label>
              <button onClick={() => {
                const allSel = parsedEntries.every(p => p._selected);
                setParsedEntries(parsedEntries.map(p => ({ ...p, _selected: !allSel })));
              }} className="btn btn-ghost text-xs">
                {parsedEntries.every(p => p._selected) ? "Hiçbirini seçme" : "Tümünü seç"}
              </button>
            </div>

            <div className="overflow-x-auto card" style={{ maxHeight: 400 }}>
              <table className="grid w-full text-xs">
                <thead style={{ position: "sticky", top: 0, background: "var(--paper)", zIndex: 1 }}>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th className="label-cell" style={{ width: 90 }}>Tarih</th>
                    <th className="label-cell">Açıklama</th>
                    <th className="label-cell" style={{ width: 130 }}>NA Kalemi</th>
                    <th style={{ width: 110 }}>Tutar</th>
                    <th className="label-cell" style={{ width: 50 }}>Tip</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedEntries.map((p, i) => (
                    <tr key={i} style={{ opacity: p._selected ? 1 : 0.4 }}>
                      <td className="label-cell text-center">
                        <input type="checkbox" checked={p._selected}
                          onChange={e => {
                            const copy = [...parsedEntries];
                            copy[i] = { ...copy[i], _selected: e.target.checked };
                            setParsedEntries(copy);
                          }}/>
                      </td>
                      <td className="label-cell mono">{new Date(p.date).toLocaleDateString("tr-TR")}</td>
                      <td className="label-cell">{p.description || <span style={{ color: "var(--ink-mute)" }}>—</span>}</td>
                      <td className="label-cell">
                        <select className="input text-xs" value={p.cashflowCatId || ""}
                          onChange={e => {
                            const copy = [...parsedEntries];
                            copy[i] = { ...copy[i], cashflowCatId: e.target.value || null };
                            setParsedEntries(copy);
                          }}>
                          <option value="">—</option>
                          {cashflowCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="num mono text-right" style={{ color: p.type === "in" ? "#0f766e" : "#b91c1c" }}>
                        {p.type === "in" ? "+" : "−"}{fmtTL2(p.amount)} {sym}
                      </td>
                      <td className="label-cell text-center">
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: p.type === "in" ? "#dcfce7" : "#fee2e2", color: p.type === "in" ? "#15803d" : "#991b1b" }}>
                          {p.type === "in" ? "↓" : "↑"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card p-3 text-xs flex items-center gap-2" style={{ background: "#fef3c7", borderLeft: "3px solid #d97706" }}>
              <AlertTriangle size={12} style={{ color: "#854d0e" }}/>
              <span style={{ color: "#854d0e" }}>
                İçe aktarılan hareketler hesap bakiyesini değiştirir. NA kalemi atanan hareketler nakit akış tablosuna projeksiyon olarak yansır.
              </span>
            </div>

            <div className="flex justify-start">
              <button onClick={() => setStep("mapping")} className="btn btn-ghost text-xs">
                ← Geri
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Sütun seçici küçük komponenti
function ColumnPicker({ label, value, headers, onChange, required }) {
  return (
    <div>
      <div className="label mb-1 text-xs">{label}</div>
      <select className="input w-full text-xs"
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ background: value >= 0 ? "var(--accent-soft)" : undefined }}>
        <option value={-1}>— Yok —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>{i + 1}. {String(h || `(sütun ${i + 1})`)}</option>
        ))}
      </select>
    </div>
  );
}

/* =====================================================================
   KASA
===================================================================== */
function KasaManager({ data, session, canAct, onChange, logAudit, notify }) {
  const canManage   = canAct ? canAct("finance.kasa.update")  || can(session.role, "manage_kasa")     : can(session.role, "manage_kasa");
  const canCreate   = canAct ? canAct("finance.kasa.create")  || can(session.role, "manage_kasa")     : can(session.role, "manage_kasa");
  const canDelete   = canAct ? canAct("finance.kasa.delete")  || can(session.role, "manage_kasa")     : can(session.role, "manage_kasa");
  const canAdd      = canAct ? canAct("finance.kasa.create")  || can(session.role, "add_kasa_entry")  : can(session.role, "add_kasa_entry");
  const canTransfer = canAct ? canAct("finance.transfers.create") || can(session.role, "manage_transfers") : can(session.role, "manage_transfers");
  const dc = data.displayCurrency || "TRY";
  const rates = data.exchangeRates || {};

  const [activeKasa, setActiveKasa] = useState((data.kasaAccounts?.[0]?.id) || null);
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" });
  const [entryDraft, setEntryDraft] = useState(null);
  const [kasaDraft, setKasaDraft] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => {
    if (!activeKasa && data.kasaAccounts?.length) setActiveKasa(data.kasaAccounts[0].id);
  }, [data.kasaAccounts, activeKasa]);

  const kasaAccounts = data.kasaAccounts || [];
  const allEntries = data.kasaEntries || [];
  const allTransfers = data.transfers || [];
  const kasaCategories = data.kasaCategories || [];
  const currentKasa = kasaAccounts.find(k => k.id === activeKasa);

  // Aktif kasanın hareketlerini ve transferlerini tek listede topla, zaman sıralı
  const unifiedEntries = useMemo(() => {
    if (!activeKasa) return [];
    const list = [];
    // Normal kasa hareketleri
    allEntries.filter(e => e.kasaAccountId === activeKasa).forEach(e => {
      list.push({
        kind: "entry",
        id: e.id,
        date: e.date,
        type: e.type,
        amount: e.amount,
        description: e.description,
        category: e.category,
        sortKey: e.date + e.id,
      });
    });
    // Transferler: bu kasaya gelen veya giden
    allTransfers.forEach(t => {
      if (t.fromType === "kasa" && t.fromId === activeKasa) {
        const other = getEndpointInfo(t.toType, t.toId, data);
        list.push({
          kind: "transfer",
          id: t.id,
          date: t.date,
          type: "out",
          amount: t.fromAmount,
          description: t.description,
          transferInfo: { direction: "out", otherType: t.toType, otherName: other.shortName, otherCurrency: t.toCurrency, otherAmount: t.toAmount },
          sortKey: t.date + t.id,
        });
      }
      if (t.toType === "kasa" && t.toId === activeKasa) {
        const other = getEndpointInfo(t.fromType, t.fromId, data);
        list.push({
          kind: "transfer",
          id: t.id,
          date: t.date,
          type: "in",
          amount: t.toAmount,
          description: t.description,
          transferInfo: { direction: "in", otherType: t.fromType, otherName: other.shortName, otherCurrency: t.fromCurrency, otherAmount: t.fromAmount },
          sortKey: t.date + t.id,
        });
      }
    });
    // Tarih filtresi
    let filtered = list;
    if (dateFilter.from) filtered = filtered.filter(e => e.date >= dateFilter.from);
    if (dateFilter.to)   filtered = filtered.filter(e => e.date <= dateFilter.to);
    return filtered.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [allEntries, allTransfers, activeKasa, dateFilter, data]);

  // Tüm hareketler (filtresiz) — bakiye hesabı için
  const allUnified = useMemo(() => {
    if (!activeKasa) return [];
    const list = [];
    allEntries.filter(e => e.kasaAccountId === activeKasa).forEach(e => {
      list.push({ type: e.type, amount: Number(e.amount) || 0, sortKey: e.date + e.id, id: e.id });
    });
    allTransfers.forEach(t => {
      if (t.fromType === "kasa" && t.fromId === activeKasa)
        list.push({ type: "out", amount: Number(t.fromAmount) || 0, sortKey: t.date + t.id, id: t.id });
      if (t.toType === "kasa" && t.toId === activeKasa)
        list.push({ type: "in", amount: Number(t.toAmount) || 0, sortKey: t.date + t.id, id: t.id });
    });
    return list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [allEntries, allTransfers, activeKasa]);

  // Belirli bir kayıt sonrası kümülatif bakiye
  const computeBalance = useCallback((upToId) => {
    if (!currentKasa) return 0;
    let balance = Number(currentKasa.openingBalance) || 0;
    for (const e of allUnified) {
      balance += (e.type === "in" ? e.amount : -e.amount);
      if (e.id === upToId) break;
    }
    return balance;
  }, [allUnified, currentKasa]);

  // Görsel özetler (filtreli)
  const totalIn = unifiedEntries.filter(e => e.type === "in").reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = unifiedEntries.filter(e => e.type === "out").reduce((s, e) => s + Number(e.amount), 0);
  const currentBalance = currentKasa ? computeKasaBalance(activeKasa, data) : 0;

  // Kasa ekleme
  const saveKasaNew = async () => {
    if (!kasaDraft.name.trim()) return notify("Kasa adı zorunlu", "err");
    const newKasa = {
      id: "ksa_" + Date.now(),
      name: kasaDraft.name.trim(),
      currency: kasaDraft.currency || "TRY",
      openingBalance: Number(kasaDraft.openingBalance) || 0,
      active: true,
    };
    await onChange({ ...data, kasaAccounts: [...kasaAccounts, newKasa] });
    await logAudit("kasa_add", { kasa: newKasa.name });
    notify("Kasa eklendi");
    setKasaDraft(null);
    setActiveKasa(newKasa.id);
  };

  const removeKasa = async (kasa) => {
    const entryCount = allEntries.filter(e => e.kasaAccountId === kasa.id).length;
    const msg = entryCount > 0
      ? `"${kasa.name}" kasasını ve ${entryCount} hareketi silmek istediğinizden emin misiniz?`
      : `"${kasa.name}" kasasını silmek istediğinizden emin misiniz?`;
    if (!confirm(msg)) return;
    await onChange({
      ...data,
      kasaAccounts: kasaAccounts.filter(k => k.id !== kasa.id),
      kasaEntries: allEntries.filter(e => e.kasaAccountId !== kasa.id),
    });
    await logAudit("kasa_delete", { kasa: kasa.name });
    notify("Kasa silindi");
    if (activeKasa === kasa.id) setActiveKasa(kasaAccounts[0]?.id || null);
  };

  // Hareket ekleme
  const saveEntryNew = async () => {
    if (!entryDraft.amount || Number(entryDraft.amount) <= 0) return notify("Geçerli bir tutar girin", "err");
    if (!entryDraft.description?.trim()) return notify("Açıklama zorunlu", "err");
    const newEntry = {
      id: "kse_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      kasaAccountId: activeKasa,
      date: entryDraft.date,
      type: entryDraft.type,
      amount: Number(entryDraft.amount),
      description: entryDraft.description.trim(),
      category: entryDraft.category || "",
    };
    await onChange({ ...data, kasaEntries: [...allEntries, newEntry] });
    await logAudit("kasa_entry_add", {
      kasa: currentKasa.name,
      tip: entryDraft.type === "in" ? "giriş" : "çıkış",
      tutar: newEntry.amount,
      açıklama: newEntry.description
    });
    notify("Hareket kaydedildi");
    setEntryDraft(null);
  };

  const removeEntry = async (entry) => {
    if (!confirm("Bu hareketi silmek istediğinizden emin misiniz?")) return;
    await onChange({ ...data, kasaEntries: allEntries.filter(e => e.id !== entry.id) });
    await logAudit("kasa_entry_delete", { kasa: currentKasa.name, tutar: entry.amount });
    notify("Hareket silindi");
  };

  if (!currentKasa && kasaAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="label mb-1">Kasa Yönetimi</div>
            <h1 className="display text-2xl md:text-3xl">Kasa</h1>
          </div>
          {canManage && (
            <button onClick={() => setKasaDraft({ name: "", currency: "TRY", openingBalance: 0 })} className="btn btn-primary">
              <Plus size={13}/> Yeni Kasa
            </button>
          )}
        </div>
        <div className="card p-10 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <Wallet size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <p className="text-sm" style={{ color: "var(--ink-mute)" }}>Henüz kasa eklenmemiş.</p>
          {canManage && (
            <button onClick={() => setKasaDraft({ name: "", currency: "TRY", openingBalance: 0 })} className="btn btn-primary mt-4">
              <Plus size={13}/> İlk kasayı oluştur
            </button>
          )}
        </div>
      </div>
    );
  }

  const kasaSym = CURRENCY_SYMBOLS[currentKasa?.currency || "TRY"];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">Günlük Hareketler</div>
          <h1 className="display text-2xl md:text-3xl">Kasa</h1>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={() => setKasaDraft({ name: "", currency: "TRY", openingBalance: 0 })}
              className="btn btn-ghost">
              <Plus size={13}/> Yeni Kasa
            </button>
          )}
          {canTransfer && currentKasa && (
            <button onClick={() => setShowTransfer(true)} className="btn btn-ghost">
              <ArrowLeftRight size={13}/> Transfer
            </button>
          )}
          {canAdd && currentKasa && (
            <button onClick={() => setEntryDraft({
              date: new Date().toISOString().slice(0, 10),
              type: "in", amount: "", description: "", category: "", cashflowCatId: ""
            })} className="btn btn-primary">
              <Plus size={13}/> Hareket Ekle
            </button>
          )}
        </div>
      </div>

      {/* Kasa seçici */}
      {kasaAccounts.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          {kasaAccounts.map(k => (
            <button key={k.id} onClick={() => setActiveKasa(k.id)}
              className="px-4 py-2 rounded text-sm font-medium transition-all flex items-center gap-2"
              style={{
                background: activeKasa === k.id ? "var(--accent)" : "var(--paper)",
                color: activeKasa === k.id ? "#f5f3ef" : "var(--ink)",
                border: "1px solid " + (activeKasa === k.id ? "var(--accent)" : "var(--line)"),
              }}>
              <Wallet size={12}/>
              {k.name}
              <span className="text-xs opacity-70">({CURRENCY_SYMBOLS[k.currency]})</span>
              {canManage && activeKasa === k.id && (
                <span onClick={(e) => { e.stopPropagation(); removeKasa(k); }}
                  className="ml-1 p-0.5 rounded hover:bg-white/20 cursor-pointer">
                  <Trash2 size={11}/>
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Özet kartları */}
      {currentKasa && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="label">Açılış Bakiyesi</div>
              <Wallet size={16} style={{ color: "var(--ink-mute)" }}/>
            </div>
            <div className="num display text-2xl">
              {fmtTLSign(currentKasa.openingBalance)} <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{kasaSym}</span>
            </div>
          </div>
          <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="label">Toplam Giriş</div>
              <ArrowDownToLine size={16} style={{ color: "#0f766e" }}/>
            </div>
            <div className="num display text-2xl" style={{ color: "#0f766e" }}>
              {fmtTL(totalIn) || "0"} <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{kasaSym}</span>
            </div>
          </div>
          <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="label">Toplam Çıkış</div>
              <ArrowUpFromLine size={16} style={{ color: "#b91c1c" }}/>
            </div>
            <div className="num display text-2xl" style={{ color: "#b91c1c" }}>
              {fmtTL(totalOut) || "0"} <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{kasaSym}</span>
            </div>
          </div>
          <div className="card p-5" style={{ boxShadow: "var(--shadow)", background: "var(--accent-soft)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="label">Mevcut Bakiye</div>
              <Coins size={16} style={{ color: "var(--accent)" }}/>
            </div>
            <div className="num display text-2xl"
              style={{ color: currentBalance < 0 ? "var(--negative)" : "var(--accent)" }}>
              {fmtTLSign(currentBalance)} <span style={{ fontSize: 12 }}>{kasaSym}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tarih filtresi */}
      <div className="card p-3 flex items-center gap-3" style={{ boxShadow: "var(--shadow)" }}>
        <Filter size={14} style={{ color: "var(--ink-mute)" }}/>
        <div className="text-xs label">Filtrele:</div>
        <input type="date" className="input" style={{ width: 160 }}
          value={dateFilter.from} onChange={e => setDateFilter({ ...dateFilter, from: e.target.value })}/>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>—</span>
        <input type="date" className="input" style={{ width: 160 }}
          value={dateFilter.to} onChange={e => setDateFilter({ ...dateFilter, to: e.target.value })}/>
        {(dateFilter.from || dateFilter.to) && (
          <button onClick={() => setDateFilter({ from: "", to: "" })} className="btn btn-ghost text-xs">
            <X size={11}/> Temizle
          </button>
        )}
        <div className="ml-auto text-xs" style={{ color: "var(--ink-mute)" }}>
          {unifiedEntries.length} hareket
        </div>
      </div>

      {/* Hareketler tablosu */}
      <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
        <table className="grid">
          <thead>
            <tr>
              <th className="label-cell" style={{ width: 100 }}>Tarih</th>
              <th className="label-cell" style={{ width: 70 }}>Tip</th>
              <th className="label-cell">Açıklama</th>
              <th className="label-cell" style={{ width: 130 }}>Kategori</th>
              <th style={{ width: 140 }}>Tutar ({kasaSym})</th>
              <th style={{ width: 140 }}>Bakiye ({kasaSym})</th>
              {canAdd && <th style={{ width: 50 }}></th>}
            </tr>
          </thead>
          <tbody>
            {unifiedEntries.length === 0 ? (
              <tr><td colSpan={canAdd ? 7 : 6} className="label-cell text-center py-8" style={{ color: "var(--ink-mute)" }}>
                Bu dönem için kayıtlı hareket veya transfer bulunamadı
              </td></tr>
            ) : unifiedEntries.map(e => (
              <tr key={e.id} style={e.kind === "transfer" ? { background: "rgba(11, 61, 46, 0.025)" } : undefined}>
                <td className="label-cell mono text-xs">
                  {new Date(e.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </td>
                <td className="label-cell">
                  {e.kind === "transfer" ? (
                    <span className="chip" style={{ background: "#e0e7ff", color: "#3730a3" }}>
                      <ArrowLeftRight size={9}/> Transfer
                    </span>
                  ) : e.type === "in" ? (
                    <span className="chip" style={{ background: "#dcfce7", color: "#15803d" }}>
                      <ArrowDownToLine size={9}/> Giriş
                    </span>
                  ) : (
                    <span className="chip" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                      <ArrowUpFromLine size={9}/> Çıkış
                    </span>
                  )}
                </td>
                <td className="label-cell text-xs">
                  {e.kind === "transfer" ? (
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: "var(--ink-mute)" }}>
                        {e.transferInfo.direction === "in" ? "Geldi:" : "Gitti:"}
                      </span>
                      <span className="font-medium flex items-center gap-1">
                        {e.transferInfo.otherType === "bank" ? <Landmark size={10}/> : <Wallet size={10}/>}
                        {e.transferInfo.otherName}
                      </span>
                      {e.description && <span style={{ color: "var(--ink-mute)" }}>· {e.description}</span>}
                    </div>
                  ) : e.description}
                </td>
                <td className="label-cell text-xs" style={{ color: "var(--ink-mute)" }}>
                  {e.kind === "transfer" ? "—" : (e.category || "—")}
                </td>
                <td className="num text-xs font-medium" style={{ color: e.type === "in" ? "#0f766e" : "#b91c1c" }}>
                  {e.type === "in" ? "+" : "−"}{fmtTL(e.amount)}
                </td>
                <td className="num text-xs">
                  {(() => {
                    const bal = computeBalance(e.id);
                    return <span style={{ color: bal < 0 ? "var(--negative)" : "var(--ink)" }}>{fmtTLSign(bal)}</span>;
                  })()}
                </td>
                {canAdd && (
                  <td>
                    {e.kind === "transfer" ? (
                      <span className="text-xs px-1.5" style={{ color: "var(--ink-mute)" }} title="Transfer kayıtları Transferler sekmesinden silinir">
                        <Info size={10}/>
                      </span>
                    ) : (
                      <button onClick={() => removeEntry(e)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={11} style={{ color: "var(--negative)" }}/>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hareket ekleme modali */}
      {entryDraft && (
        <Modal title="Yeni Hareket" onClose={() => setEntryDraft(null)}
          onSave={saveEntryNew} icon={Coins}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setEntryDraft({ ...entryDraft, type: "in" })}
                className="p-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: entryDraft.type === "in" ? "#dcfce7" : "var(--bg)",
                  color: entryDraft.type === "in" ? "#15803d" : "var(--ink-mute)",
                  border: entryDraft.type === "in" ? "1px solid #15803d" : "1px solid var(--line)"
                }}>
                <ArrowDownToLine size={14}/> Giriş
              </button>
              <button onClick={() => setEntryDraft({ ...entryDraft, type: "out" })}
                className="p-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: entryDraft.type === "out" ? "#fee2e2" : "var(--bg)",
                  color: entryDraft.type === "out" ? "#b91c1c" : "var(--ink-mute)",
                  border: entryDraft.type === "out" ? "1px solid #b91c1c" : "1px solid var(--line)"
                }}>
                <ArrowUpFromLine size={14}/> Çıkış
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Tarih *</div>
                <input className="input" type="date" value={entryDraft.date}
                  onChange={e => setEntryDraft({ ...entryDraft, date: e.target.value })}/>
              </div>
              <div>
                <div className="label mb-1">Tutar ({kasaSym}) *</div>
                <input className="input num text-right" type="number" autoFocus value={entryDraft.amount}
                  onChange={e => setEntryDraft({ ...entryDraft, amount: e.target.value })}
                  placeholder="0"/>
              </div>
            </div>
            <div>
              <div className="label mb-1">Açıklama *</div>
              <input className="input" value={entryDraft.description}
                onChange={e => setEntryDraft({ ...entryDraft, description: e.target.value })}
                placeholder="Hangi işlem için?"/>
            </div>
            <div>
              <div className="label mb-1">Kategori</div>
              <select className="input" value={entryDraft.category}
                onChange={e => setEntryDraft({ ...entryDraft, category: e.target.value })}>
                <option value="">— Kategorisiz —</option>
                {kasaCategories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Yeni kategori eklemek için <strong>Kategoriler → Kasa Kategorileri</strong> sekmesini kullanın
              </p>
            </div>
            <div>
              <div className="label mb-1">Nakit Akış Kalemi (opsiyonel)</div>
              <select className="input" value={entryDraft.cashflowCatId || ""}
                onChange={e => setEntryDraft({ ...entryDraft, cashflowCatId: e.target.value })}>
                <option value="">— Nakit akış tablosuna yansıma —</option>
                <optgroup label="Tahsilat Kalemleri">
                  {(data.inflows || []).map(c => <option key={c.id} value={c.id}>↓ {c.name}</option>)}
                </optgroup>
                <optgroup label="Ödeme Kalemleri">
                  {(data.outflows || []).map(c => <option key={c.id} value={c.id}>↑ {c.name}</option>)}
                </optgroup>
                <optgroup label="K/Z Harici Ödemeler">
                  {(data.nonPnlOutflows || []).map(c => <option key={c.id} value={c.id}>○ {c.name}</option>)}
                </optgroup>
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Seçilirse bu kasa hareketi nakit akış tablosunda ilgili aydaki kaleme otomatik yansır.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Kasa ekleme modali */}
      {kasaDraft && (
        <Modal title="Yeni Kasa Oluştur" onClose={() => setKasaDraft(null)}
          onSave={saveKasaNew} icon={Wallet}>
          <div className="space-y-3">
            <div>
              <div className="label mb-1">Kasa Adı *</div>
              <input className="input" autoFocus value={kasaDraft.name}
                onChange={e => setKasaDraft({ ...kasaDraft, name: e.target.value })}
                placeholder="Örn: Şube Kasa, USD Kasa"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Para Birimi</div>
                <select className="input" value={kasaDraft.currency}
                  onChange={e => setKasaDraft({ ...kasaDraft, currency: e.target.value })}>
                  <option value="TRY">{CURRENCY_SYMBOLS.TRY} TRY</option>
                  <option value="USD">{CURRENCY_SYMBOLS.USD} USD</option>
                  <option value="EUR">{CURRENCY_SYMBOLS.EUR} EUR</option>
                </select>
              </div>
              <div>
                <div className="label mb-1">Açılış Bakiyesi</div>
                <input className="input num text-right" type="number" value={kasaDraft.openingBalance}
                  onChange={e => setKasaDraft({ ...kasaDraft, openingBalance: e.target.value })}/>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer modali */}
      {showTransfer && (
        <TransferModal
          data={data}
          prefill={{ fromType: "kasa", fromId: activeKasa, toType: "bank" }}
          onClose={() => setShowTransfer(false)}
          onSave={async (formData) => {
            const newT = {
              id: "trf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
              ts: new Date().toISOString(),
              userId: session.userId,
              ...formData,
            };
            await onChange({ ...data, transfers: [...(data.transfers || []), newT] });
            const fromName = getEndpointInfo(newT.fromType, newT.fromId, data).shortName;
            const toName = getEndpointInfo(newT.toType, newT.toId, data).shortName;
            await logAudit("transfer_add", {
              kaynak: fromName, hedef: toName,
              tutar: newT.fromAmount, birim: newT.fromCurrency,
              açıklama: newT.description || "—",
            });
            notify(`Transfer kaydedildi: ${fromName} → ${toName}`);
            setShowTransfer(false);
          }}
        />
      )}
    </div>
  );
}

/* =====================================================================
   LOANS MANAGER — Kredi yönetimi
===================================================================== */
function LoansManager({ data, session, canAct, onChange, logAudit, notify }) {
  const canManage = canAct ? canAct("finance.loans.update") || can(session.role, "manage_loans") : can(session.role, "manage_loans");
  const canCreate = canAct ? canAct("finance.loans.create") || can(session.role, "manage_loans") : can(session.role, "manage_loans");
  const canDelete = canAct ? canAct("finance.loans.delete") || can(session.role, "manage_loans") : can(session.role, "manage_loans");
  const canPay    = canAct ? canAct("finance.loans.update") || can(session.role, "add_loan_payment") : can(session.role, "add_loan_payment");
  const canTx     = canAct ? canAct("finance.loans.update") || can(session.role, "add_loan_transaction") : can(session.role, "add_loan_transaction");

  const loans = data.loans || [];
  const banks = data.banks || [];
  const bankAccounts = data.bankAccounts || [];
  const outflowCats = data.outflows || [];
  const nonPnlCats = data.nonPnlOutflows || [];
  const allCashflowCats = [...outflowCats, ...nonPnlCats];

  const [activeId, setActiveId] = useState(loans[0]?.id || null);
  const [loanDraft, setLoanDraft] = useState(null);
  const [txDraft, setTxDraft] = useState(null);
  const [editLoanId, setEditLoanId] = useState(null);
  const [paySchedIdx, setPaySchedIdx] = useState(null);

  useEffect(() => {
    if (!activeId && loans.length) setActiveId(loans[0].id);
    if (activeId && !loans.find(l => l.id === activeId) && loans.length) {
      setActiveId(loans[0].id);
    }
  }, [loans, activeId]);

  const activeLoan = loans.find(l => l.id === activeId);
  const sym = CURRENCY_SYMBOLS[activeLoan?.currency || "TRY"];

  // Portföy istatistikleri — Hook sıra ihlalini önlemek için early return'lerden ÖNCE
  const portfolioStats = useMemo(() => {
    let totalLimit = 0, totalUsed = 0, totalAvail = 0;
    let nextDue = null, nextDueAmt = 0;
    loans.forEach(l => {
      const bal = computeLoanBalance(l.id, data);
      const lim = Number(l.principal) || 0;
      totalLimit += convertToTRY(lim, l.currency || "TRY", data.exchangeRates || {});
      totalUsed += convertToTRY(bal, l.currency || "TRY", data.exchangeRates || {});
      totalAvail += convertToTRY(Math.max(0, lim - bal), l.currency || "TRY", data.exchangeRates || {});
      (l.schedule || []).filter(s => !s.paid).forEach(s => {
        const d = new Date(s.dueDate);
        if (!nextDue || d < new Date(nextDue)) {
          nextDue = s.dueDate;
          nextDueAmt = convertToTRY(s.total, l.currency || "TRY", data.exchangeRates || {});
        }
      });
    });
    return { totalLimit, totalUsed, totalAvail, nextDue, nextDueAmt };
  }, [loans, data]);

  // ----- Yeni kredi kaydet -----
  const saveNewLoan = async () => {
    try {
      if (!loanDraft) { console.warn("loanDraft yok"); return; }
      if (!loanDraft.name?.trim()) { alert("Kredi adı zorunlu"); return; }
      if (!loanDraft.bankId)        { alert("Banka seçimi zorunlu"); return; }

      // Türk locale'inde virgül kullanılabilir ("1000,50") — onu normalize et
      const principalStr = String(loanDraft.principal || "").replace(/[^\d.,-]/g, "").replace(",", ".");
      const P = Number(principalStr);
      if (!P || P <= 0 || isNaN(P)) { alert("Geçerli anapara/limit girin"); return; }

      const interestStr = String(loanDraft.interestRate || "").replace(/[^\d.,-]/g, "").replace(",", ".");
      const interestRate = Number(interestStr) || 0;

      const newLoan = {
        id: "loan_" + Date.now(),
        type: loanDraft.type,
        name: loanDraft.name.trim(),
        contractNo: loanDraft.contractNo?.trim() || "",
        bankId: loanDraft.bankId,
        accountId: loanDraft.accountId || null,
        principal: P,
        currency: loanDraft.currency || "TRY",
        interestRate,
        bsmvRate: Number(loanDraft.bsmvRate) || LOAN_DEFAULTS.bsmvRate,
        kkdfRate: Number(loanDraft.kkdfRate) || LOAN_DEFAULTS.kkdfRate,
        disbursementDate: loanDraft.disbursementDate || new Date().toISOString().slice(0, 10),
        termMonths: Number(loanDraft.termMonths) || 0,
        paymentDay: Number(loanDraft.paymentDay) || 1,
        cashflowCatId: loanDraft.cashflowCatId || null,
        status: "active",
        note: loanDraft.note?.trim() || "",
        committedToCells: false,
        createdAt: new Date().toISOString(),
        createdBy: session.username,
      };
      newLoan.schedule = generateAmortizationSchedule(newLoan);

      const updated = [...loans, newLoan];
      await onChange({ ...data, loans: updated });
      await logAudit("loan_add", {
        ad: newLoan.name, tür: LOAN_TYPES[newLoan.type]?.label,
        anapara: P, vade: newLoan.termMonths
      });
      notify(`Kredi eklendi: ${newLoan.name}`);
      setLoanDraft(null);
      setActiveId(newLoan.id);
    } catch (err) {
      console.error("Kredi kaydetme hatası:", err);
      alert("Kredi kaydedilemedi: " + (err?.message || "bilinmeyen hata"));
    }
  };

  // ----- Kredi sil -----
  const removeLoan = async (loan) => {
    const txCount = (data.loanTransactions || []).filter(t => t.loanId === loan.id).length;
    const msg = txCount > 0
      ? `"${loan.name}" kredisini ve ${txCount} hareketi silmek istediğinizden emin misiniz?`
      : `"${loan.name}" kredisini silmek istediğinizden emin misiniz?`;
    if (!confirm(msg)) return;
    const remainingLoans = loans.filter(l => l.id !== loan.id);
    const remainingTxs = (data.loanTransactions || []).filter(t => t.loanId !== loan.id);
    await onChange({ ...data, loans: remainingLoans, loanTransactions: remainingTxs });
    await logAudit("loan_delete", { ad: loan.name });
    notify("Kredi silindi");
    if (activeId === loan.id) setActiveId(remainingLoans[0]?.id || null);
  };

  // ----- Kredi güncelle (kategori, hesap, faiz vb.) -----
  const saveEditLoan = async (patch) => {
    const updated = loans.map(l => {
      if (l.id !== editLoanId) return l;
      const merged = { ...l, ...patch };
      // Eğer kritik alanlar değiştiyse schedule'u yenile
      if (l.type === "installment" || l.type === "spot") {
        const changed = (patch.principal !== undefined && patch.principal !== l.principal) ||
                        (patch.interestRate !== undefined && patch.interestRate !== l.interestRate) ||
                        (patch.termMonths !== undefined && patch.termMonths !== l.termMonths) ||
                        (patch.disbursementDate !== undefined) ||
                        (patch.paymentDay !== undefined);
        if (changed) {
          // Ödenmiş taksitleri koru
          const oldPaid = (l.schedule || []).filter(s => s.paid).reduce((acc, s) => { acc[s.idx] = s; return acc; }, {});
          merged.schedule = generateAmortizationSchedule(merged).map(s =>
            oldPaid[s.idx] ? { ...s, paid: true, paidDate: oldPaid[s.idx].paidDate, paidAmount: oldPaid[s.idx].paidAmount } : s
          );
        }
      }
      return merged;
    });
    await onChange({ ...data, loans: updated });
    await logAudit("loan_update", { ad: loans.find(l => l.id === editLoanId)?.name, alanlar: Object.keys(patch).join(", ") });
    notify("Kredi güncellendi");
    setEditLoanId(null);
  };

  // ----- Taksit ödendi olarak işaretle (veya geri al) -----
  const togglePaidInstallment = async (loan, idx) => {
    const updated = loans.map(l => {
      if (l.id !== loan.id) return l;
      const sch = (l.schedule || []).map(s => {
        if (s.idx !== idx) return s;
        return s.paid
          ? { ...s, paid: false, paidDate: null, paidAmount: 0 }
          : { ...s, paid: true, paidDate: new Date().toISOString().slice(0, 10), paidAmount: s.total };
      });
      return { ...l, schedule: sch };
    });
    await onChange({ ...data, loans: updated });
    const s = loan.schedule.find(x => x.idx === idx);
    await logAudit(s?.paid ? "loan_payment_revert" : "loan_payment_add", {
      kredi: loan.name, taksit: idx + 1, tutar: s?.total
    });
    notify(s?.paid ? "Ödeme geri alındı" : "Taksit ödendi olarak işaretlendi");
  };

  // ----- BCH/KMH/Rotatif hareket ekle -----
  const saveTx = async () => {
    if (!txDraft.amount || Number(txDraft.amount) <= 0) return notify("Geçerli tutar girin", "err");
    if (!txDraft.date) return notify("Tarih zorunlu", "err");

    const newTx = {
      id: "ltx_" + Date.now(),
      loanId: activeLoan.id,
      date: txDraft.date,
      type: txDraft.type,
      amount: Number(txDraft.amount),
      description: txDraft.description?.trim() || "",
      cashflowCatId: txDraft.cashflowCatId || activeLoan.cashflowCatId || null,
      committedToCells: false,
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    const updated = [...(data.loanTransactions || []), newTx];
    await onChange({ ...data, loanTransactions: updated });
    const typeLabel = { draw: "kullanım", repay: "geri ödeme", interest: "faiz tahakkuku" }[newTx.type];
    await logAudit("loan_tx_add", { kredi: activeLoan.name, tip: typeLabel, tutar: newTx.amount });
    notify(`Kredi ${typeLabel} kaydedildi`);
    setTxDraft(null);
  };

  // ----- BCH/KMH/Rotatif hareket sil -----
  const removeTx = async (tx) => {
    if (!confirm("Bu hareketi silmek istediğinizden emin misiniz?")) return;
    const updated = (data.loanTransactions || []).filter(t => t.id !== tx.id);
    await onChange({ ...data, loanTransactions: updated });
    await logAudit("loan_tx_delete", { kredi: activeLoan?.name, tutar: tx.amount });
    notify("Hareket silindi");
  };

  // ===== EMPTY STATE =====
  if (loans.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="label mb-1">Kredi Portföyü</div>
            <h1 className="display text-2xl md:text-3xl">Krediler</h1>
          </div>
          {canManage && (
            <button onClick={() => setLoanDraft(emptyLoanDraft())} className="btn btn-primary">
              <Plus size={13}/> Yeni Kredi
            </button>
          )}
        </div>
        <div className="card p-10 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <Banknote size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <p className="text-sm" style={{ color: "var(--ink-mute)" }}>Henüz kredi tanımlanmamış.</p>
          {canManage && (
            <button onClick={() => setLoanDraft(emptyLoanDraft())} className="btn btn-primary mt-4">
              <Plus size={13}/> İlk krediyi ekle
            </button>
          )}
        </div>
        {loanDraft && (
          <LoanFormModal
            draft={loanDraft} setDraft={setLoanDraft}
            banks={banks} bankAccounts={bankAccounts}
            cashflowCats={allCashflowCats}
            onClose={() => setLoanDraft(null)}
            onSave={saveNewLoan}
          />
        )}
      </div>
    );
  }

  // ===== MAIN VIEW =====
  const balance = activeLoan ? computeLoanBalance(activeLoan.id, data) : 0;
  const available = activeLoan ? computeLoanAvailableLimit(activeLoan, data) : 0;
  const paid = activeLoan ? computeLoanPaidTotals(activeLoan, data) : { principal: 0, interest: 0, bsmv: 0, kkdf: 0 };

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">Kredi Portföyü</div>
          <h1 className="display text-2xl md:text-3xl">Krediler</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <button onClick={() => setLoanDraft(emptyLoanDraft())} className="btn btn-primary">
              <Plus size={13}/> Yeni Kredi
            </button>
          )}
        </div>
      </div>

      {/* Portföy özeti */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="label">Toplam Limit/Anapara</div>
            <Banknote size={16} style={{ color: "var(--ink-mute)" }}/>
          </div>
          <div className="num display text-2xl">{fmtTL(portfolioStats.totalLimit)} <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>₺</span></div>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>{loans.length} aktif kredi</div>
        </div>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="label">Kalan Borç</div>
            <TrendingDown size={16} style={{ color: "#b91c1c" }}/>
          </div>
          <div className="num display text-2xl" style={{ color: "#b91c1c" }}>{fmtTL(portfolioStats.totalUsed)} <span style={{ fontSize: 12 }}>₺</span></div>
        </div>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="label">Kullanılabilir</div>
            <Check size={16} style={{ color: "#0f766e" }}/>
          </div>
          <div className="num display text-2xl" style={{ color: "#0f766e" }}>{fmtTL(portfolioStats.totalAvail)} <span style={{ fontSize: 12 }}>₺</span></div>
        </div>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)", background: "var(--accent-soft)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="label">En Yakın Vade</div>
            <Calendar size={16} style={{ color: "var(--accent)" }}/>
          </div>
          <div className="num display text-xl">
            {portfolioStats.nextDue
              ? new Date(portfolioStats.nextDue).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
              : "—"}
          </div>
          {portfolioStats.nextDueAmt > 0 && (
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              {fmtTL(portfolioStats.nextDueAmt)} ₺
            </div>
          )}
        </div>
      </div>

      {/* Kredi seçici (chip listesi) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {loans.map(l => {
          const isActive = activeId === l.id;
          const ti = LOAN_TYPES[l.type] || LOAN_TYPES.installment;
          return (
            <button key={l.id} onClick={() => setActiveId(l.id)}
              className="px-4 py-2 rounded text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0"
              style={{
                background: isActive ? ti.color : "var(--paper)",
                color: isActive ? "#f5f3ef" : "var(--ink)",
                border: "1px solid " + (isActive ? ti.color : "var(--line)"),
              }}>
              <Banknote size={12}/>
              <span>{l.name}</span>
              <span className="text-xs opacity-70">({ti.short})</span>
              {canManage && isActive && (
                <span onClick={(e) => { e.stopPropagation(); removeLoan(l); }}
                  className="ml-1 p-0.5 rounded hover:bg-white/20 cursor-pointer">
                  <Trash2 size={11}/>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeLoan && (
        <>
          {/* Detay özet kartı */}
          <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: LOAN_TYPES[activeLoan.type]?.color + "20", color: LOAN_TYPES[activeLoan.type]?.color }}>
                    {LOAN_TYPES[activeLoan.type]?.label}
                  </span>
                  {activeLoan.contractNo && (
                    <span className="text-xs mono" style={{ color: "var(--ink-mute)" }}>#{activeLoan.contractNo}</span>
                  )}
                </div>
                <div className="text-lg font-semibold">{activeLoan.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-mute)" }}>
                  {banks.find(b => b.id === activeLoan.bankId)?.name || "?"}
                  {activeLoan.accountId && bankAccounts.find(a => a.id === activeLoan.accountId) && (
                    <> · Hesap: {bankAccounts.find(a => a.id === activeLoan.accountId).name}</>
                  )}
                </div>
              </div>
              {canManage && (
                <button onClick={() => setEditLoanId(activeLoan.id)} className="btn btn-ghost text-xs">
                  <Edit3 size={11}/> Düzenle
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="label">Anapara/Limit</div>
                <div className="num mono">{fmtTL(activeLoan.principal)} {sym}</div>
              </div>
              <div>
                <div className="label">Kalan Borç</div>
                <div className="num mono" style={{ color: "#b91c1c" }}>{fmtTL(balance)} {sym}</div>
              </div>
              <div>
                <div className="label">Faiz (Yıllık)</div>
                <div className="num mono">%{((Number(activeLoan.interestRate) || 0) * 100).toFixed(2)}</div>
                <div className="text-xs" style={{ color: "var(--ink-mute)" }}>Aylık %{(loanMonthlyRate(activeLoan) * 100).toFixed(3)}</div>
              </div>
              <div>
                {(activeLoan.type === "installment" || activeLoan.type === "spot") ? (
                  <>
                    <div className="label">Vade</div>
                    <div className="num mono">{activeLoan.termMonths} ay</div>
                  </>
                ) : (
                  <>
                    <div className="label">Kullanılabilir</div>
                    <div className="num mono" style={{ color: "#0f766e" }}>{fmtTL(available)} {sym}</div>
                  </>
                )}
              </div>
            </div>
            {(paid.principal > 0 || paid.interest > 0) && (
              <div className="mt-4 pt-4 border-t flex items-center gap-6 text-xs flex-wrap" style={{ borderColor: "var(--line)" }}>
                <div><span style={{ color: "var(--ink-mute)" }}>Ödenmiş Anapara:</span> <span className="mono">{fmtTL(paid.principal)} {sym}</span></div>
                <div><span style={{ color: "var(--ink-mute)" }}>Ödenmiş Faiz:</span> <span className="mono">{fmtTL(paid.interest)} {sym}</span></div>
                {paid.bsmv > 0 && <div><span style={{ color: "var(--ink-mute)" }}>BSMV:</span> <span className="mono">{fmtTL(paid.bsmv)} {sym}</span></div>}
                {paid.kkdf > 0 && <div><span style={{ color: "var(--ink-mute)" }}>KKDF:</span> <span className="mono">{fmtTL(paid.kkdf)} {sym}</span></div>}
                {activeLoan.cashflowCatId && (
                  <div className="ml-auto">
                    <span style={{ color: "var(--ink-mute)" }}>NA Kalemi:</span>{" "}
                    <span style={{ color: "var(--accent)" }}>
                      {allCashflowCats.find(c => c.id === activeLoan.cashflowCatId)?.name || "?"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tip'e göre ana içerik */}
          {(activeLoan.type === "installment" || activeLoan.type === "spot") ? (
            <LoanScheduleTable
              loan={activeLoan} sym={sym} canPay={canPay}
              onTogglePaid={togglePaidInstallment}
            />
          ) : (
            <LoanTransactionList
              loan={activeLoan} data={data} sym={sym}
              canAdd={canTx} cashflowCats={allCashflowCats}
              onAdd={() => setTxDraft({
                date: new Date().toISOString().slice(0, 10),
                type: "draw", amount: "", description: "",
                cashflowCatId: activeLoan.cashflowCatId || "",
              })}
              onDelete={removeTx}
            />
          )}
        </>
      )}

      {/* Modal'lar */}
      {loanDraft && (
        <LoanFormModal
          draft={loanDraft} setDraft={setLoanDraft}
          banks={banks} bankAccounts={bankAccounts}
          cashflowCats={allCashflowCats}
          onClose={() => setLoanDraft(null)}
          onSave={saveNewLoan}
        />
      )}
      {editLoanId && (
        <LoanEditModal
          loan={loans.find(l => l.id === editLoanId)}
          banks={banks} bankAccounts={bankAccounts}
          cashflowCats={allCashflowCats}
          onClose={() => setEditLoanId(null)}
          onSave={saveEditLoan}
        />
      )}
      {txDraft && activeLoan && (
        <LoanTxModal
          draft={txDraft} setDraft={setTxDraft}
          loan={activeLoan} cashflowCats={allCashflowCats}
          onClose={() => setTxDraft(null)}
          onSave={saveTx}
        />
      )}
    </div>
  );
}

// Yeni kredi draft'ı için default
function emptyLoanDraft() {
  return {
    type: "installment",
    name: "",
    contractNo: "",
    bankId: "",
    accountId: "",
    principal: "",
    currency: "TRY",
    interestRate: 0.045,
    bsmvRate: LOAN_DEFAULTS.bsmvRate,
    kkdfRate: LOAN_DEFAULTS.kkdfRate,
    disbursementDate: new Date().toISOString().slice(0, 10),
    termMonths: 12,
    paymentDay: 15,
    cashflowCatId: "",
    note: "",
  };
}

/* ---------- Loan Schedule Table (taksitli/spot için) ---------- */
function LoanScheduleTable({ loan, sym, canPay, onTogglePaid }) {
  const sch = loan.schedule || [];
  const today = new Date();
  return (
    <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
      <div className="p-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="font-semibold text-sm">Ödeme Planı</div>
        <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
          {sch.filter(s => s.paid).length} / {sch.length} ödendi
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="grid w-full">
        <thead>
          <tr>
            <th className="label-cell" style={{ width: 50 }}>#</th>
            <th className="label-cell" style={{ width: 110 }}>Vade</th>
            <th style={{ width: 130 }}>Anapara ({sym})</th>
            <th style={{ width: 130 }}>Faiz ({sym})</th>
            <th style={{ width: 100 }}>BSMV ({sym})</th>
            <th style={{ width: 100 }}>KKDF ({sym})</th>
            <th style={{ width: 140 }}>Taksit ({sym})</th>
            <th style={{ width: 130 }}>Kalan Borç ({sym})</th>
            <th className="label-cell" style={{ width: 90 }}>Durum</th>
            {canPay && <th style={{ width: 50 }}></th>}
          </tr>
        </thead>
        <tbody>
          {sch.length === 0 ? (
            <tr><td colSpan={canPay ? 10 : 9} className="text-center py-8 label-cell" style={{ color: "var(--ink-mute)" }}>
              Ödeme planı oluşturulamadı (anapara veya vade hatalı olabilir).
            </td></tr>
          ) : sch.map(s => {
            const dueD = new Date(s.dueDate);
            const isOverdue = !s.paid && dueD < today;
            return (
              <tr key={s.idx} style={s.paid ? { background: "rgba(15, 118, 110, 0.04)" } : isOverdue ? { background: "rgba(185, 28, 28, 0.05)" } : undefined}>
                <td className="label-cell mono">{s.idx + 1}</td>
                <td className="label-cell mono text-xs">{dueD.toLocaleDateString("tr-TR")}</td>
                <td className="num mono text-right">{fmtTL(s.principal)}</td>
                <td className="num mono text-right">{fmtTL(s.interest)}</td>
                <td className="num mono text-right text-xs" style={{ color: "var(--ink-mute)" }}>{fmtTL(s.bsmv)}</td>
                <td className="num mono text-right text-xs" style={{ color: "var(--ink-mute)" }}>{fmtTL(s.kkdf)}</td>
                <td className="num mono text-right font-semibold">{fmtTL(s.total)}</td>
                <td className="num mono text-right text-xs" style={{ color: "var(--ink-mute)" }}>{fmtTL(s.remaining)}</td>
                <td className="label-cell">
                  {s.paid ? (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#dcfce7", color: "#15803d" }}>
                      ✓ Ödendi
                    </span>
                  ) : isOverdue ? (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#fee2e2", color: "#991b1b" }}>
                      Gecikmiş
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--ink-mute)" }}>Bekliyor</span>
                  )}
                </td>
                {canPay && (
                  <td className="label-cell">
                    <button onClick={() => onTogglePaid(loan, s.idx)}
                      className="p-1 rounded hover:bg-gray-100"
                      title={s.paid ? "Ödemeyi geri al" : "Ödendi olarak işaretle"}>
                      {s.paid ? <X size={13} style={{ color: "var(--ink-mute)" }}/> : <Check size={13} style={{ color: "#0f766e" }}/>}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/* ---------- Loan Transaction List (BCH/KMH/Rotatif için) ---------- */
function LoanTransactionList({ loan, data, sym, canAdd, cashflowCats, onAdd, onDelete }) {
  const txs = (data.loanTransactions || []).filter(t => t.loanId === loan.id)
    .sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));

  return (
    <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
      <div className="p-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="font-semibold text-sm">Kredi Hareketleri</div>
        <div className="flex items-center gap-2">
          <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
            {txs.length} hareket
          </div>
          {canAdd && (
            <button onClick={onAdd} className="btn btn-primary text-xs">
              <Plus size={11}/> Hareket Ekle
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="grid w-full">
        <thead>
          <tr>
            <th className="label-cell" style={{ width: 110 }}>Tarih</th>
            <th className="label-cell" style={{ width: 100 }}>Tip</th>
            <th className="label-cell">Açıklama</th>
            <th style={{ width: 160 }}>Tutar ({sym})</th>
            <th className="label-cell" style={{ width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {txs.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-8 label-cell" style={{ color: "var(--ink-mute)" }}>
              Henüz hareket kaydedilmemiş.
            </td></tr>
          ) : (() => {
            let running = 0;
            return txs.map(t => {
              const sign = t.type === "draw" ? 1 : (t.type === "repay" ? -1 : 0);
              running += sign * (Number(t.amount) || 0);
              const txLabel = { draw: "Kullanım", repay: "Geri Ödeme", interest: "Faiz Tahakkuku" }[t.type];
              const txColor = { draw: "#7c3aed", repay: "#0f766e", interest: "#b45309" }[t.type];
              return (
                <tr key={t.id}>
                  <td className="label-cell mono text-xs">{new Date(t.date).toLocaleDateString("tr-TR")}</td>
                  <td className="label-cell">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: txColor + "20", color: txColor }}>
                      {txLabel}
                    </span>
                  </td>
                  <td className="label-cell text-sm">{t.description || "—"}</td>
                  <td className="num mono text-right" style={{ color: t.type === "draw" ? "#7c3aed" : "#b91c1c" }}>
                    {t.type === "draw" ? "+" : "−"}{fmtTL(t.amount)}
                  </td>
                  <td className="label-cell">
                    <button onClick={() => onDelete(t)} className="p-1 rounded hover:bg-gray-100">
                      <Trash2 size={11} style={{ color: "var(--negative)" }}/>
                    </button>
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/* ---------- Loan Form Modal (Yeni kredi) ---------- */
function LoanFormModal({ draft, setDraft, banks, bankAccounts, cashflowCats, onClose, onSave }) {
  const isInstallment = draft.type === "installment" || draft.type === "spot";
  const filteredAccts = bankAccounts.filter(a => a.bankId === draft.bankId && a.currency === draft.currency);

  // Önizleme schedule
  const previewSchedule = useMemo(() => {
    try {
      return generateAmortizationSchedule({
        type: draft.type,
        principal: Number(draft.principal) || 0,
        interestRate: Number(draft.interestRate) || 0,
        termMonths: Number(draft.termMonths) || 0,
        bsmvRate: draft.bsmvRate,
        kkdfRate: draft.kkdfRate,
        disbursementDate: draft.disbursementDate,
        paymentDay: draft.paymentDay,
      });
    } catch { return []; }
  }, [draft.type, draft.principal, draft.interestRate, draft.termMonths, draft.bsmvRate, draft.kkdfRate, draft.disbursementDate, draft.paymentDay]);

  const totalCost = previewSchedule.reduce((s, x) => s + x.total, 0);
  const totalInterest = previewSchedule.reduce((s, x) => s + x.interest, 0);
  const totalBsmv = previewSchedule.reduce((s, x) => s + (x.bsmv || 0), 0);

  return (
    <Modal title="Yeni Kredi" icon={Banknote} onClose={onClose} onSave={onSave} maxWidth="max-w-3xl">
      <div className="space-y-4">
        {/* Tür seçici */}
        <div>
          <div className="label mb-2">Kredi Türü *</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(LOAN_TYPES).map(([k, ti]) => (
              <button key={k} type="button"
                onClick={() => setDraft({ ...draft, type: k })}
                className="px-3 py-2 rounded text-xs font-medium transition-all border"
                style={{
                  background: draft.type === k ? ti.color : "var(--paper)",
                  color: draft.type === k ? "#f5f3ef" : "var(--ink)",
                  borderColor: draft.type === k ? ti.color : "var(--line)",
                }}>
                {ti.short}
              </button>
            ))}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            {LOAN_TYPES[draft.type]?.label}
          </div>
        </div>

        {/* Ad ve sözleşme no */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Kredi Adı *</div>
            <input className="input w-full" placeholder="Yatırım Kredisi 2026"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Sözleşme No</div>
            <input className="input w-full" placeholder="K-123456"
              value={draft.contractNo}
              onChange={e => setDraft({ ...draft, contractNo: e.target.value })}/>
          </div>
        </div>

        {/* Banka + hesap */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Banka *</div>
            <select className="input w-full" value={draft.bankId}
              onChange={e => setDraft({ ...draft, bankId: e.target.value, accountId: "" })}>
              <option value="">Seçiniz</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1">Bağlı Banka Hesabı</div>
            <select className="input w-full" value={draft.accountId}
              onChange={e => setDraft({ ...draft, accountId: e.target.value })}>
              <option value="">— (hesap bağlama yok)</option>
              {filteredAccts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Kullanım/ödemeler bu hesabın bakiyesine yansır
            </div>
          </div>
        </div>

        {/* Anapara + para birimi */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <div className="label mb-1">
              {isInstallment ? "Anapara" : "Limit/Anapara"} *
            </div>
            <input className="input w-full" type="number" step="0.01" placeholder="0,00"
              value={draft.principal}
              onChange={e => setDraft({ ...draft, principal: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Para Birimi</div>
            <select className="input w-full" value={draft.currency}
              onChange={e => setDraft({ ...draft, currency: e.target.value, accountId: "" })}>
              <option value="TRY">₺ TRY</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
        </div>

        {/* Faiz */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">Yıllık Faiz (oran)</div>
            <input className="input w-full" type="number" step="0.0001" placeholder="0,045"
              value={draft.interestRate}
              onChange={e => setDraft({ ...draft, interestRate: e.target.value })}/>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Örnek: 0.045 = %4.5 yıllık · Aylık %{(loanMonthlyRate(draft) * 100).toFixed(3)}
            </div>
          </div>
          <div>
            <div className="label mb-1">BSMV Oranı</div>
            <input className="input w-full" type="number" step="0.01"
              value={draft.bsmvRate}
              onChange={e => setDraft({ ...draft, bsmvRate: Number(e.target.value) })}/>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>Genelde 0.10 (%10)</div>
          </div>
          <div>
            <div className="label mb-1">KKDF Oranı</div>
            <input className="input w-full" type="number" step="0.01"
              value={draft.kkdfRate}
              onChange={e => setDraft({ ...draft, kkdfRate: Number(e.target.value) })}/>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>Ticari: 0, bireysel: 0.15</div>
          </div>
        </div>

        {/* Tarih + vade */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">{isInstallment ? "Kullandırım Tarihi" : "Başlangıç Tarihi"}</div>
            <input className="input w-full" type="date"
              value={draft.disbursementDate}
              onChange={e => setDraft({ ...draft, disbursementDate: e.target.value })}/>
          </div>
          {isInstallment && (
            <>
              <div>
                <div className="label mb-1">Vade (Ay) *</div>
                <input className="input w-full" type="number" min="1" placeholder="36"
                  value={draft.termMonths}
                  onChange={e => setDraft({ ...draft, termMonths: e.target.value })}/>
              </div>
              <div>
                <div className="label mb-1">Ödeme Günü</div>
                <input className="input w-full" type="number" min="1" max="28" placeholder="15"
                  value={draft.paymentDay}
                  onChange={e => setDraft({ ...draft, paymentDay: e.target.value })}/>
                <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>1-28 arası</div>
              </div>
            </>
          )}
        </div>

        {/* Cashflow kalem eşlemesi */}
        <div>
          <div className="label mb-1">Nakit Akış Kalemi</div>
          <select className="input w-full" value={draft.cashflowCatId}
            onChange={e => setDraft({ ...draft, cashflowCatId: e.target.value })}>
            <option value="">— (eşleme yok, nakit akışa yansımayacak)</option>
            {cashflowCats.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            Genelde "Kredi Anapara Ödemesi" veya benzeri bir kalem. Taksitler bu kaleme aylık olarak yansır.
          </div>
        </div>

        {/* Önizleme */}
        {isInstallment && previewSchedule.length > 0 && (
          <div className="card p-3" style={{ background: "var(--bg)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--ink-mute)" }}>ÖNİZLEME</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="label">Aylık Taksit</div>
                <div className="num mono font-semibold">
                  {fmtTL(previewSchedule[0]?.total || 0)} {CURRENCY_SYMBOLS[draft.currency]}
                </div>
              </div>
              <div>
                <div className="label">Toplam Faiz</div>
                <div className="num mono">{fmtTL(totalInterest)} {CURRENCY_SYMBOLS[draft.currency]}</div>
              </div>
              <div>
                <div className="label">Toplam BSMV</div>
                <div className="num mono">{fmtTL(totalBsmv)} {CURRENCY_SYMBOLS[draft.currency]}</div>
              </div>
              <div>
                <div className="label">Toplam Geri Ödeme</div>
                <div className="num mono font-semibold" style={{ color: "#b91c1c" }}>
                  {fmtTL(totalCost)} {CURRENCY_SYMBOLS[draft.currency]}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="label mb-1">Not</div>
          <textarea className="input w-full" rows={2}
            value={draft.note}
            onChange={e => setDraft({ ...draft, note: e.target.value })}/>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Loan Edit Modal (mevcut krediyi düzenle) ---------- */
function LoanEditModal({ loan, banks, bankAccounts, cashflowCats, onClose, onSave }) {
  const [draft, setDraft] = useState({ ...loan });
  const isInstallment = draft.type === "installment" || draft.type === "spot";
  const filteredAccts = bankAccounts.filter(a => a.bankId === draft.bankId && a.currency === draft.currency);

  return (
    <Modal title={`Krediyi Düzenle: ${loan.name}`} icon={Edit3} onClose={onClose} maxWidth="max-w-2xl"
      onSave={() => onSave(draft)}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Kredi Adı</div>
            <input className="input w-full"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Sözleşme No</div>
            <input className="input w-full"
              value={draft.contractNo || ""}
              onChange={e => setDraft({ ...draft, contractNo: e.target.value })}/>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Banka</div>
            <select className="input w-full" value={draft.bankId}
              onChange={e => setDraft({ ...draft, bankId: e.target.value, accountId: "" })}>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1">Bağlı Banka Hesabı</div>
            <select className="input w-full" value={draft.accountId || ""}
              onChange={e => setDraft({ ...draft, accountId: e.target.value || null })}>
              <option value="">—</option>
              {filteredAccts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">{isInstallment ? "Anapara" : "Limit"}</div>
            <input className="input w-full" type="number" step="0.01"
              value={draft.principal}
              onChange={e => setDraft({ ...draft, principal: Number(e.target.value) })}/>
          </div>
          <div>
            <div className="label mb-1">Yıllık Faiz</div>
            <input className="input w-full" type="number" step="0.0001"
              value={draft.interestRate}
              onChange={e => setDraft({ ...draft, interestRate: Number(e.target.value) })}/>
          </div>
          {isInstallment && (
            <div>
              <div className="label mb-1">Vade (Ay)</div>
              <input className="input w-full" type="number"
                value={draft.termMonths}
                onChange={e => setDraft({ ...draft, termMonths: Number(e.target.value) })}/>
            </div>
          )}
        </div>

        <div>
          <div className="label mb-1">Nakit Akış Kalemi</div>
          <select className="input w-full" value={draft.cashflowCatId || ""}
            onChange={e => setDraft({ ...draft, cashflowCatId: e.target.value || null })}>
            <option value="">—</option>
            {cashflowCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="card p-3 text-xs" style={{ background: "var(--bg)" }}>
          <AlertCircle size={12} className="inline mr-1" style={{ color: "#b45309" }}/>
          Anapara, faiz, vade veya tarihi değiştirirseniz ödeme planı yeniden hesaplanır.
          Ödenmiş taksitler korunur.
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Loan Transaction Modal (BCH/KMH/Rotatif hareket) ---------- */
function LoanTxModal({ draft, setDraft, loan, cashflowCats, onClose, onSave }) {
  const sym = CURRENCY_SYMBOLS[loan.currency || "TRY"];
  return (
    <Modal title="Kredi Hareketi" icon={ArrowLeftRight} onClose={onClose} onSave={onSave}>
      <div className="space-y-3">
        <div>
          <div className="label mb-2">Hareket Tipi *</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "draw",     label: "Kullanım",        color: "#7c3aed", desc: "Kredi çekildi" },
              { v: "repay",    label: "Geri Ödeme",      color: "#0f766e", desc: "Anapara ödendi" },
              { v: "interest", label: "Faiz Tahakkuku",  color: "#b45309", desc: "Faiz tahsil edildi" },
            ].map(opt => (
              <button key={opt.v} type="button"
                onClick={() => setDraft({ ...draft, type: opt.v })}
                className="px-2 py-2 rounded text-xs font-medium transition-all border"
                style={{
                  background: draft.type === opt.v ? opt.color : "var(--paper)",
                  color: draft.type === opt.v ? "#f5f3ef" : "var(--ink)",
                  borderColor: draft.type === opt.v ? opt.color : "var(--line)",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Tarih *</div>
            <input className="input w-full" type="date"
              value={draft.date}
              onChange={e => setDraft({ ...draft, date: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Tutar ({sym}) *</div>
            <input className="input w-full" type="number" step="0.01" placeholder="0,00"
              value={draft.amount}
              onChange={e => setDraft({ ...draft, amount: e.target.value })}/>
          </div>
        </div>
        <div>
          <div className="label mb-1">Açıklama</div>
          <input className="input w-full"
            value={draft.description}
            onChange={e => setDraft({ ...draft, description: e.target.value })}/>
        </div>
        {(draft.type === "repay" || draft.type === "interest") && (
          <div>
            <div className="label mb-1">Nakit Akış Kalemi</div>
            <select className="input w-full" value={draft.cashflowCatId}
              onChange={e => setDraft({ ...draft, cashflowCatId: e.target.value })}>
              <option value="">— (yansıtma yok)</option>
              {cashflowCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Geri ödeme/faiz nakit akış tablosuna gider olarak yansır
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Genel Amaçlı Modal ---------- */
function Modal({ title, icon: Ic, onClose, onSave, children, saveLabel = "Kaydet", maxWidth = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className={`card w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col`}
        style={{ background: "var(--paper)", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
        <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            {Ic && <Ic size={18} style={{ color: "var(--accent)" }}/>}
            <h3 className="display text-xl">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100"><X size={16}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div className="p-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
          <button onClick={onClose} className="btn btn-ghost">Vazgeç</button>
          <button onClick={onSave} className="btn btn-primary"><Check size={13}/> {saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   TRANSFER MODAL — Banka↔Kasa, Banka↔Banka, Kasa↔Kasa
===================================================================== */
function TransferModal({ data, prefill, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: prefill?.date || today,
    fromType: prefill?.fromType || "bank",
    fromId: prefill?.fromId || "",
    toType: prefill?.toType || "kasa",
    toId: prefill?.toId || "",
    fromAmount: "",
    toAmount: "",
    description: "",
    cashflowCatId: prefill?.cashflowCatId || "",
  });

  const fromInfo = form.fromId ? getEndpointInfo(form.fromType, form.fromId, data) : null;
  const toInfo = form.toId ? getEndpointInfo(form.toType, form.toId, data) : null;
  const currencyMismatch = fromInfo && toInfo && fromInfo.currency !== toInfo.currency;

  // Para birimi farklıysa, otomatik dönüştürme öner
  useEffect(() => {
    if (!currencyMismatch || !form.fromAmount) {
      // Para birimi aynıysa hedef tutar = kaynak tutar
      if (!currencyMismatch && form.fromAmount) {
        setForm(f => ({ ...f, toAmount: f.fromAmount }));
      }
      return;
    }
    // Çapraz kur hesabı: kaynak → TL → hedef
    const rates = data.exchangeRates || {};
    const sourceTRY = fromInfo.currency === "TRY" ? Number(form.fromAmount) : Number(form.fromAmount) * (rates[fromInfo.currency] || 1);
    const targetAmount = toInfo.currency === "TRY" ? sourceTRY : sourceTRY / (rates[toInfo.currency] || 1);
    setForm(f => ({ ...f, toAmount: targetAmount.toFixed(2) }));
  }, [form.fromAmount, currencyMismatch, fromInfo?.currency, toInfo?.currency]);

  const bankOptions = (data.bankAccounts || []).map(a => {
    const bank = (data.banks || []).find(b => b.id === a.bankId);
    return { id: a.id, label: `${bank?.name || "?"} — ${a.name}`, currency: a.currency };
  });
  const kasaOptions = (data.kasaAccounts || []).map(k => ({ id: k.id, label: k.name, currency: k.currency }));

  const handleSave = () => {
    if (!form.fromId || !form.toId) return alert("Kaynak ve hedef seçilmelidir");
    if (form.fromType === form.toType && form.fromId === form.toId) return alert("Kaynak ve hedef aynı olamaz");
    if (!form.fromAmount || Number(form.fromAmount) <= 0) return alert("Geçerli bir tutar girin");
    onSave({
      date: form.date,
      fromType: form.fromType,
      fromId: form.fromId,
      toType: form.toType,
      toId: form.toId,
      fromAmount: Number(form.fromAmount),
      toAmount: Number(form.toAmount) || Number(form.fromAmount),
      fromCurrency: fromInfo.currency,
      toCurrency: toInfo.currency,
      description: form.description.trim(),
      cashflowCatId: form.cashflowCatId || null,
    });
  };

  const EndpointPicker = ({ side, typeKey, idKey }) => {
    const currentType = form[typeKey];
    const options = currentType === "bank" ? bankOptions : kasaOptions;
    return (
      <div>
        <div className="label mb-1.5">{side === "from" ? "Kaynak (Kimden)" : "Hedef (Kime)"} *</div>
        <div className="flex items-center gap-1 mb-2 p-0.5 rounded text-xs" style={{ background: "var(--bg)" }}>
          {[
            { v: "bank", label: "Banka", Ic: Landmark },
            { v: "kasa", label: "Kasa",  Ic: Wallet },
          ].map(opt => (
            <button key={opt.v}
              onClick={() => setForm(f => ({ ...f, [typeKey]: opt.v, [idKey]: "" }))}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded font-medium"
              style={{
                background: currentType === opt.v ? "var(--accent)" : "transparent",
                color: currentType === opt.v ? "#f5f3ef" : "var(--ink-mute)",
              }}>
              <opt.Ic size={11}/>{opt.label}
            </button>
          ))}
        </div>
        <select className="input" value={form[idKey]}
          onChange={e => setForm(f => ({ ...f, [idKey]: e.target.value }))}>
          <option value="">— Seçiniz —</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.label} ({CURRENCY_SYMBOLS[o.currency]})</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <Modal title="Yeni Transfer" icon={ArrowLeftRight} onClose={onClose} onSave={handleSave}
      saveLabel="Transferi Kaydet" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <div className="label mb-1.5">Tarih</div>
          <input className="input" type="date" value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}/>
        </div>

        <div className="grid grid-cols-2 gap-3 items-start">
          <EndpointPicker side="from" typeKey="fromType" idKey="fromId"/>
          <EndpointPicker side="to"   typeKey="toType"   idKey="toId"/>
        </div>

        {fromInfo && toInfo && (
          <div className="flex items-center justify-center gap-2 text-xs p-2 rounded"
            style={{ background: "var(--bg)", color: "var(--ink-soft)" }}>
            <span className="font-medium">{fromInfo.shortName}</span>
            <ArrowRightLeft size={12} style={{ color: "var(--ink-mute)" }}/>
            <span className="font-medium">{toInfo.shortName}</span>
            {currencyMismatch && (
              <span className="chip ml-2" style={{ background: "#fef3c7", color: "#854d0e" }}>
                <RefreshCw size={9}/> Çapraz kur uygulanacak
              </span>
            )}
          </div>
        )}

        <div className={`grid ${currencyMismatch ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
          <div>
            <div className="label mb-1.5">
              Tutar {fromInfo && `(${CURRENCY_SYMBOLS[fromInfo.currency]} ${fromInfo.currency})`} *
            </div>
            <input className="input num text-right" type="number" step="0.01" autoFocus
              value={form.fromAmount}
              onChange={e => setForm({ ...form, fromAmount: e.target.value })}
              placeholder="0"/>
          </div>
          {currencyMismatch && (
            <div>
              <div className="label mb-1.5">
                Hedef Tutar ({CURRENCY_SYMBOLS[toInfo.currency]} {toInfo.currency})
              </div>
              <input className="input num text-right" type="number" step="0.01"
                value={form.toAmount}
                onChange={e => setForm({ ...form, toAmount: e.target.value })}/>
              <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Otomatik hesaplandı — istersen elle düzenleyebilirsin
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="label mb-1.5">Açıklama</div>
          <input className="input" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Örn: ATM çekim, Bankaya yatırım, EFT iade..."/>
        </div>

        <div>
          <div className="label mb-1.5">Nakit Akış Kalemi (opsiyonel)</div>
          <select className="input" value={form.cashflowCatId || ""}
            onChange={e => setForm({ ...form, cashflowCatId: e.target.value })}>
            <option value="">— Nakit akış tablosuna yansıma —</option>
            <optgroup label="Tahsilat Kalemleri">
              {(data.inflows || []).map(c => <option key={c.id} value={c.id}>↓ {c.name}</option>)}
            </optgroup>
            <optgroup label="Ödeme Kalemleri">
              {(data.outflows || []).map(c => <option key={c.id} value={c.id}>↑ {c.name}</option>)}
            </optgroup>
            <optgroup label="K/Z Harici Ödemeler">
              {(data.nonPnlOutflows || []).map(c => <option key={c.id} value={c.id}>○ {c.name}</option>)}
            </optgroup>
          </select>
          <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            Seçilirse bu transferin kaynak tutarı nakit akış tablosunda ilgili aydaki kaleme yansır.
            Hesaplar arası iç hareketler için boş bırakın.
          </p>
        </div>

        {/* Bakiye uyarısı */}
        {form.fromId && form.fromAmount && (() => {
          const bal = form.fromType === "bank"
            ? computeBankAccountBalance(form.fromId, data)
            : computeKasaBalance(form.fromId, data);
          const afterBal = bal - Number(form.fromAmount);
          return (
            <div className="p-3 rounded text-xs" style={{
              background: afterBal < 0 ? "#fef3c7" : "var(--bg)",
              color: afterBal < 0 ? "#854d0e" : "var(--ink-soft)"
            }}>
              <div className="flex items-center gap-1.5">
                {afterBal < 0 ? <AlertTriangle size={12}/> : <Info size={12}/>}
                <span>Mevcut bakiye: <strong>{fmtTL(bal)} {CURRENCY_SYMBOLS[fromInfo.currency]}</strong></span>
              </div>
              <div className="mt-0.5 pl-5">
                Transfer sonrası: <strong>{fmtTL(afterBal)} {CURRENCY_SYMBOLS[fromInfo.currency]}</strong>
                {afterBal < 0 && <span className="ml-1">⚠ Negatife düşecek</span>}
              </div>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
}

/* =====================================================================
   TRANSFERLER GÖRÜNÜMÜ
===================================================================== */
function TransfersView({ data, session, canAct, onChange, logAudit, notify }) {
  const canManage = canAct ? canAct("finance.transfers.create") || canAct("finance.transfers.update") || can(session.role, "manage_transfers") : can(session.role, "manage_transfers");
  const canDelete = canAct ? canAct("finance.transfers.delete") || can(session.role, "manage_transfers") : can(session.role, "manage_transfers");
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState({ type: "all", search: "" });

  const transfers = (data.transfers || []).slice().sort((a, b) =>
    (b.date + b.id).localeCompare(a.date + a.id)
  );

  // Filtre
  const filtered = transfers.filter(t => {
    if (filter.type === "bank-kasa" && !(t.fromType === "bank" && t.toType === "kasa")) return false;
    if (filter.type === "kasa-bank" && !(t.fromType === "kasa" && t.toType === "bank")) return false;
    if (filter.type === "bank-bank" && !(t.fromType === "bank" && t.toType === "bank")) return false;
    if (filter.type === "kasa-kasa" && !(t.fromType === "kasa" && t.toType === "kasa")) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const fromName = getEndpointInfo(t.fromType, t.fromId, data).name.toLowerCase();
      const toName = getEndpointInfo(t.toType, t.toId, data).name.toLowerCase();
      const desc = (t.description || "").toLowerCase();
      if (!fromName.includes(q) && !toName.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  const saveTransfer = async (formData) => {
    const newT = {
      id: "trf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ts: new Date().toISOString(),
      userId: session.userId,
      ...formData,
    };
    await onChange({ ...data, transfers: [...(data.transfers || []), newT] });
    const fromName = getEndpointInfo(newT.fromType, newT.fromId, data).shortName;
    const toName = getEndpointInfo(newT.toType, newT.toId, data).shortName;
    await logAudit("transfer_add", {
      kaynak: fromName, hedef: toName,
      tutar: newT.fromAmount,
      birim: newT.fromCurrency,
      açıklama: newT.description || "—",
    });
    notify(`Transfer kaydedildi: ${fromName} → ${toName}`);
    setShowModal(false);
  };

  const removeTransfer = async (t) => {
    if (!confirm("Bu transferi silmek istediğinizden emin misiniz? Bakiyeler otomatik düzeltilecek.")) return;
    await onChange({ ...data, transfers: data.transfers.filter(x => x.id !== t.id) });
    await logAudit("transfer_delete", {
      id: t.id, tutar: t.fromAmount, birim: t.fromCurrency,
    });
    notify("Transfer silindi");
  };

  // İstatistikler
  const stats = {
    total: transfers.length,
    bankToKasa: transfers.filter(t => t.fromType === "bank" && t.toType === "kasa").length,
    kasaToBank: transfers.filter(t => t.fromType === "kasa" && t.toType === "bank").length,
    interBank:  transfers.filter(t => t.fromType === "bank" && t.toType === "bank").length,
    interKasa:  transfers.filter(t => t.fromType === "kasa" && t.toType === "kasa").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">Hesaplar Arası Akış</div>
          <h1 className="display text-2xl md:text-3xl">Transferler</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
            Banka hesapları ve kasalar arasındaki para hareketleri
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <ArrowLeftRight size={13}/> Yeni Transfer
          </button>
        )}
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        <StatCard label="Toplam" value={stats.total} icon={ArrowLeftRight} color="var(--accent)"/>
        <StatCard label="Banka → Kasa" value={stats.bankToKasa} icon={ArrowDownToLine} color="#0f766e"/>
        <StatCard label="Kasa → Banka" value={stats.kasaToBank} icon={ArrowUpFromLine} color="#1d4ed8"/>
        <StatCard label="Banka → Banka" value={stats.interBank} icon={Landmark} color="#b45309"/>
        <StatCard label="Kasa → Kasa" value={stats.interKasa} icon={Wallet} color="#0b3d2e"/>
      </div>

      {/* Filtre */}
      <div className="card p-3 flex items-center gap-3" style={{ boxShadow: "var(--shadow)" }}>
        <Filter size={14} style={{ color: "var(--ink-mute)" }}/>
        <div className="flex items-center gap-1 rounded text-xs" style={{ background: "var(--bg)", padding: 2 }}>
          {[
            { v: "all", label: "Tümü" },
            { v: "bank-kasa", label: "Banka→Kasa" },
            { v: "kasa-bank", label: "Kasa→Banka" },
            { v: "bank-bank", label: "Banka→Banka" },
            { v: "kasa-kasa", label: "Kasa→Kasa" },
          ].map(t => (
            <button key={t.v} onClick={() => setFilter({ ...filter, type: t.v })}
              className="px-2.5 py-1 rounded font-medium transition-colors"
              style={{
                background: filter.type === t.v ? "var(--accent)" : "transparent",
                color: filter.type === t.v ? "#f5f3ef" : "var(--ink-mute)",
              }}>{t.label}</button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-mute)" }}/>
          <input className="input pl-7 text-xs" placeholder="Hesap/açıklama ara..." style={{ width: 220 }}
            value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })}/>
        </div>
        <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
          {filtered.length} kayıt
        </div>
      </div>

      {/* Tablo */}
      <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
        <table className="grid">
          <thead>
            <tr>
              <th className="label-cell" style={{ width: 100 }}>Tarih</th>
              <th className="label-cell">Kaynak</th>
              <th style={{ width: 30 }}></th>
              <th className="label-cell">Hedef</th>
              <th style={{ width: 140 }}>Kaynak Tutar</th>
              <th style={{ width: 140 }}>Hedef Tutar</th>
              <th className="label-cell">Açıklama</th>
              {canManage && <th style={{ width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={canManage ? 8 : 7} className="label-cell text-center py-10" style={{ color: "var(--ink-mute)" }}>
                <ArrowLeftRight size={28} className="mx-auto mb-2 opacity-50"/>
                <div>Henüz transfer kaydı yok.</div>
                {canManage && <div className="text-xs mt-1">Yukarıdaki "Yeni Transfer" butonu ile başlayabilirsiniz.</div>}
              </td></tr>
            ) : filtered.map(t => {
              const from = getEndpointInfo(t.fromType, t.fromId, data);
              const to = getEndpointInfo(t.toType, t.toId, data);
              const fxApplied = t.fromCurrency !== t.toCurrency;
              return (
                <tr key={t.id}>
                  <td className="label-cell mono text-xs">
                    {new Date(t.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </td>
                  <td className="label-cell text-xs">
                    <div className="flex items-center gap-1.5">
                      {t.fromType === "bank" ? <Landmark size={11} style={{ color: from.color }}/> : <Wallet size={11} style={{ color: from.color }}/>}
                      <span>{from.shortName}</span>
                    </div>
                  </td>
                  <td className="label-cell" style={{ color: "var(--ink-mute)" }}>
                    <ArrowRightLeft size={11}/>
                  </td>
                  <td className="label-cell text-xs">
                    <div className="flex items-center gap-1.5">
                      {t.toType === "bank" ? <Landmark size={11} style={{ color: to.color }}/> : <Wallet size={11} style={{ color: to.color }}/>}
                      <span>{to.shortName}</span>
                    </div>
                  </td>
                  <td className="num text-xs font-medium" style={{ color: "#b91c1c" }}>
                    −{fmtTL(t.fromAmount)} {CURRENCY_SYMBOLS[t.fromCurrency]}
                  </td>
                  <td className="num text-xs font-medium" style={{ color: "#0f766e" }}>
                    +{fmtTL(t.toAmount)} {CURRENCY_SYMBOLS[t.toCurrency]}
                    {fxApplied && (
                      <span className="ml-1 chip" style={{ background: "#fef3c7", color: "#854d0e", fontSize: 9 }}>FX</span>
                    )}
                  </td>
                  <td className="label-cell text-xs" style={{ color: "var(--ink-soft)" }}>
                    {t.description || "—"}
                  </td>
                  {canManage && (
                    <td>
                      <button onClick={() => removeTransfer(t)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={11} style={{ color: "var(--negative)" }}/>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <TransferModal data={data} onClose={() => setShowModal(false)} onSave={saveTransfer}/>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Ic, color }) {
  return (
    <div className="card p-4" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-start justify-between mb-2">
        <div className="label" style={{ fontSize: 10 }}>{label}</div>
        <Ic size={14} style={{ color }}/>
      </div>
      <div className="num display text-2xl">{value}</div>
    </div>
  );
}

/* =====================================================================
   FATURALAR (Gelen / Giden) — AR/AP Tracking
===================================================================== */
function getInvoiceStatus(inv) {
  const total = Number(inv.total) || 0;
  const paid = Number(inv.paidAmount) || 0;
  if (paid >= total && total > 0) return "paid";
  const today = new Date().toISOString().slice(0, 10);
  if (paid > 0) return "partial";
  if (inv.dueDate && inv.dueDate < today) return "overdue";
  return "open";
}

const INVOICE_STATUS = {
  open:    { label: "Açık",            bg: "#dbeafe", color: "#1d4ed8" },
  partial: { label: "Kısmen Ödendi",   bg: "#fef3c7", color: "#854d0e" },
  paid:    { label: "Ödendi",          bg: "#dcfce7", color: "#15803d" },
  overdue: { label: "Vadesi Geçti",    bg: "#fee2e2", color: "#b91c1c" },
};

/* =====================================================================
   FATURALAR — BİRLEŞİK SEKME (Manuel + e-Fatura)
   ---------------------------------------------------------------------
   Alt-sekmelerle iki modülü tek başlık altında sunar:
     • Manuel Faturalar  → InvoicesView (manuel girilen AR/AP)
     • e-Fatura          → EInvoiceManager (Logo eLogo entegrasyonu)
===================================================================== */
function InvoicesUnified({ data, session, canAct, onChange, logAudit, notify }) {
  const [subTab, setSubTab] = useState("manual");

  // Badge sayaçları
  const manualCount = (data.invoices || []).filter(i => !i.committedToCells).length;
  const apiBase = typeof window !== "undefined" ? window.PROMETCF_API : null;
  const isLive = Boolean(apiBase);

  // Demo / live için e-fatura cache sayısı
  const [einvCounts, setEinvCounts] = useState({ pending: 0, total: 0 });
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (isLive) {
          const res = await fetch(`${apiBase}/v1/einvoice/invoices?companyId=${data.activeCompanyId}&pending=true`, {
            headers: { Authorization: `Bearer ${session.token}` },
          });
          const json = await res.json();
          if (mounted) setEinvCounts({
            pending: (json.invoices || []).length,
            total: (json.invoices || []).length,
          });
        } else {
          const stored = await S.get(`promet:einvoice:${data.activeCompanyId}`) || [];
          const pending = stored.filter(e => !e.imported_invoice_id && !e.ignored).length;
          if (mounted) setEinvCounts({ pending, total: stored.length });
        }
      } catch {
        if (mounted) setEinvCounts({ pending: 0, total: 0 });
      }
    })();
    return () => { mounted = false; };
  }, [data.activeCompanyId, isLive, apiBase, session.token, subTab]);

  return (
    <div className="space-y-4">
      {/* Üst başlık */}
      <div>
        <div className="label mb-1">Alacaklar / Borçlar / Resmi Faturalar</div>
        <h1 className="display text-2xl md:text-3xl">Faturalar</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
          Manuel girilen faturalar ile Logo eLogo'dan çekilen e-faturaları tek yerden yönetin
        </p>
      </div>

      {/* Alt-sekme bar */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--line)" }}>
        <SubTabButton
          active={subTab === "manual"} onClick={() => setSubTab("manual")}
          icon={Receipt} label="Manuel Faturalar" badge={manualCount > 0 ? manualCount : null}
        />
        <SubTabButton
          active={subTab === "einvoice"} onClick={() => setSubTab("einvoice")}
          icon={FileText} label="e-Fatura (Logo eLogo)"
          badge={einvCounts.pending > 0 ? einvCounts.pending : null}
          badgeColor="#b45309"
          extra={!isLive && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
              style={{ background: "#fef3c7", color: "#854d0e" }}>
              Demo
            </span>
          )}
        />
      </div>

      {/* İçerik */}
      {subTab === "manual" && (
        <InvoicesView data={data} session={session} canAct={canAct}
          onChange={onChange} logAudit={logAudit} notify={notify}
          embedded={true}/>
      )}
      {subTab === "einvoice" && (
        <EInvoiceManager data={data} session={session} canAct={canAct}
          onChange={onChange} logAudit={logAudit} notify={notify}
          embedded={true}/>
      )}
    </div>
  );
}

/* ---------- Alt-sekme butonu (yeniden kullanılabilir) ---------- */
function SubTabButton({ active, onClick, icon: Ic, label, badge, badgeColor = "var(--negative)", extra }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2"
      style={{
        borderBottomColor: active ? "var(--accent)" : "transparent",
        color: active ? "var(--accent)" : "var(--ink-soft)",
      }}>
      <Ic size={13}/>
      <span>{label}</span>
      {badge != null && (
        <span className="text-xs px-1.5 py-0.5 rounded font-bold"
          style={{ background: badgeColor, color: "#fff", minWidth: 18, textAlign: "center" }}>
          {badge}
        </span>
      )}
      {extra}
    </button>
  );
}

/* =====================================================================
   FATURALAR — MANUEL (InvoicesView, embedded mod destekli)
===================================================================== */
function InvoicesView({ data, session, canAct, onChange, logAudit, notify, embedded = false }) {
  const canManage = canAct ? canAct("finance.invoices.update") || canAct("finance.invoices.create") || can(session.role, "manage_invoices") : can(session.role, "manage_invoices");
  const canCreate = canAct ? canAct("finance.invoices.create") || can(session.role, "manage_invoices") : can(session.role, "manage_invoices");
  const canDelete = canAct ? canAct("finance.invoices.delete") || can(session.role, "manage_invoices") : can(session.role, "manage_invoices");
  const canExport = canAct ? canAct("finance.invoices.export") || can(session.role, "manage_invoices") : can(session.role, "manage_invoices");
  const dc = data.displayCurrency || "TRY";
  const rates = data.exchangeRates || {};

  const [activeType, setActiveType] = useState("out"); // "in" = gelen, "out" = giden
  const [filter, setFilter] = useState({ status: "all", search: "", dateFrom: "", dateTo: "" });
  const [invoiceDraft, setInvoiceDraft] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState(null);

  const allInvoices = data.invoices || [];

  // Filtreleme
  const invoices = useMemo(() => {
    let list = allInvoices.filter(i => i.type === activeType);
    if (filter.status !== "all") list = list.filter(i => getInvoiceStatus(i) === filter.status);
    if (filter.dateFrom) list = list.filter(i => i.date >= filter.dateFrom);
    if (filter.dateTo) list = list.filter(i => i.date <= filter.dateTo);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(i =>
        (i.invoiceNo || "").toLowerCase().includes(q) ||
        (i.counterparty || "").toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  }, [allInvoices, activeType, filter]);

  // İstatistikler (filtresiz)
  const typeInvoices = allInvoices.filter(i => i.type === activeType);
  const totalTRY = typeInvoices.reduce((s, i) => s + convertToTRY(i.total, i.currency, rates), 0);
  const paidTRY = typeInvoices.reduce((s, i) => s + convertToTRY(i.paidAmount, i.currency, rates), 0);
  const outstandingTRY = totalTRY - paidTRY;
  const overdueCount = typeInvoices.filter(i => getInvoiceStatus(i) === "overdue").length;

  const saveInvoice = async () => {
    const d = invoiceDraft;
    if (!d.invoiceNo || !d.counterparty || !d.total) {
      return notify("Fatura no, taraf ve toplam zorunlu", "err");
    }
    const isEdit = !!d.id;
    const inv = isEdit ? d : {
      id: "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      createdAt: new Date().toISOString(),
      createdBy: session.userId,
      paidAmount: 0,
      payments: [],
      ...d,
    };
    inv.total = Number(d.total) || 0;
    inv.netAmount = Number(d.netAmount) || inv.total;
    inv.vatRate = Number(d.vatRate) || 0;
    inv.vatAmount = Number(d.vatAmount) || 0;
    const nextInvoices = isEdit
      ? allInvoices.map(x => x.id === inv.id ? inv : x)
      : [...allInvoices, inv];
    await onChange({ ...data, invoices: nextInvoices });
    await logAudit(isEdit ? "invoice_edit" : "invoice_add", {
      tip: inv.type === "in" ? "Gelen" : "Giden",
      no: inv.invoiceNo, taraf: inv.counterparty,
      tutar: inv.total, birim: inv.currency,
    });
    notify(isEdit ? "Fatura güncellendi" : "Fatura kaydedildi");
    setInvoiceDraft(null);
  };

  const removeInvoice = async (inv) => {
    if (!confirm(`"${inv.invoiceNo}" numaralı faturayı silmek istediğinizden emin misiniz?`)) return;
    await onChange({ ...data, invoices: allInvoices.filter(x => x.id !== inv.id) });
    await logAudit("invoice_delete", { no: inv.invoiceNo, taraf: inv.counterparty });
    notify("Fatura silindi");
  };

  const recordPayment = async () => {
    const p = paymentDraft;
    if (!p.amount || Number(p.amount) <= 0) return notify("Geçerli bir tutar girin", "err");
    const inv = allInvoices.find(i => i.id === p.invoiceId);
    if (!inv) return;
    const payment = {
      id: "pay_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      date: p.date,
      amount: Number(p.amount),
      currency: inv.currency,
      fromType: p.fromType,
      fromId: p.fromId,
      description: p.description || "",
      ts: new Date().toISOString(),
    };
    const newPaidAmount = (Number(inv.paidAmount) || 0) + payment.amount;
    const updated = {
      ...inv,
      paidAmount: newPaidAmount,
      payments: [...(inv.payments || []), payment],
    };
    await onChange({ ...data, invoices: allInvoices.map(x => x.id === inv.id ? updated : x) });
    await logAudit("invoice_payment", {
      no: inv.invoiceNo, taraf: inv.counterparty,
      tutar: payment.amount, birim: inv.currency,
    });
    notify(newPaidAmount >= Number(inv.total) ? "Fatura tamamen kapatıldı" : `Ödeme kaydedildi: ${fmtTL(payment.amount)} ${CURRENCY_SYMBOLS[inv.currency]}`);
    setPaymentDraft(null);
  };

  const headerLabel = activeType === "in" ? "Gelen Faturalar" : "Giden Faturalar";
  const counterpartyLabel = activeType === "in" ? "Tedarikçi" : "Müşteri";

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        {!embedded && (
          <div>
            <div className="label mb-1">Alacaklar / Borçlar Yönetimi</div>
            <h1 className="display text-2xl md:text-3xl">Faturalar</h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
              Gelen (tedarikçi) ve giden (müşteri) faturalarınızı, ödeme durumlarıyla takip edin
            </p>
          </div>
        )}
        {canManage && (
          <button onClick={() => setInvoiceDraft({
            type: activeType,
            invoiceNo: "",
            date: new Date().toISOString().slice(0, 10),
            dueDate: "",
            counterparty: "",
            description: "",
            netAmount: "",
            vatRate: 20,
            vatAmount: "",
            total: "",
            currency: "TRY",
            cashflowCatId: "",
          })} className={embedded ? "btn btn-primary ml-auto" : "btn btn-primary"}>
            <Plus size={13}/> Yeni Fatura
          </button>
        )}
      </div>

      {/* Tip seçici */}
      <div className="flex items-center gap-2 p-1 rounded w-full md:w-auto md:inline-flex"
        style={{ background: "var(--bg)" }}>
        <button onClick={() => setActiveType("out")}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
          style={{
            background: activeType === "out" ? "var(--accent)" : "transparent",
            color: activeType === "out" ? "#f5f3ef" : "var(--ink-mute)",
          }}>
          <ArrowUpFromLine size={13}/> Giden Faturalar
        </button>
        <button onClick={() => setActiveType("in")}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
          style={{
            background: activeType === "in" ? "var(--accent)" : "transparent",
            color: activeType === "in" ? "#f5f3ef" : "var(--ink-mute)",
          }}>
          <ArrowDownToLine size={13}/> Gelen Faturalar
        </button>
      </div>

      {/* KPI kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label={`Toplam ${headerLabel.split(" ")[0]}`} value={totalTRY}
          icon={Receipt} accent="var(--accent)" dc={dc} rates={rates}/>
        <KpiCard label="Tahsil/Ödenen" value={paidTRY}
          icon={FileCheck} accent="#0f766e" dc={dc} rates={rates}/>
        <KpiCard label="Bakiye" value={outstandingTRY}
          icon={FileClock} accent={outstandingTRY > 0 ? "#b45309" : "#0f766e"} dc={dc} rates={rates}/>
        <div className="card p-4 md:p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between mb-2 md:mb-3">
            <div className="label">Vadesi Geçen</div>
            <AlertTriangle size={14} style={{ color: overdueCount > 0 ? "#b91c1c" : "var(--ink-mute)" }}/>
          </div>
          <div className="num display text-2xl md:text-3xl" style={{ color: overdueCount > 0 ? "var(--negative)" : "var(--ink)" }}>
            {overdueCount}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            {overdueCount > 0 ? "fatura gecikti" : "Sorunsuz"}
          </div>
        </div>
      </div>

      {/* Filtre */}
      <div className="card p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} style={{ color: "var(--ink-mute)" }} className="hidden md:block"/>
          <div className="flex items-center gap-1 rounded text-xs flex-wrap" style={{ background: "var(--bg)", padding: 2 }}>
            {[
              { v: "all",     label: "Tümü" },
              { v: "open",    label: "Açık" },
              { v: "partial", label: "Kısmi" },
              { v: "paid",    label: "Ödendi" },
              { v: "overdue", label: "Gecikti" },
            ].map(t => (
              <button key={t.v} onClick={() => setFilter({ ...filter, status: t.v })}
                className="px-2.5 py-1 rounded font-medium transition-colors"
                style={{
                  background: filter.status === t.v ? "var(--accent)" : "transparent",
                  color: filter.status === t.v ? "#f5f3ef" : "var(--ink-mute)",
                }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 flex-wrap md:flex-nowrap md:justify-end">
          <input type="date" className="input text-xs" style={{ width: 140 }}
            value={filter.dateFrom} onChange={e => setFilter({ ...filter, dateFrom: e.target.value })}/>
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>—</span>
          <input type="date" className="input text-xs" style={{ width: 140 }}
            value={filter.dateTo} onChange={e => setFilter({ ...filter, dateTo: e.target.value })}/>
          <div className="relative flex-1 min-w-[160px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-mute)" }}/>
            <input className="input pl-7 text-xs w-full" placeholder="No / taraf / açıklama ara..."
              value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })}/>
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="card overflow-x-auto" style={{ boxShadow: "var(--shadow)" }}>
        <table className="grid" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th className="label-cell" style={{ width: 110 }}>Fatura No</th>
              <th className="label-cell" style={{ width: 95 }}>Tarih</th>
              <th className="label-cell" style={{ width: 95 }}>Vade</th>
              <th className="label-cell">{counterpartyLabel}</th>
              <th style={{ width: 130 }}>Net</th>
              <th style={{ width: 80 }}>KDV%</th>
              <th style={{ width: 130 }}>Toplam</th>
              <th style={{ width: 130 }}>Tahsil/Ödeme</th>
              <th className="label-cell" style={{ width: 130 }}>Durum</th>
              {canManage && <th style={{ width: 110 }}></th>}
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={canManage ? 10 : 9} className="label-cell text-center py-10" style={{ color: "var(--ink-mute)" }}>
                <Receipt size={28} className="mx-auto mb-2 opacity-50"/>
                <div>Bu filtrelere uyan fatura yok.</div>
              </td></tr>
            ) : invoices.map(inv => {
              const status = getInvoiceStatus(inv);
              const sl = INVOICE_STATUS[status];
              const sym = CURRENCY_SYMBOLS[inv.currency] || "₺";
              const remaining = Number(inv.total) - Number(inv.paidAmount || 0);
              return (
                <tr key={inv.id}>
                  <td className="label-cell mono text-xs font-medium">{inv.invoiceNo}</td>
                  <td className="label-cell mono text-xs">{inv.date}</td>
                  <td className="label-cell mono text-xs" style={{ color: status === "overdue" ? "var(--negative)" : "var(--ink-soft)" }}>
                    {inv.dueDate || "—"}
                  </td>
                  <td className="label-cell text-xs">
                    <div className="font-medium">{inv.counterparty}</div>
                    {inv.description && <div className="text-xs" style={{ color: "var(--ink-mute)" }}>{inv.description}</div>}
                  </td>
                  <td className="num text-xs">{fmtTL(inv.netAmount) || "—"} <span style={{ color: "var(--ink-mute)" }}>{sym}</span></td>
                  <td className="num text-xs">{inv.vatRate || 0}%</td>
                  <td className="num text-xs font-medium">{fmtTL(inv.total)} <span style={{ color: "var(--ink-mute)" }}>{sym}</span></td>
                  <td className="num text-xs">
                    <div style={{ color: "#0f766e" }}>{fmtTL(inv.paidAmount || 0)}</div>
                    {remaining > 0.01 && (
                      <div style={{ color: "var(--ink-mute)", fontSize: 10 }}>
                        kalan: {fmtTL(remaining)}
                      </div>
                    )}
                  </td>
                  <td className="label-cell">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="chip" style={{ background: sl.bg, color: sl.color }}>{sl.label}</span>
                      {inv.committedToCells && (
                        <span className="chip" style={{ background: "#ede9fe", color: "#7c3aed" }}
                          title={`Nakit akış tablosuna ${inv.committedAt ? new Date(inv.committedAt).toLocaleDateString("tr-TR") : ""} tarihinde yansıtıldı`}>
                          <Save size={9}/> Yansıtıldı
                        </span>
                      )}
                    </div>
                  </td>
                  {canManage && (
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        {status !== "paid" && (
                          <button onClick={() => setPaymentDraft({
                            invoiceId: inv.id,
                            date: new Date().toISOString().slice(0, 10),
                            amount: remaining.toFixed(2),
                            fromType: "bank", fromId: "",
                            description: "",
                          })} className="p-1.5 rounded hover:bg-green-50" title="Ödeme/tahsilat kaydet">
                            <Banknote size={11} style={{ color: "#0f766e" }}/>
                          </button>
                        )}
                        <button onClick={() => setInvoiceDraft(inv)} className="p-1.5 rounded hover:bg-stone-100" title="Düzenle">
                          <Edit3 size={11}/>
                        </button>
                        <button onClick={() => removeInvoice(inv)} className="p-1.5 rounded hover:bg-red-50" title="Sil">
                          <Trash2 size={11} style={{ color: "var(--negative)" }}/>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fatura modali */}
      {invoiceDraft && (
        <Modal title={invoiceDraft.id ? "Fatura Düzenle" : "Yeni Fatura"}
          icon={Receipt} maxWidth="max-w-xl"
          onClose={() => setInvoiceDraft(null)}
          onSave={saveInvoice}
          saveLabel={invoiceDraft.id ? "Güncelle" : "Faturayı Kaydet"}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Tip</div>
                <div className="flex items-center gap-1 p-0.5 rounded" style={{ background: "var(--bg)" }}>
                  <button type="button" onClick={() => setInvoiceDraft({ ...invoiceDraft, type: "out" })}
                    className="flex-1 px-2 py-1.5 rounded text-xs font-medium"
                    style={{
                      background: invoiceDraft.type === "out" ? "var(--accent)" : "transparent",
                      color: invoiceDraft.type === "out" ? "#f5f3ef" : "var(--ink-mute)",
                    }}>
                    <ArrowUpFromLine size={11} className="inline mr-1"/> Giden
                  </button>
                  <button type="button" onClick={() => setInvoiceDraft({ ...invoiceDraft, type: "in" })}
                    className="flex-1 px-2 py-1.5 rounded text-xs font-medium"
                    style={{
                      background: invoiceDraft.type === "in" ? "var(--accent)" : "transparent",
                      color: invoiceDraft.type === "in" ? "#f5f3ef" : "var(--ink-mute)",
                    }}>
                    <ArrowDownToLine size={11} className="inline mr-1"/> Gelen
                  </button>
                </div>
              </div>
              <div>
                <div className="label mb-1">Fatura No *</div>
                <input className="input mono" value={invoiceDraft.invoiceNo}
                  onChange={e => setInvoiceDraft({ ...invoiceDraft, invoiceNo: e.target.value })}
                  placeholder="2025-001 / FAT2025000001"/>
              </div>
            </div>

            <div>
              <div className="label mb-1">{invoiceDraft.type === "in" ? "Tedarikçi" : "Müşteri"} *</div>
              <input className="input" value={invoiceDraft.counterparty}
                onChange={e => setInvoiceDraft({ ...invoiceDraft, counterparty: e.target.value })}
                placeholder={invoiceDraft.type === "in" ? "Tedarikçi unvanı..." : "Müşteri unvanı..."}/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Fatura Tarihi *</div>
                <input className="input" type="date" value={invoiceDraft.date}
                  onChange={e => setInvoiceDraft({ ...invoiceDraft, date: e.target.value })}/>
              </div>
              <div>
                <div className="label mb-1">Vade Tarihi</div>
                <input className="input" type="date" value={invoiceDraft.dueDate}
                  onChange={e => setInvoiceDraft({ ...invoiceDraft, dueDate: e.target.value })}/>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="label mb-1">Para Birimi</div>
                <select className="input" value={invoiceDraft.currency}
                  onChange={e => setInvoiceDraft({ ...invoiceDraft, currency: e.target.value })}>
                  <option value="TRY">{CURRENCY_SYMBOLS.TRY} TRY</option>
                  <option value="USD">{CURRENCY_SYMBOLS.USD} USD</option>
                  <option value="EUR">{CURRENCY_SYMBOLS.EUR} EUR</option>
                </select>
              </div>
              <div>
                <div className="label mb-1">Net Tutar *</div>
                <input className="input num text-right" type="number" step="0.01" value={invoiceDraft.netAmount}
                  onChange={e => {
                    const net = Number(e.target.value) || 0;
                    const vatR = Number(invoiceDraft.vatRate) || 0;
                    const vat = +(net * vatR / 100).toFixed(2);
                    setInvoiceDraft({ ...invoiceDraft, netAmount: e.target.value, vatAmount: vat, total: +(net + vat).toFixed(2) });
                  }}/>
              </div>
              <div>
                <div className="label mb-1">KDV %</div>
                <input className="input num text-right" type="number" value={invoiceDraft.vatRate}
                  onChange={e => {
                    const vatR = Number(e.target.value) || 0;
                    const net = Number(invoiceDraft.netAmount) || 0;
                    const vat = +(net * vatR / 100).toFixed(2);
                    setInvoiceDraft({ ...invoiceDraft, vatRate: e.target.value, vatAmount: vat, total: +(net + vat).toFixed(2) });
                  }}/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">KDV Tutarı</div>
                <input className="input num text-right" type="number" step="0.01" value={invoiceDraft.vatAmount}
                  onChange={e => setInvoiceDraft({ ...invoiceDraft, vatAmount: e.target.value, total: +(Number(invoiceDraft.netAmount || 0) + Number(e.target.value || 0)).toFixed(2) })}/>
              </div>
              <div>
                <div className="label mb-1">Toplam *</div>
                <input className="input num text-right font-semibold" type="number" step="0.01" value={invoiceDraft.total}
                  onChange={e => setInvoiceDraft({ ...invoiceDraft, total: e.target.value })}/>
              </div>
            </div>

            <div>
              <div className="label mb-1">Nakit Akış Kalemi (eşleştirme)</div>
              <select className="input" value={invoiceDraft.cashflowCatId || ""}
                onChange={e => setInvoiceDraft({ ...invoiceDraft, cashflowCatId: e.target.value })}>
                <option value="">— Eşleştirme yok —</option>
                {(invoiceDraft.type === "in" ? data.outflows : data.inflows).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                {invoiceDraft.type === "in"
                  ? "Bu faturanın ödemesi nakit akış tablosundaki hangi ödeme kalemine yansıyacak?"
                  : "Bu faturanın tahsilatı nakit akış tablosundaki hangi tahsilat kalemine yansıyacak?"}
              </p>
            </div>

            <div>
              <div className="label mb-1">Açıklama</div>
              <input className="input" value={invoiceDraft.description}
                onChange={e => setInvoiceDraft({ ...invoiceDraft, description: e.target.value })}
                placeholder="Mal/hizmet açıklaması..."/>
            </div>
          </div>
        </Modal>
      )}

      {/* Ödeme modali */}
      {paymentDraft && (() => {
        const inv = allInvoices.find(i => i.id === paymentDraft.invoiceId);
        if (!inv) return null;
        const sym = CURRENCY_SYMBOLS[inv.currency];
        const remaining = Number(inv.total) - Number(inv.paidAmount || 0);
        return (
          <Modal title={inv.type === "in" ? "Ödeme Kaydet" : "Tahsilat Kaydet"}
            icon={Banknote} maxWidth="max-w-md"
            onClose={() => setPaymentDraft(null)}
            onSave={recordPayment}
            saveLabel={inv.type === "in" ? "Ödemeyi Kaydet" : "Tahsilatı Kaydet"}>
            <div className="space-y-3">
              <div className="p-3 rounded text-xs" style={{ background: "var(--bg)" }}>
                <div className="font-medium">{inv.invoiceNo} · {inv.counterparty}</div>
                <div className="mt-1 flex gap-4" style={{ color: "var(--ink-soft)" }}>
                  <span>Toplam: <strong>{fmtTL(inv.total)} {sym}</strong></span>
                  <span>Ödenen: <strong>{fmtTL(inv.paidAmount || 0)} {sym}</strong></span>
                  <span>Kalan: <strong style={{ color: "var(--accent)" }}>{fmtTL(remaining)} {sym}</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="label mb-1">Tarih *</div>
                  <input className="input" type="date" value={paymentDraft.date}
                    onChange={e => setPaymentDraft({ ...paymentDraft, date: e.target.value })}/>
                </div>
                <div>
                  <div className="label mb-1">Tutar ({sym}) *</div>
                  <input className="input num text-right" type="number" step="0.01" autoFocus value={paymentDraft.amount}
                    onChange={e => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}/>
                </div>
              </div>
              <div>
                <div className="label mb-1">Kaynak/Hedef</div>
                <div className="flex items-center gap-1 p-0.5 rounded mb-2" style={{ background: "var(--bg)" }}>
                  {[{v:"bank",label:"Banka",Ic:Landmark},{v:"kasa",label:"Kasa",Ic:Wallet}].map(opt => (
                    <button type="button" key={opt.v}
                      onClick={() => setPaymentDraft({ ...paymentDraft, fromType: opt.v, fromId: "" })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium"
                      style={{
                        background: paymentDraft.fromType === opt.v ? "var(--accent)" : "transparent",
                        color: paymentDraft.fromType === opt.v ? "#f5f3ef" : "var(--ink-mute)",
                      }}>
                      <opt.Ic size={11}/>{opt.label}
                    </button>
                  ))}
                </div>
                <select className="input" value={paymentDraft.fromId}
                  onChange={e => setPaymentDraft({ ...paymentDraft, fromId: e.target.value })}>
                  <option value="">— Seçiniz —</option>
                  {paymentDraft.fromType === "bank"
                    ? (data.bankAccounts || []).map(a => {
                        const bank = (data.banks || []).find(b => b.id === a.bankId);
                        return <option key={a.id} value={a.id}>{bank?.name || "?"} — {a.name} ({CURRENCY_SYMBOLS[a.currency]})</option>;
                      })
                    : (data.kasaAccounts || []).map(k => (
                        <option key={k.id} value={k.id}>{k.name} ({CURRENCY_SYMBOLS[k.currency]})</option>
                      ))
                  }
                </select>
              </div>
              <div>
                <div className="label mb-1">Açıklama (opsiyonel)</div>
                <input className="input" value={paymentDraft.description}
                  onChange={e => setPaymentDraft({ ...paymentDraft, description: e.target.value })}
                  placeholder="Banka ref no, dekont no..."/>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

/* =====================================================================
   E-FATURA ENTEGRASYONU (Logo eLogo)
   ---------------------------------------------------------------------
   İki çalışma modu:
   1. Bağlı mod (window.PROMETCF_API tanımlı): Backend'e bağlanır,
      gerçek eLogo çağrıları backend tarafından yapılır.
   2. Demo mod (default): localStorage'da örnek faturalarla çalışır,
      bulk-import UI'ı banka Excel import gibi davranır.
===================================================================== */
function EInvoiceManager({ data, session, canAct, onChange, logAudit, notify, embedded = false }) {
  const canManage = canAct ? canAct("finance.einvoice.update") || canAct("finance.invoices.update") || can(session.role, "manage_invoices") : can(session.role, "manage_invoices");
  const canImport = canAct ? canAct("finance.einvoice.create") || canAct("finance.invoices.create") || can(session.role, "manage_invoices") : can(session.role, "manage_invoices");
  const apiBase = typeof window !== "undefined" ? window.PROMETCF_API : null;
  const isLive = Boolean(apiBase);

  const [tab, setTab] = useState("inbox");  // inbox | outbox | sync | settings
  const [einvoices, setEinvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncRange, setSyncRange] = useState({
    from: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10); })(),
    to: new Date().toISOString().slice(0,10),
  });
  const [credsDraft, setCredsDraft] = useState(null);
  const [showImport, setShowImport] = useState(null);  // tek fatura | bulk
  const [providerStatus, setProviderStatus] = useState(null);

  // Cashflow kategorileri (NA kalemi seçimi için)
  const cashflowCats = useMemo(() => [
    ...(data.inflows || []), ...(data.outflows || []), ...(data.nonPnlOutflows || [])
  ], [data.inflows, data.outflows, data.nonPnlOutflows]);

  // ─── Veri yükle: live mode'da API'den, demo mode'da localStorage'dan ────
  const loadEinvoices = useCallback(async () => {
    setLoading(true);
    try {
      if (isLive) {
        const res = await fetch(`${apiBase}/v1/einvoice/invoices?companyId=${data.activeCompanyId}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const json = await res.json();
        setEinvoices(json.invoices || []);
        // Provider status
        const sRes = await fetch(`${apiBase}/v1/einvoice/status?companyId=${data.activeCompanyId}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const sJson = await sRes.json();
        setProviderStatus(sJson.providers?.[0] || null);
      } else {
        // Demo: localStorage
        const stored = await S.get(`promet:einvoice:${data.activeCompanyId}`);
        setEinvoices(stored || []);
      }
    } catch (err) {
      console.error("e-Fatura yükleme hatası:", err);
      notify("e-Fatura yüklenemedi: " + err.message, "err");
    } finally {
      setLoading(false);
    }
  }, [isLive, apiBase, data.activeCompanyId, session.token, notify]);

  useEffect(() => { loadEinvoices(); }, [loadEinvoices]);

  // ─── Senkron tetikle ─────────────────────────────────────────────────
  const triggerSync = async () => {
    setSyncing(true);
    try {
      if (isLive) {
        const res = await fetch(`${apiBase}/v1/einvoice/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            companyId: data.activeCompanyId,
            provider: "elogo",
            dateFrom: syncRange.from,
            dateTo: syncRange.to,
            direction: "both",
          }),
        });
        const json = await res.json();
        if (json.status === "error") {
          alert("Senkron hatası: " + json.errorMessage);
        } else {
          notify(`${json.incomingNew} gelen + ${json.outgoingNew} giden yeni fatura çekildi`);
        }
      } else {
        // Demo: 30 örnek fatura üret
        const mock = generateMockEinvoices(30, syncRange.from, syncRange.to);
        const stored = await S.get(`promet:einvoice:${data.activeCompanyId}`) || [];
        const existing = new Set(stored.map(e => e.uuid));
        const newOnes = mock.filter(m => !existing.has(m.uuid));
        const merged = [...stored, ...newOnes];
        await S.set(`promet:einvoice:${data.activeCompanyId}`, merged);
        notify(`(Demo) ${newOnes.length} örnek fatura eklendi`);
      }
      await loadEinvoices();
      await logAudit("einvoice_sync", { from: syncRange.from, to: syncRange.to, live: isLive });
    } catch (err) {
      alert("Senkron hatası: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // ─── Faturayı nakit akış invoice'larına aktar ────────────────────────
  const importInvoice = async (einv, cashflowCatId) => {
    if (!cashflowCatId) { alert("Nakit Akış Kalemi seçin"); return; }
    try {
      if (isLive) {
        const res = await fetch(`${apiBase}/v1/einvoice/invoices/${einv.id}/import?companyId=${data.activeCompanyId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ cashflowCatId }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "API hatası");
        }
      } else {
        // Demo: localStorage e-fatura'yı işaretle + invoices array'e ekle
        const newInv = {
          id: "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
          invoiceNo: einv.invoice_no || einv.invoiceNo,
          type: einv.direction === "incoming" ? "AP" : "AR",
          partyName: einv.party_name || einv.partyName,
          partyVkn: einv.party_vkn_tckn || einv.partyVknTckn,
          issueDate: einv.issue_date || einv.issueDate,
          dueDate: einv.due_date || einv.dueDate || einv.issue_date || einv.issueDate,
          currency: einv.currency || "TRY",
          total: Number(einv.payable_amount || einv.payableAmount) || 0,
          paidAmount: 0,
          cashflowCatId,
          source: "einvoice",
          sourceUuid: einv.uuid,
          committedToCells: false,
          createdAt: new Date().toISOString(),
        };
        await onChange({ ...data, invoices: [...(data.invoices || []), newInv] });
        // E-fatura cache'inde imported işaretle
        const stored = await S.get(`promet:einvoice:${data.activeCompanyId}`) || [];
        const updated = stored.map(e => e.uuid === einv.uuid
          ? { ...e, imported_invoice_id: newInv.id, imported_at: new Date().toISOString() }
          : e);
        await S.set(`promet:einvoice:${data.activeCompanyId}`, updated);
      }
      await loadEinvoices();
      await logAudit("einvoice_import", { uuid: einv.uuid, invoiceNo: einv.invoice_no || einv.invoiceNo });
      notify("Fatura aktarıldı");
    } catch (err) {
      alert("Aktarma hatası: " + err.message);
    }
  };

  // ─── Filtreleme ──────────────────────────────────────────────────────
  const inbox = einvoices.filter(e => (e.direction || "incoming") === "incoming");
  const outbox = einvoices.filter(e => (e.direction || "outgoing") === "outgoing");
  const inboxPending = inbox.filter(e => !e.imported_invoice_id && !e.ignored);
  const outboxPending = outbox.filter(e => !e.imported_invoice_id && !e.ignored);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!embedded && (
          <div>
            <div className="label mb-1">Entegrasyon</div>
            <h1 className="display text-2xl md:text-3xl">e-Fatura · Logo eLogo</h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
              {isLive
                ? "Logo eLogo entegratörüne bağlı · Gerçek mod"
                : "Demo mod · Backend bağlantısı yok, örnek verilerle çalışıyor"}
            </p>
          </div>
        )}
        <div className={`flex items-center gap-2 ${embedded ? "ml-auto" : ""}`}>
          <input type="date" className="input text-xs" value={syncRange.from}
            onChange={e => setSyncRange({ ...syncRange, from: e.target.value })}/>
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>—</span>
          <input type="date" className="input text-xs" value={syncRange.to}
            onChange={e => setSyncRange({ ...syncRange, to: e.target.value })}/>
          <button onClick={triggerSync} disabled={syncing}
            className="btn btn-primary">
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""}/>
            {syncing ? "Senkron..." : "Senkron Et"}
          </button>
        </div>
      </div>

      {/* Durum kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Gelen Fatura" value={inbox.length}
          color="#0f766e" large/>
        <StatBlock label="Bekleyen (Gelen)" value={inboxPending.length}
          color={inboxPending.length > 0 ? "#b91c1c" : "var(--ink-mute)"} large/>
        <StatBlock label="Giden Fatura" value={outbox.length}
          color="#1d4ed8" large/>
        <StatBlock label="Bekleyen (Giden)" value={outboxPending.length}
          color={outboxPending.length > 0 ? "#b45309" : "var(--ink-mute)"} large/>
      </div>

      {/* Bağlantı durumu (live mode) */}
      {isLive && providerStatus && (
        <div className="card p-3 flex items-center justify-between text-xs"
          style={{ background: providerStatus.last_sync_status === "success" ? "#dcfce7" : "var(--bg)" }}>
          <div className="flex items-center gap-2">
            <Info size={12}/>
            <span>
              Son senkron: {providerStatus.last_sync_at ? new Date(providerStatus.last_sync_at).toLocaleString("tr-TR") : "Henüz yok"}
              {providerStatus.auto_sync_enabled && <> · Otomatik senkron <b>açık</b> ({providerStatus.auto_sync_cron})</>}
            </span>
          </div>
          {canManage && (
            <button onClick={() => setCredsDraft({})} className="btn btn-ghost text-xs">
              <Settings size={10}/> Ayarlar
            </button>
          )}
        </div>
      )}

      {/* Bağlantı yoksa setup CTA (live mode) */}
      {isLive && !providerStatus && canManage && (
        <div className="card p-4 text-center" style={{ background: "var(--bg)", border: "2px dashed var(--line)" }}>
          <FileText size={28} className="mx-auto mb-2" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">eLogo Entegrasyonu Kurulu Değil</div>
          <div className="text-xs mb-3" style={{ color: "var(--ink-mute)" }}>
            Faturaları otomatik çekmek için eLogo kullanıcı adı ve şifrenizi girin
          </div>
          <button onClick={() => setCredsDraft({ provider: "elogo", env: "test" })} className="btn btn-primary">
            <Settings size={12}/> Bağlantıyı Yapılandır
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--line)" }}>
        {[
          { id: "inbox",  label: `Gelen Faturalar (${inbox.length})`, icon: FileDown },
          { id: "outbox", label: `Giden Faturalar (${outbox.length})`, icon: FileUp },
          { id: "sync",   label: "Senkron Geçmişi", icon: History },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 text-sm font-medium border-b-2 transition-all"
            style={{
              borderBottomColor: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "var(--accent)" : "var(--ink-soft)",
            }}>
            <t.icon size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }}/>
            {t.label}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="text-center py-8 text-sm" style={{ color: "var(--ink-mute)" }}>Yükleniyor...</div>
      ) : tab === "inbox" || tab === "outbox" ? (
        <EInvoiceTable
          invoices={tab === "inbox" ? inbox : outbox}
          direction={tab === "inbox" ? "incoming" : "outgoing"}
          cashflowCats={cashflowCats}
          canManage={canManage}
          onImport={importInvoice}
          onShowImport={(einv) => setShowImport(einv)}
        />
      ) : (
        <SyncHistory isLive={isLive} apiBase={apiBase} session={session} companyId={data.activeCompanyId}/>
      )}

      {/* Bulk import modal */}
      {showImport && (
        <Modal title={`Faturayı Aktar · ${showImport.invoice_no || showImport.invoiceNo}`} icon={FileText}
          onClose={() => setShowImport(null)}
          onSave={() => {
            importInvoice(showImport, showImport._selectedCat);
            setShowImport(null);
          }}
          saveLabel="Aktar" maxWidth="max-w-lg">
          <div className="space-y-3">
            <div className="card p-3 text-xs space-y-1" style={{ background: "var(--bg)" }}>
              <div><b>Karşı Taraf:</b> {showImport.party_name || showImport.partyName}</div>
              <div><b>VKN/TCKN:</b> <span className="mono">{showImport.party_vkn_tckn || showImport.partyVknTckn}</span></div>
              <div><b>Tarih:</b> {new Date(showImport.issue_date || showImport.issueDate).toLocaleDateString("tr-TR")}</div>
              <div><b>Tutar:</b> {fmtTL2(showImport.payable_amount || showImport.payableAmount)} {showImport.currency}</div>
            </div>
            <div>
              <div className="label mb-1">Nakit Akış Kalemi *</div>
              <select className="input w-full"
                value={showImport._selectedCat || ""}
                onChange={e => setShowImport({ ...showImport, _selectedCat: e.target.value })}>
                <option value="">— Seçiniz —</option>
                {cashflowCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Credentials modal */}
      {credsDraft && (
        <ELogoCredentialsModal draft={credsDraft} setDraft={setCredsDraft}
          isLive={isLive} apiBase={apiBase} session={session} companyId={data.activeCompanyId}
          onClose={() => setCredsDraft(null)}
          onSaved={() => { setCredsDraft(null); loadEinvoices(); }}
          notify={notify}/>
      )}
    </div>
  );
}

/* ---------- e-Fatura Tablosu ---------- */
function EInvoiceTable({ invoices, direction, cashflowCats, canManage, onImport, onShowImport }) {
  const [search, setSearch] = useState("");
  const [showImported, setShowImported] = useState(false);

  const filtered = invoices
    .filter(e => showImported || !e.imported_invoice_id)
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      const partyName = (e.party_name || e.partyName || "").toLowerCase();
      const invoiceNo = (e.invoice_no || e.invoiceNo || "").toLowerCase();
      const vkn = (e.party_vkn_tckn || e.partyVknTckn || "").toLowerCase();
      return partyName.includes(q) || invoiceNo.includes(q) || vkn.includes(q);
    })
    .sort((a, b) => (b.issue_date || b.issueDate || "").localeCompare(a.issue_date || a.issueDate || ""));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input className="input flex-1 text-xs" placeholder="Fatura no, karşı taraf veya VKN ara..."
          value={search} onChange={e => setSearch(e.target.value)}/>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={showImported}
            onChange={e => setShowImported(e.target.checked)}/>
          Aktarılanlar dahil
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: "var(--ink-mute)" }}>
          {direction === "incoming" ? "Gelen" : "Giden"} fatura bulunamadı.
          <span className="block mt-1 text-xs">"Senkron Et" butonuyla eLogo'dan çekebilirsiniz.</span>
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="grid w-full text-xs">
            <thead>
              <tr>
                <th className="label-cell" style={{ width: 90 }}>Tarih</th>
                <th className="label-cell" style={{ width: 130 }}>Fatura No</th>
                <th className="label-cell">{direction === "incoming" ? "Satıcı" : "Alıcı"}</th>
                <th className="label-cell" style={{ width: 110 }}>VKN</th>
                <th style={{ width: 110 }}>KDV Hariç</th>
                <th style={{ width: 90 }}>KDV</th>
                <th style={{ width: 120 }}>Toplam</th>
                <th className="label-cell" style={{ width: 100 }}>Durum</th>
                {canManage && <th style={{ width: 100 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(einv => {
                const imported = !!einv.imported_invoice_id;
                const ignored = einv.ignored;
                return (
                  <tr key={einv.id || einv.uuid} style={{ opacity: imported || ignored ? 0.5 : 1 }}>
                    <td className="label-cell mono">
                      {new Date(einv.issue_date || einv.issueDate).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="label-cell mono">{einv.invoice_no || einv.invoiceNo}</td>
                    <td className="label-cell">
                      {einv.party_name || einv.partyName}
                      {einv.scenario === "EARSIVFATURA" && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "#fef3c7", color: "#854d0e" }}>e-Arşiv</span>
                      )}
                    </td>
                    <td className="label-cell mono text-xs">{einv.party_vkn_tckn || einv.partyVknTckn}</td>
                    <td className="num mono text-right">{fmtTL2(einv.subtotal)}</td>
                    <td className="num mono text-right">{fmtTL2(einv.kdv_total || einv.kdvTotal)}</td>
                    <td className="num mono text-right font-semibold">
                      {fmtTL2(einv.payable_amount || einv.payableAmount)} {einv.currency}
                    </td>
                    <td className="label-cell">
                      {imported ? (
                        <span className="text-xs" style={{ color: "#0f766e" }}>✓ Aktarıldı</span>
                      ) : ignored ? (
                        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>○ Yok sayıldı</span>
                      ) : (
                        <span className="text-xs" style={{ color: "#b45309" }}>● Bekliyor</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="label-cell">
                        {!imported && !ignored && (
                          <button onClick={() => onShowImport(einv)}
                            className="btn btn-ghost text-xs"
                            title="Nakit akış faturalarına aktar">
                            <FileDown size={10}/> Aktar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- eLogo Credentials Modal ---------- */
function ELogoCredentialsModal({ draft, setDraft, isLive, apiBase, session, companyId, onClose, onSaved, notify }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const save = async () => {
    if (!draft.username || !draft.password || !draft.vergiNo) {
      alert("Kullanıcı adı, şifre ve VKN zorunludur");
      return;
    }
    if (!isLive) {
      alert("Demo mod aktif. Backend hazır olduğunda bu ayarlar gerçek bağlantıyı kuracak.");
      onSaved();
      return;
    }
    try {
      const res = await fetch(`${apiBase}/v1/einvoice/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          companyId,
          provider: "elogo",
          config: {
            username: draft.username,
            password: draft.password,
            vergiNo: draft.vergiNo,
            env: draft.env || "test",
            wsdlUrl: draft.wsdlUrl || undefined,
          },
          autoSyncEnabled: draft.autoSyncEnabled,
          autoSyncCron: draft.autoSyncCron || "0 6 * * *",
        }),
      });
      const json = await res.json();
      if (json.test?.ok) {
        notify("eLogo bağlantısı başarıyla kuruldu");
      } else {
        notify("Kaydedildi ama bağlantı testi başarısız: " + (json.test?.message || ""), "err");
      }
      onSaved();
    } catch (err) {
      alert("Kayıt hatası: " + err.message);
    }
  };

  const testOnly = async () => {
    if (!isLive) return;
    setTesting(true);
    try {
      // Önce kaydet, sonra test
      await save();
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal title="eLogo Bağlantı Ayarları" icon={Settings} onClose={onClose} onSave={save}
      saveLabel="Kaydet ve Test Et" maxWidth="max-w-lg">
      <div className="space-y-3">
        <div className="card p-3 text-xs flex items-start gap-2" style={{ background: "#dbeafe" }}>
          <Info size={12} style={{ color: "#1d4ed8", flexShrink: 0, marginTop: 2 }}/>
          <span style={{ color: "#1e3a8a" }}>
            Kullanıcı adı ve şifrenizi <b>elogo.com.tr</b> panelinden alın.
            Test ortamında deneyin, çalıştıktan sonra Üretim'e geçin.
            Tüm hassas veriler AES-256-GCM ile şifreli saklanır.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Ortam *</div>
            <select className="input w-full" value={draft.env || "test"}
              onChange={e => setDraft({ ...draft, env: e.target.value })}>
              <option value="test">Test</option>
              <option value="prod">Üretim (Canlı)</option>
            </select>
          </div>
          <div>
            <div className="label mb-1">Mükellef VKN *</div>
            <input className="input w-full mono" placeholder="1234567890"
              value={draft.vergiNo || ""} onChange={e => setDraft({ ...draft, vergiNo: e.target.value.replace(/\D/g, "").slice(0, 11) })}/>
          </div>
        </div>

        <div>
          <div className="label mb-1">Kullanıcı Adı *</div>
          <input className="input w-full" value={draft.username || ""}
            onChange={e => setDraft({ ...draft, username: e.target.value })}/>
        </div>

        <div>
          <div className="label mb-1">Şifre *</div>
          <input type="password" className="input w-full" value={draft.password || ""}
            onChange={e => setDraft({ ...draft, password: e.target.value })}/>
        </div>

        <div>
          <div className="label mb-1">WSDL URL (opsiyonel)</div>
          <input className="input w-full mono text-xs" placeholder="https://test.elogo.com.tr/api/api.svc?singleWsdl"
            value={draft.wsdlUrl || ""}
            onChange={e => setDraft({ ...draft, wsdlUrl: e.target.value })}/>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            Boş bırakırsanız ortam (Test/Üretim) için varsayılan URL kullanılır
          </div>
        </div>

        <div className="border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={draft.autoSyncEnabled || false}
              onChange={e => setDraft({ ...draft, autoSyncEnabled: e.target.checked })}/>
            Otomatik senkron (her sabah 06:00)
          </label>
          {draft.autoSyncEnabled && (
            <div className="mt-2">
              <div className="label mb-1 text-xs">Cron İfadesi</div>
              <input className="input w-full mono text-xs" placeholder="0 6 * * *"
                value={draft.autoSyncCron || "0 6 * * *"}
                onChange={e => setDraft({ ...draft, autoSyncCron: e.target.value })}/>
            </div>
          )}
        </div>

        {!isLive && (
          <div className="card p-3 text-xs" style={{ background: "#fef3c7", color: "#854d0e" }}>
            <b>Demo mod uyarısı:</b> Backend API server çalışmıyor (window.PROMETCF_API tanımlı değil).
            Gerçek eLogo bağlantısı için <code>api-server</code> deploy edilmeli.
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Senkron Geçmişi ---------- */
function SyncHistory({ isLive, apiBase, session, companyId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLive) {
      setLogs([{
        id: "demo", trigger: "manual", started_at: new Date().toISOString(),
        status: "demo", incoming_new: 15, outgoing_new: 12,
        date_from: "2026-04-12", date_to: "2026-05-12",
      }]);
      return;
    }
    setLoading(true);
    fetch(`${apiBase}/v1/einvoice/sync-log?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(r => r.json())
      .then(j => setLogs(j.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [isLive, apiBase, session.token, companyId]);

  if (loading) return <div className="text-center py-8 text-sm" style={{ color: "var(--ink-mute)" }}>Yükleniyor...</div>;
  if (logs.length === 0) return (
    <div className="text-center py-8 text-sm" style={{ color: "var(--ink-mute)" }}>
      Henüz senkron geçmişi yok.
    </div>
  );

  return (
    <div className="overflow-x-auto card">
      <table className="grid w-full text-xs">
        <thead>
          <tr>
            <th className="label-cell">Başlangıç</th>
            <th className="label-cell">Tarih Aralığı</th>
            <th className="label-cell">Tetik</th>
            <th className="label-cell">Durum</th>
            <th>Gelen (Yeni)</th>
            <th>Giden (Yeni)</th>
            <th className="label-cell">Hata</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td className="label-cell mono">
                {new Date(log.started_at).toLocaleString("tr-TR")}
              </td>
              <td className="label-cell mono text-xs">
                {log.date_from} → {log.date_to}
              </td>
              <td className="label-cell">{log.trigger}</td>
              <td className="label-cell">
                <span className="text-xs px-1.5 py-0.5 rounded" style={{
                  background: log.status === "success" ? "#dcfce7" : log.status === "error" ? "#fee2e2" : "#fef3c7",
                  color: log.status === "success" ? "#15803d" : log.status === "error" ? "#991b1b" : "#854d0e",
                }}>
                  {log.status}
                </span>
              </td>
              <td className="num">{log.incoming_new || 0}</td>
              <td className="num">{log.outgoing_new || 0}</td>
              <td className="label-cell text-xs" style={{ color: "var(--negative)" }}>
                {log.error_message || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Demo veri üretici ---------- */
function generateMockEinvoices(count, dateFrom, dateTo) {
  const from = new Date(dateFrom).getTime();
  const to = new Date(dateTo).getTime();
  const result = [];
  const tedarikciler = [
    { name: "Türk Telekom A.Ş.", vkn: "8790021890" },
    { name: "Enerya Konya Gaz Dağıtım A.Ş.", vkn: "3370561875" },
    { name: "Logo Yazılım Sanayi ve Ticaret A.Ş.", vkn: "6080051477" },
    { name: "Boyner Büyük Mağazacılık A.Ş.", vkn: "1840031578" },
    { name: "OPET Petrolcülük A.Ş.", vkn: "6450035321" },
    { name: "Microsoft Bilgisayar Yazılım A.Ş.", vkn: "6230435765" },
  ];
  const musteriler = [
    { name: "ABC Tekstil Ltd. Şti.", vkn: "1234567890" },
    { name: "Yıldız Holding A.Ş.", vkn: "9234567890" },
    { name: "Doğan Gıda Sanayi Ltd.", vkn: "5234567890" },
    { name: "Mavi Giyim A.Ş.", vkn: "7234567890" },
  ];
  for (let i = 0; i < count; i++) {
    const incoming = Math.random() > 0.4;
    const list = incoming ? tedarikciler : musteriler;
    const party = list[Math.floor(Math.random() * list.length)];
    const dateMs = from + Math.random() * (to - from);
    const date = new Date(dateMs).toISOString().slice(0, 10);
    const subtotal = Math.round((1000 + Math.random() * 80000) * 100) / 100;
    const kdv = Math.round(subtotal * 0.2 * 100) / 100;
    result.push({
      id: "mock_" + Date.now() + "_" + i,
      uuid: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      direction: incoming ? "incoming" : "outgoing",
      invoice_no: `${incoming ? "GLN" : "TAS"}2026${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`,
      scenario: Math.random() > 0.5 ? "TEMELFATURA" : "EARSIVFATURA",
      invoice_type: "SATIS",
      issue_date: date,
      party_name: party.name,
      party_vkn_tckn: party.vkn,
      currency: "TRY",
      subtotal,
      kdv_total: kdv,
      payable_amount: subtotal + kdv,
      gib_status: "KABUL_EDILDI",
    });
  }
  return result;
}

/* =====================================================================
   HR — İK MODÜLÜ
   ---------------------------------------------------------------------
   Wrapper component, alt-sekmelerle HR alt-modüllerini barındırır.
   Şu an: İşe Alım (Recruitment).
   Gelecekte: Personel Sicil, Bordro, Devam-İzin, Performans, vb.
===================================================================== */
function HRModule({ data, session, users = [], canAct, onChange, logAudit, notify }) {
  const [subTab, setSubTab] = useState("organization");

  const positions   = data.hrPositions   || [];
  const candidates  = data.hrCandidates  || [];
  const applications= data.hrApplications|| [];
  const orgUnits    = data.hrOrgUnits    || [];
  const employees   = data.hrEmployees   || [];

  const openPositionsCount = positions.filter(p => p.status === "open").length;
  const activeCandidatesCount = applications.filter(a => !["hired","rejected","withdrawn"].includes(a.stage)).length;
  const activeEmployeeCount = employees.filter(e => e.status === "active" || e.status === "probation").length;

  return (
    <div className="space-y-4">
      {/* Üst başlık */}
      <div>
        <div className="label mb-1">İnsan Kaynakları</div>
        <h1 className="display text-2xl md:text-3xl">HR</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
          Organizasyon, işe alım, personel sicili, bordro ve insan kaynakları süreçleri tek yerden
        </p>
      </div>

      {/* Alt-sekme bar */}
      <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <SubTabButton
          active={subTab === "organization"} onClick={() => setSubTab("organization")}
          icon={Building2} label="Organizasyon"
          badge={orgUnits.length > 0 ? orgUnits.length : null}
          badgeColor="#7c2d12"
        />
        <SubTabButton
          active={subTab === "recruitment"} onClick={() => setSubTab("recruitment")}
          icon={UserPlus} label="İşe Alım"
          badge={openPositionsCount > 0 ? openPositionsCount : null}
          badgeColor="#0ea5e9"
        />
        <SubTabButton
          active={subTab === "employees"} onClick={() => setSubTab("employees")}
          icon={Users} label="Personel"
          badge={activeEmployeeCount > 0 ? activeEmployeeCount : null}
          badgeColor="#15803d"
        />
        {/* Gelecekteki sekmeler */}
        <SubTabButton active={false} onClick={() => notify("Bu modül yakında eklenecek", "ok")}
          icon={Wallet} label="Bordro" extra={<span className="ml-1 text-xs opacity-50">(yakında)</span>}/>
        <SubTabButton active={false} onClick={() => notify("Bu modül yakında eklenecek", "ok")}
          icon={CalendarClock} label="Devam/İzin" extra={<span className="ml-1 text-xs opacity-50">(yakında)</span>}/>
      </div>

      {subTab === "organization" && (
        <OrganizationManager data={data} session={session} users={users} canAct={canAct}
          onChange={onChange} logAudit={logAudit} notify={notify}/>
      )}
      {subTab === "recruitment" && (
        <RecruitmentManager data={data} session={session} canAct={canAct}
          onChange={onChange} logAudit={logAudit} notify={notify}/>
      )}
      {subTab === "employees" && (
        <EmployeesList data={data} session={session} canAct={canAct}
          onChange={onChange} logAudit={logAudit} notify={notify}/>
      )}
    </div>
  );
}

/* =====================================================================
   ORGANIZATION MANAGER — Hiyerarşik Organizasyon Yapısı
   ---------------------------------------------------------------------
   4 katmanlı hiyerarşi:
     • Organizasyon Birimi (Genel Müdürlük, Bölge, Şube)  — parent_id ile recursive
     • Departman (İK, Finans)                              — orgUnitId + parentDeptId
     • Pozisyon (İK Müdürü)                                — departmentId
     • Çalışan (Ahmet Yılmaz)                              — jobTitleId
   Her seviyede:
     • Sorumlu Çalışan (managerEmployeeId) atanabilir
     • Yetkili Kullanıcılar (authorizedUsers) tanımlanabilir
===================================================================== */
function OrganizationManager({ data, session, users = [], canAct, onChange, logAudit, notify }) {
  const [viewMode, setViewMode] = useState("tree");  // tree | chart | flat
  const [expanded, setExpanded] = useState(new Set(["ou_gm"]));
  const [modal, setModal] = useState(null);  // { kind: "ou"|"dept"|"jt"|"emp", item?, parentContext? }

  // RBAC: yeni canAct'i varsa kullan, yoksa eski sistem
  const canManageOrg   = canAct ? canAct("hr.organization.create") || canAct("hr.organization.update") || can(session.role, "manage_org")        : can(session.role, "manage_org");
  const canManageDept  = canAct ? canAct("hr.departments.create")  || canAct("hr.departments.update")  || can(session.role, "manage_departments"): can(session.role, "manage_departments");
  const canManageJT    = canAct ? canAct("hr.job_titles.create")   || canAct("hr.job_titles.update")   || can(session.role, "manage_job_titles") : can(session.role, "manage_job_titles");
  const canManageEmp   = canAct ? canAct("hr.employees.create")    || canAct("hr.employees.update")    || can(session.role, "manage_employees")  : can(session.role, "manage_employees");
  const canDeleteOrg   = canAct ? canAct("hr.organization.delete") || can(session.role, "manage_org")        : can(session.role, "manage_org");
  const canDeleteDept  = canAct ? canAct("hr.departments.delete")  || can(session.role, "manage_departments"): can(session.role, "manage_departments");
  const canDeleteJT    = canAct ? canAct("hr.job_titles.delete")   || can(session.role, "manage_job_titles") : can(session.role, "manage_job_titles");
  const canDeleteEmp   = canAct ? canAct("hr.employees.delete")    || can(session.role, "manage_employees")  : can(session.role, "manage_employees");
  const canManageAuth  = can(session.role, "manage_org_auth");

  const orgUnits    = data.hrOrgUnits     || [];
  const departments = data.hrDepartments  || [];
  const jobTitles   = data.hrJobTitles    || [];
  const employees   = data.hrEmployees    || [];

  // Tree node toggling
  const toggle = (id) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id); else n.add(id);
    setExpanded(n);
  };
  const expandAll = () => {
    const all = new Set();
    orgUnits.forEach(o => all.add(o.id));
    departments.forEach(d => all.add(d.id));
    jobTitles.forEach(j => all.add(j.id));
    setExpanded(all);
  };
  const collapseAll = () => setExpanded(new Set());

  // CRUD helpers
  const saveOrgUnit = async (draft) => {
    if (!draft.name?.trim()) { alert("Birim adı zorunlu"); return; }
    const isEdit = !!draft.id;
    // Daireselliği engelle (parent kendisi olamaz, alt birim olamaz)
    if (isEdit && draft.parentId === draft.id) {
      alert("Bir birim kendi parent'ı olamaz"); return;
    }
    const item = isEdit ? draft : {
      id: "ou_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      createdAt: new Date().toISOString(),
    };
    item.name = draft.name.trim();
    item.code = (draft.code || "").trim();
    item.description = (draft.description || "").trim();
    item.authorizedUsers = Array.isArray(draft.authorizedUsers) ? draft.authorizedUsers : [];
    const next = isEdit ? orgUnits.map(x => x.id === item.id ? item : x) : [...orgUnits, item];
    await onChange({ ...data, hrOrgUnits: next });
    if (!isEdit) setExpanded(new Set([...expanded, item.id]));
    await logAudit(isEdit ? "org_unit_edit" : "org_unit_add", { birim: item.name });
    notify(isEdit ? "Birim güncellendi" : "Birim eklendi");
    setModal(null);
  };

  const deleteOrgUnit = async (ou) => {
    // Bağlı departman veya alt birim varsa engelle
    const subUnits = orgUnits.filter(o => o.parentId === ou.id);
    const subDepts = departments.filter(d => d.orgUnitId === ou.id);
    if (subUnits.length > 0 || subDepts.length > 0) {
      alert(`"${ou.name}" silinemiyor: ${subUnits.length} alt birim, ${subDepts.length} departman bağlı`);
      return;
    }
    if (!confirm(`"${ou.name}" birimini silmek istediğinizden emin misiniz?`)) return;
    await onChange({ ...data, hrOrgUnits: orgUnits.filter(o => o.id !== ou.id) });
    await logAudit("org_unit_delete", { birim: ou.name });
    notify("Birim silindi");
  };

  const saveDepartment = async (draft) => {
    if (!draft.name?.trim()) { alert("Departman adı zorunlu"); return; }
    if (!draft.orgUnitId)    { alert("Bağlı olduğu organizasyon birimi zorunlu"); return; }
    const isEdit = !!draft.id;
    if (isEdit && draft.parentDeptId === draft.id) {
      alert("Bir departman kendi parent'ı olamaz"); return;
    }
    const item = isEdit ? draft : {
      id: "dept_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      createdAt: new Date().toISOString(),
    };
    item.name = draft.name.trim();
    item.code = (draft.code || "").trim();
    item.color = draft.color || "#737373";
    item.authorizedUsers = Array.isArray(draft.authorizedUsers) ? draft.authorizedUsers : [];
    const next = isEdit ? departments.map(x => x.id === item.id ? item : x) : [...departments, item];
    await onChange({ ...data, hrDepartments: next });
    if (!isEdit) setExpanded(new Set([...expanded, item.id]));
    await logAudit(isEdit ? "department_edit" : "department_add", { departman: item.name });
    notify(isEdit ? "Departman güncellendi" : "Departman eklendi");
    setModal(null);
  };

  const deleteDepartment = async (dept) => {
    const subDepts = departments.filter(d => d.parentDeptId === dept.id);
    const deptJTs  = jobTitles.filter(j => j.departmentId === dept.id);
    if (subDepts.length > 0 || deptJTs.length > 0) {
      alert(`"${dept.name}" silinemiyor: ${subDepts.length} alt departman, ${deptJTs.length} pozisyon bağlı`);
      return;
    }
    if (!confirm(`"${dept.name}" departmanını silmek istediğinizden emin misiniz?`)) return;
    await onChange({ ...data, hrDepartments: departments.filter(d => d.id !== dept.id) });
    await logAudit("department_delete", { departman: dept.name });
    notify("Departman silindi");
  };

  const saveJobTitle = async (draft) => {
    if (!draft.title?.trim()) { alert("Pozisyon başlığı zorunlu"); return; }
    if (!draft.departmentId)  { alert("Bağlı olduğu departman zorunlu"); return; }
    const isEdit = !!draft.id;
    const item = isEdit ? draft : {
      id: "jt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      createdAt: new Date().toISOString(),
    };
    item.title = draft.title.trim();
    item.code = (draft.code || "").trim();
    item.description = (draft.description || "").trim();
    item.headcount = Number(draft.headcount) || 1;
    item.standardBrutSalary = parseTRNumber(draft.standardBrutSalary) || 0;
    item.authorizedUsers = Array.isArray(draft.authorizedUsers) ? draft.authorizedUsers : [];
    const next = isEdit ? jobTitles.map(x => x.id === item.id ? item : x) : [...jobTitles, item];
    await onChange({ ...data, hrJobTitles: next });
    if (!isEdit) setExpanded(new Set([...expanded, item.id]));
    await logAudit(isEdit ? "job_title_edit" : "job_title_add", { pozisyon: item.title });
    notify(isEdit ? "Pozisyon güncellendi" : "Pozisyon eklendi");
    setModal(null);
  };

  const deleteJobTitle = async (jt) => {
    const linkedEmps = employees.filter(e => e.jobTitleId === jt.id);
    if (linkedEmps.length > 0) {
      alert(`"${jt.title}" silinemiyor: ${linkedEmps.length} çalışan bu pozisyonda`);
      return;
    }
    if (!confirm(`"${jt.title}" pozisyonunu silmek istediğinizden emin misiniz?`)) return;
    await onChange({ ...data, hrJobTitles: jobTitles.filter(j => j.id !== jt.id) });
    await logAudit("job_title_delete", { pozisyon: jt.title });
    notify("Pozisyon silindi");
  };

  const saveEmployee = async (draft) => {
    if (!draft.firstName?.trim() || !draft.lastName?.trim()) { alert("Ad-soyad zorunlu"); return; }
    if (!draft.jobTitleId) { alert("Pozisyon ataması zorunlu"); return; }
    const isEdit = !!draft.id;
    const item = isEdit ? draft : {
      id: "emp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    item.firstName = draft.firstName.trim();
    item.lastName  = draft.lastName.trim();
    item.email     = (draft.email || "").trim().toLowerCase();
    item.phone     = (draft.phone || "").trim();
    item.tcNo      = (draft.tcNo || "").trim();
    item.sgkNo     = (draft.sgkNo || "").trim();
    item.brutSalary= parseTRNumber(draft.brutSalary) || 0;
    item.status    = draft.status || "active";
    const next = isEdit ? employees.map(x => x.id === item.id ? item : x) : [...employees, item];
    await onChange({ ...data, hrEmployees: next });
    await logAudit(isEdit ? "employee_edit" : "employee_add", {
      personel: `${item.firstName} ${item.lastName}`,
    });
    notify(isEdit ? "Çalışan güncellendi" : "Çalışan eklendi");
    setModal(null);
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`"${emp.firstName} ${emp.lastName}" çalışanını silmek istediğinizden emin misiniz?`)) return;
    await onChange({ ...data, hrEmployees: employees.filter(e => e.id !== emp.id) });
    await logAudit("employee_delete", { personel: `${emp.firstName} ${emp.lastName}` });
    notify("Çalışan silindi");
  };

  // İstatistikler
  const stats = useMemo(() => ({
    orgUnits: orgUnits.length,
    departments: departments.length,
    jobTitles: jobTitles.length,
    employees: employees.length,
    activeEmployees: employees.filter(e => e.status === "active" || e.status === "probation").length,
  }), [orgUnits, departments, jobTitles, employees]);

  return (
    <div className="space-y-4">
      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatBlock label="Org. Birimi" value={stats.orgUnits} color="#7c2d12"/>
        <StatBlock label="Departman" value={stats.departments} color="#1d4ed8"/>
        <StatBlock label="Pozisyon" value={stats.jobTitles} color="#0f766e"/>
        <StatBlock label="Toplam Çalışan" value={stats.employees} color="#475569"/>
        <StatBlock label="Aktif Çalışan" value={stats.activeEmployees} color="#15803d"/>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 border rounded p-0.5" style={{ borderColor: "var(--line)" }}>
          {[
            { id: "tree",  icon: FolderTree, label: "Ağaç" },
            { id: "chart", icon: Layers,     label: "Org Şema" },
          ].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              className="px-2 py-1 text-xs rounded flex items-center gap-1"
              style={{
                background: viewMode === v.id ? "var(--accent)" : "transparent",
                color: viewMode === v.id ? "#fff" : "var(--ink-soft)",
              }}>
              <v.icon size={11}/>{v.label}
            </button>
          ))}
        </div>
        {viewMode === "tree" && (
          <>
            <button onClick={expandAll} className="btn btn-ghost text-xs">
              <ChevronDown size={11}/> Hepsini Aç
            </button>
            <button onClick={collapseAll} className="btn btn-ghost text-xs">
              <ChevronRight size={11}/> Hepsini Kapat
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canManageOrg && (
            <button onClick={() => setModal({ kind: "ou", item: { type: "headquarters", parentId: null } })}
              className="btn btn-primary text-xs">
              <Building2 size={11}/> Org. Birimi
            </button>
          )}
          {canManageDept && orgUnits.length > 0 && (
            <button onClick={() => setModal({ kind: "dept", item: { orgUnitId: orgUnits[0].id, color: "#0ea5e9" } })}
              className="btn text-xs" style={{ background: "#1d4ed8", color: "#fff" }}>
              <FolderTree size={11}/> Departman
            </button>
          )}
          {canManageJT && departments.length > 0 && (
            <button onClick={() => setModal({ kind: "jt", item: { departmentId: departments[0].id, level: "mid", headcount: 1 } })}
              className="btn text-xs" style={{ background: "#0f766e", color: "#fff" }}>
              <Briefcase size={11}/> Pozisyon
            </button>
          )}
          {canManageEmp && jobTitles.length > 0 && (
            <button onClick={() => setModal({ kind: "emp", item: { jobTitleId: jobTitles[0].id, status: "active", startDate: new Date().toISOString().slice(0,10) } })}
              className="btn text-xs" style={{ background: "#15803d", color: "#fff" }}>
              <UserPlus size={11}/> Çalışan
            </button>
          )}
        </div>
      </div>

      {/* Ana içerik */}
      {orgUnits.length === 0 ? (
        <div className="text-center py-12 card">
          <Building2 size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">Organizasyon Yapısı Henüz Kurulmamış</div>
          <div className="text-xs mb-4" style={{ color: "var(--ink-mute)" }}>
            İlk adım: bir Organizasyon Birimi (Genel Müdürlük, Şirket vb.) ekleyin
          </div>
          {canManageOrg && (
            <button onClick={() => setModal({ kind: "ou", item: { type: "headquarters", parentId: null } })}
              className="btn btn-primary inline-flex items-center">
              <Plus size={13}/> İlk Birimi Ekle
            </button>
          )}
        </div>
      ) : viewMode === "tree" ? (
        <OrgTreeView
          orgUnits={orgUnits} departments={departments}
          jobTitles={jobTitles} employees={employees}
          expanded={expanded} toggle={toggle}
          canManageOrg={canManageOrg} canManageDept={canManageDept}
          canManageJT={canManageJT} canManageEmp={canManageEmp}
          onAddOrgUnit={(parentId) => setModal({ kind: "ou", item: { parentId, type: "branch" } })}
          onEditOrgUnit={(ou) => setModal({ kind: "ou", item: ou })}
          onDeleteOrgUnit={deleteOrgUnit}
          onAddDept={(orgUnitId, parentDeptId) => setModal({ kind: "dept", item: { orgUnitId, parentDeptId, color: "#0ea5e9" } })}
          onEditDept={(d) => setModal({ kind: "dept", item: d })}
          onDeleteDept={deleteDepartment}
          onAddJT={(departmentId) => setModal({ kind: "jt", item: { departmentId, level: "mid", headcount: 1 } })}
          onEditJT={(j) => setModal({ kind: "jt", item: j })}
          onDeleteJT={deleteJobTitle}
          onAddEmp={(jobTitleId) => setModal({ kind: "emp", item: { jobTitleId, status: "active", startDate: new Date().toISOString().slice(0,10) } })}
          onEditEmp={(e) => setModal({ kind: "emp", item: e })}
          onDeleteEmp={deleteEmployee}
        />
      ) : (
        <OrgChartView
          orgUnits={orgUnits} departments={departments}
          jobTitles={jobTitles} employees={employees}
        />
      )}

      {/* Modallar */}
      {modal?.kind === "ou" && (
        <OrgUnitFormModal draft={modal.item} setDraft={(item) => setModal({ ...modal, item })}
          orgUnits={orgUnits} employees={employees} users={users}
          canManageAuth={canManageAuth}
          onClose={() => setModal(null)}
          onSave={() => saveOrgUnit(modal.item)}/>
      )}
      {modal?.kind === "dept" && (
        <DepartmentFormModal draft={modal.item} setDraft={(item) => setModal({ ...modal, item })}
          orgUnits={orgUnits} departments={departments} employees={employees} users={users}
          canManageAuth={canManageAuth}
          onClose={() => setModal(null)}
          onSave={() => saveDepartment(modal.item)}/>
      )}
      {modal?.kind === "jt" && (
        <JobTitleFormModal draft={modal.item} setDraft={(item) => setModal({ ...modal, item })}
          departments={departments} jobTitles={jobTitles} users={users}
          canManageAuth={canManageAuth}
          onClose={() => setModal(null)}
          onSave={() => saveJobTitle(modal.item)}/>
      )}
      {modal?.kind === "emp" && (
        <EmployeeFormModal draft={modal.item} setDraft={(item) => setModal({ ...modal, item })}
          jobTitles={jobTitles} departments={departments} employees={employees}
          onClose={() => setModal(null)}
          onSave={() => saveEmployee(modal.item)}/>
      )}
    </div>
  );
}

/* ---------- Ağaç Görünümü ---------- */
function OrgTreeView({
  orgUnits, departments, jobTitles, employees, expanded, toggle,
  canManageOrg, canManageDept, canManageJT, canManageEmp,
  onAddOrgUnit, onEditOrgUnit, onDeleteOrgUnit,
  onAddDept, onEditDept, onDeleteDept,
  onAddJT, onEditJT, onDeleteJT,
  onAddEmp, onEditEmp, onDeleteEmp,
}) {
  // Kök birimler (parentId === null veya undefined)
  const rootUnits = orgUnits.filter(o => !o.parentId);

  return (
    <div className="card p-3 space-y-1">
      {rootUnits.map(ou => (
        <OrgUnitNode key={ou.id} unit={ou} level={0}
          orgUnits={orgUnits} departments={departments}
          jobTitles={jobTitles} employees={employees}
          expanded={expanded} toggle={toggle}
          canManageOrg={canManageOrg} canManageDept={canManageDept}
          canManageJT={canManageJT} canManageEmp={canManageEmp}
          onAddOrgUnit={onAddOrgUnit} onEditOrgUnit={onEditOrgUnit} onDeleteOrgUnit={onDeleteOrgUnit}
          onAddDept={onAddDept} onEditDept={onEditDept} onDeleteDept={onDeleteDept}
          onAddJT={onAddJT} onEditJT={onEditJT} onDeleteJT={onDeleteJT}
          onAddEmp={onAddEmp} onEditEmp={onEditEmp} onDeleteEmp={onDeleteEmp}
        />
      ))}
    </div>
  );
}

/* ---------- Org Unit düğümü (recursive) ---------- */
function OrgUnitNode({
  unit, level, orgUnits, departments, jobTitles, employees, expanded, toggle,
  canManageOrg, canManageDept, canManageJT, canManageEmp,
  onAddOrgUnit, onEditOrgUnit, onDeleteOrgUnit,
  onAddDept, onEditDept, onDeleteDept,
  onAddJT, onEditJT, onDeleteJT,
  onAddEmp, onEditEmp, onDeleteEmp,
}) {
  const isExp = expanded.has(unit.id);
  const subUnits = orgUnits.filter(o => o.parentId === unit.id);
  const unitDepts = departments.filter(d => d.orgUnitId === unit.id && !d.parentDeptId);
  const typeInfo = ORG_UNIT_TYPES[unit.type] || ORG_UNIT_TYPES.branch;
  const hasChildren = subUnits.length > 0 || unitDepts.length > 0;

  return (
    <div>
      <div className="flex items-center gap-1 group hover:bg-stone-50 rounded px-1 py-1"
        style={{ paddingLeft: 4 + level * 20 }}>
        {hasChildren ? (
          <button onClick={() => toggle(unit.id)} className="p-0.5 hover:bg-stone-200 rounded">
            {isExp ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
          </button>
        ) : (
          <span style={{ width: 16 }}/>
        )}
        <span className="text-base">{typeInfo.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: typeInfo.color }}>
              {unit.name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ background: typeInfo.color + "22", color: typeInfo.color }}>
              {typeInfo.label}
            </span>
            {unit.code && <span className="text-xs mono" style={{ color: "var(--ink-mute)" }}>[{unit.code}]</span>}
            {unit.authorizedUsers?.length > 0 && (
              <span className="text-xs flex items-center gap-0.5" style={{ color: "var(--ink-mute)" }} title="Yetkili kullanıcı sayısı">
                <Shield size={9}/> {unit.authorizedUsers.length}
              </span>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          {canManageOrg && (
            <button onClick={() => onAddOrgUnit(unit.id)} className="p-1 rounded hover:bg-stone-100" title="Alt birim ekle">
              <Plus size={10}/>
            </button>
          )}
          {canManageDept && (
            <button onClick={() => onAddDept(unit.id, null)} className="p-1 rounded hover:bg-stone-100" title="Departman ekle">
              <FolderTree size={10}/>
            </button>
          )}
          {canManageOrg && (
            <>
              <button onClick={() => onEditOrgUnit(unit)} className="p-1 rounded hover:bg-stone-100" title="Düzenle">
                <Edit3 size={10}/>
              </button>
              <button onClick={() => onDeleteOrgUnit(unit)} className="p-1 rounded hover:bg-red-50" title="Sil">
                <Trash2 size={10} style={{ color: "var(--negative)" }}/>
              </button>
            </>
          )}
        </div>
      </div>
      {isExp && (
        <>
          {/* Alt birimler */}
          {subUnits.map(sub => (
            <OrgUnitNode key={sub.id} unit={sub} level={level + 1}
              orgUnits={orgUnits} departments={departments}
              jobTitles={jobTitles} employees={employees}
              expanded={expanded} toggle={toggle}
              canManageOrg={canManageOrg} canManageDept={canManageDept}
              canManageJT={canManageJT} canManageEmp={canManageEmp}
              onAddOrgUnit={onAddOrgUnit} onEditOrgUnit={onEditOrgUnit} onDeleteOrgUnit={onDeleteOrgUnit}
              onAddDept={onAddDept} onEditDept={onEditDept} onDeleteDept={onDeleteDept}
              onAddJT={onAddJT} onEditJT={onEditJT} onDeleteJT={onDeleteJT}
              onAddEmp={onAddEmp} onEditEmp={onEditEmp} onDeleteEmp={onDeleteEmp}
            />
          ))}
          {/* Birime bağlı departmanlar */}
          {unitDepts.map(dept => (
            <DepartmentNode key={dept.id} dept={dept} level={level + 1}
              departments={departments} jobTitles={jobTitles} employees={employees}
              expanded={expanded} toggle={toggle}
              canManageDept={canManageDept} canManageJT={canManageJT} canManageEmp={canManageEmp}
              onAddDept={onAddDept} onEditDept={onEditDept} onDeleteDept={onDeleteDept}
              onAddJT={onAddJT} onEditJT={onEditJT} onDeleteJT={onDeleteJT}
              onAddEmp={onAddEmp} onEditEmp={onEditEmp} onDeleteEmp={onDeleteEmp}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- Departman düğümü (recursive: alt departman desteği) ---------- */
function DepartmentNode({
  dept, level, departments, jobTitles, employees, expanded, toggle,
  canManageDept, canManageJT, canManageEmp,
  onAddDept, onEditDept, onDeleteDept,
  onAddJT, onEditJT, onDeleteJT,
  onAddEmp, onEditEmp, onDeleteEmp,
}) {
  const isExp = expanded.has(dept.id);
  const subDepts = departments.filter(d => d.parentDeptId === dept.id);
  const deptJTs  = jobTitles.filter(j => j.departmentId === dept.id);
  const hasChildren = subDepts.length > 0 || deptJTs.length > 0;

  return (
    <div>
      <div className="flex items-center gap-1 group hover:bg-stone-50 rounded px-1 py-1"
        style={{ paddingLeft: 4 + level * 20 }}>
        {hasChildren ? (
          <button onClick={() => toggle(dept.id)} className="p-0.5 hover:bg-stone-200 rounded">
            {isExp ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
          </button>
        ) : (
          <span style={{ width: 16 }}/>
        )}
        <FolderTree size={13} style={{ color: dept.color }}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" style={{ color: dept.color }}>{dept.name}</span>
            {dept.code && <span className="text-xs mono" style={{ color: "var(--ink-mute)" }}>[{dept.code}]</span>}
            {deptJTs.length > 0 && (
              <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
                · {deptJTs.length} pozisyon
              </span>
            )}
            {dept.authorizedUsers?.length > 0 && (
              <span className="text-xs flex items-center gap-0.5" style={{ color: "var(--ink-mute)" }}>
                <Shield size={9}/> {dept.authorizedUsers.length}
              </span>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          {canManageDept && (
            <button onClick={() => onAddDept(dept.orgUnitId, dept.id)} className="p-1 rounded hover:bg-stone-100" title="Alt departman ekle">
              <Plus size={10}/>
            </button>
          )}
          {canManageJT && (
            <button onClick={() => onAddJT(dept.id)} className="p-1 rounded hover:bg-stone-100" title="Pozisyon ekle">
              <Briefcase size={10}/>
            </button>
          )}
          {canManageDept && (
            <>
              <button onClick={() => onEditDept(dept)} className="p-1 rounded hover:bg-stone-100">
                <Edit3 size={10}/>
              </button>
              <button onClick={() => onDeleteDept(dept)} className="p-1 rounded hover:bg-red-50">
                <Trash2 size={10} style={{ color: "var(--negative)" }}/>
              </button>
            </>
          )}
        </div>
      </div>
      {isExp && (
        <>
          {/* Alt departmanlar */}
          {subDepts.map(sub => (
            <DepartmentNode key={sub.id} dept={sub} level={level + 1}
              departments={departments} jobTitles={jobTitles} employees={employees}
              expanded={expanded} toggle={toggle}
              canManageDept={canManageDept} canManageJT={canManageJT} canManageEmp={canManageEmp}
              onAddDept={onAddDept} onEditDept={onEditDept} onDeleteDept={onDeleteDept}
              onAddJT={onAddJT} onEditJT={onEditJT} onDeleteJT={onDeleteJT}
              onAddEmp={onAddEmp} onEditEmp={onEditEmp} onDeleteEmp={onDeleteEmp}
            />
          ))}
          {/* Pozisyonlar */}
          {deptJTs.map(jt => (
            <JobTitleNode key={jt.id} jobTitle={jt} level={level + 1}
              employees={employees} expanded={expanded} toggle={toggle}
              canManageJT={canManageJT} canManageEmp={canManageEmp}
              onEditJT={onEditJT} onDeleteJT={onDeleteJT}
              onAddEmp={onAddEmp} onEditEmp={onEditEmp} onDeleteEmp={onDeleteEmp}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- Pozisyon düğümü ---------- */
function JobTitleNode({
  jobTitle, level, employees, expanded, toggle,
  canManageJT, canManageEmp,
  onEditJT, onDeleteJT,
  onAddEmp, onEditEmp, onDeleteEmp,
}) {
  const isExp = expanded.has(jobTitle.id);
  const jtEmps = employees.filter(e => e.jobTitleId === jobTitle.id);
  const levelInfo = JOB_LEVELS[jobTitle.level] || {};
  const hasChildren = jtEmps.length > 0;

  return (
    <div>
      <div className="flex items-center gap-1 group hover:bg-stone-50 rounded px-1 py-1"
        style={{ paddingLeft: 4 + level * 20 }}>
        {hasChildren ? (
          <button onClick={() => toggle(jobTitle.id)} className="p-0.5 hover:bg-stone-200 rounded">
            {isExp ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
          </button>
        ) : (
          <span style={{ width: 16 }}/>
        )}
        <Briefcase size={12} style={{ color: levelInfo.color || "#0f766e" }}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: levelInfo.color || "#0f766e" }}>{jobTitle.title}</span>
            {levelInfo.label && (
              <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
                · {levelInfo.label}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
              · {jtEmps.length}/{jobTitle.headcount || 1} dolu
            </span>
            {jobTitle.standardBrutSalary > 0 && (
              <span className="text-xs mono" style={{ color: "var(--ink-mute)" }}>
                · {fmtTL(jobTitle.standardBrutSalary)} ₺
              </span>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          {canManageEmp && (
            <button onClick={() => onAddEmp(jobTitle.id)} className="p-1 rounded hover:bg-stone-100" title="Çalışan ata">
              <UserPlus size={10}/>
            </button>
          )}
          {canManageJT && (
            <>
              <button onClick={() => onEditJT(jobTitle)} className="p-1 rounded hover:bg-stone-100">
                <Edit3 size={10}/>
              </button>
              <button onClick={() => onDeleteJT(jobTitle)} className="p-1 rounded hover:bg-red-50">
                <Trash2 size={10} style={{ color: "var(--negative)" }}/>
              </button>
            </>
          )}
        </div>
      </div>
      {isExp && jtEmps.map(emp => (
        <EmployeeNode key={emp.id} emp={emp} level={level + 1}
          canManageEmp={canManageEmp}
          onEditEmp={onEditEmp} onDeleteEmp={onDeleteEmp}/>
      ))}
    </div>
  );
}

/* ---------- Çalışan düğümü (yaprak) ---------- */
function EmployeeNode({ emp, level, canManageEmp, onEditEmp, onDeleteEmp }) {
  const statusInfo = EMPLOYEE_STATUS[emp.status] || EMPLOYEE_STATUS.active;
  return (
    <div className="flex items-center gap-1 group hover:bg-stone-50 rounded px-1 py-1"
      style={{ paddingLeft: 4 + level * 20 }}>
      <span style={{ width: 16 }}/>
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: statusInfo.color + "33", color: statusInfo.color }}>
        {(emp.firstName?.[0] || "?") + (emp.lastName?.[0] || "")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span>{emp.firstName} {emp.lastName}</span>
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: statusInfo.color + "22", color: statusInfo.color }}>
            {statusInfo.label}
          </span>
          {emp.email && (
            <span className="text-xs" style={{ color: "var(--ink-mute)" }}>{emp.email}</span>
          )}
        </div>
      </div>
      {canManageEmp && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button onClick={() => onEditEmp(emp)} className="p-1 rounded hover:bg-stone-100">
            <Edit3 size={10}/>
          </button>
          <button onClick={() => onDeleteEmp(emp)} className="p-1 rounded hover:bg-red-50">
            <Trash2 size={10} style={{ color: "var(--negative)" }}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Org Chart Görünümü (kart bazlı) ---------- */
function OrgChartView({ orgUnits, departments, jobTitles, employees }) {
  const rootUnits = orgUnits.filter(o => !o.parentId);
  return (
    <div className="overflow-x-auto card p-4">
      <div className="flex flex-col items-center gap-6 min-w-fit">
        {rootUnits.map(ou => (
          <OrgChartNode key={ou.id} unit={ou}
            orgUnits={orgUnits} departments={departments}
            jobTitles={jobTitles} employees={employees}/>
        ))}
      </div>
    </div>
  );
}

function OrgChartNode({ unit, orgUnits, departments, jobTitles, employees }) {
  const typeInfo = ORG_UNIT_TYPES[unit.type] || ORG_UNIT_TYPES.branch;
  const subUnits = orgUnits.filter(o => o.parentId === unit.id);
  const unitDepts = departments.filter(d => d.orgUnitId === unit.id && !d.parentDeptId);
  const empCount = employees.filter(e => {
    const jt = jobTitles.find(j => j.id === e.jobTitleId);
    if (!jt) return false;
    const dept = departments.find(d => d.id === jt.departmentId);
    return dept?.orgUnitId === unit.id;
  }).length;

  return (
    <div className="flex flex-col items-center">
      <div className="card p-3 text-center min-w-[180px]" style={{ borderTop: `4px solid ${typeInfo.color}` }}>
        <div className="text-2xl mb-1">{typeInfo.icon}</div>
        <div className="font-bold text-sm" style={{ color: typeInfo.color }}>{unit.name}</div>
        <div className="text-xs" style={{ color: "var(--ink-mute)" }}>{typeInfo.label}</div>
        <div className="text-xs mt-2 flex items-center justify-center gap-3" style={{ color: "var(--ink-mute)" }}>
          <span><FolderTree size={10} style={{display:"inline"}}/> {unitDepts.length}</span>
          <span><Users size={10} style={{display:"inline"}}/> {empCount}</span>
        </div>
      </div>
      {subUnits.length > 0 && (
        <>
          <div className="w-px h-4" style={{ background: "var(--line)" }}/>
          <div className="flex items-start gap-4">
            {subUnits.map(sub => (
              <OrgChartNode key={sub.id} unit={sub}
                orgUnits={orgUnits} departments={departments}
                jobTitles={jobTitles} employees={employees}/>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Org Unit Form Modal ---------- */
function OrgUnitFormModal({ draft, setDraft, orgUnits, employees, users, canManageAuth, onClose, onSave }) {
  // Daireselliği önlemek için aday parent listesi
  const possibleParents = orgUnits.filter(o => o.id !== draft.id);

  return (
    <Modal title={draft.id ? "Organizasyon Birimi Düzenle" : "Yeni Organizasyon Birimi"}
      icon={Building2} onClose={onClose} onSave={onSave} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Birim Adı *</div>
            <input className="input w-full" autoFocus
              value={draft.name || ""} placeholder="Genel Müdürlük"
              onChange={e => setDraft({ ...draft, name: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Tür</div>
            <select className="input w-full" value={draft.type || "branch"}
              onChange={e => setDraft({ ...draft, type: e.target.value })}>
              {Object.entries(ORG_UNIT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Üst Birim (parent)</div>
            <select className="input w-full" value={draft.parentId || ""}
              onChange={e => setDraft({ ...draft, parentId: e.target.value || null })}>
              <option value="">— En üst seviye (kök) —</option>
              {possibleParents.map(p => (
                <option key={p.id} value={p.id}>
                  {ORG_UNIT_TYPES[p.type]?.icon} {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">Birim Kodu</div>
            <input className="input w-full mono" placeholder="GM-001"
              value={draft.code || ""}
              onChange={e => setDraft({ ...draft, code: e.target.value })}/>
          </div>
        </div>

        <div>
          <div className="label mb-1">Sorumlu Çalışan</div>
          <select className="input w-full" value={draft.managerEmployeeId || ""}
            onChange={e => setDraft({ ...draft, managerEmployeeId: e.target.value || null })}>
            <option value="">— Atanmamış —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="label mb-1">Açıklama</div>
          <textarea className="input w-full" rows="2"
            value={draft.description || ""}
            onChange={e => setDraft({ ...draft, description: e.target.value })}/>
        </div>

        {/* Yetki yönetimi */}
        {canManageAuth && (
          <AuthorizedUsersPicker
            users={users}
            selected={draft.authorizedUsers || []}
            onChange={(arr) => setDraft({ ...draft, authorizedUsers: arr })}
          />
        )}
      </div>
    </Modal>
  );
}

/* ---------- Departman Form Modal ---------- */
function DepartmentFormModal({ draft, setDraft, orgUnits, departments, employees, users, canManageAuth, onClose, onSave }) {
  const possibleParents = departments.filter(d =>
    d.id !== draft.id && d.orgUnitId === draft.orgUnitId
  );

  const colorPalette = ["#1d4ed8", "#0f766e", "#dc2626", "#ea580c", "#7c3aed", "#db2777", "#475569", "#0891b2", "#15803d", "#ca8a04"];

  return (
    <Modal title={draft.id ? "Departman Düzenle" : "Yeni Departman"}
      icon={FolderTree} onClose={onClose} onSave={onSave} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Departman Adı *</div>
            <input className="input w-full" autoFocus
              value={draft.name || ""} placeholder="İnsan Kaynakları"
              onChange={e => setDraft({ ...draft, name: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Kod</div>
            <input className="input w-full mono" placeholder="IK"
              value={draft.code || ""}
              onChange={e => setDraft({ ...draft, code: e.target.value })}/>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Bağlı Olduğu Org. Birimi *</div>
            <select className="input w-full" value={draft.orgUnitId || ""}
              onChange={e => setDraft({ ...draft, orgUnitId: e.target.value, parentDeptId: null })}>
              <option value="">— Seçiniz —</option>
              {orgUnits.map(o => (
                <option key={o.id} value={o.id}>
                  {ORG_UNIT_TYPES[o.type]?.icon} {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">Üst Departman (opsiyonel)</div>
            <select className="input w-full" value={draft.parentDeptId || ""}
              onChange={e => setDraft({ ...draft, parentDeptId: e.target.value || null })}>
              <option value="">— Üst seviye —</option>
              {possibleParents.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="label mb-1">Renk</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {colorPalette.map(c => (
              <button key={c} onClick={() => setDraft({ ...draft, color: c })}
                className="w-6 h-6 rounded-full"
                style={{
                  background: c,
                  border: draft.color === c ? "2px solid #000" : "2px solid transparent",
                }}/>
            ))}
            <input type="color" className="ml-2 w-8 h-8 cursor-pointer rounded"
              value={draft.color || "#737373"}
              onChange={e => setDraft({ ...draft, color: e.target.value })}/>
          </div>
        </div>

        <div>
          <div className="label mb-1">Departman Müdürü</div>
          <select className="input w-full" value={draft.managerEmployeeId || ""}
            onChange={e => setDraft({ ...draft, managerEmployeeId: e.target.value || null })}>
            <option value="">— Atanmamış —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </select>
        </div>

        {canManageAuth && (
          <AuthorizedUsersPicker
            users={users}
            selected={draft.authorizedUsers || []}
            onChange={(arr) => setDraft({ ...draft, authorizedUsers: arr })}
          />
        )}
      </div>
    </Modal>
  );
}

/* ---------- Pozisyon (Job Title) Form Modal ---------- */
function JobTitleFormModal({ draft, setDraft, departments, jobTitles, users, canManageAuth, onClose, onSave }) {
  const possibleReports = jobTitles.filter(j => j.id !== draft.id);

  return (
    <Modal title={draft.id ? "Pozisyon Düzenle" : "Yeni Pozisyon Tanımı"}
      icon={Briefcase} onClose={onClose} onSave={onSave} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div>
          <div className="label mb-1">Pozisyon Başlığı *</div>
          <input className="input w-full" autoFocus
            value={draft.title || ""} placeholder="İK Müdürü"
            onChange={e => setDraft({ ...draft, title: e.target.value })}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Departman *</div>
            <select className="input w-full" value={draft.departmentId || ""}
              onChange={e => setDraft({ ...draft, departmentId: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1">Seviye</div>
            <select className="input w-full" value={draft.level || "mid"}
              onChange={e => setDraft({ ...draft, level: e.target.value })}>
              {Object.entries(JOB_LEVELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">Pozisyon Kodu</div>
            <input className="input w-full mono" placeholder="IK-MGR-01"
              value={draft.code || ""}
              onChange={e => setDraft({ ...draft, code: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Kadro (kişi)</div>
            <input type="number" min="1" className="input w-full"
              value={draft.headcount || 1}
              onChange={e => setDraft({ ...draft, headcount: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Standart Brüt (TL)</div>
            <input className="input w-full mono text-right" placeholder="0,00"
              value={draft.standardBrutSalary || ""}
              onChange={e => setDraft({ ...draft, standardBrutSalary: e.target.value })}/>
          </div>
        </div>

        <div>
          <div className="label mb-1">Rapor Verdiği Pozisyon</div>
          <select className="input w-full" value={draft.reportsToJobTitleId || ""}
            onChange={e => setDraft({ ...draft, reportsToJobTitleId: e.target.value || null })}>
            <option value="">— Üst pozisyon yok —</option>
            {possibleReports.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="label mb-1">Pozisyon Açıklaması</div>
          <textarea className="input w-full" rows="3"
            value={draft.description || ""}
            placeholder="Pozisyonun temel sorumlulukları, yetkinlikler vb."
            onChange={e => setDraft({ ...draft, description: e.target.value })}/>
        </div>

        {canManageAuth && (
          <AuthorizedUsersPicker
            users={users}
            selected={draft.authorizedUsers || []}
            onChange={(arr) => setDraft({ ...draft, authorizedUsers: arr })}
          />
        )}
      </div>
    </Modal>
  );
}

/* ---------- Çalışan Form Modal ---------- */
function EmployeeFormModal({ draft, setDraft, jobTitles, departments, employees, onClose, onSave }) {
  return (
    <Modal title={draft.id ? "Çalışan Düzenle" : "Yeni Çalışan"}
      icon={UserPlus} onClose={onClose} onSave={onSave} maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Ad *</div>
            <input className="input w-full" autoFocus
              value={draft.firstName || ""}
              onChange={e => setDraft({ ...draft, firstName: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Soyad *</div>
            <input className="input w-full"
              value={draft.lastName || ""}
              onChange={e => setDraft({ ...draft, lastName: e.target.value })}/>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">E-posta</div>
            <input type="email" className="input w-full lowercase"
              value={draft.email || ""}
              onChange={e => setDraft({ ...draft, email: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Telefon</div>
            <input className="input w-full mono" placeholder="+90 5XX XXX XX XX"
              value={draft.phone || ""}
              onChange={e => setDraft({ ...draft, phone: e.target.value })}/>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">T.C. Kimlik No</div>
            <input className="input w-full mono" maxLength="11"
              value={draft.tcNo || ""}
              onChange={e => setDraft({ ...draft, tcNo: e.target.value.replace(/\D/g, "") })}/>
          </div>
          <div>
            <div className="label mb-1">SGK Sicil No</div>
            <input className="input w-full mono"
              value={draft.sgkNo || ""}
              onChange={e => setDraft({ ...draft, sgkNo: e.target.value })}/>
          </div>
        </div>

        <div>
          <div className="label mb-1">Pozisyon Ataması *</div>
          <select className="input w-full" value={draft.jobTitleId || ""}
            onChange={e => setDraft({ ...draft, jobTitleId: e.target.value })}>
            <option value="">— Seçiniz —</option>
            {jobTitles.map(j => {
              const dept = departments.find(d => d.id === j.departmentId);
              return (
                <option key={j.id} value={j.id}>
                  {j.title} {dept ? `(${dept.name})` : ""}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">Durum</div>
            <select className="input w-full" value={draft.status || "active"}
              onChange={e => setDraft({ ...draft, status: e.target.value })}>
              {Object.entries(EMPLOYEE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">İşe Başlama</div>
            <input type="date" className="input w-full"
              value={draft.startDate || ""}
              onChange={e => setDraft({ ...draft, startDate: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Brüt Maaş (TL)</div>
            <input className="input w-full mono text-right" placeholder="0,00"
              value={draft.brutSalary || ""}
              onChange={e => setDraft({ ...draft, brutSalary: e.target.value })}/>
          </div>
        </div>

        {parseTRNumber(draft.brutSalary) > 0 && (
          <div className="card p-2 text-xs" style={{ background: "#fef3c7" }}>
            <div className="flex items-center justify-between" style={{ color: "#854d0e" }}>
              <span>Tahmini Net Maaş:</span>
              <span className="font-bold mono">{fmtTL(computeNetFromGross(parseTRNumber(draft.brutSalary)))} ₺</span>
            </div>
            <div className="flex items-center justify-between mt-1" style={{ color: "#854d0e" }}>
              <span>İşveren Maliyeti:</span>
              <span className="font-bold mono">{fmtTL(computeEmployerCost(parseTRNumber(draft.brutSalary)))} ₺/ay</span>
            </div>
          </div>
        )}

        <div>
          <div className="label mb-1">Direkt Yönetici</div>
          <select className="input w-full" value={draft.managerEmployeeId || ""}
            onChange={e => setDraft({ ...draft, managerEmployeeId: e.target.value || null })}>
            <option value="">— Atanmamış —</option>
            {employees.filter(e => e.id !== draft.id).map(e => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Yetkili Kullanıcılar Seçici (her seviye için ortak) ---------- */
function AuthorizedUsersPicker({ users, selected, onChange }) {
  const toggle = (uname) => {
    if (selected.includes(uname)) {
      onChange(selected.filter(u => u !== uname));
    } else {
      onChange([...selected, uname]);
    }
  };

  return (
    <div className="card p-3" style={{ background: "var(--bg)" }}>
      <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: "#854d0e" }}>
        <Shield size={11}/> Yetkili Kullanıcılar
        <span className="ml-1 font-normal" style={{ color: "var(--ink-mute)" }}>
          ({selected.length} seçili — boş bırakılırsa rol bazlı standart yetkilendirme uygulanır)
        </span>
      </div>
      {users.length === 0 ? (
        <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
          Henüz sistem kullanıcısı tanımlanmamış (Kullanıcılar sekmesinden ekleyebilirsiniz)
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {users.map(u => (
            <label key={u.username} className="flex items-center gap-1.5 p-1.5 rounded hover:bg-stone-100 cursor-pointer">
              <input type="checkbox"
                checked={selected.includes(u.username)}
                onChange={() => toggle(u.username)}/>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{u.fullName || u.username}</div>
                <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                  {ROLES[u.role]?.label}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Personel Listesi (flat) ---------- */
function EmployeesList({ data, session, canAct, onChange, logAudit, notify }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  // RBAC: yeni canAct varsa kontrol et
  const canExport = canAct ? canAct("hr.employees.export") || can(session.role, "manage_employees") : can(session.role, "manage_employees");

  const employees   = data.hrEmployees   || [];
  const jobTitles   = data.hrJobTitles   || [];
  const departments = data.hrDepartments || [];

  const enriched = useMemo(() => employees.map(e => {
    const jt = jobTitles.find(j => j.id === e.jobTitleId);
    const dept = jt ? departments.find(d => d.id === jt.departmentId) : null;
    return { ...e, jobTitle: jt, department: dept };
  }), [employees, jobTitles, departments]);

  const filtered = useMemo(() => enriched.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const f = `${e.firstName} ${e.lastName} ${e.email} ${e.jobTitle?.title} ${e.department?.name}`.toLowerCase();
      if (!f.includes(q)) return false;
    }
    return true;
  }), [enriched, search, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input text-xs flex-1 min-w-[200px]" placeholder="İsim, e-posta, pozisyon..."
          value={search} onChange={e => setSearch(e.target.value)}/>
        <select className="input text-xs" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tüm Durumlar</option>
          {Object.entries(EMPLOYEE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>{filtered.length} çalışan</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 card">
          <Users size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">Çalışan Bulunamadı</div>
          <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Çalışan eklemek için Organizasyon sekmesini kullanın
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="grid w-full text-xs">
            <thead>
              <tr>
                <th className="label-cell">Ad Soyad</th>
                <th className="label-cell">Pozisyon</th>
                <th className="label-cell">Departman</th>
                <th className="label-cell">İletişim</th>
                <th>İşe Başlama</th>
                <th>Brüt</th>
                <th className="label-cell">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const statusInfo = EMPLOYEE_STATUS[emp.status] || EMPLOYEE_STATUS.active;
                return (
                  <tr key={emp.id}>
                    <td className="label-cell">
                      <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                    </td>
                    <td className="label-cell">{emp.jobTitle?.title || "—"}</td>
                    <td className="label-cell" style={{ color: emp.department?.color }}>
                      {emp.department?.name || "—"}
                    </td>
                    <td className="label-cell text-xs">
                      {emp.email && <div style={{ color: "var(--ink-mute)" }}>{emp.email}</div>}
                      {emp.phone && <div className="mono" style={{ color: "var(--ink-mute)" }}>{emp.phone}</div>}
                    </td>
                    <td className="num text-xs">{emp.startDate || "—"}</td>
                    <td className="num mono">{emp.brutSalary > 0 ? fmtTL(emp.brutSalary) : "—"}</td>
                    <td className="label-cell">
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: statusInfo.color + "22", color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   /ORGANIZATION
===================================================================== */

/* =====================================================================
   RECRUITMENT — İŞE ALIM YÖNETİMİ
   ---------------------------------------------------------------------
   4 alt-bölüm: Genel Bakış, Pozisyonlar, Adaylar, Pipeline, Mülakatlar
===================================================================== */
function RecruitmentManager({ data, session, canAct, onChange, logAudit, notify }) {
  const [view, setView] = useState("dashboard");
  const canManagePositions  = canAct ? canAct("hr.positions.create") || canAct("hr.positions.update") || can(session.role, "manage_positions") : can(session.role, "manage_positions");
  const canManageCandidates = canAct ? canAct("hr.candidates.create") || canAct("hr.candidates.update") || can(session.role, "manage_candidates") : can(session.role, "manage_candidates");
  const canManageInterviews = canAct ? canAct("hr.interviews.create") || canAct("hr.interviews.update") || can(session.role, "manage_interviews") : can(session.role, "manage_interviews");

  const positions    = data.hrPositions    || [];
  const candidates   = data.hrCandidates   || [];
  const applications = data.hrApplications || [];
  const interviews   = data.hrInterviews   || [];
  const departments  = data.hrDepartments  || [];

  // İstatistikler
  const stats = useMemo(() => {
    const openPositions = positions.filter(p => p.status === "open");
    const activeApps = applications.filter(a => !["hired","rejected","withdrawn"].includes(a.stage));
    const hiredThisMonth = applications.filter(a => {
      if (a.stage !== "hired" || !a.hiredAt) return false;
      const d = new Date(a.hiredAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const upcomingInterviews = interviews.filter(i => {
      if (i.status === "completed" || i.status === "cancelled") return false;
      const d = new Date(i.dateTime);
      return d >= new Date();
    });
    // Açık pozisyonların tahmini aylık brüt maliyeti
    const monthlyBudget = openPositions.reduce((sum, p) => {
      const brut = (Number(p.brutMinSalary) + Number(p.brutMaxSalary)) / 2 || 0;
      const cost = computeEmployerCost(brut);
      return sum + (cost * (Number(p.headcount) || 1));
    }, 0);
    return {
      openPositions: openPositions.length,
      totalApplications: applications.length,
      activeApplications: activeApps.length,
      hiredThisMonth: hiredThisMonth.length,
      upcomingInterviews: upcomingInterviews.length,
      candidatePool: candidates.length,
      monthlyBudget,
    };
  }, [positions, candidates, applications, interviews]);

  return (
    <div className="space-y-4">
      {/* İç sekme bar (recruitment alt-bölümleri) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {[
          { id: "dashboard",  icon: LayoutDashboard, label: "Genel Bakış" },
          { id: "positions",  icon: Briefcase,       label: `Pozisyonlar (${stats.openPositions})` },
          { id: "candidates", icon: Users,           label: `Adaylar (${stats.candidatePool})` },
          { id: "pipeline",   icon: Layers,          label: `Süreç (${stats.activeApplications})` },
          { id: "interviews", icon: CalendarClock,   label: `Mülakatlar (${stats.upcomingInterviews})` },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5"
            style={{
              background: view === t.id ? "var(--accent)" : "transparent",
              color: view === t.id ? "#fff" : "var(--ink-soft)",
              border: view === t.id ? "1px solid var(--accent)" : "1px solid var(--line)",
            }}>
            <t.icon size={11}/>{t.label}
          </button>
        ))}
      </div>

      {view === "dashboard" && (
        <RecruitmentDashboard data={data} stats={stats} setView={setView}/>
      )}
      {view === "positions" && (
        <PositionsList data={data} session={session} onChange={onChange}
          logAudit={logAudit} notify={notify}
          canManage={canManagePositions} departments={departments}/>
      )}
      {view === "candidates" && (
        <CandidatesList data={data} session={session} onChange={onChange}
          logAudit={logAudit} notify={notify}
          canManage={canManageCandidates}/>
      )}
      {view === "pipeline" && (
        <RecruitmentPipeline data={data} session={session} onChange={onChange}
          logAudit={logAudit} notify={notify}/>
      )}
      {view === "interviews" && (
        <InterviewsList data={data} session={session} onChange={onChange}
          logAudit={logAudit} notify={notify} canManage={canManageInterviews}/>
      )}
    </div>
  );
}

/* ---------- Genel Bakış (Dashboard) ---------- */
function RecruitmentDashboard({ data, stats, setView }) {
  const positions    = data.hrPositions    || [];
  const applications = data.hrApplications || [];
  const interviews   = data.hrInterviews   || [];
  const candidates   = data.hrCandidates   || [];

  // Bu hafta yapılacak mülakatlar
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86400000);
  const upcoming = interviews
    .filter(i => {
      const d = new Date(i.dateTime);
      return d >= now && d <= weekEnd && i.status !== "cancelled";
    })
    .sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime));

  // Açık pozisyonların aday sayıları
  const positionStats = positions.filter(p => p.status === "open").map(pos => {
    const apps = applications.filter(a => a.positionId === pos.id);
    return {
      ...pos,
      totalApps: apps.length,
      activeApps: apps.filter(a => !["hired","rejected","withdrawn"].includes(a.stage)).length,
      inOffer: apps.filter(a => a.stage === "offer").length,
    };
  });

  return (
    <div className="space-y-4">
      {/* KPI kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Açık Pozisyon" value={stats.openPositions} color="#0ea5e9" large/>
        <StatBlock label="Aktif Süreç" value={stats.activeApplications} color="#8b5cf6" large/>
        <StatBlock label="Bekleyen Mülakat" value={stats.upcomingInterviews} color="#f59e0b" large/>
        <StatBlock label="Bu Ay İşe Alınan" value={stats.hiredThisMonth} color="#15803d" large/>
      </div>

      {/* Bütçe öngörüsü */}
      {stats.monthlyBudget > 0 && (
        <div className="card p-4" style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-semibold" style={{ color: "#854d0e" }}>
                📊 Açık Pozisyonların Tahmini Aylık Maliyeti
              </div>
              <div className="display text-2xl mt-1" style={{ color: "#854d0e" }}>
                ≈ {fmtTL(stats.monthlyBudget)} ₺/ay
              </div>
              <div className="text-xs mt-1" style={{ color: "#92400e" }}>
                Brüt maaş ortalaması + işveren SGK + işsizlik primi dahil (yaklaşık)
              </div>
            </div>
            <button onClick={() => setView("positions")} className="btn btn-ghost text-xs">
              Detay <ChevronRight size={12}/>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Açık pozisyonlar özet */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm flex items-center gap-2">
              <Briefcase size={14}/> Açık Pozisyonlar
            </div>
            <button onClick={() => setView("positions")} className="text-xs hover:underline" style={{ color: "var(--accent)" }}>
              Tümü →
            </button>
          </div>
          {positionStats.length === 0 ? (
            <div className="text-xs text-center py-4" style={{ color: "var(--ink-mute)" }}>
              Henüz açık pozisyon yok
            </div>
          ) : (
            <div className="space-y-2">
              {positionStats.slice(0, 5).map(pos => (
                <div key={pos.id} className="flex items-center justify-between p-2 rounded"
                  style={{ background: "var(--bg)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pos.title}</div>
                    <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                      {pos.departmentName || "—"} · {pos.headcount || 1} kişi aranıyor
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                      {pos.activeApps}
                    </div>
                    <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                      aktif aday
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Yaklaşan mülakatlar */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm flex items-center gap-2">
              <CalendarClock size={14}/> Bu Haftaki Mülakatlar
            </div>
            <button onClick={() => setView("interviews")} className="text-xs hover:underline" style={{ color: "var(--accent)" }}>
              Tümü →
            </button>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-xs text-center py-4" style={{ color: "var(--ink-mute)" }}>
              Bu hafta planlanmış mülakat yok
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map(iv => {
                const cand = candidates.find(c => c.id === iv.candidateId);
                const pos = positions.find(p => p.id === iv.positionId);
                const dt = new Date(iv.dateTime);
                return (
                  <div key={iv.id} className="flex items-center gap-3 p-2 rounded"
                    style={{ background: "var(--bg)" }}>
                    <div className="text-center flex-shrink-0" style={{ minWidth: 50 }}>
                      <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                        {dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                      </div>
                      <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                        {dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {cand ? `${cand.firstName} ${cand.lastName}` : "?"}
                      </div>
                      <div className="text-xs truncate" style={{ color: "var(--ink-mute)" }}>
                        {pos?.title || "?"} · {iv.interviewType || "Mülakat"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Açık Pozisyonlar Listesi ---------- */
function PositionsList({ data, session, onChange, logAudit, notify, canManage, departments }) {
  const [showModal, setShowModal] = useState(null);  // null | {} (yeni) | position obj (düzenle)
  const [filter, setFilter] = useState({ status: "open", department: "" });

  const positions    = data.hrPositions    || [];
  const applications = data.hrApplications || [];

  // Departman adlarını çözümle
  const positionsWithDept = useMemo(() => positions.map(p => ({
    ...p,
    departmentName: departments.find(d => d.id === p.departmentId)?.name || "—",
    departmentColor: departments.find(d => d.id === p.departmentId)?.color || "#737373",
    applicationsCount: applications.filter(a => a.positionId === p.id).length,
    activeAppsCount: applications.filter(a => a.positionId === p.id && !["hired","rejected","withdrawn"].includes(a.stage)).length,
  })), [positions, applications, departments]);

  const filtered = useMemo(() => {
    return positionsWithDept.filter(p => {
      if (filter.status !== "all" && p.status !== filter.status) return false;
      if (filter.department && p.departmentId !== filter.department) return false;
      return true;
    }).sort((a,b) => (b.openedAt || "").localeCompare(a.openedAt || ""));
  }, [positionsWithDept, filter]);

  const savePosition = async (draft) => {
    if (!draft.title?.trim()) { alert("Pozisyon adı zorunlu"); return; }
    if (!draft.departmentId) { alert("Departman seçimi zorunlu"); return; }

    const isEdit = !!draft.id;
    const pos = isEdit ? draft : {
      id: "pos_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      status: draft.status || "open",
      openedAt: new Date().toISOString().slice(0, 10),
      openedBy: session.username,
    };
    // Sayısal alanları normalize et
    pos.headcount       = Number(draft.headcount) || 1;
    pos.brutMinSalary   = parseTRNumber(draft.brutMinSalary) || 0;
    pos.brutMaxSalary   = parseTRNumber(draft.brutMaxSalary) || pos.brutMinSalary;
    pos.experienceYears = Number(draft.experienceYears) || 0;
    pos.title           = draft.title.trim();
    pos.jobDescription  = (draft.jobDescription || "").trim();
    pos.requirements    = (draft.requirements || "").trim();
    pos.location        = (draft.location || "").trim();

    const nextList = isEdit
      ? positions.map(p => p.id === pos.id ? pos : p)
      : [...positions, pos];
    await onChange({ ...data, hrPositions: nextList });
    await logAudit(isEdit ? "position_edit" : "position_add", {
      pozisyon: pos.title, departman: positionsWithDept.find(d => d.id === pos.id)?.departmentName,
    });
    notify(isEdit ? "Pozisyon güncellendi" : "Pozisyon eklendi");
    setShowModal(null);
  };

  const removePosition = async (pos) => {
    const appCount = applications.filter(a => a.positionId === pos.id).length;
    const msg = appCount > 0
      ? `"${pos.title}" pozisyonunu ve bağlı ${appCount} başvuruyu silmek istediğinizden emin misiniz?`
      : `"${pos.title}" pozisyonunu silmek istediğinizden emin misiniz?`;
    if (!confirm(msg)) return;
    await onChange({
      ...data,
      hrPositions: positions.filter(p => p.id !== pos.id),
      hrApplications: applications.filter(a => a.positionId !== pos.id),
    });
    await logAudit("position_delete", { pozisyon: pos.title });
    notify("Pozisyon silindi");
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className="input text-xs" value={filter.status}
          onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="all">Tüm Durumlar</option>
          {Object.entries(POSITION_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="input text-xs" value={filter.department}
          onChange={e => setFilter({ ...filter, department: e.target.value })}>
          <option value="">Tüm Departmanlar</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
            {filtered.length} pozisyon
          </span>
          {canManage && (
            <button onClick={() => setShowModal({ status: "open", headcount: 1, employmentType: "full_time", workMode: "office", currency: "TRY", experienceYears: 0 })}
              className="btn btn-primary">
              <Plus size={13}/> Yeni Pozisyon
            </button>
          )}
        </div>
      </div>

      {/* Pozisyon kartları */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 card">
          <Briefcase size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">Pozisyon Bulunamadı</div>
          <div className="text-xs mb-4" style={{ color: "var(--ink-mute)" }}>
            Filtreyi değiştirin veya yeni pozisyon ekleyin
          </div>
          {canManage && (
            <button onClick={() => setShowModal({ status: "open", headcount: 1, employmentType: "full_time", workMode: "office", currency: "TRY", experienceYears: 0 })}
              className="btn btn-primary inline-flex items-center">
              <Plus size={13}/> İlk Pozisyonu Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(pos => (
            <PositionCard key={pos.id} position={pos} canManage={canManage}
              onEdit={() => setShowModal(pos)}
              onDelete={() => removePosition(pos)}/>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PositionFormModal draft={showModal} setDraft={setShowModal}
          departments={departments}
          onClose={() => setShowModal(null)}
          onSave={() => savePosition(showModal)}/>
      )}
    </div>
  );
}

/* ---------- Pozisyon Kartı ---------- */
function PositionCard({ position, canManage, onEdit, onDelete }) {
  const statusInfo = POSITION_STATUS[position.status] || POSITION_STATUS.open;
  const monthlyEmployerCost = computeEmployerCost((position.brutMinSalary + position.brutMaxSalary) / 2 || 0);

  return (
    <div className="card p-4 space-y-3 hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${position.departmentColor}` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{position.title}</div>
          <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: "var(--ink-mute)" }}>
            <span style={{ color: position.departmentColor }}>● {position.departmentName}</span>
            {position.location && <span>· <MapPin size={9} style={{display:"inline"}}/> {position.location}</span>}
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ background: statusInfo.color + "22", color: statusInfo.color }}>
          {statusInfo.label}
        </span>
      </div>

      {/* Detaylar */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div style={{ color: "var(--ink-mute)" }}>Aranan Kişi</div>
          <div className="font-medium">{position.headcount} kişi</div>
        </div>
        <div>
          <div style={{ color: "var(--ink-mute)" }}>Çalışma Şekli</div>
          <div className="font-medium">{EMPLOYMENT_TYPES[position.employmentType] || "?"}</div>
        </div>
        {position.experienceYears > 0 && (
          <div>
            <div style={{ color: "var(--ink-mute)" }}>Deneyim</div>
            <div className="font-medium">{position.experienceYears}+ yıl</div>
          </div>
        )}
        <div>
          <div style={{ color: "var(--ink-mute)" }}>Yer</div>
          <div className="font-medium">{WORK_MODES[position.workMode] || "?"}</div>
        </div>
      </div>

      {/* Maaş aralığı + tahmini maliyet */}
      {(position.brutMinSalary > 0 || position.brutMaxSalary > 0) && (
        <div className="p-2 rounded text-xs" style={{ background: "var(--bg)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink-mute)" }}>Brüt Maaş</span>
            <span className="font-medium mono">
              {fmtTL(position.brutMinSalary)} – {fmtTL(position.brutMaxSalary)} {position.currency}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span style={{ color: "var(--ink-mute)" }}>İşveren Maliyeti</span>
            <span className="font-semibold mono" style={{ color: "#854d0e" }}>
              ≈ {fmtTL(monthlyEmployerCost)} {position.currency}/ay
            </span>
          </div>
        </div>
      )}

      {/* Aday özet */}
      <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: "var(--line-soft)" }}>
        <span style={{ color: "var(--ink-mute)" }}>
          {position.applicationsCount} başvuru · <b style={{ color: "var(--ink)" }}>{position.activeAppsCount}</b> aktif
        </span>
        {canManage && (
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1 rounded hover:bg-stone-100" title="Düzenle">
              <Edit3 size={10}/>
            </button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-red-50" title="Sil">
              <Trash2 size={10} style={{ color: "var(--negative)" }}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Pozisyon Form Modal ---------- */
function PositionFormModal({ draft, setDraft, departments, onClose, onSave }) {
  return (
    <Modal title={draft.id ? "Pozisyon Düzenle" : "Yeni Pozisyon"} icon={Briefcase}
      onClose={onClose} onSave={onSave} maxWidth="max-w-2xl">
      <div className="space-y-3">
        {/* Temel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <div className="label mb-1">Pozisyon Adı *</div>
            <input className="input w-full" autoFocus
              value={draft.title || ""} placeholder="Senior Yazılım Geliştirici"
              onChange={e => setDraft({ ...draft, title: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Durum</div>
            <select className="input w-full" value={draft.status || "open"}
              onChange={e => setDraft({ ...draft, status: e.target.value })}>
              {Object.entries(POSITION_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">Departman *</div>
            <select className="input w-full" value={draft.departmentId || ""}
              onChange={e => setDraft({ ...draft, departmentId: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1">Çalışma Şekli</div>
            <select className="input w-full" value={draft.employmentType || "full_time"}
              onChange={e => setDraft({ ...draft, employmentType: e.target.value })}>
              {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">Çalışma Yeri</div>
            <select className="input w-full" value={draft.workMode || "office"}
              onChange={e => setDraft({ ...draft, workMode: e.target.value })}>
              {Object.entries(WORK_MODES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">Aranan Kişi Sayısı</div>
            <input className="input w-full" type="number" min="1"
              value={draft.headcount || 1}
              onChange={e => setDraft({ ...draft, headcount: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Min. Deneyim (yıl)</div>
            <input className="input w-full" type="number" min="0"
              value={draft.experienceYears || 0}
              onChange={e => setDraft({ ...draft, experienceYears: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Lokasyon</div>
            <input className="input w-full" placeholder="İstanbul / Ankara / vb."
              value={draft.location || ""}
              onChange={e => setDraft({ ...draft, location: e.target.value })}/>
          </div>
        </div>

        {/* Maaş aralığı */}
        <div className="card p-3" style={{ background: "var(--bg)" }}>
          <div className="text-xs font-semibold mb-2" style={{ color: "#854d0e" }}>
            💰 Maaş Aralığı (Brüt, aylık) — CFO öngörüsü için kritik
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="label mb-1 text-xs">Min. Brüt</div>
              <input className="input w-full mono text-right" type="text" placeholder="0,00"
                value={draft.brutMinSalary || ""}
                onChange={e => setDraft({ ...draft, brutMinSalary: e.target.value })}/>
            </div>
            <div>
              <div className="label mb-1 text-xs">Max. Brüt</div>
              <input className="input w-full mono text-right" type="text" placeholder="0,00"
                value={draft.brutMaxSalary || ""}
                onChange={e => setDraft({ ...draft, brutMaxSalary: e.target.value })}/>
            </div>
            <div>
              <div className="label mb-1 text-xs">Para Birimi</div>
              <select className="input w-full" value={draft.currency || "TRY"}
                onChange={e => setDraft({ ...draft, currency: e.target.value })}>
                <option value="TRY">TRY ₺</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </div>
          </div>
          {(parseTRNumber(draft.brutMinSalary) > 0 || parseTRNumber(draft.brutMaxSalary) > 0) && (
            <div className="text-xs mt-2 pt-2 border-t" style={{ borderColor: "var(--line-soft)", color: "#92400e" }}>
              📊 Tahmini işveren maliyeti: <b className="mono">
                {fmtTL(computeEmployerCost(parseTRNumber(draft.brutMinSalary)))} – {fmtTL(computeEmployerCost(parseTRNumber(draft.brutMaxSalary)))} {draft.currency || "TRY"}/ay/kişi
              </b>
            </div>
          )}
        </div>

        <div>
          <div className="label mb-1">İş Tanımı</div>
          <textarea className="input w-full" rows="3"
            value={draft.jobDescription || ""}
            onChange={e => setDraft({ ...draft, jobDescription: e.target.value })}
            placeholder="Pozisyonun temel sorumlulukları..."/>
        </div>

        <div>
          <div className="label mb-1">Gereksinimler</div>
          <textarea className="input w-full" rows="3"
            value={draft.requirements || ""}
            onChange={e => setDraft({ ...draft, requirements: e.target.value })}
            placeholder="• Üniversite mezunu&#10;• 3+ yıl deneyim&#10;• ..."/>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Aday Havuzu ---------- */
function CandidatesList({ data, session, onChange, logAudit, notify, canManage }) {
  const [showModal, setShowModal] = useState(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const candidates   = data.hrCandidates   || [];
  const applications = data.hrApplications || [];
  const positions    = data.hrPositions    || [];

  const candidatesWithApps = useMemo(() => candidates.map(c => {
    const apps = applications.filter(a => a.candidateId === c.id);
    return {
      ...c,
      applicationsCount: apps.length,
      activeApps: apps.filter(a => !["hired","rejected","withdrawn"].includes(a.stage)).length,
      lastStage: apps.sort((x,y) => (y.updatedAt || "").localeCompare(x.updatedAt || ""))[0]?.stage,
    };
  }), [candidates, applications]);

  const filtered = useMemo(() => {
    return candidatesWithApps.filter(c => {
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const currentRole = (c.currentRole || "").toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !phone.includes(q) && !currentRole.includes(q)) return false;
      }
      return true;
    }).sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [candidatesWithApps, search, sourceFilter]);

  const saveCandidate = async (draft) => {
    if (!draft.firstName?.trim() || !draft.lastName?.trim()) { alert("Ad ve soyad zorunlu"); return; }

    const isEdit = !!draft.id;
    const candidate = isEdit ? draft : {
      id: "cand_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    candidate.firstName = draft.firstName.trim();
    candidate.lastName  = draft.lastName.trim();
    candidate.email     = (draft.email || "").trim().toLowerCase();
    candidate.phone     = (draft.phone || "").trim();
    candidate.currentRole = (draft.currentRole || "").trim();
    candidate.currentCompany = (draft.currentCompany || "").trim();
    candidate.expectedBrutSalary = parseTRNumber(draft.expectedBrutSalary) || 0;
    candidate.notes = (draft.notes || "").trim();
    candidate.experienceYears = Number(draft.experienceYears) || 0;

    const nextList = isEdit
      ? candidates.map(c => c.id === candidate.id ? candidate : c)
      : [...candidates, candidate];
    await onChange({ ...data, hrCandidates: nextList });
    await logAudit(isEdit ? "candidate_edit" : "candidate_add", {
      aday: `${candidate.firstName} ${candidate.lastName}`,
    });
    notify(isEdit ? "Aday güncellendi" : "Aday eklendi");
    setShowModal(null);
  };

  const removeCandidate = async (cand) => {
    const appCount = applications.filter(a => a.candidateId === cand.id).length;
    const msg = appCount > 0
      ? `"${cand.firstName} ${cand.lastName}" adayını ve bağlı ${appCount} başvuruyu silmek istediğinizden emin misiniz?`
      : `"${cand.firstName} ${cand.lastName}" adayını silmek istediğinizden emin misiniz?`;
    if (!confirm(msg)) return;
    await onChange({
      ...data,
      hrCandidates: candidates.filter(c => c.id !== cand.id),
      hrApplications: applications.filter(a => a.candidateId !== cand.id),
    });
    await logAudit("candidate_delete", { aday: `${cand.firstName} ${cand.lastName}` });
    notify("Aday silindi");
  };

  // Adayı bir pozisyona başvurt
  const applyToPosition = async (cand, positionId) => {
    if (!positionId) return;
    const existing = applications.find(a => a.candidateId === cand.id && a.positionId === positionId);
    if (existing) { alert("Bu aday zaten bu pozisyona başvurmuş"); return; }
    const newApp = {
      id: "app_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      candidateId: cand.id,
      positionId,
      stage: "cv_review",
      score: null,
      stageHistory: [{
        stage: "cv_review",
        enteredAt: new Date().toISOString(),
        enteredBy: session.username,
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onChange({ ...data, hrApplications: [...applications, newApp] });
    await logAudit("application_create", {
      aday: `${cand.firstName} ${cand.lastName}`,
      pozisyon: positions.find(p => p.id === positionId)?.title,
    });
    notify("Aday pozisyona başvurttu");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input text-xs flex-1 min-w-[200px]" placeholder="Ad, e-posta, telefon veya pozisyon..."
          value={search} onChange={e => setSearch(e.target.value)}/>
        <select className="input text-xs" value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}>
          <option value="">Tüm Kaynaklar</option>
          {Object.entries(CANDIDATE_SOURCES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>{filtered.length} aday</span>
        {canManage && (
          <button onClick={() => setShowModal({})} className="btn btn-primary">
            <UserPlus size={13}/> Yeni Aday
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 card">
          <Users size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">Aday Bulunamadı</div>
          <div className="text-xs mb-4" style={{ color: "var(--ink-mute)" }}>
            Filtreyi değiştirin veya yeni aday ekleyin
          </div>
          {canManage && (
            <button onClick={() => setShowModal({})} className="btn btn-primary inline-flex items-center">
              <UserPlus size={13}/> İlk Adayı Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="grid w-full text-xs">
            <thead>
              <tr>
                <th className="label-cell">Ad Soyad</th>
                <th className="label-cell">İletişim</th>
                <th className="label-cell">Mevcut Pozisyon</th>
                <th className="label-cell">Kaynak</th>
                <th>Deneyim</th>
                <th>Beklenti</th>
                <th className="label-cell">Başvuru</th>
                {canManage && <th style={{ width: 140 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(cand => (
                <CandidateRow key={cand.id} candidate={cand} positions={positions}
                  canManage={canManage}
                  onEdit={() => setShowModal(cand)}
                  onDelete={() => removeCandidate(cand)}
                  onApply={(posId) => applyToPosition(cand, posId)}/>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CandidateFormModal draft={showModal} setDraft={setShowModal}
          onClose={() => setShowModal(null)}
          onSave={() => saveCandidate(showModal)}/>
      )}
    </div>
  );
}

/* ---------- Aday Satırı ---------- */
function CandidateRow({ candidate, positions, canManage, onEdit, onDelete, onApply }) {
  const [showApply, setShowApply] = useState(false);
  const openPositions = positions.filter(p => p.status === "open");
  const stageInfo = RECRUITMENT_STAGES.find(s => s.id === candidate.lastStage);

  return (
    <tr>
      <td className="label-cell">
        <div className="font-medium">{candidate.firstName} {candidate.lastName}</div>
        {candidate.linkedIn && (
          <a href={candidate.linkedIn} target="_blank" rel="noopener noreferrer"
            className="text-xs flex items-center gap-1 hover:underline" style={{ color: "#0a66c2" }}>
            <Linkedin size={9}/> LinkedIn
          </a>
        )}
      </td>
      <td className="label-cell text-xs">
        {candidate.email && (
          <div className="flex items-center gap-1" style={{ color: "var(--ink-mute)" }}>
            <AtSign size={9}/> <span className="truncate">{candidate.email}</span>
          </div>
        )}
        {candidate.phone && (
          <div className="flex items-center gap-1 mono" style={{ color: "var(--ink-mute)" }}>
            <Phone size={9}/> {candidate.phone}
          </div>
        )}
      </td>
      <td className="label-cell text-xs">
        {candidate.currentRole && <div>{candidate.currentRole}</div>}
        {candidate.currentCompany && (
          <div style={{ color: "var(--ink-mute)" }}>{candidate.currentCompany}</div>
        )}
      </td>
      <td className="label-cell text-xs" style={{ color: "var(--ink-mute)" }}>
        {CANDIDATE_SOURCES[candidate.source] || "—"}
      </td>
      <td className="num text-xs">{candidate.experienceYears || 0} yıl</td>
      <td className="num mono text-xs">
        {candidate.expectedBrutSalary > 0 ? `${fmtTL(candidate.expectedBrutSalary)} ₺` : "—"}
      </td>
      <td className="label-cell">
        {candidate.activeApps > 0 && stageInfo ? (
          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: stageInfo.color + "22", color: stageInfo.color }}>
            {stageInfo.label}
          </span>
        ) : candidate.applicationsCount > 0 ? (
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
            {candidate.applicationsCount} başvuru
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>—</span>
        )}
      </td>
      {canManage && (
        <td className="label-cell">
          <div className="flex items-center gap-1 justify-end relative">
            {openPositions.length > 0 && (
              <>
                <button onClick={() => setShowApply(!showApply)}
                  className="btn btn-ghost text-xs" title="Pozisyona Başvurt">
                  <Briefcase size={10}/>
                </button>
                {showApply && (
                  <div className="absolute right-0 top-full mt-1 card p-2 z-10"
                    style={{ minWidth: 200, background: "var(--paper)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "var(--ink-mute)" }}>
                      Pozisyon Seç
                    </div>
                    {openPositions.map(p => (
                      <button key={p.id}
                        onClick={() => { onApply(p.id); setShowApply(false); }}
                        className="block w-full text-left px-2 py-1 text-xs hover:bg-stone-100 rounded">
                        {p.title}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button onClick={onEdit} className="p-1 rounded hover:bg-stone-100">
              <Edit3 size={10}/>
            </button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-red-50">
              <Trash2 size={10} style={{ color: "var(--negative)" }}/>
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

/* ---------- Aday Form Modal ---------- */
function CandidateFormModal({ draft, setDraft, onClose, onSave }) {
  return (
    <Modal title={draft.id ? "Aday Düzenle" : "Yeni Aday"} icon={UserPlus}
      onClose={onClose} onSave={onSave} maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Ad *</div>
            <input className="input w-full" autoFocus
              value={draft.firstName || ""}
              onChange={e => setDraft({ ...draft, firstName: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Soyad *</div>
            <input className="input w-full"
              value={draft.lastName || ""}
              onChange={e => setDraft({ ...draft, lastName: e.target.value })}/>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">E-posta</div>
            <input type="email" className="input w-full lowercase"
              value={draft.email || ""}
              onChange={e => setDraft({ ...draft, email: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Telefon</div>
            <input className="input w-full mono"
              value={draft.phone || ""} placeholder="+90 5XX XXX XX XX"
              onChange={e => setDraft({ ...draft, phone: e.target.value })}/>
          </div>
        </div>

        <div>
          <div className="label mb-1">LinkedIn URL</div>
          <input className="input w-full text-xs"
            value={draft.linkedIn || ""}
            placeholder="https://linkedin.com/in/..."
            onChange={e => setDraft({ ...draft, linkedIn: e.target.value })}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Mevcut Pozisyon</div>
            <input className="input w-full"
              value={draft.currentRole || ""}
              placeholder="Senior Developer"
              onChange={e => setDraft({ ...draft, currentRole: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Mevcut Şirket</div>
            <input className="input w-full"
              value={draft.currentCompany || ""}
              onChange={e => setDraft({ ...draft, currentCompany: e.target.value })}/>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">Deneyim (yıl)</div>
            <input className="input w-full" type="number" min="0"
              value={draft.experienceYears || 0}
              onChange={e => setDraft({ ...draft, experienceYears: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Maaş Beklentisi (Brüt)</div>
            <input className="input w-full mono text-right"
              value={draft.expectedBrutSalary || ""}
              placeholder="0,00"
              onChange={e => setDraft({ ...draft, expectedBrutSalary: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Kaynak</div>
            <select className="input w-full" value={draft.source || ""}
              onChange={e => setDraft({ ...draft, source: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {Object.entries(CANDIDATE_SOURCES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="label mb-1">Notlar</div>
          <textarea className="input w-full" rows="3"
            value={draft.notes || ""}
            placeholder="Aday hakkında özel notlar..."
            onChange={e => setDraft({ ...draft, notes: e.target.value })}/>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Süreç (Pipeline / Kanban) ---------- */
function RecruitmentPipeline({ data, session, onChange, logAudit, notify }) {
  const [positionFilter, setPositionFilter] = useState("");

  const positions    = data.hrPositions    || [];
  const candidates   = data.hrCandidates   || [];
  const applications = data.hrApplications || [];

  const openPositions = positions.filter(p => p.status === "open");
  const activeStages = RECRUITMENT_STAGES.filter(s => s.order <= 7);  // Reddedildi/Vazgeçti hariç

  const filteredApps = useMemo(() => {
    return applications.filter(a => {
      if (positionFilter && a.positionId !== positionFilter) return false;
      return true;
    });
  }, [applications, positionFilter]);

  const moveStage = async (appId, newStage) => {
    const app = applications.find(a => a.id === appId);
    if (!app || app.stage === newStage) return;
    const stageInfo = RECRUITMENT_STAGES.find(s => s.id === newStage);
    const updated = {
      ...app,
      stage: newStage,
      stageHistory: [...(app.stageHistory || []), {
        stage: newStage,
        enteredAt: new Date().toISOString(),
        enteredBy: session.username,
      }],
      updatedAt: new Date().toISOString(),
    };
    if (newStage === "hired") updated.hiredAt = new Date().toISOString();
    await onChange({ ...data, hrApplications: applications.map(a => a.id === appId ? updated : a) });
    const cand = candidates.find(c => c.id === app.candidateId);
    await logAudit("application_stage_change", {
      aday: cand ? `${cand.firstName} ${cand.lastName}` : "?",
      yeniAsama: stageInfo?.label,
    });
    notify(`Aşama güncellendi: ${stageInfo?.label}`);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className="input text-xs" value={positionFilter}
          onChange={e => setPositionFilter(e.target.value)}>
          <option value="">Tüm Pozisyonlar</option>
          {openPositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
          {filteredApps.filter(a => activeStages.some(s => s.id === a.stage)).length} aktif aday
        </span>
        <div className="ml-auto text-xs" style={{ color: "var(--ink-mute)" }}>
          💡 Aşamayı değiştirmek için kartın altındaki butonları kullanın
        </div>
      </div>

      {/* Kanban kolonları */}
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: 500 }}>
        {activeStages.map(stage => {
          const stageApps = filteredApps.filter(a => a.stage === stage.id);
          return (
            <div key={stage.id} className="flex-shrink-0" style={{ width: 240 }}>
              <div className="card p-2 mb-2 sticky top-0 z-10"
                style={{ background: stage.color, color: "#fff" }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold">{stage.label}</div>
                  <span className="text-xs font-bold px-1.5 rounded"
                    style={{ background: "rgba(255,255,255,0.3)" }}>
                    {stageApps.length}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {stageApps.length === 0 ? (
                  <div className="card p-3 text-center text-xs" style={{ color: "var(--ink-mute)" }}>
                    Bu aşamada aday yok
                  </div>
                ) : stageApps.map(app => {
                  const cand = candidates.find(c => c.id === app.candidateId);
                  const pos = positions.find(p => p.id === app.positionId);
                  if (!cand || !pos) return null;
                  return (
                    <PipelineCard key={app.id} app={app} candidate={cand} position={pos}
                      onMoveStage={(newStage) => moveStage(app.id, newStage)}/>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Pipeline Kartı ---------- */
function PipelineCard({ app, candidate, position, onMoveStage }) {
  const [showMenu, setShowMenu] = useState(false);
  const currentStage = RECRUITMENT_STAGES.find(s => s.id === app.stage);
  const nextStage = RECRUITMENT_STAGES.find(s => s.order === (currentStage?.order || 0) + 1);
  const daysSinceUpdate = Math.floor((Date.now() - new Date(app.updatedAt || app.createdAt).getTime()) / 86400000);

  return (
    <div className="card p-2.5 space-y-2 hover:shadow-md transition-shadow">
      <div>
        <div className="text-sm font-medium">{candidate.firstName} {candidate.lastName}</div>
        <div className="text-xs truncate" style={{ color: "var(--ink-mute)" }}>
          {position.title}
        </div>
      </div>
      {candidate.currentRole && (
        <div className="text-xs flex items-center gap-1" style={{ color: "var(--ink-mute)" }}>
          <Briefcase size={9}/> {candidate.currentRole}
        </div>
      )}
      {candidate.expectedBrutSalary > 0 && (
        <div className="text-xs mono" style={{ color: "var(--ink-mute)" }}>
          {fmtTL(candidate.expectedBrutSalary)} ₺
        </div>
      )}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--line-soft)" }}>
        <span className="text-xs" style={{ color: daysSinceUpdate > 14 ? "var(--negative)" : "var(--ink-mute)" }}>
          {daysSinceUpdate === 0 ? "Bugün" : `${daysSinceUpdate}g önce`}
        </span>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-stone-100 text-xs">
            <ChevronsUpDown size={10}/>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 card p-1 z-20"
              style={{ minWidth: 160, background: "var(--paper)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
              <div className="text-xs font-semibold px-2 py-1" style={{ color: "var(--ink-mute)" }}>
                Aşamaya Taşı
              </div>
              {RECRUITMENT_STAGES.filter(s => s.id !== app.stage).map(s => (
                <button key={s.id}
                  onClick={() => { onMoveStage(s.id); setShowMenu(false); }}
                  className="block w-full text-left px-2 py-1 text-xs hover:bg-stone-100 rounded">
                  <span style={{ color: s.color }}>●</span> {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {nextStage && nextStage.order <= 7 && (
        <button onClick={() => onMoveStage(nextStage.id)}
          className="w-full px-2 py-1 text-xs rounded font-medium"
          style={{ background: nextStage.color, color: "#fff" }}>
          → {nextStage.label}
        </button>
      )}
    </div>
  );
}

/* ---------- Mülakatlar Listesi ---------- */
function InterviewsList({ data, session, onChange, logAudit, notify, canManage }) {
  const [showModal, setShowModal] = useState(null);
  const [filter, setFilter] = useState("upcoming");

  const interviews   = data.hrInterviews   || [];
  const candidates   = data.hrCandidates   || [];
  const positions    = data.hrPositions    || [];

  const interviewsEnriched = useMemo(() => interviews.map(iv => ({
    ...iv,
    candidate: candidates.find(c => c.id === iv.candidateId),
    position: positions.find(p => p.id === iv.positionId),
  })), [interviews, candidates, positions]);

  const filtered = useMemo(() => {
    const now = new Date();
    return interviewsEnriched.filter(iv => {
      const dt = new Date(iv.dateTime);
      if (filter === "upcoming") return dt >= now && iv.status !== "cancelled";
      if (filter === "past") return dt < now;
      if (filter === "cancelled") return iv.status === "cancelled";
      return true;
    }).sort((a,b) => {
      // Yaklaşan en yakın önce, geçmiş en yeni önce
      if (filter === "upcoming") return new Date(a.dateTime) - new Date(b.dateTime);
      return new Date(b.dateTime) - new Date(a.dateTime);
    });
  }, [interviewsEnriched, filter]);

  const saveInterview = async (draft) => {
    if (!draft.candidateId || !draft.positionId) { alert("Aday ve pozisyon zorunlu"); return; }
    if (!draft.dateTime) { alert("Tarih/saat zorunlu"); return; }

    const isEdit = !!draft.id;
    const iv = isEdit ? draft : {
      id: "iv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      status: "scheduled",
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    iv.interviewers = (draft.interviewers || "").trim();
    iv.location = (draft.location || "").trim();
    iv.notes = (draft.notes || "").trim();

    const nextList = isEdit
      ? interviews.map(x => x.id === iv.id ? iv : x)
      : [...interviews, iv];
    await onChange({ ...data, hrInterviews: nextList });
    await logAudit(isEdit ? "interview_edit" : "interview_schedule", {
      aday: candidates.find(c => c.id === iv.candidateId) ? `${candidates.find(c => c.id === iv.candidateId).firstName} ${candidates.find(c => c.id === iv.candidateId).lastName}` : "?",
      tarih: new Date(iv.dateTime).toLocaleString("tr-TR"),
    });
    notify(isEdit ? "Mülakat güncellendi" : "Mülakat planlandı");
    setShowModal(null);
  };

  const cancelInterview = async (iv) => {
    if (!confirm("Bu mülakatı iptal etmek istediğinizden emin misiniz?")) return;
    await onChange({ ...data, hrInterviews: interviews.map(x => x.id === iv.id ? { ...x, status: "cancelled" } : x) });
    await logAudit("interview_cancel", { id: iv.id });
    notify("Mülakat iptal edildi");
  };

  const completeInterview = async (iv, rating) => {
    await onChange({ ...data, hrInterviews: interviews.map(x => x.id === iv.id
      ? { ...x, status: "completed", rating, completedAt: new Date().toISOString() }
      : x) });
    notify("Mülakat tamamlandı");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: "upcoming", label: "Yaklaşan" },
          { id: "past", label: "Geçmiş" },
          { id: "cancelled", label: "İptal" },
          { id: "all", label: "Tümü" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              background: filter === f.id ? "var(--accent)" : "var(--bg)",
              color: filter === f.id ? "#fff" : "var(--ink-soft)",
              border: "1px solid var(--line)",
            }}>
            {f.label}
          </button>
        ))}
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>{filtered.length} mülakat</span>
        {canManage && (
          <button onClick={() => setShowModal({
            dateTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
            interviewType: "İK Mülakatı",
            mode: "office",
          })} className="btn btn-primary ml-auto">
            <Plus size={13}/> Yeni Mülakat
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 card">
          <CalendarClock size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">Mülakat Bulunamadı</div>
          <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
            {filter === "upcoming" && "Yaklaşan mülakat yok"}
            {filter === "past" && "Geçmiş mülakat yok"}
            {filter === "cancelled" && "İptal mülakat yok"}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(iv => (
            <InterviewRow key={iv.id} interview={iv}
              canManage={canManage}
              onEdit={() => setShowModal(iv)}
              onCancel={() => cancelInterview(iv)}
              onComplete={(rating) => completeInterview(iv, rating)}/>
          ))}
        </div>
      )}

      {showModal && (
        <InterviewFormModal draft={showModal} setDraft={setShowModal}
          candidates={candidates} positions={positions}
          onClose={() => setShowModal(null)}
          onSave={() => saveInterview(showModal)}/>
      )}
    </div>
  );
}

/* ---------- Mülakat Satırı ---------- */
function InterviewRow({ interview, canManage, onEdit, onCancel, onComplete }) {
  const dt = new Date(interview.dateTime);
  const isPast = dt < new Date();
  const statusColor = interview.status === "cancelled" ? "#737373"
    : interview.status === "completed" ? "#15803d"
    : isPast ? "#b45309" : "#0ea5e9";

  return (
    <div className="card p-3 flex items-center gap-3 flex-wrap">
      <div className="text-center flex-shrink-0" style={{ minWidth: 70 }}>
        <div className="font-bold text-sm" style={{ color: statusColor }}>
          {dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
        </div>
        <div className="text-xs mono" style={{ color: "var(--ink-mute)" }}>
          {dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {interview.candidate ? `${interview.candidate.firstName} ${interview.candidate.lastName}` : "?"}
        </div>
        <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
          {interview.position?.title || "?"} · {interview.interviewType}
          {interview.interviewers && ` · ${interview.interviewers}`}
        </div>
      </div>
      <span className="text-xs px-2 py-0.5 rounded font-medium"
        style={{ background: statusColor + "22", color: statusColor }}>
        {interview.status === "cancelled" ? "İptal"
          : interview.status === "completed" ? "Tamamlandı"
          : isPast ? "Geçti" : "Planlandı"}
      </span>
      {interview.status === "completed" && interview.rating && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={10}
              style={{ color: i < interview.rating ? "#f59e0b" : "var(--line)", fill: i < interview.rating ? "#f59e0b" : "none" }}/>
          ))}
        </div>
      )}
      {canManage && interview.status === "scheduled" && (
        <div className="flex items-center gap-1">
          {isPast && (
            <select onChange={e => e.target.value && onComplete(Number(e.target.value))}
              className="input text-xs" defaultValue="">
              <option value="">Tamamla...</option>
              <option value="1">★ — Çok zayıf</option>
              <option value="2">★★ — Zayıf</option>
              <option value="3">★★★ — Orta</option>
              <option value="4">★★★★ — İyi</option>
              <option value="5">★★★★★ — Mükemmel</option>
            </select>
          )}
          <button onClick={onEdit} className="p-1 rounded hover:bg-stone-100">
            <Edit3 size={10}/>
          </button>
          <button onClick={onCancel} className="p-1 rounded hover:bg-red-50">
            <X size={10} style={{ color: "var(--negative)" }}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Mülakat Form Modal ---------- */
function InterviewFormModal({ draft, setDraft, candidates, positions, onClose, onSave }) {
  return (
    <Modal title={draft.id ? "Mülakat Düzenle" : "Yeni Mülakat"} icon={CalendarClock}
      onClose={onClose} onSave={onSave} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Aday *</div>
            <select className="input w-full" value={draft.candidateId || ""}
              onChange={e => setDraft({ ...draft, candidateId: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">Pozisyon *</div>
            <select className="input w-full" value={draft.positionId || ""}
              onChange={e => setDraft({ ...draft, positionId: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {positions.filter(p => p.status === "open").map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="label mb-1">Tarih/Saat *</div>
          <input type="datetime-local" className="input w-full"
            value={draft.dateTime || ""}
            onChange={e => setDraft({ ...draft, dateTime: e.target.value })}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Mülakat Türü</div>
            <select className="input w-full" value={draft.interviewType || ""}
              onChange={e => setDraft({ ...draft, interviewType: e.target.value })}>
              <option value="Telefon Görüşmesi">Telefon Görüşmesi</option>
              <option value="Teknik Mülakat">Teknik Mülakat</option>
              <option value="İK Mülakatı">İK Mülakatı</option>
              <option value="Vaka Çalışması">Vaka Çalışması</option>
              <option value="Üst Yönetim Mülakatı">Üst Yönetim Mülakatı</option>
              <option value="Diğer">Diğer</option>
            </select>
          </div>
          <div>
            <div className="label mb-1">Yapılış Şekli</div>
            <select className="input w-full" value={draft.mode || "office"}
              onChange={e => setDraft({ ...draft, mode: e.target.value })}>
              <option value="office">Yüz Yüze (Ofiste)</option>
              <option value="video">Video Konferans</option>
              <option value="phone">Telefon</option>
            </select>
          </div>
        </div>

        <div>
          <div className="label mb-1">Mülakatçılar</div>
          <input className="input w-full" placeholder="Ahmet Yılmaz, Mehmet Demir, ..."
            value={draft.interviewers || ""}
            onChange={e => setDraft({ ...draft, interviewers: e.target.value })}/>
        </div>

        <div>
          <div className="label mb-1">Yer / Bağlantı</div>
          <input className="input w-full" placeholder="Toplantı odası 2 / Zoom linki / ..."
            value={draft.location || ""}
            onChange={e => setDraft({ ...draft, location: e.target.value })}/>
        </div>

        <div>
          <div className="label mb-1">Notlar</div>
          <textarea className="input w-full" rows="2"
            value={draft.notes || ""}
            onChange={e => setDraft({ ...draft, notes: e.target.value })}/>
        </div>
      </div>
    </Modal>
  );
}

/* =====================================================================
   /HR
===================================================================== */

/* =====================================================================
   AI ASİSTAN — Veri Tabanından ve Audit Log'undan Beslenen Chatbot
   ---------------------------------------------------------------------
   Tüm uygulamaya floating widget olarak eklenir. Kullanıcı sorusunu yazar,
   Claude API'sine bağlamla beraber gönderilir, cevap chat ekranında akar.
   
   Bağlam (context) — Claude'a geçirilen veri:
     • Aktif şirket bilgisi
     • Nakit akış özeti (aylık toplam giriş/çıkış)
     • Banka hesapları + son bakiye
     • Kasa hesapları + son bakiye
     • Faturalar özeti (toplam, ödenmemiş, vadesi geçen)
     • Krediler özeti
     • HR özeti (org birim, departman, çalışan sayısı, açık pozisyon)
     • Sistem kullanıcıları (audit yetkisi varsa)
     • Son 100 audit log girişi (kim, ne, ne zaman)
     • Aktif kullanıcı
===================================================================== */

// Bağlam oluşturucu — büyük data'yı API limitine sığacak şekilde özetler
function buildAIContext(data, session, users, audit) {
  if (!data) return null;

  const activeCompany = (data.companies || []).find(c => c.id === data.activeCompanyId);
  const rates = data.exchangeRates || {};
  const dc = data.displayCurrency || "TRY";

  // Nakit akış özeti
  const cells = data.cells || {};
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const monthlySummary = months.map((m, i) => {
    let inSum = 0, outSum = 0;
    (data.inflows || []).forEach(cat => {
      inSum += Number(cells[`${cat.id}_${i}_actual`] || cells[`${cat.id}_${i}_planned`] || 0);
    });
    (data.outflows || []).forEach(cat => {
      outSum += Number(cells[`${cat.id}_${i}_actual`] || cells[`${cat.id}_${i}_planned`] || 0);
    });
    return { ay: m, giris: inSum, cikis: outSum, net: inSum - outSum };
  });

  // Bankalar
  const bankAccounts = (data.bankAccounts || []).map(b => {
    const entries = (data.bankEntries || []).filter(e => e.accountId === b.id);
    const balance = entries.reduce((s, e) => s + (Number(e.amount) || 0), Number(b.openingBalance) || 0);
    return {
      ad: b.name, parabirim: b.currency, bakiye: balance,
      hareketSayisi: entries.length,
    };
  });

  // Kasa
  const kasaAccounts = (data.kasaAccounts || []).map(k => {
    const entries = (data.kasaEntries || []).filter(e => e.accountId === k.id);
    const balance = entries.reduce((s, e) => s + (e.type === "in" ? 1 : -1) * (Number(e.amount) || 0), Number(k.openingBalance) || 0);
    return { ad: k.name, parabirim: k.currency, bakiye: balance };
  });

  // Faturalar
  const invoices = data.invoices || [];
  const today = new Date().toISOString().slice(0, 10);
  const invoiceStats = {
    toplam: invoices.length,
    gelen: invoices.filter(i => i.type === "in").length,
    giden: invoices.filter(i => i.type === "out").length,
    odenmemis: invoices.filter(i => (Number(i.paidAmount) || 0) < (Number(i.total) || 0)).length,
    vadesiGecmis: invoices.filter(i =>
      i.dueDate && i.dueDate < today && (Number(i.paidAmount) || 0) < (Number(i.total) || 0)
    ).length,
    toplamOdenmemisTutar: invoices.reduce((s, i) =>
      s + Math.max(0, (Number(i.total) || 0) - (Number(i.paidAmount) || 0)), 0
    ),
  };
  const recentInvoices = invoices.slice(-5).map(i => ({
    no: i.invoiceNo,
    taraf: (i.counterparty || "").slice(0, 30),
    tip: i.type === "in" ? "Gelen" : "Giden",
    tutar: i.total,
    vade: i.dueDate,
    odeme: i.paidAmount,
  }));

  // Krediler
  const loans = (data.loans || []).map(l => ({
    ad: l.name, banka: l.bankName, anaPara: l.principal,
    kalan: l.remainingPrincipal, parabirim: l.currency, durum: l.status,
  }));

  // HR özeti
  const employees = data.hrEmployees || [];
  const hrSummary = {
    organizasyonBirimi: (data.hrOrgUnits || []).length,
    departman: (data.hrDepartments || []).length,
    pozisyonTanimi: (data.hrJobTitles || []).length,
    toplamCalisan: employees.length,
    aktifCalisan: employees.filter(e => e.status === "active").length,
    denemeSurecinde: employees.filter(e => e.status === "probation").length,
    acikPozisyon: (data.hrPositions || []).filter(p => p.status === "open").length,
    aktifAday: (data.hrApplications || []).filter(a =>
      !["hired","rejected","withdrawn"].includes(a.stage)
    ).length,
    departmanListesi: (data.hrDepartments || []).map(d => d.name),
  };

  // Kullanıcılar (audit yetkisi varsa görünür)
  const userList = (session && (session.role === "admin" || session.role === "cfo"))
    ? (users || []).map(u => ({
        kullaniciAdi: u.username, adSoyad: u.fullName,
        rol: ROLES[u.role]?.label, aktif: u.active !== false,
      }))
    : [];

  // Audit log (son 20, çok kısa)
  const auditEntries = (audit || []).slice(0, 20).map(a => {
    let detailStr = "";
    if (a.detail) {
      if (typeof a.detail === "object") {
        detailStr = Object.entries(a.detail).slice(0, 3)
          .map(([k,v]) => `${k}:${String(v).slice(0,20)}`).join("|");
      } else {
        detailStr = String(a.detail).slice(0, 60);
      }
    }
    return { t: a.ts, u: a.user, a: a.action, d: detailStr };
  });

  return {
    bugun: today,
    aktifSirket: activeCompany ? {
      ad: activeCompany.name, vergiNo: activeCompany.taxNo,
      vergiDairesi: activeCompany.taxOffice,
    } : null,
    aktifKullanici: session ? {
      kullaniciAdi: session.username, adSoyad: session.fullName, rol: ROLES[session.role]?.label,
    } : null,
    gosterimParaBirimi: dc,
    aylikNakitAkis: monthlySummary,
    bankaHesaplari: bankAccounts,
    kasalar: kasaAccounts,
    faturaOzeti: invoiceStats,
    sonFaturalar: recentInvoices,
    krediler: loans,
    insanKaynaklari: hrSummary,
    sistemKullanicilari: userList,
    sonHareketler: auditEntries,
    kurlar: { USD: rates.USD, EUR: rates.EUR, GBP: rates.GBP },
  };
}

function AIAssistantWidget({ data, session, users, audit }) {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState(() => {
    return [{
      role: "assistant",
      content: `**${t("ai.assistant")}** — ${t("ai.welcome")}\n\n• ${t("ai.suggestions.cash")}\n• ${t("ai.suggestions.overdue")}\n• ${t("ai.suggestions.activity")}\n• ${t("ai.suggestions.employees")}`,
    }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // Yeni mesaj geldiğinde aşağı kaydır
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const context = buildAIContext(data, session, users, audit);
      let contextJson = JSON.stringify(context);

      // Hard cap: context çok büyükse zorla kes (artifact wrapper limiti için)
      const MAX_CONTEXT_CHARS = 40000;
      if (contextJson.length > MAX_CONTEXT_CHARS) {
        contextJson = contextJson.slice(0, MAX_CONTEXT_CHARS) + "...[veri kısaltıldı]";
        console.warn(`AI context truncated to ${MAX_CONTEXT_CHARS} chars`);
      }

      const activeLang = typeof window !== "undefined" ? window.__PROMETA_LANG__ : "tr";
      const langName = LANGUAGES[activeLang]?.nameNative || "Türkçe";
      const numberFormatHint = activeLang === "tr"
        ? "Türkçe format (1.234,56 ₺)"
        : activeLang === "de"
          ? "Deutsche format (1.234,56 €)"
          : activeLang === "ar"
            ? "تنسيق عربي (1,234.56)"
            : "English format (1,234.56)";
      const dateFormatHint = activeLang === "en" ? "DD/MM/YYYY" : "GG.AA.YYYY";

      const systemPrompt = `You are the AI assistant of Prometa One (integrated Finance & HR platform).

CRITICAL: Respond in ${langName} (${activeLang}). The user is interacting in ${langName}.

KURALLAR / RULES:
- Numbers: ${numberFormatHint}
- Missing data: respond accordingly in ${langName} ("Bu bilgi verilerde yok" in TR, "This info is not in the data" in EN, etc.)
- Don't guess, stick to data
- Date format: ${dateFormatHint}
- sonHareketler field: t=time, u=user, a=action, d=detail (last 20 actions)
- Keep responses concise (3-5 sentences), use lists if needed
- Markdown supported

COMPANY DATA:
${contextJson}`;

      // API messages: SADECE user ve assistant role'leri, üstelik user ile başlamalı
      // Başlangıç welcome mesajı assistant role'ünde — onu çıkar
      let apiMessages = next
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      // Anthropic API ilk mesajın user olmasını bekler
      // Başlangıçta assistant mesajları varsa hepsini at, user'a kadar gel
      while (apiMessages.length > 0 && apiMessages[0].role !== "user") {
        apiMessages.shift();
      }

      // Son mesaj user değilse boş yanıt verme
      if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== "user") {
        throw new Error("İletişim hatası: kullanıcı mesajı bulunamadı");
      }

      const requestBody = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: apiMessages,
      };

      console.log("AI request body size:", JSON.stringify(requestBody).length, "chars");

      let response, result;
      try {
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      } catch (fetchErr) {
        throw new Error(`Ağ hatası: ${fetchErr.message}`);
      }

      // Önce response'u text olarak oku
      const rawText = await response.text();
      console.log("AI raw response (ilk 500):", rawText.slice(0, 500));

      if (!response.ok) {
        let errJson;
        try { errJson = JSON.parse(rawText); } catch {}
        const errMsg = errJson?.error?.message || errJson?.message || rawText.slice(0, 500);
        throw new Error(`API ${response.status}: ${errMsg}`);
      }

      try {
        result = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`JSON parse edilemedi. Yanıt: ${rawText.slice(0, 300)}`);
      }

      if (result?.type === "error" || result?.error) {
        throw new Error(`API hata: ${result.error?.message || result?.message || "bilinmiyor"}`);
      }

      if (!Array.isArray(result.content)) {
        console.error("Beklenmeyen API yanıtı:", result);
        throw new Error(`Yanıt biçimi geçersiz: ${JSON.stringify(result).slice(0, 300)}`);
      }

      const reply = result.content
        .filter(b => b && b.type === "text" && typeof b.text === "string")
        .map(b => b.text)
        .join("\n");

      if (!reply.trim()) {
        throw new Error("API boş yanıt verdi");
      }

      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e.message);
      setMessages([...next, {
        role: "assistant",
        content: `❌ Hata: ${e.message}\n\nLütfen tekrar deneyin veya soruyu farklı şekilde sorun.`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (!confirm("Sohbet geçmişi silinsin mi?")) return;
    setMessages([{
      role: "assistant",
      content: "Sohbet temizlendi. Yeni sorunuzu sorabilirsiniz.",
    }]);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Önerilen sorular
  const suggestions = [
    "Bu ay toplam nakit girişim ne kadar?",
    "Vadesi geçmiş faturalarım var mı?",
    "Bugün hangi işlemler yapıldı?",
    "Aktif çalışan sayım kaç?",
  ];

  if (!session) return null;

  const panelStyle = maximized
    ? { width: "min(900px, 90vw)", height: "min(700px, 90vh)" }
    : { width: 400, height: 600 };

  return (
    <>
      {/* Floating button (kapalıyken) */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all"
          style={{
            background: "linear-gradient(135deg, var(--accent) 0%, #064e3b 100%)",
            color: "#fff",
          }}>
          <Sparkles size={16}/>
          <span className="text-sm font-medium">Prometa AI</span>
        </button>
      )}

      {/* Açık panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col rounded-lg overflow-hidden"
          style={{
            ...panelStyle,
            background: "var(--paper)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
            border: "1px solid var(--line)",
            maxHeight: "calc(100vh - 48px)",
          }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: "linear-gradient(135deg, var(--accent) 0%, #064e3b 100%)", color: "#fff" }}>
            <div className="flex items-center gap-2">
              <Sparkles size={16}/>
              <div>
                <div className="font-semibold text-sm">Prometa AI Asistan</div>
                <div className="text-xs opacity-80">{t("app.tagline")}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearChat} title="Sohbeti temizle"
                className="p-1 hover:bg-white/10 rounded">
                <Trash size={13}/>
              </button>
              <button onClick={() => setMaximized(!maximized)} title={maximized ? "Küçült" : "Büyüt"}
                className="p-1 hover:bg-white/10 rounded">
                {maximized ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}
              </button>
              <button onClick={() => setOpen(false)} title="Kapat"
                className="p-1 hover:bg-white/10 rounded">
                <X size={14}/>
              </button>
            </div>
          </div>

          {/* Mesajlar */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3"
            style={{ background: "var(--bg)" }}>
            {messages.map((m, i) => (
              <AIMessage key={i} message={m}/>
            ))}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  <Bot size={13}/>
                </div>
                <div className="card px-3 py-2 text-xs italic" style={{ color: "var(--ink-mute)" }}>
                  <span className="inline-block animate-pulse">{t("ai.thinking")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Önerilen sorular (sadece ilk mesaj durumunda) */}
          {messages.length === 1 && !loading && (
            <div className="px-3 py-2 border-t flex flex-wrap gap-1.5" style={{ borderColor: "var(--line)" }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setInput(s)}
                  className="text-xs px-2 py-1 rounded hover:bg-stone-100"
                  style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t flex items-end gap-2" style={{ borderColor: "var(--line)" }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={t("ai.placeholder")}
              disabled={loading}
              rows={1}
              className="flex-1 input resize-none text-sm"
              style={{ maxHeight: 100 }}
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              className="btn btn-primary px-3"
              style={{ opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
              <Send size={13}/>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Tek mesaj görüntüleyici ---------- */
function AIMessage({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: isUser ? "var(--ink-soft)" : "var(--accent)",
          color: "#fff",
        }}>
        {isUser ? <Users size={13}/> : <Bot size={13}/>}
      </div>
      <div className={`card px-3 py-2 text-sm max-w-[85%] ${isUser ? "text-right" : ""}`}
        style={{
          background: isUser ? "var(--accent)" : "var(--paper)",
          color: isUser ? "#fff" : "var(--ink)",
          borderRadius: 10,
        }}>
        <FormattedAIText text={message.content}/>
      </div>
    </div>
  );
}

/* ---------- Basit markdown formatlaması (kalın, liste, paragraf) ---------- */
function FormattedAIText({ text }) {
  // Markdown'u basit HTML'e dönüştür
  const lines = (text || "").split("\n");
  const out = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      out.push(
        <ul key={`list-${out.length}`} className="list-disc list-inside space-y-0.5 my-1 text-sm">
          {listItems.map((li, i) => <li key={i}>{renderInline(li)}</li>)}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, idx) => {
    if (/^\s*[-•]\s+/.test(line)) {
      inList = true;
      listItems.push(line.replace(/^\s*[-•]\s+/, ""));
    } else {
      flushList();
      if (line.trim() === "") {
        out.push(<div key={`br-${idx}`} className="h-1"/>);
      } else {
        out.push(<div key={idx} className="text-sm leading-snug">{renderInline(line)}</div>);
      }
    }
  });
  flushList();

  return <div className="space-y-0.5">{out}</div>;
}

// Inline formatlaması: **bold**, `code`
function renderInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    if (boldMatch && (!codeMatch || boldMatch.index <= codeMatch.index)) {
      if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else if (codeMatch) {
      if (codeMatch.index > 0) parts.push(remaining.slice(0, codeMatch.index));
      parts.push(<code key={key++} className="px-1 rounded text-xs mono"
        style={{ background: "rgba(0,0,0,0.08)" }}>{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }
  return parts;
}

/* =====================================================================
   /AI ASİSTAN
===================================================================== */

/* =====================================================================
   ACCESS CONTROL — ROLES, GRANTS, OVERRIDES
   ---------------------------------------------------------------------
   Kullanıcılar sekmesinin altında alt-sekmeler:
     • Kullanıcılar (mevcut)
     • Custom Roller
     • Yetki Atamaları (Grants)
     • İstisnalar (Overrides)
===================================================================== */
function AccessControlView({ data, session, users, setUsers, onChange, logAudit, notify }) {
  const [subTab, setSubTab] = useState("users");
  const [showMyPerms, setShowMyPerms] = useState(false);

  const customRoles = data.hrCustomRoles || [];
  const grants      = data.hrRoleGrants  || [];
  const overrides   = data.hrPermOverrides || [];

  // Aktif kullanıcının yetki kapsamı
  const myScope = useMemo(() => resolveUserScope(session.username, data, users), [session, data, users]);
  const myGrants = useMemo(() =>
    grants.filter(g => grantAppliesToUser(g, session, myScope, {
      orgUnits: data.hrOrgUnits || [],
      departments: data.hrDepartments || [],
    }))
  , [grants, session, myScope, data]);
  const myRoles = useMemo(() =>
    myGrants.map(g => customRoles.find(r => r.id === g.roleId)).filter(Boolean)
  , [myGrants, customRoles]);
  const myEffectivePerms = useMemo(() => {
    const set = new Set();
    myRoles.forEach(r => (r.permissions || []).forEach(p => set.add(p)));
    overrides
      .filter(o => o.userId === session.username && o.allow && (!o.expiresAt || new Date(o.expiresAt) >= new Date()))
      .forEach(o => set.add(`${o.resource}.${o.action}`));
    overrides
      .filter(o => o.userId === session.username && !o.allow && (!o.expiresAt || new Date(o.expiresAt) >= new Date()))
      .forEach(o => set.delete(`${o.resource}.${o.action}`));
    return set;
  }, [myRoles, overrides, session]);

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-1">Erişim Yönetimi</div>
        <h1 className="display text-2xl md:text-3xl">Kullanıcılar &amp; Yetkiler</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
          Sistem kullanıcıları, custom roller ve hiyerarşik yetki atamaları
        </p>
      </div>

      {/* Kendi yetkilerimi göster */}
      <div className="card p-3" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Shield size={13} style={{ color: "var(--accent)" }}/>
            <span className="text-sm font-semibold">Benim Yetkilerim:</span>
            <span className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: ROLES[session.role].color + "22", color: ROLES[session.role].color }}>
              {ROLES[session.role].label} (sistem rolü)
            </span>
            {myRoles.map(r => (
              <span key={r.id} className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: r.color + "22", color: r.color }}>
                + {r.name}
              </span>
            ))}
            {myScope && (
              <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
                · Kapsam: {(data.hrDepartments || []).find(d => d.id === myScope.departmentId)?.name || "—"}
              </span>
            )}
          </div>
          <button onClick={() => setShowMyPerms(!showMyPerms)} className="btn btn-ghost text-xs">
            {showMyPerms ? "Gizle" : "Detayları Göster"} ({myEffectivePerms.size} izin)
          </button>
        </div>
        {showMyPerms && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--line-soft)" }}>
            {myEffectivePerms.size === 0 ? (
              <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                Sistem rolünüz dışında özel bir yetkiniz yok
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                {[...myEffectivePerms].sort().map(p => {
                  const [res, act] = p.split(/\.(?=[^.]+$)/);
                  const r = RESOURCES[res];
                  return (
                    <div key={p} className="text-xs flex items-center gap-1.5 p-1.5 rounded"
                      style={{ background: "var(--paper)" }}>
                      <span style={{ color: ACTIONS[act]?.color }}>● </span>
                      <span style={{ color: "var(--ink-soft)" }}>{r?.module}</span>
                      <span>›</span>
                      <span className="font-medium">{r?.label || res}</span>
                      <span className="ml-auto" style={{ color: ACTIONS[act]?.color }}>
                        {ACTIONS[act]?.label || act}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <SubTabButton active={subTab === "users"} onClick={() => setSubTab("users")}
          icon={Users} label="Kullanıcılar" badge={users.length || null}/>
        <SubTabButton active={subTab === "roles"} onClick={() => setSubTab("roles")}
          icon={Shield} label="Roller" badge={customRoles.length || null} badgeColor="#7c3aed"/>
        <SubTabButton active={subTab === "grants"} onClick={() => setSubTab("grants")}
          icon={UserCheck} label="Yetki Atamaları" badge={grants.length || null} badgeColor="#0ea5e9"/>
        <SubTabButton active={subTab === "overrides"} onClick={() => setSubTab("overrides")}
          icon={UserX} label="İstisnalar" badge={overrides.length || null} badgeColor="#ea580c"/>
      </div>

      {subTab === "users" && (
        <UsersManager users={users} setUsers={setUsers}
          employees={data.hrEmployees || []}
          logAudit={logAudit} notify={notify}/>
      )}
      {subTab === "roles" && (
        <CustomRolesManager data={data} onChange={onChange}
          logAudit={logAudit} notify={notify} session={session}/>
      )}
      {subTab === "grants" && (
        <RoleGrantsManager data={data} users={users} onChange={onChange}
          logAudit={logAudit} notify={notify} session={session}/>
      )}
      {subTab === "overrides" && (
        <PermOverridesManager data={data} users={users} onChange={onChange}
          logAudit={logAudit} notify={notify} session={session}/>
      )}
    </div>
  );
}

/* ---------- CUSTOM ROLLER YÖNETİMİ ---------- */
function CustomRolesManager({ data, onChange, logAudit, notify, session }) {
  const [editing, setEditing] = useState(null);  // null | {} (new) | role
  const customRoles = data.hrCustomRoles || [];

  const saveRole = async (draft) => {
    if (!draft.name?.trim()) { alert("Rol adı zorunlu"); return; }
    const isEdit = !!draft.id;
    const role = isEdit ? draft : {
      id: "role_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      permissions: draft.permissions || [],
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    role.name = draft.name.trim();
    role.description = (draft.description || "").trim();
    role.color = draft.color || "#7c3aed";
    role.permissions = draft.permissions || [];

    const next = isEdit
      ? customRoles.map(r => r.id === role.id ? role : r)
      : [...customRoles, role];
    await onChange({ ...data, hrCustomRoles: next });
    await logAudit(isEdit ? "role_edit" : "role_create", { rol: role.name, izinSayisi: role.permissions.length });
    notify(isEdit ? "Rol güncellendi" : "Rol oluşturuldu");
    setEditing(null);
  };

  const deleteRole = async (role) => {
    const grantsUsingThis = (data.hrRoleGrants || []).filter(g => g.roleId === role.id);
    if (grantsUsingThis.length > 0) {
      alert(`"${role.name}" silinemiyor: ${grantsUsingThis.length} atamada kullanılıyor`);
      return;
    }
    if (!confirm(`"${role.name}" rolünü silmek istediğinizden emin misiniz?`)) return;
    await onChange({ ...data, hrCustomRoles: customRoles.filter(r => r.id !== role.id) });
    await logAudit("role_delete", { rol: role.name });
    notify("Rol silindi");
  };

  return (
    <div className="space-y-3">
      {/* Sistem rolleri (read-only) */}
      <div className="card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={13} style={{ color: "var(--ink-mute)" }}/>
          <span className="text-sm font-semibold">Sistem Rolleri</span>
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>(düzenlenemez)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(ROLES).map(([key, role]) => (
            <div key={key} className="p-2 rounded text-xs" style={{ background: "var(--bg)", borderLeft: `3px solid ${role.color}` }}>
              <div className="font-medium" style={{ color: role.color }}>{role.label}</div>
              <div style={{ color: "var(--ink-mute)" }}>Seviye {role.level}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
          {customRoles.length} özel rol tanımlı
        </span>
        <button onClick={() => setEditing({ permissions: [], color: "#7c3aed" })} className="btn btn-primary">
          <Plus size={13}/> Yeni Rol
        </button>
      </div>

      {/* Custom roller listesi */}
      {customRoles.length === 0 ? (
        <div className="text-center py-12 card">
          <Shield size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">Özel Rol Tanımlanmamış</div>
          <div className="text-xs mb-4" style={{ color: "var(--ink-mute)" }}>
            Sistem rollerinin dışında özel bir rol oluşturarak modül/ekran bazında izin verebilirsiniz
          </div>
          <button onClick={() => setEditing({ permissions: [], color: "#7c3aed" })}
            className="btn btn-primary inline-flex items-center">
            <Plus size={13}/> İlk Rolü Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {customRoles.map(role => (
            <RoleCard key={role.id} role={role}
              onEdit={() => setEditing(role)}
              onDelete={() => deleteRole(role)}/>
          ))}
        </div>
      )}

      {editing && (
        <RoleFormModal draft={editing} setDraft={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => saveRole(editing)}/>
      )}
    </div>
  );
}

function RoleCard({ role, onEdit, onDelete }) {
  // Modül bazında izin sayıları
  const byModule = {};
  (role.permissions || []).forEach(p => {
    const [resource] = p.split(/\.(?=[^.]+$)/);  // son . dan ayır
    const mod = RESOURCES[resource]?.module || "Diğer";
    byModule[mod] = (byModule[mod] || 0) + 1;
  });

  return (
    <div className="card p-3" style={{ borderLeft: `4px solid ${role.color || "#7c3aed"}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Shield size={13} style={{ color: role.color }}/>
            {role.name}
          </div>
          {role.description && (
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              {role.description}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 rounded hover:bg-stone-100">
            <Edit3 size={10}/>
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50">
            <Trash2 size={10} style={{ color: "var(--negative)" }}/>
          </button>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--line-soft)" }}>
        <span className="text-xs font-medium">{role.permissions?.length || 0} izin:</span>
        {Object.entries(byModule).map(([mod, count]) => (
          <span key={mod} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg)" }}>
            {mod}: <b>{count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Rol Form Modalı (Permission Matrix) ---------- */
function RoleFormModal({ draft, setDraft, onClose, onSave }) {
  // Resource'ları modüle göre grupla
  const byModule = useMemo(() => {
    const groups = {};
    Object.entries(RESOURCES).forEach(([key, res]) => {
      if (!groups[res.module]) groups[res.module] = [];
      groups[res.module].push({ key, ...res });
    });
    return groups;
  }, []);

  const permissions = new Set(draft.permissions || []);

  const togglePerm = (resourceKey, action) => {
    const k = `${resourceKey}.${action}`;
    const next = new Set(permissions);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setDraft({ ...draft, permissions: [...next] });
  };

  const toggleAllActions = (resourceKey, actions) => {
    const next = new Set(permissions);
    const allSelected = actions.every(a => next.has(`${resourceKey}.${a}`));
    actions.forEach(a => {
      if (allSelected) next.delete(`${resourceKey}.${a}`);
      else next.add(`${resourceKey}.${a}`);
    });
    setDraft({ ...draft, permissions: [...next] });
  };

  const toggleAllInModule = (moduleName, resources) => {
    const next = new Set(permissions);
    const allKeys = resources.flatMap(r => r.actions.map(a => `${r.key}.${a}`));
    const allSelected = allKeys.every(k => next.has(k));
    allKeys.forEach(k => {
      if (allSelected) next.delete(k);
      else next.add(k);
    });
    setDraft({ ...draft, permissions: [...next] });
  };

  const colorPalette = ["#7c3aed", "#0ea5e9", "#15803d", "#dc2626", "#f59e0b", "#0f766e", "#ec4899", "#475569"];

  return (
    <Modal title={draft.id ? "Rol Düzenle" : "Yeni Rol"} icon={Shield}
      onClose={onClose} onSave={onSave} maxWidth="max-w-4xl">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <div className="label mb-1">Rol Adı *</div>
            <input className="input w-full" autoFocus
              value={draft.name || ""} placeholder="İK Müdürü"
              onChange={e => setDraft({ ...draft, name: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Renk</div>
            <div className="flex items-center gap-1 flex-wrap">
              {colorPalette.map(c => (
                <button key={c} type="button" onClick={() => setDraft({ ...draft, color: c })}
                  className="w-6 h-6 rounded-full"
                  style={{
                    background: c,
                    border: draft.color === c ? "2px solid #000" : "2px solid transparent",
                  }}/>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="label mb-1">Açıklama</div>
          <input className="input w-full"
            value={draft.description || ""} placeholder="Bu rolün ne yapabileceğine dair kısa açıklama"
            onChange={e => setDraft({ ...draft, description: e.target.value })}/>
        </div>

        {/* Permission Matrix */}
        <div className="card p-3" style={{ background: "var(--bg)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">İzin Matrisi</div>
            <span className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {permissions.size} izin seçili
            </span>
          </div>
          <div className="text-xs mb-3" style={{ color: "var(--ink-mute)" }}>
            Her satır bir modül/ekran, her sütun bir aksiyon. Tek tek tıklayın veya hızlı seçim için modül/satır başlığını kullanın.
          </div>

          {Object.entries(byModule).map(([modName, resources]) => {
            const allKeys = resources.flatMap(r => r.actions.map(a => `${r.key}.${a}`));
            const allSelected = allKeys.every(k => permissions.has(k));
            const someSelected = allKeys.some(k => permissions.has(k));
            return (
              <div key={modName} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <button type="button" onClick={() => toggleAllInModule(modName, resources)}
                    className="text-xs font-bold flex items-center gap-1.5 hover:underline">
                    <div className="w-3 h-3 rounded border flex items-center justify-center"
                      style={{
                        background: allSelected ? "var(--accent)" : someSelected ? "var(--accent)" + "55" : "transparent",
                        borderColor: someSelected || allSelected ? "var(--accent)" : "var(--line)",
                      }}>
                      {allSelected && <Check size={8} style={{ color: "#fff" }}/>}
                    </div>
                    {modName} ({allKeys.filter(k => permissions.has(k)).length}/{allKeys.length})
                  </button>
                </div>
                <div className="overflow-x-auto rounded" style={{ background: "var(--paper)" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--bg-alt)" }}>
                        <th className="text-left px-2 py-1.5 font-medium" style={{ color: "var(--ink-mute)" }}>Ekran</th>
                        {Object.entries(ACTIONS).map(([a, act]) => (
                          <th key={a} className="text-center px-2 py-1.5 font-medium" style={{ width: 70, color: act.color }}>
                            {act.label}
                          </th>
                        ))}
                        <th className="px-2 py-1.5" style={{ width: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map(res => {
                        const rowAllSelected = res.actions.every(a => permissions.has(`${res.key}.${a}`));
                        return (
                          <tr key={res.key} className="border-t" style={{ borderColor: "var(--line-soft)" }}>
                            <td className="px-2 py-1.5">{res.label}</td>
                            {Object.keys(ACTIONS).map(a => {
                              const supported = res.actions.includes(a);
                              const checked = permissions.has(`${res.key}.${a}`);
                              return (
                                <td key={a} className="text-center px-2 py-1.5">
                                  {supported ? (
                                    <button type="button" onClick={() => togglePerm(res.key, a)}
                                      className="w-4 h-4 rounded border flex items-center justify-center mx-auto"
                                      style={{
                                        background: checked ? ACTIONS[a].color : "transparent",
                                        borderColor: checked ? ACTIONS[a].color : "var(--line)",
                                      }}>
                                      {checked && <Check size={9} style={{ color: "#fff" }}/>}
                                    </button>
                                  ) : (
                                    <span style={{ color: "var(--line)" }}>—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-center px-2 py-1.5">
                              <button type="button" onClick={() => toggleAllActions(res.key, res.actions)}
                                className="text-xs px-1.5 py-0.5 rounded hover:bg-stone-100"
                                style={{ color: "var(--accent)" }}>
                                {rowAllSelected ? "Boşalt" : "Hepsi"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- ROLE GRANTS YÖNETİMİ ---------- */
function RoleGrantsManager({ data, users, onChange, logAudit, notify, session }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ subjectType: "", roleId: "" });

  const customRoles = data.hrCustomRoles || [];
  const grants      = data.hrRoleGrants  || [];
  const orgUnits    = data.hrOrgUnits    || [];
  const departments = data.hrDepartments || [];
  const jobTitles   = data.hrJobTitles   || [];
  const employees   = data.hrEmployees   || [];

  const filtered = useMemo(() => grants.filter(g => {
    if (filter.subjectType && g.subjectType !== filter.subjectType) return false;
    if (filter.roleId && g.roleId !== filter.roleId) return false;
    return true;
  }), [grants, filter]);

  const saveGrant = async (draft) => {
    if (!draft.roleId) { alert("Rol seçimi zorunlu"); return; }
    if (!draft.subjectType || !draft.subjectId) { alert("Atanan kişi/birim seçimi zorunlu"); return; }
    const isEdit = !!draft.id;
    const grant = isEdit ? draft : {
      id: "grant_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    const next = isEdit
      ? grants.map(g => g.id === grant.id ? grant : g)
      : [...grants, grant];
    await onChange({ ...data, hrRoleGrants: next });
    const role = customRoles.find(r => r.id === grant.roleId);
    await logAudit(isEdit ? "grant_edit" : "grant_create", {
      rol: role?.name, subjectType: grant.subjectType, subjectId: grant.subjectId,
    });
    notify(isEdit ? "Atama güncellendi" : "Atama oluşturuldu");
    setEditing(null);
  };

  const deleteGrant = async (g) => {
    if (!confirm("Bu yetki atamasını silmek istediğinizden emin misiniz?")) return;
    await onChange({ ...data, hrRoleGrants: grants.filter(x => x.id !== g.id) });
    await logAudit("grant_delete", { id: g.id });
    notify("Atama silindi");
  };

  const getSubjectLabel = (g) => {
    switch (g.subjectType) {
      case "user": return users.find(u => u.username === g.subjectId)?.fullName || g.subjectId;
      case "employee":
        const e = employees.find(x => x.id === g.subjectId);
        return e ? `${e.firstName} ${e.lastName}` : g.subjectId;
      case "job_title": return jobTitles.find(x => x.id === g.subjectId)?.title || g.subjectId;
      case "department": return departments.find(x => x.id === g.subjectId)?.name || g.subjectId;
      case "org_unit": return orgUnits.find(x => x.id === g.subjectId)?.name || g.subjectId;
      default: return "?";
    }
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 text-xs" style={{ background: "#dbeafe", color: "#1e40af" }}>
        💡 <b>Yetki Atamaları:</b> Bir custom rolü <b>kullanıcıya</b>, <b>pozisyona</b>, <b>departmana</b> veya <b>organizasyon birimine</b>
        atayabilirsiniz. Pozisyona atadığınızda o pozisyondaki tüm çalışanlar bu rolü kazanır.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select className="input text-xs" value={filter.subjectType}
          onChange={e => setFilter({ ...filter, subjectType: e.target.value })}>
          <option value="">Tüm Atama Türleri</option>
          {Object.entries(GRANT_SCOPE_TYPES).filter(([k]) => k !== "all").map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
          <option value="user">👤 Kullanıcı</option>
        </select>
        <select className="input text-xs" value={filter.roleId}
          onChange={e => setFilter({ ...filter, roleId: e.target.value })}>
          <option value="">Tüm Roller</option>
          {customRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>{filtered.length} atama</span>
        <button onClick={() => setEditing({ subjectType: "user", cascade: true })}
          className="btn btn-primary ml-auto">
          <Plus size={13}/> Yeni Atama
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 card">
          <UserCheck size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">Atama Yok</div>
          <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Önce Roller sekmesinden bir custom rol oluşturun, sonra burada atama yapabilirsiniz
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--bg-alt)" }}>
                <th className="text-left px-3 py-2">Atanan</th>
                <th className="text-left px-3 py-2">Tür</th>
                <th className="text-left px-3 py-2">Rol</th>
                <th className="text-left px-3 py-2">Geçerlilik</th>
                <th className="px-3 py-2" style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const role = customRoles.find(r => r.id === g.roleId);
                const scopeInfo = GRANT_SCOPE_TYPES[g.subjectType] || { icon: "?", label: g.subjectType };
                return (
                  <tr key={g.id} className="border-t" style={{ borderColor: "var(--line-soft)" }}>
                    <td className="px-3 py-2 font-medium">{getSubjectLabel(g)}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg)" }}>
                        {scopeInfo.icon} {scopeInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium" style={{ color: role?.color }}>
                        {role?.name || "?"}
                      </span>
                      <span className="text-xs ml-2" style={{ color: "var(--ink-mute)" }}>
                        ({role?.permissions?.length || 0} izin)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-mute)" }}>
                      {g.validUntil ? `→ ${g.validUntil}` : "Süresiz"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setEditing(g)} className="p-1 rounded hover:bg-stone-100">
                          <Edit3 size={10}/>
                        </button>
                        <button onClick={() => deleteGrant(g)} className="p-1 rounded hover:bg-red-50">
                          <Trash2 size={10} style={{ color: "var(--negative)" }}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <GrantFormModal draft={editing} setDraft={setEditing}
          users={users} customRoles={customRoles}
          orgUnits={orgUnits} departments={departments}
          jobTitles={jobTitles} employees={employees}
          onClose={() => setEditing(null)}
          onSave={() => saveGrant(editing)}/>
      )}
    </div>
  );
}

/* ---------- Grant Form Modalı ---------- */
function GrantFormModal({ draft, setDraft, users, customRoles, orgUnits, departments, jobTitles, employees, onClose, onSave }) {
  // Subject seçeneklerini subjectType'a göre çıkar
  const subjectOptions = useMemo(() => {
    switch (draft.subjectType) {
      case "user":       return users.map(u => ({ id: u.username, label: u.fullName + " (" + u.username + ")" }));
      case "employee":   return employees.map(e => ({ id: e.id, label: `${e.firstName} ${e.lastName}` }));
      case "job_title":  return jobTitles.map(j => ({ id: j.id, label: j.title }));
      case "department": return departments.map(d => ({ id: d.id, label: d.name }));
      case "org_unit":   return orgUnits.map(o => ({ id: o.id, label: o.name }));
      default: return [];
    }
  }, [draft.subjectType, users, employees, jobTitles, departments, orgUnits]);

  return (
    <Modal title={draft.id ? "Yetki Atamasını Düzenle" : "Yeni Yetki Ataması"}
      icon={UserCheck} onClose={onClose} onSave={onSave} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div>
          <div className="label mb-1">Kime Atanıyor *</div>
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(GRANT_SCOPE_TYPES).filter(([k]) => k !== "all").map(([k, v]) => (
              <button key={k} type="button" onClick={() => setDraft({ ...draft, subjectType: k, subjectId: null })}
                className="p-2 rounded border text-xs text-center"
                style={{
                  background: draft.subjectType === k ? "var(--accent)" : "var(--paper)",
                  color: draft.subjectType === k ? "#fff" : "var(--ink)",
                  borderColor: draft.subjectType === k ? "var(--accent)" : "var(--line)",
                }}>
                <div className="text-lg">{v.icon}</div>
                <div className="text-xs">{v.label}</div>
              </button>
            ))}
            <button type="button" onClick={() => setDraft({ ...draft, subjectType: "user", subjectId: null })}
              className="p-2 rounded border text-xs text-center"
              style={{
                background: draft.subjectType === "user" ? "var(--accent)" : "var(--paper)",
                color: draft.subjectType === "user" ? "#fff" : "var(--ink)",
                borderColor: draft.subjectType === "user" ? "var(--accent)" : "var(--line)",
              }}>
              <div className="text-lg">👤</div>
              <div className="text-xs">Kullanıcı</div>
            </button>
          </div>
        </div>

        {draft.subjectType && (
          <div>
            <div className="label mb-1">
              {GRANT_SCOPE_TYPES[draft.subjectType]?.label || "Kullanıcı"} Seç *
            </div>
            <select className="input w-full" value={draft.subjectId || ""}
              onChange={e => setDraft({ ...draft, subjectId: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {subjectOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <div className="label mb-1">Rol *</div>
          <select className="input w-full" value={draft.roleId || ""}
            onChange={e => setDraft({ ...draft, roleId: e.target.value })}>
            <option value="">— Rol seçiniz —</option>
            {customRoles.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.permissions?.length || 0} izin)
              </option>
            ))}
          </select>
          {customRoles.length === 0 && (
            <div className="text-xs mt-1" style={{ color: "var(--negative)" }}>
              ⚠️ Önce Roller sekmesinden custom rol oluşturmalısınız
            </div>
          )}
        </div>

        {(draft.subjectType === "org_unit" || draft.subjectType === "department") && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.cascade !== false}
              onChange={e => setDraft({ ...draft, cascade: e.target.checked })}/>
            <span>Alt birim/departmanları da kapsasın</span>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Başlangıç Tarihi</div>
            <input type="date" className="input w-full"
              value={draft.validFrom || ""}
              onChange={e => setDraft({ ...draft, validFrom: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Bitiş Tarihi (yetki devri için)</div>
            <input type="date" className="input w-full"
              value={draft.validUntil || ""}
              onChange={e => setDraft({ ...draft, validUntil: e.target.value })}/>
          </div>
        </div>

        <div>
          <div className="label mb-1">Açıklama / Not</div>
          <input className="input w-full"
            value={draft.note || ""}
            placeholder="ör: Annelik izninde yetki devri"
            onChange={e => setDraft({ ...draft, note: e.target.value })}/>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- PERMISSION OVERRIDES YÖNETİMİ ---------- */
function PermOverridesManager({ data, users, onChange, logAudit, notify, session }) {
  const [editing, setEditing] = useState(null);
  const overrides = data.hrPermOverrides || [];

  const saveOverride = async (draft) => {
    if (!draft.userId || !draft.resource || !draft.action) {
      alert("Kullanıcı, kaynak ve aksiyon zorunlu"); return;
    }
    const isEdit = !!draft.id;
    const o = isEdit ? draft : {
      id: "ovr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ...draft,
      createdAt: new Date().toISOString(),
      createdBy: session.username,
    };
    const next = isEdit
      ? overrides.map(x => x.id === o.id ? o : x)
      : [...overrides, o];
    await onChange({ ...data, hrPermOverrides: next });
    await logAudit(isEdit ? "override_edit" : "override_create", {
      kullanıcı: o.userId, izin: `${o.resource}.${o.action}`, izinVer: o.allow,
    });
    notify(isEdit ? "İstisna güncellendi" : "İstisna oluşturuldu");
    setEditing(null);
  };

  const deleteOverride = async (o) => {
    if (!confirm("Bu istisnayı silmek istediğinizden emin misiniz?")) return;
    await onChange({ ...data, hrPermOverrides: overrides.filter(x => x.id !== o.id) });
    await logAudit("override_delete", { id: o.id });
    notify("İstisna silindi");
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 text-xs" style={{ background: "#fef3c7", color: "#854d0e" }}>
        ⚠️ <b>İstisnalar:</b> Belirli bir kullanıcı için <b>tek tek izin verme</b> veya
        <b> mevcut izinden alma</b> kuralları. Roller dışında özel durumlar için kullanılır.
        Deny (alma) her zaman önceliklidir.
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>{overrides.length} istisna tanımlı</span>
        <button onClick={() => setEditing({ allow: true })} className="btn btn-primary">
          <Plus size={13}/> Yeni İstisna
        </button>
      </div>

      {overrides.length === 0 ? (
        <div className="text-center py-12 card">
          <UserX size={32} className="mx-auto mb-3" style={{ color: "var(--ink-mute)" }}/>
          <div className="font-semibold mb-1">İstisna Yok</div>
          <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Sadece özel durumlar için kullanın — ana yetkilendirme roller üzerinden yapılmalı
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--bg-alt)" }}>
                <th className="text-left px-3 py-2">Kullanıcı</th>
                <th className="text-left px-3 py-2">Kaynak</th>
                <th className="text-left px-3 py-2">Aksiyon</th>
                <th className="text-left px-3 py-2">Tür</th>
                <th className="text-left px-3 py-2">Bitiş</th>
                <th className="px-3 py-2" style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {overrides.map(o => {
                const user = users.find(u => u.username === o.userId);
                const res = RESOURCES[o.resource];
                return (
                  <tr key={o.id} className="border-t" style={{ borderColor: "var(--line-soft)" }}>
                    <td className="px-3 py-2 font-medium">{user?.fullName || o.userId}</td>
                    <td className="px-3 py-2">{res?.label || o.resource}</td>
                    <td className="px-3 py-2">
                      <span style={{ color: ACTIONS[o.action]?.color }}>
                        {ACTIONS[o.action]?.label || o.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {o.allow ? (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: "#d1fae5", color: "#065f46" }}>
                          ✓ İzin Ver
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: "#fee2e2", color: "#991b1b" }}>
                          ✗ İzin Alma
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-mute)" }}>
                      {o.expiresAt || "Süresiz"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setEditing(o)} className="p-1 rounded hover:bg-stone-100">
                          <Edit3 size={10}/>
                        </button>
                        <button onClick={() => deleteOverride(o)} className="p-1 rounded hover:bg-red-50">
                          <Trash2 size={10} style={{ color: "var(--negative)" }}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <OverrideFormModal draft={editing} setDraft={setEditing}
          users={users}
          onClose={() => setEditing(null)}
          onSave={() => saveOverride(editing)}/>
      )}
    </div>
  );
}

function OverrideFormModal({ draft, setDraft, users, onClose, onSave }) {
  const selectedResource = RESOURCES[draft.resource];
  return (
    <Modal title={draft.id ? "İstisna Düzenle" : "Yeni İstisna"}
      icon={UserX} onClose={onClose} onSave={onSave} maxWidth="max-w-xl">
      <div className="space-y-3">
        <div>
          <div className="label mb-1">Kullanıcı *</div>
          <select className="input w-full" value={draft.userId || ""}
            onChange={e => setDraft({ ...draft, userId: e.target.value })}>
            <option value="">— Seçiniz —</option>
            {users.map(u => (
              <option key={u.username} value={u.username}>
                {u.fullName} ({u.username})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Kaynak (Ekran) *</div>
            <select className="input w-full" value={draft.resource || ""}
              onChange={e => setDraft({ ...draft, resource: e.target.value, action: null })}>
              <option value="">— Seçiniz —</option>
              {Object.entries(RESOURCES).map(([k, r]) => (
                <option key={k} value={k}>{r.module} · {r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">Aksiyon *</div>
            <select className="input w-full" value={draft.action || ""}
              onChange={e => setDraft({ ...draft, action: e.target.value })}
              disabled={!selectedResource}>
              <option value="">— Seçiniz —</option>
              {selectedResource && selectedResource.actions.map(a => (
                <option key={a} value={a}>{ACTIONS[a]?.label || a}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="label mb-2">İstisna Türü *</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDraft({ ...draft, allow: true })}
              className="p-3 rounded border text-sm text-center"
              style={{
                background: draft.allow === true ? "#d1fae5" : "var(--paper)",
                borderColor: draft.allow === true ? "#15803d" : "var(--line)",
              }}>
              <div className="text-2xl">✓</div>
              <div className="font-medium">Ekstra İzin Ver</div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Rolünde olmayan bir yetkiyi kullanıcıya tanı
              </div>
            </button>
            <button type="button" onClick={() => setDraft({ ...draft, allow: false })}
              className="p-3 rounded border text-sm text-center"
              style={{
                background: draft.allow === false ? "#fee2e2" : "var(--paper)",
                borderColor: draft.allow === false ? "#dc2626" : "var(--line)",
              }}>
              <div className="text-2xl">✗</div>
              <div className="font-medium">İzni Kısıtla</div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Rolünde olan bir yetkiyi bu kullanıcıdan al
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Bitiş Tarihi (opsiyonel)</div>
            <input type="date" className="input w-full"
              value={draft.expiresAt || ""}
              onChange={e => setDraft({ ...draft, expiresAt: e.target.value })}/>
          </div>
          <div>
            <div className="label mb-1">Sebep</div>
            <input className="input w-full"
              value={draft.reason || ""}
              placeholder="ör: Proje görevlendirmesi"
              onChange={e => setDraft({ ...draft, reason: e.target.value })}/>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* =====================================================================
   /ACCESS CONTROL
===================================================================== */

/* ===================================================================== */
function UsersManager({ users, setUsers, employees = [], logAudit, notify }) {
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ username: "", password: "", fullName: "", role: "viewer", active: true });

  const persist = async (next) => {
    setUsers(next);
    await S.set("promet:users", next);
  };

  const saveNew = async () => {
    if (!draft.username || !draft.password || !draft.fullName) return notify("Tüm alanlar zorunlu", "err");
    if (users.find(u => u.username === draft.username)) return notify("Bu kullanıcı adı zaten var", "err");
    const newUser = { ...draft, id: "u_" + Date.now() };
    await persist([...users, newUser]);
    await logAudit("user_add", { kullanıcı: draft.username, rol: draft.role });
    notify("Kullanıcı eklendi");
    setShowAdd(false);
    setDraft({ username: "", password: "", fullName: "", role: "viewer", active: true });
  };

  const saveEdit = async (u) => {
    await persist(users.map(x => x.id === u.id ? u : x));
    await logAudit("user_edit", { kullanıcı: u.username });
    notify("Kullanıcı güncellendi");
    setEditing(null);
  };

  const toggleActive = async (u) => {
    await persist(users.map(x => x.id === u.id ? { ...x, active: !x.active } : x));
    await logAudit("user_toggle", { kullanıcı: u.username, aktif: !u.active });
    notify(u.active ? "Kullanıcı pasifleştirildi" : "Kullanıcı aktifleştirildi");
  };

  const remove = async (u) => {
    if (u.role === "admin" && users.filter(x => x.role === "admin").length === 1)
      return notify("Son yönetici silinemez", "err");
    if (!confirm(`"${u.fullName}" kullanıcısını silmek istediğinizden emin misiniz?`)) return;
    await persist(users.filter(x => x.id !== u.id));
    await logAudit("user_delete", { kullanıcı: u.username });
    notify("Kullanıcı silindi");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
          {users.length} sistem kullanıcısı · Bir kullanıcıyı HR çalışanına bağlamak rol atamalarının hiyerarşik yetkilendirme için çalışmasını sağlar
        </span>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary">
          <Plus size={13}/> Yeni Kullanıcı
        </button>
      </div>

      <div className="card overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
        <table className="grid">
          <thead>
            <tr>
              <th className="label-cell">Ad Soyad</th>
              <th className="label-cell">Kullanıcı Adı</th>
              <th className="label-cell">Rol</th>
              <th className="label-cell">Bağlı Çalışan</th>
              <th className="label-cell">Durum</th>
              <th style={{ width: 120 }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => editing === u.id ? (
              <UserEditRow key={u.id} user={u} employees={employees} onSave={saveEdit} onCancel={() => setEditing(null)}/>
            ) : (
              <tr key={u.id}>
                <td className="label-cell font-medium">{u.fullName}</td>
                <td className="label-cell mono text-xs">{u.username}</td>
                <td className="label-cell">
                  <span className="chip" style={{ background: ROLES[u.role].color + "15", color: ROLES[u.role].color }}>
                    <Shield size={9}/> {ROLES[u.role].label}
                  </span>
                </td>
                <td className="label-cell text-xs">
                  {(() => {
                    const emp = employees.find(e => e.id === u.linkedEmployeeId);
                    return emp ? (
                      <span style={{ color: "var(--ink)" }}>
                        <Users size={9} style={{ display: "inline" }}/> {emp.firstName} {emp.lastName}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-mute)" }}>—</span>
                    );
                  })()}
                </td>
                <td className="label-cell">
                  <button onClick={() => toggleActive(u)}
                    className="chip cursor-pointer"
                    style={{ background: u.active ? "#dcfce7" : "#fee2e2", color: u.active ? "#15803d" : "#b91c1c" }}>
                    {u.active ? "Aktif" : "Pasif"}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setEditing(u.id)} className="p-1.5 rounded hover:bg-stone-100" title="Düzenle">
                      <Edit3 size={12}/>
                    </button>
                    <button onClick={() => remove(u)} className="p-1.5 rounded hover:bg-red-50" title="Sil">
                      <Trash2 size={12} style={{ color: "var(--negative)" }}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {showAdd && (
              <UserEditRow user={draft} isNew employees={employees}
                onChange={setDraft}
                onSave={saveNew}
                onCancel={() => { setShowAdd(false); setDraft({ username: "", password: "", fullName: "", role: "viewer", active: true }); }}/>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserEditRow({ user, isNew, employees = [], onSave, onCancel, onChange }) {
  const [u, setU] = useState(user);
  const update = (k, v) => {
    const nu = { ...u, [k]: v };
    setU(nu);
    onChange?.(nu);
  };
  return (
    <tr style={{ background: "#fff8e1" }}>
      <td><input className="input" value={u.fullName} onChange={e => update("fullName", e.target.value)} placeholder="Ad Soyad"/></td>
      <td><input className="input mono" value={u.username} onChange={e => update("username", e.target.value)} placeholder="kullanici"/></td>
      <td>
        <select className="input" value={u.role} onChange={e => update("role", e.target.value)}>
          {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
      </td>
      <td>
        <select className="input text-xs" value={u.linkedEmployeeId || ""}
          onChange={e => update("linkedEmployeeId", e.target.value || null)}>
          <option value="">— Bağlı değil —</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
      </td>
      <td><input className="input" type={isNew ? "text" : "password"} value={u.password || ""}
        onChange={e => update("password", e.target.value)}
        placeholder={isNew ? "Parola" : "Yeni parola (boş bırakılabilir)"}/></td>
      <td>
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => onSave(u)} className="btn btn-primary"><Save size={12}/></button>
          <button onClick={onCancel} className="btn btn-ghost"><X size={12}/></button>
        </div>
      </td>
    </tr>
  );
}

/* ===================================================================== */
function AuditLog({ audit, companies = [] }) {
  const [filter, setFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");

  const list = audit.filter(a => {
    if (companyFilter !== "all" && a.companyId !== companyFilter) return false;
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (a.user + a.action + JSON.stringify(a.detail)).toLowerCase().includes(f);
  });

  const getCompany = (id) => companies.find(c => c.id === id);

  const actionLabels = {
    login: { label: "Giriş", color: "#0f766e" },
    logout: { label: "Çıkış", color: "#6b7280" },
    cell_edit: { label: "Hücre düzenleme", color: "#1d4ed8" },
    opening_cash_change: { label: "Açılış nakdi değişikliği", color: "#b45309" },
    category_add: { label: "Kategori eklendi", color: "#0f766e" },
    category_rename: { label: "Kategori yeniden adlandırıldı", color: "#1d4ed8" },
    category_delete: { label: "Kategori silindi", color: "#b91c1c" },
    user_add: { label: "Kullanıcı eklendi", color: "#0f766e" },
    user_edit: { label: "Kullanıcı düzenlendi", color: "#1d4ed8" },
    user_delete: { label: "Kullanıcı silindi", color: "#b91c1c" },
    user_toggle: { label: "Kullanıcı aktiflik", color: "#b45309" },
    excel_export: { label: "Excel dışa aktarım", color: "#0f766e" },
    excel_import: { label: "Excel içe aktarım", color: "#1d4ed8" },
    period_settings: { label: "Dönem ayarı", color: "#b45309" },
    data_reset: { label: "Veri sıfırlama", color: "#b91c1c" },
    bank_add: { label: "Banka eklendi", color: "#0f766e" },
    bank_delete: { label: "Banka silindi", color: "#b91c1c" },
    account_add: { label: "Hesap eklendi", color: "#0f766e" },
    account_edit: { label: "Hesap düzenlendi", color: "#1d4ed8" },
    account_delete: { label: "Hesap silindi", color: "#b91c1c" },
    kasa_add: { label: "Kasa oluşturuldu", color: "#0f766e" },
    kasa_delete: { label: "Kasa silindi", color: "#b91c1c" },
    kasa_entry_add: { label: "Kasa hareketi", color: "#1d4ed8" },
    kasa_entry_delete: { label: "Kasa hareketi silindi", color: "#b91c1c" },
    currency_rate_update: { label: "Döviz kuru güncellemesi", color: "#b45309" },
    tcmb_fetch: { label: "TCMB kur çekildi", color: "#0f766e" },
    tcmb_fetch_error: { label: "TCMB çekim hatası", color: "#b91c1c" },
    tcmb_config_update: { label: "TCMB ayarı", color: "#b45309" },
    tcmb_autofetch: { label: "TCMB otomatik çekim", color: "#1d4ed8" },
    transfer_add: { label: "Transfer eklendi", color: "#0f766e" },
    transfer_delete: { label: "Transfer silindi", color: "#b91c1c" },
    invoice_add: { label: "Fatura eklendi", color: "#0f766e" },
    invoice_edit: { label: "Fatura düzenlendi", color: "#1d4ed8" },
    invoice_delete: { label: "Fatura silindi", color: "#b91c1c" },
    invoice_payment: { label: "Fatura ödemesi", color: "#0f766e" },
    invoices_bulk_commit: { label: "Faturalar nakit akışa yansıtıldı", color: "#7c3aed" },
    company_add: { label: "Şirket eklendi", color: "#0f766e" },
    company_edit: { label: "Şirket düzenlendi", color: "#1d4ed8" },
    company_delete: { label: "Şirket silindi", color: "#b91c1c" },
    company_switch: { label: "Şirket değiştirildi", color: "#6b7280" },
    fx_revaluation: { label: "Kur değerleme", color: "#b45309" },
    fx_revaluation_delete: { label: "Değerleme silindi", color: "#b91c1c" },
    fx_revaluation_post: { label: "Kur farkı nakit akışa yansıtıldı", color: "#1d4ed8" },
    notification_send: { label: "Bildirim oluşturuldu", color: "#0f766e" },
    notification_settings: { label: "Bildirim ayarları değişti", color: "#1d4ed8" },
    year_archive: { label: "Mali yıl arşivlendi", color: "#7c3aed" },
    year_archive_delete: { label: "Arşiv silindi", color: "#b91c1c" },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">İz Kaydı</div>
          <h1 className="display text-2xl md:text-3xl">Denetim Geçmişi</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
            Tüm sistem aktiviteleri kronolojik sırayla
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {companies.length > 1 && (
            <select className="input text-xs" style={{ width: 180 }}
              value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
              <option value="all">Tüm Şirketler</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-mute)" }}/>
            <input className="input pl-7" placeholder="Filtrele..." style={{ width: 220 }}
              value={filter} onChange={e => setFilter(e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto" style={{ boxShadow: "var(--shadow)" }}>
        <table className="grid" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th className="label-cell" style={{ width: 140 }}>Tarih / Saat</th>
              {companies.length > 1 && <th className="label-cell" style={{ width: 130 }}>Şirket</th>}
              <th className="label-cell" style={{ width: 130 }}>Kullanıcı</th>
              <th className="label-cell" style={{ width: 180 }}>Eylem</th>
              <th className="label-cell">Detay</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={companies.length > 1 ? 5 : 4} className="label-cell text-center py-8" style={{ color: "var(--ink-mute)" }}>
                Kayıt bulunamadı
              </td></tr>
            )}
            {list.map(a => {
              const al = actionLabels[a.action] || { label: a.action, color: "#6b7280" };
              const co = getCompany(a.companyId);
              return (
                <tr key={a.id}>
                  <td className="label-cell mono text-xs" style={{ color: "var(--ink-mute)" }}>
                    {new Date(a.ts).toLocaleString("tr-TR")}
                  </td>
                  {companies.length > 1 && (
                    <td className="label-cell text-xs">
                      {co ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: co.color }}/>
                          <span className="truncate" style={{ maxWidth: 110 }}>{co.name}</span>
                        </div>
                      ) : <span style={{ color: "var(--ink-mute)" }}>—</span>}
                    </td>
                  )}
                  <td className="label-cell text-xs">
                    <div className="font-medium">{a.user}</div>
                    {a.role && <div style={{ color: "var(--ink-mute)" }}>{ROLES[a.role]?.label || a.role}</div>}
                  </td>
                  <td className="label-cell">
                    <span className="chip" style={{ background: al.color + "15", color: al.color }}>{al.label}</span>
                  </td>
                  <td className="label-cell text-xs mono" style={{ color: "var(--ink-soft)" }}>
                    {a.detail ? Object.entries(a.detail).map(([k, v]) => (
                      <span key={k} className="inline-block mr-3">
                        <span style={{ color: "var(--ink-mute)" }}>{k}:</span> {typeof v === "number" ? fmtTL(v) : String(v)}
                      </span>
                    )) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================================================================== */
function Reports({ data }) {
  const c = useMemo(() => computeCashflow(data), [data]);

  const flowData = c.monthLabels.map((m, i) => ({
    ay: m,
    Tahsilat: Math.round(c.inflowTotals[i]),
    Ödeme: Math.round(c.outflowTotals[i]),
    KZHarici: Math.round(c.nonPnlTotals[i]),
    AySonu: Math.round(c.endCash[i]),
  }));

  // Top categories
  const topInflows = data.inflows.map(cat => ({
    ad: cat.name,
    toplam: Array(12).fill(0).reduce((a, _, i) => a + Number((data.cells || {})[`${cat.id}:${i}`] || 0), 0),
  })).sort((a, b) => b.toplam - a.toplam).slice(0, 6);

  const topOutflows = data.outflows.map(cat => ({
    ad: cat.name,
    toplam: Array(12).fill(0).reduce((a, _, i) => a + Number((data.cells || {})[`${cat.id}:${i}`] || 0), 0),
  })).sort((a, b) => b.toplam - a.toplam).slice(0, 6);

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-1">Analiz</div>
        <h1 className="display text-2xl md:text-3xl">Raporlar</h1>
      </div>

      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h3 className="display text-xl mb-4">Aylık Nakit Pozisyonu</h3>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={flowData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#d9d3c7" vertical={false}/>
              <XAxis dataKey="ay" tick={{ fontSize: 11, fill: "#8a8580" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}
                tickFormatter={v => (v / 1000000).toFixed(1) + "M"}/>
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d9d3c7", borderRadius: 3, fontSize: 12 }}
                formatter={v => fmtTL(v) + " ₺"} />
              <ReferenceLine y={0} stroke="#b91c1c" strokeDasharray="3 3"/>
              <Legend wrapperStyle={{ fontSize: 11 }}/>
              <Line type="monotone" dataKey="AySonu" stroke="#0b3d2e" strokeWidth={2.5} dot={{ r: 4 }} name="Ay Sonu Nakit"/>
              <Line type="monotone" dataKey="Tahsilat" stroke="#0f766e" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Tahsilat"/>
              <Line type="monotone" dataKey="Ödeme" stroke="#b91c1c" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Ödeme"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <h3 className="display text-xl mb-4" style={{ color: "var(--positive)" }}>En Yüksek Tahsilat Kalemleri</h3>
          <div className="space-y-2">
            {topInflows.map((t, i) => (
              <RankBar key={i} rank={i + 1} label={t.ad} value={t.toplam}
                max={topInflows[0]?.toplam || 1} color="#0f766e"/>
            ))}
          </div>
        </div>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <h3 className="display text-xl mb-4" style={{ color: "var(--negative)" }}>En Yüksek Ödeme Kalemleri</h3>
          <div className="space-y-2">
            {topOutflows.map((t, i) => (
              <RankBar key={i} rank={i + 1} label={t.ad} value={t.toplam}
                max={topOutflows[0]?.toplam || 1} color="#b91c1c"/>
            ))}
          </div>
        </div>
      </div>

      <ScenarioComparison data={data}/>
    </div>
  );
}

/* =====================================================================
   SENARYO KARŞILAŞTIRMA — İyimser / Temel / Kötümser
===================================================================== */
function ScenarioComparison({ data }) {
  const [scenarios, setScenarios] = useState({
    optimistic:  { name: "İyimser",  inflowMult: 1.15, outflowMult: 0.90, color: "#0f766e" },
    base:        { name: "Temel",    inflowMult: 1.00, outflowMult: 1.00, color: "#1a1a1a" },
    pessimistic: { name: "Kötümser", inflowMult: 0.85, outflowMult: 1.15, color: "#b91c1c" },
  });
  const [editing, setEditing] = useState(false);

  const baseCompute = useMemo(() => computeCashflow(data), [data]);

  // Her senaryo için end-of-month cash hesapla
  const scenarioResults = useMemo(() => {
    const out = {};
    Object.entries(scenarios).forEach(([key, s]) => {
      const beginCash = Array(12).fill(0);
      const endCash = Array(12).fill(0);
      let running = Number(data.openingCash || 0);
      for (let i = 0; i < 12; i++) {
        beginCash[i] = running;
        const adjustedInflow  = baseCompute.inflowTotals[i]  * s.inflowMult;
        const adjustedOutflow = baseCompute.outflowTotals[i] * s.outflowMult;
        const net = adjustedInflow - adjustedOutflow - baseCompute.nonPnlTotals[i];
        running += net;
        endCash[i] = running;
      }
      out[key] = {
        ...s, beginCash, endCash,
        finalCash: endCash[11],
        minCash: Math.min(...endCash),
        maxCash: Math.max(...endCash),
        totalInflow: baseCompute.inflowTotals.reduce((a, b) => a + b, 0) * s.inflowMult,
        totalOutflow: baseCompute.outflowTotals.reduce((a, b) => a + b, 0) * s.outflowMult,
      };
    });
    return out;
  }, [scenarios, baseCompute, data.openingCash]);

  // Grafik verisi: her ayda 3 senaryo
  const chartData = baseCompute.monthLabels.map((m, i) => ({
    ay: m,
    İyimser:  Math.round(scenarioResults.optimistic.endCash[i]),
    Temel:    Math.round(scenarioResults.base.endCash[i]),
    Kötümser: Math.round(scenarioResults.pessimistic.endCash[i]),
  }));

  const finalDiff = {
    optimistic: scenarioResults.optimistic.finalCash - scenarioResults.base.finalCash,
    pessimistic: scenarioResults.pessimistic.finalCash - scenarioResults.base.finalCash,
  };

  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="display text-xl flex items-center gap-2">
            <Layers size={16} style={{ color: "var(--accent)" }}/>
            Senaryo Karşılaştırması
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            İyimser, temel ve kötümser senaryolarda nakit pozisyonunuzun seyri
          </p>
        </div>
        <button onClick={() => setEditing(!editing)} className="btn btn-ghost text-xs">
          <Settings size={12}/> {editing ? "Kapat" : "Çarpanları Düzenle"}
        </button>
      </div>

      {/* Çarpan editörü */}
      {editing && (
        <div className="card p-3 mb-4" style={{ background: "var(--bg)" }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(scenarios).map(([key, s]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }}/>
                  <span className="font-medium text-sm">{s.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs" style={{ color: "var(--ink-mute)" }}>Tahsilat ×</div>
                    <input className="input num text-right text-xs" type="number" step="0.05"
                      value={s.inflowMult}
                      onChange={e => setScenarios({ ...scenarios, [key]: { ...s, inflowMult: Number(e.target.value) || 0 } })}/>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: "var(--ink-mute)" }}>Ödeme ×</div>
                    <input className="input num text-right text-xs" type="number" step="0.05"
                      value={s.outflowMult}
                      onChange={e => setScenarios({ ...scenarios, [key]: { ...s, outflowMult: Number(e.target.value) || 0 } })}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--ink-mute)" }}>
            Çarpanlar tahsilat ve ödeme toplamlarına uygulanır. K/Z harici ödemeler değiştirilmez.
          </p>
        </div>
      )}

      {/* KPI kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {Object.entries(scenarioResults).map(([key, s]) => (
          <div key={key} className="p-4 rounded border-2"
            style={{ borderColor: s.color + "30", background: s.color + "05" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: s.color }}/>
                <span className="font-medium text-sm">{s.name}</span>
              </div>
              <div className="text-xs mono" style={{ color: "var(--ink-mute)" }}>
                ×{s.inflowMult.toFixed(2)} / ×{s.outflowMult.toFixed(2)}
              </div>
            </div>
            <div className="num display text-2xl" style={{ color: s.finalCash < 0 ? "var(--negative)" : s.color }}>
              {fmtTLSign(s.finalCash)} ₺
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>Yıl sonu nakit pozisyonu</div>
            {key !== "base" && (
              <div className="text-xs mt-2 pt-2 border-t" style={{ borderColor: s.color + "20", color: "var(--ink-soft)" }}>
                Temele göre fark: <strong style={{ color: s.color }}>
                  {fmtTLSign(key === "optimistic" ? finalDiff.optimistic : finalDiff.pessimistic)} ₺
                </strong>
              </div>
            )}
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Min: <span className={s.minCash < 0 ? "font-medium" : ""} style={{ color: s.minCash < 0 ? "var(--negative)" : "var(--ink-soft)" }}>{fmtTL(s.minCash)}</span>
              {" / "}Max: {fmtTL(s.maxCash)}
            </div>
          </div>
        ))}
      </div>

      {/* Çizgi grafik */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Ay Sonu Nakit Seyri</div>
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(scenarios).map(([key, s]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: s.color }}/>{s.name}
              </span>
            ))}
          </div>
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#d9d3c7" vertical={false}/>
              <XAxis dataKey="ay" tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}
                tickFormatter={v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "K")}/>
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d9d3c7", borderRadius: 3, fontSize: 11 }}
                formatter={(v) => fmtTLSign(v) + " ₺"}/>
              <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="2 2"/>
              <Line type="monotone" dataKey="İyimser"  stroke={scenarios.optimistic.color}  strokeWidth={2} dot={{ r: 3 }}/>
              <Line type="monotone" dataKey="Temel"    stroke={scenarios.base.color}        strokeWidth={2.5} dot={{ r: 3 }}/>
              <Line type="monotone" dataKey="Kötümser" stroke={scenarios.pessimistic.color} strokeWidth={2} dot={{ r: 3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ay bazında tablo */}
      <div className="overflow-x-auto">
        <table className="grid text-xs" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th className="label-cell" style={{ width: 120 }}>Senaryo / Ay</th>
              {baseCompute.monthLabels.map(m => (
                <th key={m} style={{ minWidth: 80 }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(scenarioResults).map(([key, s]) => (
              <tr key={key}>
                <td className="label-cell">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }}/>
                    <span className="font-medium">{s.name}</span>
                  </div>
                </td>
                {s.endCash.map((v, i) => (
                  <td key={i} className="num" style={{ color: v < 0 ? "var(--negative)" : (v === Math.min(...s.endCash) ? s.color : "var(--ink)") }}>
                    {fmtTL(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBar({ rank, label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="mono" style={{ color: "var(--ink-mute)" }}>#{rank}</span>
          <span className="font-medium">{label}</span>
        </div>
        <span className="num text-xs font-medium">{fmtTL(value)} ₺</span>
      </div>
      <div className="h-1.5 rounded-sm" style={{ background: "var(--bg-alt)" }}>
        <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, background: color }}/>
      </div>
    </div>
  );
}

/* ===================================================================== */
function SettingsView({ data, onChange, audit, users, notify, logAudit, session }) {
  const [openingDraft, setOpeningDraft] = useState(data.openingCash);
  const [yearDraft, setYearDraft] = useState(data.fiscalYear);
  const [startDraft, setStartDraft] = useState(data.fiscalStartMonth);
  const [usdDraft, setUsdDraft] = useState(data.exchangeRates?.USD || 0);
  const [eurDraft, setEurDraft] = useState(data.exchangeRates?.EUR || 0);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // TCMB state
  const tcmbConfig = data.tcmb || {};
  const [tcmbDraft, setTcmbDraft] = useState({
    apiKey: tcmbConfig.apiKey || "",
    corsProxy: tcmbConfig.corsProxy || "",
    rateType: tcmbConfig.rateType || "selling",
    autoFetchOnLogin: tcmbConfig.autoFetchOnLogin || false,
  });
  const [tcmbDate, setTcmbDate] = useState(new Date().toISOString().slice(0, 10));
  const [tcmbFetching, setTcmbFetching] = useState(false);
  const [tcmbShowKey, setTcmbShowKey] = useState(false);
  const [tcmbShowHistory, setTcmbShowHistory] = useState(false);

  const savePeriod = async () => {
    const next = {
      ...data,
      openingCash: Number(openingDraft) || 0,
      fiscalYear: Number(yearDraft) || data.fiscalYear,
      fiscalStartMonth: Number(startDraft),
    };
    await onChange(next);
    await logAudit("period_settings", { yıl: next.fiscalYear, başlangıç: TR_MONTHS[next.fiscalStartMonth] });
    notify("Dönem ayarları güncellendi");
  };

  const saveRates = async () => {
    const newRates = {
      USD: Number(usdDraft) || data.exchangeRates.USD,
      EUR: Number(eurDraft) || data.exchangeRates.EUR,
    };
    await onChange({ ...data, exchangeRates: newRates });
    await logAudit("currency_rate_update", { USD: newRates.USD, EUR: newRates.EUR, kaynak: "manuel" });
    notify("Döviz kurları güncellendi");
  };

  const saveTcmbConfig = async () => {
    const newTcmb = { ...tcmbConfig, ...tcmbDraft };
    await onChange({ ...data, tcmb: newTcmb });
    await logAudit("tcmb_config_update", { rateType: newTcmb.rateType, autoFetch: newTcmb.autoFetchOnLogin });
    notify("TCMB ayarları kaydedildi");
  };

  const fetchTcmb = async () => {
    if (!tcmbDraft.apiKey) {
      notify("Önce TCMB API anahtarınızı girin", "err");
      return;
    }
    setTcmbFetching(true);
    try {
      const result = await fetchTcmbRates({
        apiKey: tcmbDraft.apiKey,
        rateType: tcmbDraft.rateType,
        date: tcmbDate,
        corsProxy: tcmbDraft.corsProxy,
      });

      // Yeni kurlar
      const newRates = {
        USD: result.USD || data.exchangeRates.USD,
        EUR: result.EUR || data.exchangeRates.EUR,
      };

      // Geçmişe ekle
      const historyEntry = {
        date: result.date,
        USD: result.USD,
        EUR: result.EUR,
        type: result.rateType === "buying" ? "Alış" : "Satış",
        source: "TCMB EVDS",
        ts: new Date().toISOString(),
      };
      const newHistory = [historyEntry, ...(data.rateHistory || [])].slice(0, 100);

      // TCMB ayarlarını da güncelle (config + son çekim bilgisi)
      const newTcmb = {
        ...tcmbConfig, ...tcmbDraft,
        lastFetched: new Date().toISOString(),
        lastFetchStatus: "success",
        lastFetchMessage: `${result.date} tarihli ${tcmbDraft.rateType === "buying" ? "Alış" : "Satış"} kuru çekildi`,
      };

      await onChange({
        ...data,
        exchangeRates: newRates,
        tcmb: newTcmb,
        rateHistory: newHistory,
      });
      setUsdDraft(newRates.USD);
      setEurDraft(newRates.EUR);
      await logAudit("tcmb_fetch", {
        tarih: result.date, USD: result.USD, EUR: result.EUR,
        tip: tcmbDraft.rateType === "buying" ? "Alış" : "Satış"
      });
      notify(`TCMB kurları çekildi: 1$ = ${result.USD?.toFixed(4)} ₺, 1€ = ${result.EUR?.toFixed(4)} ₺`);
    } catch (err) {
      const newTcmb = {
        ...tcmbConfig, ...tcmbDraft,
        lastFetched: new Date().toISOString(),
        lastFetchStatus: "error",
        lastFetchMessage: err.message,
      };
      await onChange({ ...data, tcmb: newTcmb });
      await logAudit("tcmb_fetch_error", { hata: err.message });
      notify(err.message, "err");
    } finally {
      setTcmbFetching(false);
    }
  };

  const exportJson = () => {
    const payload = { data, users: users.map(u => ({ ...u, password: "***" })), audit, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promet_nakit_akis_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("JSON yedek indirildi");
  };

  const exportXlsx = async () => {
    try {
      const fname = exportToExcel(data);
      await logAudit("excel_export", { dosya: fname });
      notify("Excel indirildi: " + fname);
    } catch (err) {
      notify("Dışa aktarım başarısız: " + err.message, "err");
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await parseExcelFile(file);
      setImportPreview({ ...result, fileName: file.name });
    } catch (err) {
      notify("Dosya okuma hatası: " + err.message, "err");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyImport = async (mode) => {
    try {
      if (importPreview.mode === "roundtrip") {
        await onChange(importPreview.data);
        await logAudit("excel_import", { mod: "roundtrip", kategori: importPreview.summary.kategoriSayısı, hücre: importPreview.summary.hücreSayısı });
        notify("Excel verisi başarıyla yüklendi");
      } else {
        const merged = applyFuzzyImport(data, importPreview.rows, mode);
        await onChange(merged);
        await logAudit("excel_import", { mod: "fuzzy_" + mode, satır: importPreview.rows.length });
        notify(`${importPreview.rows.length} satır ${mode === "replace" ? "değiştirildi" : "eklendi"}`);
      }
      setImportPreview(null);
    } catch (err) {
      notify("İçe aktarım hatası: " + err.message, "err");
    }
  };

  const resetData = async () => {
    if (!confirm("TÜM nakit akış verisi sıfırlanacak. Emin misiniz?")) return;
    await onChange({ ...DEFAULT_SEED });
    await logAudit("data_reset", {});
    notify("Veriler sıfırlandı");
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-1">Yönetim</div>
        <h1 className="display text-2xl md:text-3xl">Ayarlar</h1>
      </div>

      {/* Aktif şirket göstergesi */}
      {data.companies && data.companies.length > 0 && (() => {
        const activeCo = data.companies.find(c => c.id === data.activeCompanyId);
        return activeCo ? (
          <div className="p-3 rounded flex items-center gap-3 text-sm"
            style={{ background: activeCo.color + "10", border: `1px solid ${activeCo.color}30` }}>
            <Building2 size={14} style={{ color: activeCo.color }}/>
            <span style={{ color: "var(--ink-mute)" }}>Aktif Şirket:</span>
            <span className="font-medium">{activeCo.name}</span>
            {activeCo.taxNo && <span className="mono text-xs" style={{ color: "var(--ink-mute)" }}>VKN: {activeCo.taxNo}</span>}
            <span className="text-xs ml-auto" style={{ color: "var(--ink-mute)" }}>
              Dönem ayarları ve veriler bu şirkete aittir
            </span>
          </div>
        ) : null;
      })()}

      {/* ŞİRKETLER YÖNETİMİ — sadece admin */}
      {can(session?.role || "admin", "manage_companies") && (
        <CompaniesCard data={data} onChange={onChange} logAudit={logAudit} notify={notify}/>
      )}

      {/* MALİ YIL ARŞİVİ */}
      {can(session?.role || "admin", "manage_periods") && (
        <YearArchiveCard data={data} onChange={onChange}
          logAudit={logAudit} notify={notify}/>
      )}

      {/* BİLDİRİM AYARLARI */}
      {can(session?.role || "admin", "manage_notifications") && (() => {
        const activeCo = (data.companies || []).find(c => c.id === data.activeCompanyId);
        return (
          <NotificationsCard data={data} onChange={onChange}
            logAudit={logAudit} notify={notify} activeCompany={activeCo}/>
        );
      })()}

      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h3 className="display text-xl mb-4">Dönem Ayarları</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="label mb-1.5">Mali Yıl</div>
            <input className="input" type="number" value={yearDraft} onChange={e => setYearDraft(e.target.value)}/>
          </div>
          <div>
            <div className="label mb-1.5">Başlangıç Ayı</div>
            <select className="input" value={startDraft} onChange={e => setStartDraft(e.target.value)}>
              {TR_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1.5">Açılış Nakdi (₺)</div>
            <input className="input num" type="number" value={openingDraft} onChange={e => setOpeningDraft(e.target.value)}/>
          </div>
        </div>
        <button onClick={savePeriod} className="btn btn-primary mt-4"><Save size={13}/> Kaydet</button>
        <p className="text-xs mt-3" style={{ color: "var(--ink-mute)" }}>
          Bu ayarlar yalnızca aktif şirket için geçerlidir.
        </p>
      </div>

      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="display text-xl flex items-center gap-2">
              <CircleDollarSign size={18} style={{ color: "var(--accent)" }}/>
              Döviz Kurları
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Görüntüleme amaçlı kullanılır. Tüm veriler TL bazında saklanır.
            </p>
          </div>
          <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Aktif görüntüleme: <span className="chip ml-1" style={{ background: "var(--accent)", color: "#f5f3ef" }}>
              {CURRENCY_SYMBOLS[data.displayCurrency]} {data.displayCurrency}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="label mb-1.5">USD / TRY</div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "var(--ink-mute)" }}>1 $</span>
              <span style={{ color: "var(--ink-mute)" }}>=</span>
              <input className="input num text-right" type="number" step="0.001" value={usdDraft}
                onChange={e => setUsdDraft(e.target.value)}/>
              <span className="text-sm">₺</span>
            </div>
          </div>
          <div>
            <div className="label mb-1.5">EUR / TRY</div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "var(--ink-mute)" }}>1 €</span>
              <span style={{ color: "var(--ink-mute)" }}>=</span>
              <input className="input num text-right" type="number" step="0.001" value={eurDraft}
                onChange={e => setEurDraft(e.target.value)}/>
              <span className="text-sm">₺</span>
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={saveRates} className="btn btn-primary"><Save size={13}/> Kurları Kaydet</button>
          </div>
        </div>
        <div className="mt-3 p-3 rounded text-xs flex items-start gap-2" style={{ background: "var(--bg)", color: "var(--ink-soft)" }}>
          <Info size={13} className="flex-shrink-0 mt-0.5"/>
          <div>
            Para birimini sağ üstteki seçiciden değiştirebilirsiniz. <strong>Baz veri TL</strong> olarak saklanır,
            USD/EUR sadece görüntülemede dönüştürme için kullanılır.
          </div>
        </div>
      </div>

      {/* TCMB EVDS API ENTEGRASYONU */}
      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="display text-xl flex items-center gap-2">
              <Landmark size={18} style={{ color: "var(--accent)" }}/>
              TCMB EVDS Otomatik Kur Çekme
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Türkiye Cumhuriyet Merkez Bankası Elektronik Veri Dağıtım Sistemi'nden günlük döviz kurlarını otomatik çekin
            </p>
          </div>
          {tcmbConfig.lastFetched && (
            <div className="text-right text-xs">
              <div style={{ color: "var(--ink-mute)" }}>Son çekim:</div>
              <div className="font-medium">
                {new Date(tcmbConfig.lastFetched).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
              <span className="chip mt-1" style={{
                background: tcmbConfig.lastFetchStatus === "success" ? "#dcfce7" : "#fee2e2",
                color: tcmbConfig.lastFetchStatus === "success" ? "#15803d" : "#b91c1c"
              }}>
                {tcmbConfig.lastFetchStatus === "success" ? <Check size={9}/> : <AlertCircle size={9}/>}
                {tcmbConfig.lastFetchStatus === "success" ? "Başarılı" : "Hata"}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* API anahtarı */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="label">EVDS API Anahtarı *</div>
              <a href="https://evds2.tcmb.gov.tr/" target="_blank" rel="noopener noreferrer"
                className="text-xs flex items-center gap-1 hover:underline" style={{ color: "var(--accent)" }}>
                <ArrowUpRight size={11}/> evds2.tcmb.gov.tr → BENİM SAYFAM → API Anahtarı
              </a>
            </div>
            <div className="relative">
              <input
                className="input mono pr-10"
                type={tcmbShowKey ? "text" : "password"}
                value={tcmbDraft.apiKey}
                onChange={e => setTcmbDraft({ ...tcmbDraft, apiKey: e.target.value.trim() })}
                placeholder="EVDS API anahtarınızı yapıştırın..."
              />
              <button type="button" onClick={() => setTcmbShowKey(!tcmbShowKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-stone-100"
                style={{ color: "var(--ink-mute)" }}>
                {tcmbShowKey ? <EyeOff size={13}/> : <Eye size={13}/>}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="label mb-1.5">Kur Tipi</div>
              <select className="input" value={tcmbDraft.rateType}
                onChange={e => setTcmbDraft({ ...tcmbDraft, rateType: e.target.value })}>
                <option value="selling">Döviz Satış (TP.DK.x.S.YTL)</option>
                <option value="buying">Döviz Alış (TP.DK.x.A.YTL)</option>
              </select>
            </div>
            <div>
              <div className="label mb-1.5">Değerleme Tarihi</div>
              <input className="input" type="date" value={tcmbDate}
                onChange={e => setTcmbDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}/>
            </div>
            <div className="flex items-end">
              <button onClick={fetchTcmb} disabled={tcmbFetching || !tcmbDraft.apiKey}
                className="btn btn-primary w-full justify-center"
                style={{ opacity: (!tcmbDraft.apiKey || tcmbFetching) ? 0.6 : 1 }}>
                {tcmbFetching ? (
                  <><RefreshCw size={13} className="animate-spin"/> Çekiliyor...</>
                ) : (
                  <><Download size={13}/> Kuru Çek</>
                )}
              </button>
            </div>
          </div>

          {/* CORS proxy (gelişmiş) */}
          <details className="group" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
            <summary className="text-xs cursor-pointer flex items-center gap-1.5" style={{ color: "var(--ink-mute)" }}>
              <ChevronRight size={12} className="group-open:rotate-90 transition-transform"/>
              Gelişmiş ayarlar (CORS proxy, otomatik çekim)
            </summary>
            <div className="space-y-3 mt-3 pl-4">
              <div>
                <div className="label mb-1.5">CORS Proxy URL'i (opsiyonel)</div>
                <input className="input mono text-xs" value={tcmbDraft.corsProxy}
                  onChange={e => setTcmbDraft({ ...tcmbDraft, corsProxy: e.target.value })}
                  placeholder="https://corsproxy.io/?  veya  https://your-proxy.com/?url={url}"/>
                <p className="text-xs mt-1.5" style={{ color: "var(--ink-mute)" }}>
                  Tarayıcı CORS engeline takılırsa, bir CORS proxy üzerinden çekebilirsiniz.
                  <code className="mono ml-1">{`{url}`}</code> şablonu desteklenir; yoksa URL doğrudan eklenir.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={tcmbDraft.autoFetchOnLogin}
                  onChange={e => setTcmbDraft({ ...tcmbDraft, autoFetchOnLogin: e.target.checked })}/>
                <span className="text-sm">Her gün ilk girişte otomatik kur çek</span>
              </label>
              <button onClick={saveTcmbConfig} className="btn btn-ghost">
                <Save size={13}/> TCMB Ayarlarını Kaydet
              </button>
            </div>
          </details>

          {/* Son hata mesajı */}
          {tcmbConfig.lastFetchStatus === "error" && tcmbConfig.lastFetchMessage && (
            <div className="p-3 rounded text-xs flex items-start gap-2"
              style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5"/>
              <div>
                <strong>Son çekim hatası:</strong> {tcmbConfig.lastFetchMessage}
              </div>
            </div>
          )}

          {/* Bilgi notu */}
          <div className="p-3 rounded text-xs flex items-start gap-2" style={{ background: "var(--bg)", color: "var(--ink-soft)" }}>
            <Info size={13} className="flex-shrink-0 mt-0.5"/>
            <div className="space-y-1">
              <div><strong>EVDS API anahtarı ücretsizdir.</strong> evds2.tcmb.gov.tr'ye üye olup BENİM SAYFAM → API Anahtarı bölümünden alabilirsiniz.</div>
              <div><strong>TCMB kur yayın saati:</strong> Mesai günlerinde saat 15:30 civarı. Hafta sonu ve resmi tatillerde yayın yapılmaz; sistem son 14 günden en güncel veriyi otomatik bulur.</div>
              <div><strong>Güvenlik:</strong> API anahtarı tarayıcı isteklerinde URL'de görünür. Üretim ortamında backend proxy kullanılması önerilir.</div>
            </div>
          </div>
        </div>

        {/* Kur geçmişi */}
        {(data.rateHistory || []).length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line-soft)" }}>
            {/* Kur Seyri Grafiği */}
            {data.rateHistory.length >= 2 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <LineChartIcon size={14} style={{ color: "var(--accent)" }}/>
                    Kur Seyri (Son {Math.min(data.rateHistory.length, 30)} Kayıt)
                  </h4>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: "#0f766e" }}/> USD</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: "#1d4ed8" }}/> EUR</span>
                  </div>
                </div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={[...data.rateHistory].reverse().slice(-30).map(h => {
                        const [d, m, y] = (h.date || "").split("-");
                        return {
                          tarih: d && m ? `${d}/${m}` : h.date,
                          USD: h.USD,
                          EUR: h.EUR,
                        };
                      })}
                      margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#d9d3c7" vertical={false}/>
                      <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={v => v?.toFixed(2)}/>
                      <Tooltip
                        contentStyle={{ background: "#fff", border: "1px solid #d9d3c7", borderRadius: 3, fontSize: 11 }}
                        formatter={(v, name) => [v?.toFixed(4) + " ₺", name]}/>
                      <Line type="monotone" dataKey="USD" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }}/>
                      <Line type="monotone" dataKey="EUR" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <button onClick={() => setTcmbShowHistory(!tcmbShowHistory)}
              className="flex items-center gap-2 text-sm font-medium hover:underline">
              {tcmbShowHistory ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              Kur Geçmişi Tablosu ({data.rateHistory.length} kayıt)
            </button>
            {tcmbShowHistory && (
              <div className="card overflow-x-auto mt-3" style={{ borderColor: "var(--line)" }}>
                <table className="grid" style={{ minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th className="label-cell" style={{ width: 120 }}>Değer Tarihi</th>
                      <th className="label-cell" style={{ width: 80 }}>Tip</th>
                      <th>USD/TRY</th>
                      <th>EUR/TRY</th>
                      <th className="label-cell" style={{ width: 100 }}>Kaynak</th>
                      <th className="label-cell" style={{ width: 140 }}>Çekim Zamanı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rateHistory.slice(0, 30).map((h, i) => (
                      <tr key={i}>
                        <td className="label-cell mono text-xs">{h.date}</td>
                        <td className="label-cell">
                          <span className="chip" style={{ background: h.type === "Alış" ? "#dcfce7" : "#dbeafe", color: h.type === "Alış" ? "#15803d" : "#1d4ed8" }}>
                            {h.type}
                          </span>
                        </td>
                        <td className="num text-xs">{h.USD?.toFixed(4) || "—"}</td>
                        <td className="num text-xs">{h.EUR?.toFixed(4) || "—"}</td>
                        <td className="label-cell text-xs" style={{ color: "var(--ink-mute)" }}>{h.source}</td>
                        <td className="label-cell mono text-xs" style={{ color: "var(--ink-mute)" }}>
                          {new Date(h.ts).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXCEL İÇE/DIŞA AKTARIM */}
      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="display text-xl flex items-center gap-2">
              <FileSpreadsheet size={18} style={{ color: "var(--accent)" }}/>
              Excel İçe / Dışa Aktarım
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Verileri Excel formatında alın veya mevcut Excel dosyalarınızı sisteme yükleyin
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* DIŞA AKTARIM */}
          <div className="p-4 rounded" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2 mb-2">
              <FileDown size={15} style={{ color: "var(--positive)" }}/>
              <span className="font-medium text-sm">Dışa Aktarım</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--ink-mute)" }}>
              Tüm nakit akış verileri 3 sheet'li bir Excel dosyasına aktarılır: ana tablo, kategori listesi ve roundtrip için teknik veri.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={exportXlsx} className="btn btn-primary w-full justify-center">
                <FileDown size={13}/> Excel (.xlsx) İndir
              </button>
              <button onClick={exportJson} className="btn btn-ghost w-full justify-center">
                <Download size={13}/> JSON Yedek
              </button>
            </div>
          </div>

          {/* İÇE AKTARIM */}
          <div className="p-4 rounded" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2 mb-2">
              <FileUp size={15} style={{ color: "var(--accent)" }}/>
              <span className="font-medium text-sm">İçe Aktarım</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--ink-mute)" }}>
              Excel dosyası yükleyin. Bizim ürettiğimiz dosyalar otomatik olarak <strong>roundtrip</strong> modunda yüklenir. Diğer dosyalar için <strong>akıllı eşleştirme</strong> önizlemesi sunulur.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="btn btn-primary w-full justify-center">
              {importing ? (<><RefreshCw size={13} className="animate-spin"/> Okunuyor...</>) : (<><FileUp size={13}/> Excel Dosyası Seç</>)}
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 rounded text-xs flex items-start gap-2" style={{ background: "#fef3c7", color: "#854d0e" }}>
          <Info size={13} className="flex-shrink-0 mt-0.5"/>
          <div>
            <strong>İpucu:</strong> Roundtrip dışa aktarımı kullanın — dosya tekrar yüklendiğinde tüm kategori ID'leri ve veriler eksiksiz geri yüklenir. Harici dosyalar için sistem kategori adlarına göre eşleştirme yapar; mevcut olmayanlar otomatik oluşturulur.
          </div>
        </div>
      </div>

      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h3 className="display text-xl mb-3">Sistem Bilgisi</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 md:gap-3 text-sm">
          <Stat label="Kullanıcı" value={users.length}/>
          <Stat label="Banka" value={(data.banks || []).length}/>
          <Stat label="Hesap" value={(data.bankAccounts || []).length}/>
          <Stat label="Kasa" value={(data.kasaAccounts || []).length}/>
          <Stat label="Fatura" value={(data.invoices || []).length}/>
          <Stat label="Transfer" value={(data.transfers || []).length}/>
          <Stat label="Kategori" value={data.inflows.length + data.outflows.length + data.nonPnlOutflows.length + (data.kasaCategories || []).length}/>
          <Stat label="Denetim" value={audit.length}/>
        </div>
      </div>

      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h3 className="display text-xl mb-3">Tehlikeli İşlemler</h3>
        <button onClick={resetData} className="btn btn-danger"><Trash2 size={13}/> Tüm Verileri Sıfırla</button>
        <p className="text-xs mt-2" style={{ color: "var(--ink-mute)" }}>
          Bu işlem geri alınamaz. Yapmadan önce Excel veya JSON yedek aldığınızdan emin olun.
        </p>
      </div>

      <div className="card p-5" style={{ background: "var(--bg-alt)", borderColor: "var(--line)" }}>
        <h3 className="display text-lg mb-2 flex items-center gap-2"><Building2 size={16}/> Geliştirme Notları</h3>
        <ul className="text-xs space-y-1.5" style={{ color: "var(--ink-soft)" }}>
          <li>• <strong>Storage katmanı</strong> tek bir <code className="mono">S</code> nesnesinde izole — Supabase'e geçiş için sadece bu modülü değiştirmek yeterli.</li>
          <li>• <strong>Yetki sistemi</strong> <code className="mono">PERMS</code> ve <code className="mono">can()</code> fonksiyonu üzerinden — yeni yetki kuralı eklemek tek satır.</li>
          <li>• <strong>Excel roundtrip</strong> gizli <code className="mono">_promet_meta</code> ve <code className="mono">_promet_cells</code> sheet'leri ile sağlanır — dışa aktarıp tekrar yüklenince hiç veri kaybı olmaz.</li>
          <li>• <strong>Genişletme önerileri:</strong> Çoklu şirket, döviz desteği, banka entegrasyonu, Logo ERP bağlantısı, otomatik mizan aktarımı.</li>
        </ul>
      </div>

      {/* IMPORT PREVIEW MODAL */}
      {importPreview && (
        <ImportPreviewModal
          preview={importPreview}
          currentData={data}
          onClose={() => setImportPreview(null)}
          onApply={applyImport}
        />
      )}
    </div>
  );
}

function ImportPreviewModal({ preview, currentData, onClose, onApply }) {
  const sectionLabels = {
    inflows: { label: "Tahsilat", color: "#0f766e" },
    outflows: { label: "Ödeme", color: "#b91c1c" },
    nonPnlOutflows: { label: "K/Z Harici", color: "#b45309" },
  };

  const isRoundtrip = preview.mode === "roundtrip";

  // For fuzzy mode: identify which rows would be new vs existing
  const normalize = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
  const fuzzyAnalysis = !isRoundtrip ? preview.rows.map(row => {
    const existing = currentData[row.section]?.find(c => normalize(c.name) === normalize(row.name));
    return { ...row, isNew: !existing };
  }) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: "var(--paper)", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
        <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: "var(--line)" }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet size={18} style={{ color: "var(--accent)" }}/>
              <h3 className="display text-xl">İçe Aktarım Önizlemesi</h3>
              <span className="chip" style={{
                background: isRoundtrip ? "#dcfce7" : "#fef3c7",
                color: isRoundtrip ? "#15803d" : "#854d0e"
              }}>
                {isRoundtrip ? "Roundtrip Modu" : "Akıllı Eşleştirme"}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--ink-mute)" }}>{preview.fileName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100">
            <X size={16}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isRoundtrip ? (
            <>
              <div className="p-4 rounded flex items-start gap-2" style={{ background: "#dcfce7", color: "#15803d" }}>
                <Check size={15} className="flex-shrink-0 mt-0.5"/>
                <div className="text-sm">
                  <strong>Roundtrip dosyası tespit edildi.</strong> Mali yıl, kategori yapısı ve tüm veriler eksiksiz aktarılacak. Mevcut verileriniz tamamen değişecek.
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <Stat label="Mali Yıl" value={preview.data.fiscalYear}/>
                <Stat label="Tahsilat" value={preview.summary.tahsilatKalemi}/>
                <Stat label="Ödeme" value={preview.summary.ödemeKalemi}/>
                <Stat label="K/Z Harici" value={preview.summary.kzHariciKalemi}/>
              </div>

              <div>
                <div className="label mb-2">Açılış Nakdi</div>
                <div className="num display text-2xl">{fmtTLSign(preview.data.openingCash)} ₺</div>
              </div>

              <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                {preview.summary.hücreSayısı} dolu hücre içe aktarılacak.
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded flex items-start gap-2" style={{ background: "#fef3c7", color: "#854d0e" }}>
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5"/>
                <div className="text-sm">
                  <strong>Harici dosya — Akıllı eşleştirme modu.</strong> Sistem kategori adlarına göre eşleştirme yaptı.
                  Eşleşmeyen kalemler yeni olarak eklenecek. <strong>Birleştir</strong> mevcut verilerin üzerine ekler, <strong>Değiştir</strong> tüm verileri silip yeniden başlar.
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {Object.entries(sectionLabels).map(([key, { label, color }]) => {
                  const count = fuzzyAnalysis.filter(r => r.section === key).length;
                  const newCount = fuzzyAnalysis.filter(r => r.section === key && r.isNew).length;
                  return (
                    <div key={key} className="p-3 rounded" style={{ background: color + "08", border: `1px solid ${color}25` }}>
                      <div className="label mb-1" style={{ color }}>{label}</div>
                      <div className="display text-2xl num">{count}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                        {newCount > 0 ? `${newCount} yeni kategori` : "Hepsi eşleşti"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="label mb-2">Algılanan Satırlar ({fuzzyAnalysis.length})</div>
                <div className="card overflow-hidden">
                  <table className="grid">
                    <thead>
                      <tr>
                        <th className="label-cell">Bölüm</th>
                        <th className="label-cell">Kategori Adı</th>
                        <th>12 Ay Toplamı (₺)</th>
                        <th style={{ width: 90 }}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fuzzyAnalysis.slice(0, 50).map((r, i) => {
                        const sl = sectionLabels[r.section];
                        return (
                          <tr key={i}>
                            <td className="label-cell">
                              <span className="chip" style={{ background: sl.color + "15", color: sl.color }}>{sl.label}</span>
                            </td>
                            <td className="label-cell text-xs">{r.name}</td>
                            <td className="num text-xs">{fmtTL(r.total) || "—"}</td>
                            <td className="label-cell">
                              {r.isNew ? (
                                <span className="chip" style={{ background: "#dbeafe", color: "#1d4ed8" }}>Yeni</span>
                              ) : (
                                <span className="chip" style={{ background: "#dcfce7", color: "#15803d" }}>Eşleşti</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {fuzzyAnalysis.length > 50 && (
                        <tr><td colSpan="4" className="label-cell text-center text-xs py-3" style={{ color: "var(--ink-mute)" }}>
                          ...ve {fuzzyAnalysis.length - 50} satır daha
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
          <button onClick={onClose} className="btn btn-ghost">Vazgeç</button>
          {isRoundtrip ? (
            <button onClick={() => onApply("replace")} className="btn btn-primary">
              <Check size={13}/> Tüm Verileri Yükle (Üzerine Yaz)
            </button>
          ) : (
            <>
              <button onClick={() => onApply("merge")} className="btn btn-ghost">
                <Plus size={13}/> Mevcuta Birleştir
              </button>
              <button onClick={() => onApply("replace")} className="btn btn-primary">
                <RefreshCw size={13}/> Tamamen Değiştir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   BİLDİRİM SİSTEMİ — Günlük Vade Raporu Üretici
   Düz metin rapor + özet objesi döndürür. mailto:, .txt, kopyala için
===================================================================== */
function generateDailyReport(data, activeCompany, options = {}) {
  const today = new Date();
  const todayStr = today.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const threshold = options.alertThresholdDays || 7;
  const rates = data.exchangeRates || {};

  // Faturaları kategorize et
  const overdue = [];
  const dueSoon = [];
  const upcoming30 = [];

  (data.invoices || []).forEach(inv => {
    if (!inv.dueDate) return;
    const remaining = (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0);
    if (remaining <= 0.01) return;
    const due = new Date(inv.dueDate);
    if (isNaN(due.getTime())) return;
    const t = new Date(today); t.setHours(0,0,0,0);
    const daysUntil = Math.round((due - t) / 86400000);
    const remainingTRY = convertToTRY(remaining, inv.currency || "TRY", rates);
    const entry = { ...inv, daysUntil, remaining, remainingTRY };
    if (daysUntil < 0) overdue.push(entry);
    else if (daysUntil <= threshold) dueSoon.push(entry);
    else if (daysUntil <= 30) upcoming30.push(entry);
  });
  overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  dueSoon.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  upcoming30.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Nakit pozisyonu
  const totalBankBalance = (data.bankAccounts || []).reduce((s, a) =>
    s + convertToTRY(computeBankAccountBalance(a.id, data), a.currency, rates), 0);
  const totalKasaBalance = (data.kasaAccounts || []).reduce((s, k) =>
    s + convertToTRY(computeKasaBalance(k.id, data), k.currency, rates), 0);

  // FX pozisyonlar
  const fxPositions = [];
  (data.bankAccounts || []).filter(a => a.currency !== "TRY").forEach(a => {
    const bal = computeBankAccountBalance(a.id, data);
    if (Math.abs(bal) > 0.01) {
      const bank = (data.banks || []).find(b => b.id === a.bankId);
      fxPositions.push({
        type: "bank", name: `${bank?.name || "?"} — ${a.name}`,
        currency: a.currency, balance: bal,
        balanceTRY: convertToTRY(bal, a.currency, rates),
      });
    }
  });
  (data.kasaAccounts || []).filter(k => k.currency !== "TRY").forEach(k => {
    const bal = computeKasaBalance(k.id, data);
    if (Math.abs(bal) > 0.01) {
      fxPositions.push({
        type: "kasa", name: k.name, currency: k.currency,
        balance: bal, balanceTRY: convertToTRY(bal, k.currency, rates),
      });
    }
  });

  // Düz metin formatı
  const lines = [];
  const sep = "═══════════════════════════════════════════════════════";
  const halfSep = "─────────────────────────────────────";
  lines.push(sep);
  lines.push("  PROMETA ONE — GÜNLÜK VADE RAPORU");
  lines.push(sep);
  lines.push(`  Tarih: ${todayStr}`);
  lines.push(`  Şirket: ${activeCompany?.name || "—"}${activeCompany?.taxNo ? " (VKN: " + activeCompany.taxNo + ")" : ""}`);
  lines.push(`  Mali Yıl: ${data.fiscalYear}`);
  lines.push("");

  // ÖZET
  lines.push("📋 ÖZET");
  lines.push(halfSep);
  if (overdue.length > 0) {
    const t = overdue.reduce((s, i) => s + i.remainingTRY, 0);
    lines.push(`  🔴 ${overdue.length} fatura vadesi geçti  —  ${fmtTL(t)} ₺`);
  }
  if (dueSoon.length > 0) {
    const t = dueSoon.reduce((s, i) => s + i.remainingTRY, 0);
    lines.push(`  🟡 ${dueSoon.length} fatura ${threshold} gün içinde  —  ${fmtTL(t)} ₺`);
  }
  if (upcoming30.length > 0) {
    const t = upcoming30.reduce((s, i) => s + i.remainingTRY, 0);
    lines.push(`  🟢 ${upcoming30.length} fatura 30 gün içinde  —  ${fmtTL(t)} ₺`);
  }
  if (overdue.length === 0 && dueSoon.length === 0 && upcoming30.length === 0) {
    lines.push("  ✓ Yaklaşan vade veya geciken fatura yok");
  }
  lines.push("");

  // NAKİT POZİSYONU
  if (options.includeCashPosition !== false) {
    lines.push("💰 NAKİT POZİSYONU");
    lines.push(halfSep);
    lines.push(`  Banka toplam:  ${fmtTL(totalBankBalance).padStart(15)} ₺`);
    lines.push(`  Kasa toplam:   ${fmtTL(totalKasaBalance).padStart(15)} ₺`);
    lines.push(`  GENEL TOPLAM:  ${fmtTL(totalBankBalance + totalKasaBalance).padStart(15)} ₺`);
    lines.push("");
  }

  // FX POZİSYONLAR
  if (options.includeFxPositions !== false && fxPositions.length > 0) {
    lines.push("💱 YABANCI PARA POZİSYONLARI");
    lines.push(halfSep);
    fxPositions.forEach(p => {
      lines.push(`  • ${p.name}`);
      lines.push(`      ${fmtTL(p.balance)} ${p.currency}  ≈  ${fmtTL(p.balanceTRY)} ₺`);
    });
    lines.push("");
  }

  // VADESİ GEÇMİŞ
  if (options.includeOverdue !== false && overdue.length > 0) {
    lines.push("🔴 VADESİ GEÇMİŞ FATURALAR");
    lines.push(halfSep);
    overdue.forEach(inv => {
      const sign = inv.type === "out" ? "ALACAK" : "BORÇ";
      lines.push(`  • [${sign}] ${inv.invoiceNo} · ${inv.counterparty}`);
      lines.push(`      ${fmtTL(inv.remaining)} ${inv.currency}  ·  vade ${inv.dueDate}  ·  ${-inv.daysUntil} gün gecikti`);
    });
    const total = overdue.reduce((s, i) => s + i.remainingTRY, 0);
    lines.push(`  ${halfSep}`);
    lines.push(`  TOPLAM: ${fmtTL(total)} ₺`);
    lines.push("");
  }

  // YAKLAŞAN VADE
  if (options.includeDueSoon !== false && dueSoon.length > 0) {
    lines.push(`🟡 ÖNÜMÜZDEKİ ${threshold} GÜN İÇİNDE VADESİ GELEN`);
    lines.push(halfSep);
    dueSoon.forEach(inv => {
      const sign = inv.type === "out" ? "ALACAK" : "BORÇ";
      const dayStr = inv.daysUntil === 0 ? "BUGÜN" : `${inv.daysUntil} gün sonra`;
      lines.push(`  • [${sign}] ${inv.invoiceNo} · ${inv.counterparty}`);
      lines.push(`      ${fmtTL(inv.remaining)} ${inv.currency}  ·  vade ${inv.dueDate}  ·  ${dayStr}`);
    });
    const total = dueSoon.reduce((s, i) => s + i.remainingTRY, 0);
    lines.push(`  ${halfSep}`);
    lines.push(`  TOPLAM: ${fmtTL(total)} ₺`);
    lines.push("");
  }

  // 30 GÜN VADE
  if (options.includeUpcoming30 !== false && upcoming30.length > 0) {
    lines.push("🟢 30 GÜN İÇİNDE VADE — ÖZET");
    lines.push(halfSep);
    const totalRec = upcoming30.filter(i => i.type === "out").reduce((s, i) => s + i.remainingTRY, 0);
    const totalPay = upcoming30.filter(i => i.type === "in").reduce((s, i) => s + i.remainingTRY, 0);
    lines.push(`  Tahsil edilecek:  ${fmtTL(totalRec).padStart(15)} ₺  (${upcoming30.filter(i => i.type === "out").length} fatura)`);
    lines.push(`  Ödenecek:         ${fmtTL(totalPay).padStart(15)} ₺  (${upcoming30.filter(i => i.type === "in").length} fatura)`);
    lines.push(`  Net nakit etkisi: ${fmtTLSign(totalRec - totalPay).padStart(15)} ₺`);
    lines.push("");
  }

  lines.push(halfSep);
  lines.push(`Otomatik üretildi · ${new Date().toLocaleString("tr-TR")}`);
  lines.push("Prometa One · Finans ve İK Platformu");

  const text = lines.join("\n");
  const summary = {
    overdueCount: overdue.length,
    overdueTotal: overdue.reduce((s, i) => s + i.remainingTRY, 0),
    dueSoonCount: dueSoon.length,
    dueSoonTotal: dueSoon.reduce((s, i) => s + i.remainingTRY, 0),
    upcoming30Count: upcoming30.length,
    cashTotal: totalBankBalance + totalKasaBalance,
    hasAlerts: overdue.length > 0 || dueSoon.length > 0,
  };
  return { text, summary, overdue, dueSoon, upcoming30, fxPositions };
}

/* =====================================================================
   AI TAHMİN — Zaman Serisi Algoritmaları (saf JS, kütüphane yok)
   - Linear regression (eğilim çıkarımı)
   - Moving average (son N ayın ortalaması)
   - Exponential smoothing (yakın dönemi ağırlıklandırır)
   - Ensemble: 3 yöntemin r²-ağırlıklı birleşimi
===================================================================== */
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return null;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += Math.pow(i - meanX, 2);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const ssTotal = values.reduce((s, y) => s + Math.pow(y - meanY, 2), 0);
  const ssRes = values.reduce((s, y, i) => s + Math.pow(y - (intercept + slope * i), 2), 0);
  const r2 = ssTotal === 0 ? 1 : Math.max(0, 1 - ssRes / ssTotal);
  const stdErr = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  return { slope, intercept, r2, stdErr, mean: meanY };
}

function predictTimeSeries(historical, futureMonths) {
  if (!historical || historical.length === 0) {
    return { method: "no_data", values: Array(futureMonths).fill(0), lower: Array(futureMonths).fill(0), upper: Array(futureMonths).fill(0), confidence: "none", trend: "n/a" };
  }
  if (historical.length === 1) {
    const v = historical[0];
    return { method: "single_point", values: Array(futureMonths).fill(v), lower: Array(futureMonths).fill(v), upper: Array(futureMonths).fill(v), confidence: "very_low", trend: "stable", mean: v };
  }

  const linear = linearRegression(historical);
  const lastN = Math.min(3, historical.length);
  const ma = historical.slice(-lastN).reduce((a, b) => a + b, 0) / lastN;

  // Exponential smoothing α=0.4 (yakın dönemi ağırlıklandır)
  const alpha = 0.4;
  let es = historical[0];
  for (let i = 1; i < historical.length; i++) {
    es = alpha * historical[i] + (1 - alpha) * es;
  }

  const values = [];
  const lower = [];
  const upper = [];
  for (let f = 0; f < futureMonths; f++) {
    const future_x = historical.length + f;
    const linearVal = linear.intercept + linear.slope * future_x;

    // Ensemble: r²'ye göre ağırlık
    const wLin = Math.max(0.2, Math.min(0.7, linear.r2));
    const wMA = 0.3;
    const wES = Math.max(0.05, 1 - wLin - wMA);

    const predicted = wLin * linearVal + wMA * ma + wES * es;
    values.push(predicted);

    // Belirsizlik artıyor zamanla
    const margin = 1.96 * linear.stdErr * (1 + 0.15 * f);
    lower.push(predicted - margin);
    upper.push(predicted + margin);
  }

  let confidence = "low";
  if (linear.r2 > 0.7 && historical.length >= 6) confidence = "high";
  else if (linear.r2 > 0.4 && historical.length >= 4) confidence = "medium";

  let trend = "stable";
  if (linear.mean > 0) {
    const relSlope = linear.slope / Math.abs(linear.mean);
    if (relSlope > 0.05) trend = "increasing";
    else if (relSlope < -0.05) trend = "decreasing";
  }

  return {
    method: "ensemble",
    values, lower, upper,
    r2: linear.r2,
    slope: linear.slope,
    mean: linear.mean,
    confidence, trend,
    weights: { linear: 0.5, ma: 0.3, es: 0.2 },
  };
}

/* =====================================================================
   ÇOKLU YIL ARŞİV — Yıl sonu kapanışı + tarihsel veri yardımcıları
   ÖNEMLİ: Arşiv yapısı dış sisteme (RDBMS) kolay map'lenebilir;
   her arşiv standalone JSON snapshot'ıdır.
===================================================================== */
// Belirli bir kategoriye ait çapraz-yıl tarihsel zaman serisi oluşturur
// (eski yıllar önce, mevcut yıl sonra — chronological)
// Kategori eşleştirme: aynı ID veya aynı NAME (yeniden adlandırılmış kategoriler için)
function buildCrossYearHistory(cat, data, currentMonthLimit = 11) {
  const series = [];
  const archives = (data.archives || []).slice().sort((a, b) => a.fiscalYear - b.fiscalYear);
  archives.forEach(arch => {
    const archCats = [...(arch.inflows || []), ...(arch.outflows || []), ...(arch.nonPnlOutflows || [])];
    const matched = archCats.find(c => c.id === cat.id || c.name === cat.name);
    if (!matched) {
      // Bu kategori bu arşivde yoktu — 12 ay sıfır ekle (devamlılık için)
      for (let i = 0; i < 12; i++) series.push(0);
      return;
    }
    // Calendar order (Jan-Dec) — chronological
    for (let i = 0; i < 12; i++) {
      series.push(Number((arch.cells || {})[`${matched.id}:${i}`]) || 0);
    }
  });
  // Mevcut yıl: 0 → currentMonthLimit
  const cells = data.cells || {};
  for (let i = 0; i <= currentMonthLimit; i++) {
    series.push(Number(cells[`${cat.id}:${i}`]) || 0);
  }
  return series;
}

// Mevcut yılın kapanış nakdi (12. ay sonu)
function computeYearClosingCash(data) {
  const c = computeCashflow(data);
  return c.endCash[11];
}

// Yıl sonu kapanışı: mevcut yılı arşivler, yeni yıla geçirir
// Yeni opening cash = kapanış nakdi (carryForward true ise)
function archiveAndAdvanceYear(data, options) {
  const {
    newFiscalYear,
    newFiscalStartMonth,
    newOpeningCash,
    carryCategories = true,
    clearCells = true,
  } = options;

  const closingCash = computeYearClosingCash(data);

  const archive = {
    fiscalYear: data.fiscalYear,
    fiscalStartMonth: data.fiscalStartMonth,
    openingCash: Number(data.openingCash) || 0,
    closingCash,
    inflows: (data.inflows || []).map(c => ({ ...c })),
    outflows: (data.outflows || []).map(c => ({ ...c })),
    nonPnlOutflows: (data.nonPnlOutflows || []).map(c => ({ ...c })),
    cells: { ...(data.cells || {}) },
    archivedAt: new Date().toISOString(),
  };

  const nextData = {
    ...data,
    fiscalYear: newFiscalYear,
    fiscalStartMonth: newFiscalStartMonth,
    openingCash: Number(newOpeningCash) || 0,
    cells: clearCells ? {} : { ...(data.cells || {}) },
    archives: [...(data.archives || []), archive],
  };

  if (!carryCategories) {
    nextData.inflows = [];
    nextData.outflows = [];
    nextData.nonPnlOutflows = [];
  }

  return nextData;
}

function Stat({ label, value }) {
  return (
    <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
      <div className="label mb-1">{label}</div>
      <div className="display text-2xl num">{value}</div>
    </div>
  );
}

/* =====================================================================
   UFRS 21 — KUR FARKI DEĞERLEMESİ
   Yabancı para cinsi banka hesabı ve kasaların TL değerlemesi
   - Referans tarih ve değerleme tarihi seçilir
   - Her FX hesap için bakiye × ref kuru ve bakiye × güncel kur hesaplanır
   - Fark = Kambiyo Karı (646) veya Kambiyo Zararı (656)
   - Opsiyonel: nakit akış tablosuna yansıtma
===================================================================== */
function parseTrDate(trDate) {
  // DD-MM-YYYY → YYYY-MM-DD
  if (!trDate) return "";
  const parts = trDate.split("-");
  if (parts.length !== 3) return trDate;
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

function findRateAtDate(rateHistory, currency, isoDate) {
  if (!rateHistory || !rateHistory.length || !isoDate) return null;
  // Tarihten önce/eşit olan en yakın kayıtı bul
  const candidates = rateHistory
    .map(h => ({ h, iso: parseTrDate(h.date) }))
    .filter(x => x.iso && x.iso <= isoDate)
    .sort((a, b) => b.iso.localeCompare(a.iso));
  if (!candidates.length) return null;
  return { rate: candidates[0].h[currency], source: candidates[0].h, distance: 0 };
}

function FxRevaluationView({ data, session, canAct, onChange, logAudit, notify }) {
  const canManage = canAct ? canAct("finance.fx.update") || canAct("finance.fx.create") || can(session.role, "manage_fx_revaluation") : can(session.role, "manage_fx_revaluation");
  const canDelete = canAct ? canAct("finance.fx.delete") || can(session.role, "manage_fx_revaluation") : can(session.role, "manage_fx_revaluation");
  const rateHistory = data.rateHistory || [];
  const rates = data.exchangeRates || {};
  const revaluations = data.revaluations || [];

  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const [refDate, setRefDate] = useState(oneMonthAgo);
  const [asOfDate, setAsOfDate] = useState(today);
  const [manualRates, setManualRates] = useState({ usdRef: 0, usdAt: 0, eurRef: 0, eurAt: 0 });
  const [useManual, setUseManual] = useState(false);
  const [postModal, setPostModal] = useState(null);

  // Otomatik kur çözünürlüğü (rate history'den)
  const autoRates = useMemo(() => {
    return {
      usdRef: findRateAtDate(rateHistory, "USD", refDate),
      usdAt:  findRateAtDate(rateHistory, "USD", asOfDate),
      eurRef: findRateAtDate(rateHistory, "EUR", refDate),
      eurAt:  findRateAtDate(rateHistory, "EUR", asOfDate),
    };
  }, [refDate, asOfDate, rateHistory]);

  // Kullanılacak kurlar
  const activeRates = useMemo(() => {
    if (useManual) return manualRates;
    return {
      usdRef: autoRates.usdRef?.rate || rates.USD || 0,
      usdAt:  autoRates.usdAt?.rate  || rates.USD || 0,
      eurRef: autoRates.eurRef?.rate || rates.EUR || 0,
      eurAt:  autoRates.eurAt?.rate  || rates.EUR || 0,
    };
  }, [useManual, manualRates, autoRates, rates]);

  // FX pozisyonları (USD/EUR hesap ve kasalar)
  const fxItems = useMemo(() => {
    const items = [];
    (data.bankAccounts || []).forEach(a => {
      if (!a.currency || a.currency === "TRY") return;
      const balance = computeBankAccountBalance(a.id, data);
      const refRate = a.currency === "USD" ? activeRates.usdRef : activeRates.eurRef;
      const atRate  = a.currency === "USD" ? activeRates.usdAt  : activeRates.eurAt;
      const trAtRef = balance * refRate;
      const trAtDate = balance * atRate;
      items.push({
        type: "bank",
        id: a.id,
        name: getEndpointInfo("bank", a.id, data).name,
        shortName: getEndpointInfo("bank", a.id, data).shortName,
        color: getEndpointInfo("bank", a.id, data).color,
        currency: a.currency,
        balance, refRate, atRate, trAtRef, trAtDate,
        diff: trAtDate - trAtRef,
      });
    });
    (data.kasaAccounts || []).forEach(k => {
      if (!k.currency || k.currency === "TRY") return;
      const balance = computeKasaBalance(k.id, data);
      const refRate = k.currency === "USD" ? activeRates.usdRef : activeRates.eurRef;
      const atRate  = k.currency === "USD" ? activeRates.usdAt  : activeRates.eurAt;
      const trAtRef = balance * refRate;
      const trAtDate = balance * atRate;
      items.push({
        type: "kasa",
        id: k.id,
        name: k.name,
        shortName: k.name,
        color: "#0b3d2e",
        currency: k.currency,
        balance, refRate, atRate, trAtRef, trAtDate,
        diff: trAtDate - trAtRef,
      });
    });
    return items;
  }, [data, activeRates]);

  const totalGain = fxItems.filter(i => i.diff > 0).reduce((s, i) => s + i.diff, 0);
  const totalLoss = fxItems.filter(i => i.diff < 0).reduce((s, i) => s + Math.abs(i.diff), 0);
  const netDiff = totalGain - totalLoss;

  // Snapshot kaydetme
  const saveRevaluation = async () => {
    if (fxItems.length === 0) return notify("Değerlenecek FX pozisyonu yok", "err");
    const rev = {
      id: "rev_" + Date.now(),
      refDate, asOfDate,
      usdRef: activeRates.usdRef, usdAt: activeRates.usdAt,
      eurRef: activeRates.eurRef, eurAt: activeRates.eurAt,
      ratesSource: useManual ? "manuel" : "tcmb",
      items: fxItems.map(i => ({
        type: i.type, id: i.id, name: i.shortName, currency: i.currency,
        balance: i.balance, refRate: i.refRate, atRate: i.atRate,
        trAtRef: i.trAtRef, trAtDate: i.trAtDate, diff: i.diff,
      })),
      totalGain, totalLoss, netDiff,
      cashflowPosted: false,
      createdAt: new Date().toISOString(),
      createdBy: session.userId,
    };
    await onChange({ ...data, revaluations: [rev, ...revaluations] });
    await logAudit("fx_revaluation", {
      tarih: asOfDate, ref: refDate,
      kar: totalGain, zarar: totalLoss, net: netDiff,
    });
    notify(`Kur değerlemesi kaydedildi: Net ${fmtTLSign(netDiff)} ₺`);
  };

  // Snapshot silme
  const removeRevaluation = async (rev) => {
    if (!confirm(`${rev.asOfDate} tarihli değerlemeyi silmek istediğinizden emin misiniz?`)) return;
    if (rev.cashflowPosted) {
      if (!confirm("Bu değerleme nakit akışa yansıtılmıştı. Silmek nakit akış hücrelerini geri almaz. Devam edilsin mi?")) return;
    }
    await onChange({ ...data, revaluations: revaluations.filter(x => x.id !== rev.id) });
    await logAudit("fx_revaluation_delete", { id: rev.id, tarih: rev.asOfDate });
    notify("Değerleme silindi");
  };

  // Nakit akışa yansıtma
  const postToCashflow = async (rev, gainCatId, lossCatId) => {
    const dateObj = new Date(rev.asOfDate);
    // Hangi mali yıl sütununa düşüyor?
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    if (year !== data.fiscalYear) {
      return notify(`Değerleme tarihi (${year}) aktif mali yıldan (${data.fiscalYear}) farklı`, "err");
    }
    const cellsKey = (catId) => `${catId}:${month}`;

    const newCells = { ...(data.cells || {}) };
    if (rev.totalGain > 0 && gainCatId) {
      newCells[cellsKey(gainCatId)] = (Number(newCells[cellsKey(gainCatId)]) || 0) + rev.totalGain;
    }
    if (rev.totalLoss > 0 && lossCatId) {
      newCells[cellsKey(lossCatId)] = (Number(newCells[cellsKey(lossCatId)]) || 0) + rev.totalLoss;
    }
    const newRevs = revaluations.map(x => x.id === rev.id
      ? { ...x, cashflowPosted: true, postedGainCatId: gainCatId, postedLossCatId: lossCatId, postedAt: new Date().toISOString() }
      : x);
    await onChange({ ...data, cells: newCells, revaluations: newRevs });
    await logAudit("fx_revaluation_post", {
      tarih: rev.asOfDate, ay: TR_MONTHS[month],
      kar: rev.totalGain, zarar: rev.totalLoss,
    });
    notify(`Kur farkı ${TR_MONTHS[month]} ayına yansıtıldı`);
    setPostModal(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">UFRS 21 / TFRS 21</div>
          <h1 className="display text-2xl md:text-3xl">Kur Farkı Değerlemesi</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
            Yabancı para cinsi banka hesabı ve kasaların dönem sonu değerlemesi
          </p>
        </div>
        {canManage && fxItems.length > 0 && (
          <button onClick={saveRevaluation} className="btn btn-primary">
            <Save size={13}/> Değerlemeyi Kaydet
          </button>
        )}
      </div>

      {/* Tarih ve kur ayarları */}
      <div className="card p-4 md:p-5" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="display text-lg flex items-center gap-2">
            <Calendar size={16} style={{ color: "var(--accent)" }}/>
            Tarih ve Kur Ayarları
          </h3>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={useManual} onChange={e => {
              setUseManual(e.target.checked);
              if (e.target.checked) {
                setManualRates({
                  usdRef: autoRates.usdRef?.rate || rates.USD || 0,
                  usdAt:  autoRates.usdAt?.rate  || rates.USD || 0,
                  eurRef: autoRates.eurRef?.rate || rates.EUR || 0,
                  eurAt:  autoRates.eurAt?.rate  || rates.EUR || 0,
                });
              }
            }}/>
            <span>Manuel kur gir</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="label mb-1">Referans Tarihi</div>
            <input className="input" type="date" value={refDate} onChange={e => setRefDate(e.target.value)}/>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <div className="text-xs flex justify-between" style={{ color: "var(--ink-mute)" }}>
                  <span>USD/TRY</span>
                  {!useManual && autoRates.usdRef && <span className="mono">{autoRates.usdRef.source.date}</span>}
                  {!useManual && !autoRates.usdRef && <span style={{ color: "#b91c1c" }}>kayıt yok</span>}
                </div>
                {useManual ? (
                  <input className="input num text-right" type="number" step="0.0001" value={manualRates.usdRef}
                    onChange={e => setManualRates({ ...manualRates, usdRef: Number(e.target.value) || 0 })}/>
                ) : (
                  <div className="p-2 rounded num text-right" style={{ background: "var(--bg)", fontWeight: 500 }}>
                    {(autoRates.usdRef?.rate || rates.USD || 0).toFixed(4)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs flex justify-between" style={{ color: "var(--ink-mute)" }}>
                  <span>EUR/TRY</span>
                  {!useManual && autoRates.eurRef && <span className="mono">{autoRates.eurRef.source.date}</span>}
                </div>
                {useManual ? (
                  <input className="input num text-right" type="number" step="0.0001" value={manualRates.eurRef}
                    onChange={e => setManualRates({ ...manualRates, eurRef: Number(e.target.value) || 0 })}/>
                ) : (
                  <div className="p-2 rounded num text-right" style={{ background: "var(--bg)", fontWeight: 500 }}>
                    {(autoRates.eurRef?.rate || rates.EUR || 0).toFixed(4)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="label mb-1">Değerleme Tarihi</div>
            <input className="input" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}/>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <div className="text-xs flex justify-between" style={{ color: "var(--ink-mute)" }}>
                  <span>USD/TRY</span>
                  {!useManual && autoRates.usdAt && <span className="mono">{autoRates.usdAt.source.date}</span>}
                </div>
                {useManual ? (
                  <input className="input num text-right" type="number" step="0.0001" value={manualRates.usdAt}
                    onChange={e => setManualRates({ ...manualRates, usdAt: Number(e.target.value) || 0 })}/>
                ) : (
                  <div className="p-2 rounded num text-right" style={{ background: "var(--bg)", fontWeight: 500 }}>
                    {(autoRates.usdAt?.rate || rates.USD || 0).toFixed(4)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs flex justify-between" style={{ color: "var(--ink-mute)" }}>
                  <span>EUR/TRY</span>
                  {!useManual && autoRates.eurAt && <span className="mono">{autoRates.eurAt.source.date}</span>}
                </div>
                {useManual ? (
                  <input className="input num text-right" type="number" step="0.0001" value={manualRates.eurAt}
                    onChange={e => setManualRates({ ...manualRates, eurAt: Number(e.target.value) || 0 })}/>
                ) : (
                  <div className="p-2 rounded num text-right" style={{ background: "var(--bg)", fontWeight: 500 }}>
                    {(autoRates.eurAt?.rate || rates.EUR || 0).toFixed(4)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {!useManual && (!autoRates.usdRef || !autoRates.usdAt || !autoRates.eurRef || !autoRates.eurAt) && (
          <div className="mt-3 p-2.5 rounded flex items-start gap-2 text-xs"
            style={{ background: "#fef3c7", color: "#854d0e" }}>
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0"/>
            <span>Bazı kurlar TCMB geçmişinde bulunamadı; ayarlardaki güncel kur kullanıldı. Daha hassas hesap için "Manuel kur gir" seçeneğini kullanın veya Ayarlar → TCMB üzerinden kurları çekin.</span>
          </div>
        )}
      </div>

      {/* KPI kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="label">Toplam Kambiyo Karı (646)</div>
            <TrendingUp size={14} style={{ color: "#0f766e" }}/>
          </div>
          <div className="num display text-2xl md:text-3xl" style={{ color: "#0f766e" }}>
            +{fmtTL(totalGain)} ₺
          </div>
        </div>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="label">Toplam Kambiyo Zararı (656)</div>
            <TrendingDown size={14} style={{ color: "#b91c1c" }}/>
          </div>
          <div className="num display text-2xl md:text-3xl" style={{ color: "#b91c1c" }}>
            −{fmtTL(totalLoss)} ₺
          </div>
        </div>
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="label">Net Kur Farkı</div>
            <Coins size={14} style={{ color: "var(--accent)" }}/>
          </div>
          <div className="num display text-2xl md:text-3xl" style={{ color: netDiff >= 0 ? "#0f766e" : "#b91c1c" }}>
            {fmtTLSign(netDiff)} ₺
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            {refDate} → {asOfDate}
          </div>
        </div>
      </div>

      {/* Pozisyonlar tablosu */}
      <div className="card overflow-x-auto" style={{ boxShadow: "var(--shadow)" }}>
        <table className="grid" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th className="label-cell" style={{ width: 200 }}>Hesap</th>
              <th className="label-cell" style={{ width: 60 }}>Birim</th>
              <th style={{ width: 130 }}>Bakiye</th>
              <th style={{ width: 100 }}>Ref Kur</th>
              <th style={{ width: 100 }}>Güncel Kur</th>
              <th style={{ width: 130 }}>Defter Değeri</th>
              <th style={{ width: 130 }}>Güncel Değer</th>
              <th style={{ width: 140 }}>Kur Farkı</th>
            </tr>
          </thead>
          <tbody>
            {fxItems.length === 0 ? (
              <tr><td colSpan="8" className="label-cell text-center py-10" style={{ color: "var(--ink-mute)" }}>
                <Coins size={28} className="mx-auto mb-2 opacity-50"/>
                <div>Yabancı para cinsi hesap veya kasa bulunamadı.</div>
                <div className="text-xs mt-1">Banka hesabı veya kasa eklerken USD/EUR seçmeniz gerekir.</div>
              </td></tr>
            ) : fxItems.map((it, idx) => (
              <tr key={it.type + ":" + it.id}>
                <td className="label-cell text-xs">
                  <div className="flex items-center gap-2">
                    {it.type === "bank" ? <Landmark size={11} style={{ color: it.color }}/> : <Wallet size={11} style={{ color: it.color }}/>}
                    <span className="font-medium">{it.shortName}</span>
                  </div>
                </td>
                <td className="label-cell">
                  <span className="chip" style={{ background: "var(--bg)", color: "var(--ink-soft)" }}>
                    {CURRENCY_SYMBOLS[it.currency]} {it.currency}
                  </span>
                </td>
                <td className="num text-xs font-medium">{fmtTL(it.balance)}</td>
                <td className="num text-xs mono">{it.refRate.toFixed(4)}</td>
                <td className="num text-xs mono">{it.atRate.toFixed(4)}</td>
                <td className="num text-xs">{fmtTL(it.trAtRef)} ₺</td>
                <td className="num text-xs font-medium">{fmtTL(it.trAtDate)} ₺</td>
                <td className="num text-xs font-semibold"
                  style={{ color: it.diff > 0 ? "#0f766e" : (it.diff < 0 ? "#b91c1c" : "var(--ink-mute)") }}>
                  {fmtTLSign(it.diff)} ₺
                </td>
              </tr>
            ))}
          </tbody>
          {fxItems.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--bg)", fontWeight: 600 }}>
                <td className="label-cell text-xs">TOPLAM</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td className="num text-xs">{fmtTL(fxItems.reduce((s, i) => s + i.trAtRef, 0))} ₺</td>
                <td className="num text-xs">{fmtTL(fxItems.reduce((s, i) => s + i.trAtDate, 0))} ₺</td>
                <td className="num text-xs" style={{ color: netDiff >= 0 ? "#0f766e" : "#b91c1c" }}>
                  {fmtTLSign(netDiff)} ₺
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Geçmiş değerlemeler */}
      {revaluations.length > 0 && (
        <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="display text-lg flex items-center gap-2">
              <History size={16} style={{ color: "var(--accent)" }}/>
              Geçmiş Değerlemeler ({revaluations.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="grid" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th className="label-cell" style={{ width: 110 }}>Değerleme Tarihi</th>
                  <th className="label-cell" style={{ width: 110 }}>Referans</th>
                  <th className="label-cell" style={{ width: 60 }}>Kaynak</th>
                  <th style={{ width: 110 }}>Kambiyo Karı</th>
                  <th style={{ width: 110 }}>Kambiyo Zararı</th>
                  <th style={{ width: 120 }}>Net</th>
                  <th className="label-cell" style={{ width: 130 }}>Durum</th>
                  {canManage && <th style={{ width: 130 }}></th>}
                </tr>
              </thead>
              <tbody>
                {revaluations.map(rev => (
                  <tr key={rev.id}>
                    <td className="label-cell mono text-xs font-medium">{rev.asOfDate}</td>
                    <td className="label-cell mono text-xs" style={{ color: "var(--ink-mute)" }}>{rev.refDate}</td>
                    <td className="label-cell">
                      <span className="chip" style={{ background: rev.ratesSource === "tcmb" ? "#dbeafe" : "#f3e8ff", color: rev.ratesSource === "tcmb" ? "#1d4ed8" : "#7c3aed" }}>
                        {rev.ratesSource === "tcmb" ? "TCMB" : "Manuel"}
                      </span>
                    </td>
                    <td className="num text-xs" style={{ color: "#0f766e" }}>+{fmtTL(rev.totalGain)}</td>
                    <td className="num text-xs" style={{ color: "#b91c1c" }}>−{fmtTL(rev.totalLoss)}</td>
                    <td className="num text-xs font-semibold" style={{ color: rev.netDiff >= 0 ? "#0f766e" : "#b91c1c" }}>
                      {fmtTLSign(rev.netDiff)}
                    </td>
                    <td className="label-cell">
                      {rev.cashflowPosted ? (
                        <span className="chip" style={{ background: "#dcfce7", color: "#15803d" }}>
                          <Check size={9}/> Yansıtıldı
                        </span>
                      ) : (
                        <span className="chip" style={{ background: "var(--bg)", color: "var(--ink-mute)" }}>
                          Beklemede
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          {!rev.cashflowPosted && (
                            <button onClick={() => setPostModal(rev)}
                              className="p-1.5 rounded hover:bg-blue-50" title="Nakit akışa yansıt">
                              <ArrowRightLeft size={11} style={{ color: "#1d4ed8" }}/>
                            </button>
                          )}
                          <button onClick={() => removeRevaluation(rev)}
                            className="p-1.5 rounded hover:bg-red-50" title="Sil">
                            <Trash2 size={11} style={{ color: "var(--negative)" }}/>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nakit akışa yansıtma modali */}
      {postModal && (
        <PostRevaluationModal
          rev={postModal} data={data}
          onClose={() => setPostModal(null)}
          onPost={(gainCatId, lossCatId) => postToCashflow(postModal, gainCatId, lossCatId)}
        />
      )}
    </div>
  );
}

function PostRevaluationModal({ rev, data, onClose, onPost }) {
  const [gainCatId, setGainCatId] = useState("");
  const [lossCatId, setLossCatId] = useState("");
  const dateObj = new Date(rev.asOfDate);
  const month = dateObj.getMonth();

  return (
    <Modal title="Nakit Akışa Yansıt" icon={ArrowRightLeft} maxWidth="max-w-md"
      onClose={onClose} onSave={() => onPost(gainCatId, lossCatId)} saveLabel="Yansıt">
      <div className="space-y-3">
        <div className="p-3 rounded text-xs space-y-1" style={{ background: "var(--bg)" }}>
          <div>Değerleme tarihi: <strong>{rev.asOfDate}</strong></div>
          <div>Hedef ay: <strong>{TR_MONTHS[month]} {dateObj.getFullYear()}</strong></div>
          <div className="pt-1 border-t mt-1" style={{ borderColor: "var(--line-soft)" }}>
            Kambiyo karı: <strong style={{ color: "#0f766e" }}>+{fmtTL(rev.totalGain)} ₺</strong> · Kambiyo zararı: <strong style={{ color: "#b91c1c" }}>−{fmtTL(rev.totalLoss)} ₺</strong>
          </div>
        </div>

        {rev.totalGain > 0 && (
          <div>
            <div className="label mb-1">Kambiyo Karı (646) → Tahsilat Kalemi</div>
            <select className="input" value={gainCatId} onChange={e => setGainCatId(e.target.value)}>
              <option value="">— Yansıtma —</option>
              {(data.inflows || []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {rev.totalLoss > 0 && (
          <div>
            <div className="label mb-1">Kambiyo Zararı (656) → Ödeme Kalemi</div>
            <select className="input" value={lossCatId} onChange={e => setLossCatId(e.target.value)}>
              <option value="">— Yansıtma —</option>
              {(data.outflows || []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="p-2.5 rounded flex items-start gap-2 text-xs"
          style={{ background: "#fef3c7", color: "#854d0e" }}>
          <Info size={12} className="mt-0.5 flex-shrink-0"/>
          <span>Tutarlar seçili kalemin {TR_MONTHS[month]} ayı hücresine <strong>eklenir</strong> (üzerine yazılmaz). Boş bıraktığınız taraf yansıtılmaz.</span>
        </div>
      </div>
    </Modal>
  );
}

/* =====================================================================
   BİLDİRİM AYARLARI KARTI (Ayarlar > Bildirimler)
===================================================================== */
function NotificationsCard({ data, onChange, logAudit, notify, activeCompany }) {
  const settings = data.notificationSettings || createDefaultNotificationSettings();
  const [newRecipient, setNewRecipient] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [report, setReport] = useState(null);

  const update = async (patch) => {
    const next = { ...settings, ...patch };
    await onChange({ ...data, notificationSettings: next });
  };

  const addRecipient = async () => {
    const email = newRecipient.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return notify("Geçerli e-posta adresi girin", "err");
    if (settings.recipients.includes(email)) return notify("Bu adres zaten ekli", "err");
    await update({ recipients: [...settings.recipients, email] });
    setNewRecipient("");
    await logAudit("notification_settings", { eylem: "alıcı eklendi", email });
  };

  const removeRecipient = async (email) => {
    await update({ recipients: settings.recipients.filter(r => r !== email) });
    await logAudit("notification_settings", { eylem: "alıcı silindi", email });
  };

  const generateNow = () => {
    const r = generateDailyReport(data, activeCompany, settings);
    setReport(r);
    setPreviewOpen(true);
    update({ lastGeneratedAt: new Date().toISOString() });
    logAudit("notification_send", {
      tip: "preview", gecikti: r.summary.overdueCount, yaklaşan: r.summary.dueSoonCount,
    });
  };

  const sendViaMail = () => {
    if (!report) return;
    if (settings.recipients.length === 0) return notify("Önce alıcı ekleyin", "err");
    const subject = `Prometa One Vade Raporu — ${new Date().toLocaleDateString("tr-TR")} — ${activeCompany?.name || ""}`;
    // mailto URL uzunluk sınırı (~2000 char) — özet versiyon
    const bodyShort = (report.text || "").slice(0, 1500) + "\n\n[Tam rapor uygulamada görüntülenebilir]";
    const url = `mailto:${encodeURIComponent(settings.recipients.join(","))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyShort)}`;
    window.location.href = url;
    update({ lastSentAt: new Date().toISOString() });
    logAudit("notification_send", { tip: "mailto", alıcı: settings.recipients.length });
    notify("E-posta uygulamanız açılıyor...");
  };

  const copyToClipboard = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.text);
      notify("Rapor panoya kopyalandı");
    } catch {
      notify("Kopyalama başarısız", "err");
    }
  };

  const downloadAsText = () => {
    if (!report) return;
    const blob = new Blob([report.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vade_raporu_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("Rapor indiriliyor: " + a.download);
  };

  const requestBrowserPermission = async () => {
    if (!("Notification" in window)) return notify("Tarayıcınız bildirim desteklemiyor", "err");
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      await update({ browserNotifyEnabled: true });
      notify("Tarayıcı bildirimleri etkin");
      new Notification("Prometa One", {
        body: "Bildirimler etkinleştirildi. Sayfayı açtığınızda kritik alarmları göreceksiniz.",
        icon: "/favicon.ico",
      });
    } else {
      notify("Bildirim izni verilmedi", "err");
    }
  };

  // Kritik durumda anlık tarayıcı bildirimi
  useEffect(() => {
    if (!settings.browserNotifyEnabled || !settings.enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const r = generateDailyReport(data, activeCompany, settings);
    if (r.summary.overdueCount > 0) {
      // Aynı raporu sürekli tekrar göndermemek için: günde bir kere
      const todayKey = new Date().toISOString().slice(0, 10);
      const lastShown = localStorage.getItem("promet_notif_last");
      if (lastShown !== todayKey) {
        new Notification("⚠️ Vade Uyarısı — Prometa One", {
          body: `${r.summary.overdueCount} fatura vadesi geçti (toplam ${fmtTL(r.summary.overdueTotal)} ₺)`,
        });
        localStorage.setItem("promet_notif_last", todayKey);
      }
    }
  }, [settings.enabled, settings.browserNotifyEnabled, data.invoices]);

  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="display text-xl flex items-center gap-2">
            <Mail size={18} style={{ color: "var(--accent)" }}/>
            E-posta Bildirimleri
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            Vadesi yaklaşan ve geciken faturalar için günlük rapor
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>Etkin</span>
          <span className="w-9 h-5 rounded-full relative transition-colors"
            style={{ background: settings.enabled ? "var(--accent)" : "#cbd5e1" }}>
            <input type="checkbox" checked={settings.enabled} className="opacity-0 absolute inset-0 cursor-pointer"
              onChange={e => update({ enabled: e.target.checked })}/>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: settings.enabled ? "19px" : "2px" }}/>
          </span>
        </label>
      </div>

      {/* Backend bilgilendirmesi */}
      <div className="p-2.5 rounded text-xs mb-4 flex items-start gap-2"
        style={{ background: "#dbeafe", color: "#1e3a8a" }}>
        <Info size={12} className="mt-0.5 flex-shrink-0"/>
        <span>
          <strong>Mevcut sürüm:</strong> Manuel tetikleme + tarayıcı bildirimi (sayfa açıkken). Backend (Supabase) bağlandığında
          otomatik günlük cron tetiklemesi ve gerçek e-posta gönderimi devreye girer.
        </span>
      </div>

      {/* Alıcılar */}
      <div className="mb-4">
        <div className="label mb-1.5">Alıcılar</div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {settings.recipients.map(email => (
            <span key={email} className="chip flex items-center gap-1.5"
              style={{ background: "var(--bg)", color: "var(--ink)" }}>
              <Mail size={10}/>
              <span>{email}</span>
              <button onClick={() => removeRecipient(email)} className="opacity-50 hover:opacity-100">
                <X size={10}/>
              </button>
            </span>
          ))}
          {settings.recipients.length === 0 && (
            <span className="text-xs" style={{ color: "var(--ink-mute)" }}>Henüz alıcı yok</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="email" className="input text-xs flex-1" placeholder="ornek@sirket.com.tr"
            value={newRecipient} onChange={e => setNewRecipient(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addRecipient(); }}/>
          <button onClick={addRecipient} className="btn btn-ghost text-xs">
            <Plus size={11}/> Ekle
          </button>
        </div>
      </div>

      {/* Rapor içerik ayarları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-xs">
        <NotifToggle label="Vadesi geçenler" checked={settings.includeOverdue} onChange={v => update({ includeOverdue: v })}/>
        <NotifToggle label="Yaklaşan vade" checked={settings.includeDueSoon} onChange={v => update({ includeDueSoon: v })}/>
        <NotifToggle label="30 günlük özet" checked={settings.includeUpcoming30} onChange={v => update({ includeUpcoming30: v })}/>
        <NotifToggle label="Nakit pozisyonu" checked={settings.includeCashPosition} onChange={v => update({ includeCashPosition: v })}/>
        <NotifToggle label="FX pozisyonlar" checked={settings.includeFxPositions} onChange={v => update({ includeFxPositions: v })}/>
        <div className="flex items-center gap-2 p-2 rounded" style={{ background: "var(--bg)" }}>
          <span>Vade eşiği (gün):</span>
          <input type="number" min="1" max="30" className="input num text-right text-xs" style={{ width: 60 }}
            value={settings.alertThresholdDays}
            onChange={e => update({ alertThresholdDays: Math.max(1, Math.min(30, Number(e.target.value) || 7)) })}/>
        </div>
      </div>

      {/* Tarayıcı bildirimi */}
      <div className="p-3 rounded mb-4 flex items-center gap-3" style={{ background: "var(--bg)" }}>
        <BellRing size={16} style={{ color: settings.browserNotifyEnabled ? "var(--accent)" : "var(--ink-mute)" }}/>
        <div className="flex-1">
          <div className="text-sm font-medium">Tarayıcı Bildirimleri</div>
          <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Sayfa açıkken vadesi geçen faturalar için anlık uyarı (günde bir kez)
          </div>
        </div>
        {settings.browserNotifyEnabled ? (
          <span className="chip" style={{ background: "#dcfce7", color: "#15803d" }}>
            <Check size={9}/> Aktif
          </span>
        ) : (
          <button onClick={requestBrowserPermission} className="btn btn-ghost text-xs">
            <Bell size={11}/> Etkinleştir
          </button>
        )}
      </div>

      {/* Aksiyon butonları */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={generateNow} className="btn btn-primary">
          <FileText size={13}/> Bugünkü Raporu Üret
        </button>
        {settings.lastGeneratedAt && (
          <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Son: {new Date(settings.lastGeneratedAt).toLocaleString("tr-TR")}
          </span>
        )}
      </div>

      {/* Önizleme modali */}
      {previewOpen && report && (
        <Modal title="Vade Raporu Önizleme" icon={Mail} maxWidth="max-w-2xl"
          onClose={() => setPreviewOpen(false)}
          onSave={sendViaMail}
          saveLabel={settings.recipients.length > 0 ? `Mail Gönder (${settings.recipients.length})` : "Alıcı ekleyin"}>
          <div className="space-y-3">
            {/* Hızlı butonlar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={copyToClipboard} className="btn btn-ghost text-xs">
                <ClipboardCopy size={12}/> Panoya Kopyala
              </button>
              <button onClick={downloadAsText} className="btn btn-ghost text-xs">
                <Download size={12}/> .txt İndir
              </button>
            </div>

            {/* Özet kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded text-center" style={{ background: report.summary.overdueCount > 0 ? "#fee2e2" : "var(--bg)" }}>
                <div style={{ color: report.summary.overdueCount > 0 ? "#b91c1c" : "var(--ink-mute)" }}>Geciken</div>
                <div className="display text-lg num" style={{ color: report.summary.overdueCount > 0 ? "#b91c1c" : "var(--ink)" }}>
                  {report.summary.overdueCount}
                </div>
                {report.summary.overdueCount > 0 && (
                  <div className="text-xs" style={{ color: "#b91c1c" }}>{fmtTL(report.summary.overdueTotal)} ₺</div>
                )}
              </div>
              <div className="p-2 rounded text-center" style={{ background: report.summary.dueSoonCount > 0 ? "#fef3c7" : "var(--bg)" }}>
                <div style={{ color: report.summary.dueSoonCount > 0 ? "#854d0e" : "var(--ink-mute)" }}>Yaklaşan</div>
                <div className="display text-lg num" style={{ color: report.summary.dueSoonCount > 0 ? "#854d0e" : "var(--ink)" }}>
                  {report.summary.dueSoonCount}
                </div>
                {report.summary.dueSoonCount > 0 && (
                  <div className="text-xs" style={{ color: "#854d0e" }}>{fmtTL(report.summary.dueSoonTotal)} ₺</div>
                )}
              </div>
              <div className="p-2 rounded text-center" style={{ background: "var(--bg)" }}>
                <div style={{ color: "var(--ink-mute)" }}>30 Gün</div>
                <div className="display text-lg num">{report.summary.upcoming30Count}</div>
              </div>
              <div className="p-2 rounded text-center" style={{ background: "var(--bg)" }}>
                <div style={{ color: "var(--ink-mute)" }}>Nakit</div>
                <div className="display text-lg num">{fmtTL(report.summary.cashTotal)}</div>
                <div className="text-xs" style={{ color: "var(--ink-mute)" }}>₺</div>
              </div>
            </div>

            {/* Düz metin önizleme */}
            <div className="p-3 rounded font-mono text-xs whitespace-pre-wrap" style={{
              background: "#1a1a1a", color: "#e5e7eb", maxHeight: 400, overflowY: "auto",
              fontSize: 10.5, lineHeight: 1.4,
            }}>
              {report.text}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NotifToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: "var(--bg)" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/>
      <span>{label}</span>
    </label>
  );
}

/* =====================================================================
   ÇOKLU YIL ARŞİV KARTI (Ayarlar > Mali Yıllar)
===================================================================== */
function YearArchiveCard({ data, onChange, logAudit, notify }) {
  const archives = (data.archives || []).slice().sort((a, b) => b.fiscalYear - a.fiscalYear);
  const [closeModal, setCloseModal] = useState(false);
  const [viewArchive, setViewArchive] = useState(null);

  const handleCloseYear = async (options) => {
    const nextData = archiveAndAdvanceYear(data, options);
    await onChange(nextData);
    await logAudit("year_archive", {
      arşivlenen: data.fiscalYear,
      yeni: options.newFiscalYear,
      kapanış_nakdi: computeYearClosingCash(data),
    });
    notify(`${data.fiscalYear} mali yılı arşivlendi, ${options.newFiscalYear} yılına geçildi`);
    setCloseModal(false);
  };

  const handleDeleteArchive = async (fiscalYear) => {
    if (!confirm(`${fiscalYear} mali yıl arşivini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    const next = { ...data, archives: archives.filter(a => a.fiscalYear !== fiscalYear) };
    await onChange(next);
    await logAudit("year_archive_delete", { yıl: fiscalYear });
    notify(`${fiscalYear} arşivi silindi`);
  };

  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="display text-xl flex items-center gap-2">
            <Calendar size={18} style={{ color: "var(--accent)" }}/>
            Mali Yıllar
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            Geçmiş mali yılları arşivleyin, AI tahmin için tarihsel veriyi zenginleştirin
          </p>
        </div>
        <button onClick={() => setCloseModal(true)} className="btn btn-primary">
          <FileCheck size={13}/> Yıl Sonu Kapanışı
        </button>
      </div>

      {/* Mevcut yıl özeti */}
      <div className="p-3 rounded mb-4" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="label">Aktif Mali Yıl</div>
            <div className="display text-2xl flex items-center gap-2">
              {data.fiscalYear}
              <span className="chip" style={{ background: "#dcfce7", color: "#15803d", fontSize: 9 }}>Aktif</span>
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Başlangıç: {TR_MONTHS[data.fiscalStartMonth]} · Açılış: {fmtTL(data.openingCash)} ₺
            </div>
          </div>
          <div className="text-right">
            <div className="label">Tahmini Kapanış Nakdi</div>
            <div className="num display text-xl">{fmtTLSign(computeYearClosingCash(data))} ₺</div>
          </div>
        </div>
      </div>

      {/* Arşivlenmiş yıllar */}
      {archives.length === 0 ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--ink-mute)" }}>
          <Calendar size={28} className="mx-auto mb-2 opacity-40"/>
          Henüz arşivlenmiş yıl yok.
          <div className="mt-1">İlk yıl sonu kapanışınızı yapın — AI Tahmin tarihsel veriden faydalanır.</div>
        </div>
      ) : (
        <div>
          <div className="label mb-2">Arşivlenmiş Yıllar ({archives.length})</div>
          <div className="space-y-2">
            {archives.map(arch => {
              const totalIn = (arch.inflows || []).reduce((s, c) =>
                s + Array(12).fill(0).reduce((a, _, i) => a + Number((arch.cells || {})[`${c.id}:${i}`] || 0), 0), 0);
              const totalOut = (arch.outflows || []).reduce((s, c) =>
                s + Array(12).fill(0).reduce((a, _, i) => a + Number((arch.cells || {})[`${c.id}:${i}`] || 0), 0), 0);
              return (
                <div key={arch.fiscalYear} className="p-3 rounded flex items-center gap-3 flex-wrap"
                  style={{ background: "var(--paper)", border: "1px solid var(--line-soft)" }}>
                  <div className="flex items-center gap-2">
                    <span className="display text-xl">{arch.fiscalYear}</span>
                    <span className="chip" style={{ background: "#ede9fe", color: "#7c3aed", fontSize: 9 }}>Arşiv</span>
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span style={{ color: "var(--ink-mute)" }}>Açılış:</span>{" "}
                      <span className="num">{fmtTL(arch.openingCash)} ₺</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--ink-mute)" }}>Kapanış:</span>{" "}
                      <span className="num font-medium">{fmtTLSign(arch.closingCash)} ₺</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--ink-mute)" }}>Toplam Tahsilat:</span>{" "}
                      <span className="num" style={{ color: "#0f766e" }}>{fmtTL(totalIn)} ₺</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--ink-mute)" }}>Toplam Ödeme:</span>{" "}
                      <span className="num" style={{ color: "#b91c1c" }}>{fmtTL(totalOut)} ₺</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewArchive(arch)} className="btn btn-ghost text-xs" title="Görüntüle">
                      <Eye size={11}/>
                    </button>
                    <button onClick={() => handleDeleteArchive(arch.fiscalYear)} className="btn btn-ghost text-xs" title="Sil"
                      style={{ color: "var(--negative)" }}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RDBMS uyumluluk notu */}
      <div className="mt-4 p-2.5 rounded text-xs flex items-start gap-2"
        style={{ background: "#fef3c7", color: "#854d0e" }}>
        <Info size={12} className="mt-0.5 flex-shrink-0"/>
        <span>
          <strong>Backend uyumluluğu:</strong> Her arşiv standalone JSON snapshot olarak saklanır.
          Kendi sunucunuzda <code>year_archives</code> tablosuna (company_id, fiscal_year, snapshot JSONB)
          olarak doğrudan map'lenebilir.
        </span>
      </div>

      {closeModal && (
        <CloseYearModal data={data}
          onClose={() => setCloseModal(false)}
          onConfirm={handleCloseYear}/>
      )}

      {viewArchive && (
        <ArchiveViewerModal archive={viewArchive} onClose={() => setViewArchive(null)}/>
      )}
    </div>
  );
}

/* =====================================================================
   YIL SONU KAPANIŞ MODALI
===================================================================== */
function CloseYearModal({ data, onClose, onConfirm }) {
  const closingCash = useMemo(() => computeYearClosingCash(data), [data]);
  const [form, setForm] = useState({
    newFiscalYear: data.fiscalYear + 1,
    newFiscalStartMonth: data.fiscalStartMonth,
    newOpeningCash: closingCash.toFixed(2),
    carryCategories: true,
    clearCells: true,
  });

  const handleSave = () => {
    if (!form.newFiscalYear || form.newFiscalYear <= data.fiscalYear) {
      return alert("Yeni mali yıl, mevcut yıldan büyük olmalı");
    }
    if ((data.archives || []).some(a => a.fiscalYear === data.fiscalYear)) {
      return alert("Bu mali yıl zaten arşivlenmiş");
    }
    onConfirm({
      newFiscalYear: Number(form.newFiscalYear),
      newFiscalStartMonth: Number(form.newFiscalStartMonth),
      newOpeningCash: Number(form.newOpeningCash) || 0,
      carryCategories: form.carryCategories,
      clearCells: form.clearCells,
    });
  };

  return (
    <Modal title="Yıl Sonu Kapanışı" icon={FileCheck} maxWidth="max-w-xl"
      onClose={onClose} onSave={handleSave} saveLabel="Onayla ve Arşivle">
      <div className="space-y-4">
        <div className="p-3 rounded text-sm" style={{ background: "#fef3c7", color: "#854d0e" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0"/>
            <div>
              <strong>{data.fiscalYear}</strong> mali yılı arşivlenecek ve <strong>{form.newFiscalYear}</strong>{" "}
              yılına geçilecek. Nakit akış tablosundaki tüm hücreler temizlenir (arşivde korunur).
              Bankalar, kasa, faturalar ve transferler etkilenmez.
              <div className="mt-1.5"><strong>Bu işlem geri alınamaz.</strong></div>
            </div>
          </div>
        </div>

        {/* Mevcut yıl özeti */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
            <div className="label">Arşivlenecek Yıl</div>
            <div className="display text-2xl">{data.fiscalYear}</div>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
              Başlangıç: {TR_MONTHS[data.fiscalStartMonth]}
            </div>
          </div>
          <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
            <div className="label">Tahmini Kapanış Nakdi</div>
            <div className="num display text-2xl" style={{ color: closingCash >= 0 ? "#0f766e" : "#b91c1c" }}>
              {fmtTLSign(closingCash)}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>₺</div>
          </div>
        </div>

        {/* Yeni yıl ayarları */}
        <div>
          <div className="label mb-2">Yeni Mali Yıl Ayarları</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--ink-mute)" }}>Yeni Yıl</div>
              <input type="number" className="input num text-right" min={data.fiscalYear + 1}
                value={form.newFiscalYear}
                onChange={e => setForm({ ...form, newFiscalYear: e.target.value })}/>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--ink-mute)" }}>Başlangıç Ayı</div>
              <select className="input" value={form.newFiscalStartMonth}
                onChange={e => setForm({ ...form, newFiscalStartMonth: e.target.value })}>
                {TR_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <div className="text-xs mb-1" style={{ color: "var(--ink-mute)" }}>
                Yeni Açılış Nakdi
                <span className="ml-1 opacity-70">(varsayılan: önceki yıl kapanışı)</span>
              </div>
              <input type="number" step="0.01" className="input num text-right"
                value={form.newOpeningCash}
                onChange={e => setForm({ ...form, newOpeningCash: e.target.value })}/>
            </div>
          </div>
        </div>

        {/* Seçenekler */}
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: "var(--bg)" }}>
            <input type="checkbox" checked={form.carryCategories}
              onChange={e => setForm({ ...form, carryCategories: e.target.checked })}/>
            <span>Kategorileri yeni yıla taşı <span className="text-xs" style={{ color: "var(--ink-mute)" }}>(önerilen)</span></span>
          </label>
          <label className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: "var(--bg)" }}>
            <input type="checkbox" checked={form.clearCells}
              onChange={e => setForm({ ...form, clearCells: e.target.checked })}/>
            <span>Hücreleri temizle <span className="text-xs" style={{ color: "var(--ink-mute)" }}>(önerilen — yeni yıl sıfırdan başlar)</span></span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

/* =====================================================================
   ARŞİV GÖRÜNTÜLEYİCİ — Geçmiş yılın nakit akış tablosu (salt okunur)
===================================================================== */
function ArchiveViewerModal({ archive, onClose }) {
  const monthLabels = [];
  for (let i = 0; i < 12; i++) {
    monthLabels.push(TR_MONTHS[(archive.fiscalStartMonth + i) % 12]);
  }

  const inflowTotals = Array(12).fill(0);
  const outflowTotals = Array(12).fill(0);
  const nonPnlTotals = Array(12).fill(0);
  (archive.inflows || []).forEach(c => {
    for (let i = 0; i < 12; i++) inflowTotals[i] += Number((archive.cells || {})[`${c.id}:${i}`] || 0);
  });
  (archive.outflows || []).forEach(c => {
    for (let i = 0; i < 12; i++) outflowTotals[i] += Number((archive.cells || {})[`${c.id}:${i}`] || 0);
  });
  (archive.nonPnlOutflows || []).forEach(c => {
    for (let i = 0; i < 12; i++) nonPnlTotals[i] += Number((archive.cells || {})[`${c.id}:${i}`] || 0);
  });

  const beginCash = Array(12).fill(0);
  const endCash = Array(12).fill(0);
  let running = Number(archive.openingCash) || 0;
  for (let i = 0; i < 12; i++) {
    beginCash[i] = running;
    running = running + inflowTotals[i] - outflowTotals[i] - nonPnlTotals[i];
    endCash[i] = running;
  }

  const totalIn = inflowTotals.reduce((a, b) => a + b, 0);
  const totalOut = outflowTotals.reduce((a, b) => a + b, 0);
  const totalNonPnl = nonPnlTotals.reduce((a, b) => a + b, 0);

  return (
    <Modal title={`${archive.fiscalYear} Mali Yılı Arşivi`} icon={Eye} maxWidth="max-w-5xl" onClose={onClose}>
      <div className="space-y-3">
        <div className="p-2 rounded text-xs flex items-center gap-2" style={{ background: "#ede9fe", color: "#5b21b6" }}>
          <Eye size={12}/>
          <span>
            Salt okunur arşiv görüntüleyici · Arşivleme tarihi: {new Date(archive.archivedAt).toLocaleString("tr-TR")}
          </span>
        </div>

        {/* Özet KPI'lar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
            <div className="label">Açılış</div>
            <div className="num display text-lg">{fmtTL(archive.openingCash)} ₺</div>
          </div>
          <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
            <div className="label">Toplam Tahsilat</div>
            <div className="num display text-lg" style={{ color: "#0f766e" }}>{fmtTL(totalIn)} ₺</div>
          </div>
          <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
            <div className="label">Toplam Ödeme</div>
            <div className="num display text-lg" style={{ color: "#b91c1c" }}>{fmtTL(totalOut + totalNonPnl)} ₺</div>
          </div>
          <div className="p-3 rounded" style={{ background: "var(--bg)" }}>
            <div className="label">Kapanış</div>
            <div className="num display text-lg" style={{ color: archive.closingCash >= 0 ? "#0f766e" : "#b91c1c" }}>
              {fmtTLSign(archive.closingCash)} ₺
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="card overflow-x-auto" style={{ maxHeight: 500 }}>
          <table className="grid text-xs">
            <thead>
              <tr>
                <th className="label-cell" style={{ minWidth: 200 }}>Kalem</th>
                {monthLabels.map(m => <th key={m}>{m}</th>)}
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "#dbeafe" }}>
                <td className="label-cell font-medium">Dönem Başı Nakit</td>
                {beginCash.map((v, i) => <td key={i} className="num">{v ? fmtTL(v) : "—"}</td>)}
                <td className="num">{fmtTL(archive.openingCash)}</td>
              </tr>
              <tr className="section-head">
                <td colSpan={14} className="label-cell">Tahsil Edilen Nakit</td>
              </tr>
              {(archive.inflows || []).map(cat => {
                const rt = Array(12).fill(0).reduce((a, _, i) => a + Number((archive.cells || {})[`${cat.id}:${i}`] || 0), 0);
                return (
                  <tr key={cat.id}>
                    <td className="label-cell">{cat.name}</td>
                    {Array(12).fill(0).map((_, i) => {
                      const v = Number((archive.cells || {})[`${cat.id}:${i}`]) || 0;
                      return <td key={i} className="num" style={{ color: v ? "var(--ink)" : "var(--ink-mute)" }}>{v ? fmtTL(v) : "—"}</td>;
                    })}
                    <td className="num font-medium">{rt ? fmtTL(rt) : "—"}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "var(--bg)" }}>
                <td className="label-cell font-medium">Toplam Tahsilat</td>
                {inflowTotals.map((v, i) => <td key={i} className="num font-medium">{v ? fmtTL(v) : "—"}</td>)}
                <td className="num font-medium" style={{ color: "#0f766e" }}>{fmtTL(totalIn)}</td>
              </tr>
              <tr className="section-head">
                <td colSpan={14} className="label-cell">Ödenen Nakit</td>
              </tr>
              {(archive.outflows || []).map(cat => {
                const rt = Array(12).fill(0).reduce((a, _, i) => a + Number((archive.cells || {})[`${cat.id}:${i}`] || 0), 0);
                return (
                  <tr key={cat.id}>
                    <td className="label-cell">{cat.name}</td>
                    {Array(12).fill(0).map((_, i) => {
                      const v = Number((archive.cells || {})[`${cat.id}:${i}`]) || 0;
                      return <td key={i} className="num" style={{ color: v ? "var(--ink)" : "var(--ink-mute)" }}>{v ? fmtTL(v) : "—"}</td>;
                    })}
                    <td className="num font-medium">{rt ? fmtTL(rt) : "—"}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "var(--bg)" }}>
                <td className="label-cell font-medium">Toplam Ödeme</td>
                {outflowTotals.map((v, i) => <td key={i} className="num font-medium">{v ? fmtTL(v) : "—"}</td>)}
                <td className="num font-medium" style={{ color: "#b91c1c" }}>{fmtTL(totalOut)}</td>
              </tr>
              {(archive.nonPnlOutflows || []).length > 0 && (
                <>
                  <tr className="section-head">
                    <td colSpan={14} className="label-cell">Ödenen Nakit (Kar/Zarar Harici)</td>
                  </tr>
                  {(archive.nonPnlOutflows || []).map(cat => {
                    const rt = Array(12).fill(0).reduce((a, _, i) => a + Number((archive.cells || {})[`${cat.id}:${i}`] || 0), 0);
                    return (
                      <tr key={cat.id}>
                        <td className="label-cell">{cat.name}</td>
                        {Array(12).fill(0).map((_, i) => {
                          const v = Number((archive.cells || {})[`${cat.id}:${i}`]) || 0;
                          return <td key={i} className="num" style={{ color: v ? "var(--ink)" : "var(--ink-mute)" }}>{v ? fmtTL(v) : "—"}</td>;
                        })}
                        <td className="num font-medium">{rt ? fmtTL(rt) : "—"}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "var(--bg)" }}>
                    <td className="label-cell font-medium">Toplam K/Z Harici</td>
                    {nonPnlTotals.map((v, i) => <td key={i} className="num font-medium">{v ? fmtTL(v) : "—"}</td>)}
                    <td className="num font-medium">{fmtTL(totalNonPnl)}</td>
                  </tr>
                </>
              )}
              <tr style={{ background: "#dbeafe", borderTop: "2px solid #93c5fd" }}>
                <td className="label-cell font-medium">Ay Sonu Nakit</td>
                {endCash.map((v, i) => (
                  <td key={i} className="num font-medium" style={{ color: v < 0 ? "var(--negative)" : "var(--ink)" }}>
                    {fmtTLSign(v)}
                  </td>
                ))}
                <td className="num font-medium" style={{ color: archive.closingCash < 0 ? "var(--negative)" : "var(--ink)" }}>
                  {fmtTLSign(archive.closingCash)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/* =====================================================================
   AI TAHMİN — Gelecek Ay Nakit Akış Projeksiyonu
===================================================================== */
function AiPredictionView({ data, session }) {
  const [horizonMonths, setHorizonMonths] = useState(3); // 1, 3, 6 ay

  // Mevcut ay: son veri girilen ay
  const currentMonth = useMemo(() => {
    const cells = data.cells || {};
    let last = -1;
    [...(data.inflows || []), ...(data.outflows || []), ...(data.nonPnlOutflows || [])].forEach(cat => {
      for (let i = 0; i < 12; i++) {
        if (Number(cells[`${cat.id}:${i}`]) > 0 && i > last) last = i;
      }
    });
    // Hiç veri yoksa current = -1 (12 ay tahmin)
    return last;
  }, [data.cells, data.inflows, data.outflows, data.nonPnlOutflows]);

  const futureMonths = Math.min(11 - currentMonth, horizonMonths);

  // Her kategori için historical (çoklu yıl) + prediction
  const archiveYearCount = (data.archives || []).length;
  const predictions = useMemo(() => {
    const result = { inflows: [], outflows: [] };
    ["inflows", "outflows"].forEach(section => {
      (data[section] || []).forEach(cat => {
        // Çoklu yıl: arşivlerden + mevcut yıldan birleşik zaman serisi
        const historical = buildCrossYearHistory(cat, data, currentMonth);
        // Sadece pozitif veri varsa (en az 1 dolu ay)
        const nonZero = historical.filter(v => v > 0).length;
        if (nonZero === 0) return;
        const pred = predictTimeSeries(historical, futureMonths);
        result[section].push({
          id: cat.id, name: cat.name, historical,
          historicalLength: historical.length,
          predicted: pred.values,
          lower: pred.lower, upper: pred.upper,
          r2: pred.r2, confidence: pred.confidence, trend: pred.trend,
          totalPredicted: pred.values.reduce((a, b) => a + b, 0),
          mean: pred.mean,
        });
      });
    });
    // Tutara göre sırala (en büyük tahminler önce)
    result.inflows.sort((a, b) => b.totalPredicted - a.totalPredicted);
    result.outflows.sort((a, b) => b.totalPredicted - a.totalPredicted);
    return result;
  }, [data, currentMonth, futureMonths]);

  // Genel toplam tahmin
  const totalPredictedInflow = predictions.inflows.reduce((s, c) =>
    s + c.predicted.reduce((a, b) => a + b, 0), 0);
  const totalPredictedOutflow = predictions.outflows.reduce((s, c) =>
    s + c.predicted.reduce((a, b) => a + b, 0), 0);

  // Tahmin edilen ay sonu nakit pozisyonu
  const projectedCash = useMemo(() => {
    if (currentMonth < 0) return Array(futureMonths).fill(0);
    const c = computeCashflow(data);
    let running = c.endCash[currentMonth]; // şu anki bilinen ay sonu
    const result = [];
    for (let f = 0; f < futureMonths; f++) {
      const inflowSum = predictions.inflows.reduce((s, cat) => s + (cat.predicted[f] || 0), 0);
      const outflowSum = predictions.outflows.reduce((s, cat) => s + (cat.predicted[f] || 0), 0);
      running = running + inflowSum - outflowSum;
      result.push(running);
    }
    return result;
  }, [predictions, currentMonth, futureMonths, data]);

  const baseCompute = useMemo(() => computeCashflow(data), [data]);

  // Grafik: historical + tahmini birleştir
  const chartData = useMemo(() => {
    const labels = baseCompute.monthLabels;
    const out = [];
    for (let i = 0; i < 12; i++) {
      const point = { ay: labels[i] };
      if (i <= currentMonth) {
        point.Gerçek = Math.round(baseCompute.endCash[i]);
      } else if (i - currentMonth - 1 < futureMonths) {
        point.Tahmin = Math.round(projectedCash[i - currentMonth - 1]);
      }
      out.push(point);
    }
    return out;
  }, [currentMonth, futureMonths, projectedCash, baseCompute]);

  if (currentMonth < 0) {
    return (
      <div className="space-y-4">
        <div>
          <div className="label mb-1">Makine Öğrenmesi Projeksiyonu</div>
          <h1 className="display text-2xl md:text-3xl">AI Tahmin</h1>
        </div>
        <div className="card p-8 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <Sparkles size={36} className="mx-auto mb-3 opacity-50" style={{ color: "var(--accent)" }}/>
          <h3 className="display text-lg mb-2">Tahmin için yeterli veri yok</h3>
          <p className="text-sm" style={{ color: "var(--ink-mute)" }}>
            Tahmin algoritması için Nakit Akış Tablosunda en az 2 dolu ay verisi gerekir.
            Hücrelere değer girdikten sonra burası canlanır.
          </p>
        </div>
      </div>
    );
  }

  const insufficientData = predictions.inflows.length + predictions.outflows.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="label mb-1">Makine Öğrenmesi Projeksiyonu</div>
          <h1 className="display text-2xl md:text-3xl flex items-center gap-2">
            <Sparkles size={24} style={{ color: "var(--accent)" }}/>
            AI Tahmin
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-mute)" }}>
            Geçmiş aylık veriden trend, hareketli ortalama ve üstel düzeltme ile gelecek aylar projeksiyonu
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded text-xs" style={{ background: "var(--bg)" }}>
          <span style={{ color: "var(--ink-mute)" }} className="px-2">Ufuk:</span>
          {[1, 3, 6].map(h => {
            const max = 11 - currentMonth;
            const disabled = h > max;
            return (
              <button key={h} onClick={() => !disabled && setHorizonMonths(h)} disabled={disabled}
                className="px-3 py-1 rounded font-medium transition-colors"
                style={{
                  background: horizonMonths === h ? "var(--accent)" : "transparent",
                  color: horizonMonths === h ? "#f5f3ef" : (disabled ? "#ccc" : "var(--ink-mute)"),
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}>{h} Ay</button>
            );
          })}
        </div>
      </div>

      {/* Mevcut durum bilgi bandı */}
      <div className="card p-3 flex items-center gap-3 text-xs flex-wrap" style={{ background: "#ede9fe", color: "#5b21b6", boxShadow: "var(--shadow)" }}>
        <Sparkles size={14}/>
        <span>Şu anki ay: <strong>{baseCompute.monthLabels[currentMonth]}</strong></span>
        <span>·</span>
        <span>Tahmin ufku: <strong>{futureMonths} ay</strong> ({baseCompute.monthLabels[currentMonth + 1]}{futureMonths > 1 ? ` → ${baseCompute.monthLabels[currentMonth + futureMonths]}` : ""})</span>
        <span>·</span>
        {archiveYearCount > 0 ? (
          <span style={{ background: "#7c3aed", color: "white", padding: "1px 8px", borderRadius: 10, fontSize: 10 }}>
            <strong>{archiveYearCount + 1} yıl veri</strong> kullanılıyor ({archiveYearCount * 12 + currentMonth + 1} ay)
          </span>
        ) : (
          <span style={{ background: "#fef3c7", color: "#854d0e", padding: "1px 8px", borderRadius: 10, fontSize: 10 }}>
            <strong>Tek yıl verisi</strong> · Arşivleyerek tahmini güçlendirin
          </span>
        )}
        <span>·</span>
        <span>Algoritma: <strong>Doğrusal regresyon + 3 aylık MA + üstel düzeltme</strong></span>
      </div>

      {insufficientData ? (
        <div className="card p-8 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <AlertCircle size={28} className="mx-auto mb-2 opacity-40"/>
          <div>Kategorilerde tahmin yapılacak veri bulunamadı.</div>
        </div>
      ) : (
        <>
          {/* Üst özet kartlar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="card p-5" style={{ boxShadow: "var(--shadow)", borderLeft: "3px solid #0f766e" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="label">Tahmini Tahsilat ({futureMonths} ay)</div>
                <TrendingUp size={14} style={{ color: "#0f766e" }}/>
              </div>
              <div className="num display text-2xl" style={{ color: "#0f766e" }}>
                {fmtTL(totalPredictedInflow)} ₺
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Aylık ort: {fmtTL(totalPredictedInflow / futureMonths)} ₺
              </div>
            </div>
            <div className="card p-5" style={{ boxShadow: "var(--shadow)", borderLeft: "3px solid #b91c1c" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="label">Tahmini Ödeme ({futureMonths} ay)</div>
                <TrendingDown size={14} style={{ color: "#b91c1c" }}/>
              </div>
              <div className="num display text-2xl" style={{ color: "#b91c1c" }}>
                {fmtTL(totalPredictedOutflow)} ₺
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                Aylık ort: {fmtTL(totalPredictedOutflow / futureMonths)} ₺
              </div>
            </div>
            <div className="card p-5" style={{ boxShadow: "var(--shadow)", borderLeft: `3px solid ${projectedCash[projectedCash.length - 1] >= 0 ? "#0f766e" : "#b91c1c"}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="label">Tahmini Ay Sonu Nakit</div>
                <Coins size={14} style={{ color: "var(--accent)" }}/>
              </div>
              <div className="num display text-2xl"
                style={{ color: projectedCash[projectedCash.length - 1] >= 0 ? "#0f766e" : "#b91c1c" }}>
                {fmtTLSign(projectedCash[projectedCash.length - 1])} ₺
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                {baseCompute.monthLabels[currentMonth + futureMonths]} sonu
              </div>
            </div>
          </div>

          {/* Çizgi grafik */}
          <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="display text-lg">Nakit Pozisyonu — Gerçek vs Tahmin</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: "#0f766e" }}/> Gerçekleşen</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded border-dashed border-t" style={{ borderColor: "#7c3aed", height: 0 }}/><Sparkles size={9} style={{ color: "#7c3aed" }}/> AI Tahmin</span>
              </div>
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#d9d3c7" vertical={false}/>
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: "#8a8580" }} axisLine={false} tickLine={false}
                    tickFormatter={v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "K")}/>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d9d3c7", borderRadius: 3, fontSize: 11 }}
                    formatter={(v) => fmtTLSign(v) + " ₺"}/>
                  <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="2 2"/>
                  <Line type="monotone" dataKey="Gerçek" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false}/>
                  <Line type="monotone" dataKey="Tahmin" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4 }} connectNulls={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Kategori bazında tahminler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PredictionSection title="Tahsilat Kalemleri (Tahmin)" color="#0f766e" icon={ArrowDownToLine}
              items={predictions.inflows} futureMonths={futureMonths} currentMonth={currentMonth} monthLabels={baseCompute.monthLabels}/>
            <PredictionSection title="Ödeme Kalemleri (Tahmin)" color="#b91c1c" icon={ArrowUpFromLine}
              items={predictions.outflows} futureMonths={futureMonths} currentMonth={currentMonth} monthLabels={baseCompute.monthLabels}/>
          </div>

          {/* Metodoloji */}
          <div className="card p-4" style={{ boxShadow: "var(--shadow)", background: "var(--bg)" }}>
            <div className="flex items-start gap-2.5">
              <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}/>
              <div className="text-xs space-y-1.5">
                <div><strong>Algoritma:</strong> Üç yöntemin r²-ağırlıklı birleşimi (ensemble)</div>
                <div>
                  <strong>1. Doğrusal Regresyon:</strong> Geçmiş aylardan trend (eğim + sabit) çıkarır. r² değeri ne kadar yüksekse o kadar güvenilir.
                </div>
                <div>
                  <strong>2. Hareketli Ortalama (3 ay):</strong> Son 3 ayın ortalaması. Mevsimsel olmayan dalgalanmaları yumuşatır.
                </div>
                <div>
                  <strong>3. Üstel Düzeltme (α=0.4):</strong> Yakın dönem verilerine daha çok ağırlık verir.
                </div>
                <div className="pt-1.5 border-t" style={{ borderColor: "var(--line-soft)", color: "var(--ink-mute)" }}>
                  <strong>Sınırlamalar:</strong> Sadece geçmiş veri kullanılır; faturalar, sözleşmeler veya mevsimsel olaylar dahil değildir.
                  Güvenilirlik etiketi (yüksek/orta/düşük) r² ve örneklem sayısına dayanır.
                  Profesyonel tahmin için bu sonuçları diğer kaynaklarla karşılaştırın.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PredictionSection({ title, color, icon: Ic, items, futureMonths, currentMonth, monthLabels }) {
  if (items.length === 0) {
    return (
      <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h3 className="display text-lg mb-2 flex items-center gap-2">
          <Ic size={14} style={{ color }}/>{title}
        </h3>
        <div className="text-xs text-center py-6" style={{ color: "var(--ink-mute)" }}>
          Bu bölümde tahmin yapılabilecek veri bulunamadı
        </div>
      </div>
    );
  }
  const confColors = {
    high:     { bg: "#dcfce7", color: "#15803d", label: "Yüksek" },
    medium:   { bg: "#fef3c7", color: "#854d0e", label: "Orta" },
    low:      { bg: "#fee2e2", color: "#b91c1c", label: "Düşük" },
    very_low: { bg: "#fee2e2", color: "#b91c1c", label: "Çok düşük" },
    none:     { bg: "var(--bg)", color: "var(--ink-mute)", label: "—" },
  };
  const trendIcons = { increasing: TrendingUp, decreasing: TrendingDown, stable: Filter };
  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
      <h3 className="display text-lg mb-3 flex items-center gap-2">
        <Ic size={14} style={{ color }}/>{title}
      </h3>
      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {items.map(item => {
          const conf = confColors[item.confidence] || confColors.none;
          const TrIcon = trendIcons[item.trend] || Filter;
          return (
            <div key={item.id} className="p-3 rounded" style={{ background: "var(--bg)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="chip" style={{ background: conf.bg, color: conf.color, fontSize: 9 }}>
                      {conf.label} güven
                    </span>
                    <span className="chip" style={{ background: "var(--paper)", color: "var(--ink-mute)", fontSize: 9 }}>
                      <TrIcon size={9}/>
                      {item.trend === "increasing" ? "Artıyor" : (item.trend === "decreasing" ? "Azalıyor" : "Stabil")}
                    </span>
                    <span className="text-xs mono" style={{ color: "var(--ink-mute)" }}>
                      r²={item.r2.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="num font-medium text-sm" style={{ color }}>
                    {fmtTL(item.totalPredicted)} ₺
                  </div>
                  <div className="text-xs" style={{ color: "var(--ink-mute)" }}>
                    {futureMonths} ay toplam
                  </div>
                </div>
              </div>
              {/* Ay bazında değerler */}
              <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                {item.predicted.slice(0, 3).map((v, i) => (
                  <div key={i} className="p-1.5 rounded text-center" style={{ background: "var(--paper)" }}>
                    <div style={{ color: "var(--ink-mute)" }}>{monthLabels[currentMonth + 1 + i]}</div>
                    <div className="num font-medium" style={{ color }}>{fmtTL(v)}</div>
                    {item.lower && item.upper && (
                      <div className="text-xs" style={{ color: "var(--ink-mute)", fontSize: 9 }}>
                        ±{fmtTL((item.upper[i] - item.lower[i]) / 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
   ŞİRKETLER YÖNETİMİ KARTI
===================================================================== */
function CompaniesCard({ data, onChange, logAudit, notify }) {
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const companies = data.companies || [];
  const isActive = (c) => c.id === data.activeCompanyId;

  const saveCompany = async () => {
    if (!draft.name?.trim()) return notify("Şirket adı zorunlu", "err");
    const isEdit = !!draft.id;

    if (isEdit) {
      const next = companies.map(c => c.id === draft.id ? { ...c, name: draft.name.trim(), taxNo: draft.taxNo, color: draft.color } : c);
      await onChange({ ...data, companies: next });
      await logAudit("company_edit", { şirket: draft.name, vkn: draft.taxNo });
      notify("Şirket bilgileri güncellendi");
    } else {
      const newId = "comp_" + Date.now();
      const newCompany = {
        id: newId,
        name: draft.name.trim(),
        taxNo: draft.taxNo?.trim() || "",
        color: draft.color || "#1d4ed8",
        createdAt: new Date().toISOString(),
      };
      // Yeni şirket için empty companyData
      let newCompanyData = createEmptyCompanyData({
        fiscalYear: new Date().getFullYear(),
        fiscalStartMonth: 0,
      });
      // Eğer kategori kopyala işaretliyse
      if (draft.copyCategoriesFrom) {
        const src = data.companyData?.[draft.copyCategoriesFrom];
        if (src) {
          newCompanyData = {
            ...newCompanyData,
            inflows: [...(src.inflows || [])],
            outflows: [...(src.outflows || [])],
            nonPnlOutflows: [...(src.nonPnlOutflows || [])],
            kasaCategories: [...(src.kasaCategories || [])],
          };
        }
      }
      await onChange({
        ...data,
        companies: [...companies, newCompany],
        companyData: {
          ...(data.companyData || {}),
          [newId]: newCompanyData,
        },
      });
      await logAudit("company_add", { şirket: newCompany.name, vkn: newCompany.taxNo, kategoriKopyalandı: !!draft.copyCategoriesFrom });
      notify("Şirket eklendi");
    }
    setDraft(null);
  };

  const removeCompany = async (c) => {
    if (companies.length === 1) return notify("Son şirket silinemez", "err");
    if (c.id === data.activeCompanyId) return notify("Aktif şirket silinemez — önce başka şirkete geçin", "err");
    const dataKeys = data.companyData?.[c.id];
    const summary = [];
    if (dataKeys?.invoices?.length) summary.push(`${dataKeys.invoices.length} fatura`);
    if (dataKeys?.transfers?.length) summary.push(`${dataKeys.transfers.length} transfer`);
    if (dataKeys?.kasaEntries?.length) summary.push(`${dataKeys.kasaEntries.length} kasa hareketi`);
    if (dataKeys?.bankAccounts?.length) summary.push(`${dataKeys.bankAccounts.length} banka hesabı`);
    const warn = summary.length > 0 ? ` Bu şirkete ait ${summary.join(", ")} kaybolacak!` : "";
    if (!confirm(`"${c.name}" şirketini silmek istediğinizden emin misiniz?${warn}`)) return;

    const newCompanyData = { ...(data.companyData || {}) };
    delete newCompanyData[c.id];
    await onChange({
      ...data,
      companies: companies.filter(x => x.id !== c.id),
      companyData: newCompanyData,
    });
    await logAudit("company_delete", { şirket: c.name });
    notify("Şirket silindi");
  };

  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="display text-xl flex items-center gap-2">
            <Building2 size={18} style={{ color: "var(--accent)" }}/>
            Şirketler
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
            Sistemde tanımlı tüm şirketler ve aktif şirket
          </p>
        </div>
        <button onClick={() => setDraft({ name: "", taxNo: "", color: "#1d4ed8", copyCategoriesFrom: "" })}
          className="btn btn-primary">
          <Plus size={13}/> Yeni Şirket
        </button>
      </div>

      <div className="space-y-2">
        {companies.map(c => {
          const co = data.companyData?.[c.id] || {};
          const totals = {
            inflows: (co.inflows || []).length,
            outflows: (co.outflows || []).length + (co.nonPnlOutflows || []).length,
            accounts: (co.bankAccounts || []).length,
            invoices: (co.invoices || []).length,
          };
          return (
            <div key={c.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded"
              style={{
                background: isActive(c) ? c.color + "08" : "var(--bg)",
                border: isActive(c) ? `1px solid ${c.color}30` : "1px solid var(--line-soft)",
              }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: c.color, color: "#fff" }}>
                  <Building2 size={14}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.name}</span>
                    {isActive(c) && (
                      <span className="chip" style={{ background: c.color + "20", color: c.color }}>
                        <Check size={9}/> Aktif
                      </span>
                    )}
                  </div>
                  <div className="text-xs flex items-center gap-3 mt-0.5" style={{ color: "var(--ink-mute)" }}>
                    {c.taxNo && <span className="mono">VKN: {c.taxNo}</span>}
                    <span>{totals.inflows + totals.outflows} kategori</span>
                    <span>{totals.accounts} hesap</span>
                    <span>{totals.invoices} fatura</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!isActive(c) && (
                  <button onClick={async () => {
                    await onChange({ ...data, activeCompanyId: c.id });
                    await logAudit("company_switch", { şirket: c.name });
                    notify(`Aktif şirket: ${c.name}`);
                  }} className="btn btn-ghost text-xs" title="Aktif yap">
                    <Check size={12}/> Geç
                  </button>
                )}
                <button onClick={() => setDraft({ ...c, copyCategoriesFrom: "" })}
                  className="p-1.5 rounded hover:bg-stone-100" title="Düzenle">
                  <Edit3 size={12}/>
                </button>
                <button onClick={() => removeCompany(c)} className="p-1.5 rounded hover:bg-red-50" title="Sil">
                  <Trash2 size={12} style={{ color: "var(--negative)" }}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {draft && (
        <Modal title={draft.id ? "Şirket Düzenle" : "Yeni Şirket"}
          icon={Building2} maxWidth="max-w-md"
          onClose={() => setDraft(null)}
          onSave={saveCompany}>
          <div className="space-y-3">
            <div>
              <div className="label mb-1">Şirket Unvanı *</div>
              <input className="input" autoFocus value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="Örn: AGV Yapı Ticaret Ltd. Şti."/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <div className="label mb-1">Vergi/MERSİS No</div>
                <input className="input mono" value={draft.taxNo}
                  onChange={e => setDraft({ ...draft, taxNo: e.target.value })}
                  placeholder="1234567890"/>
              </div>
              <div className="col-span-1">
                <div className="label mb-1">Renk</div>
                <input className="input" type="color" value={draft.color}
                  onChange={e => setDraft({ ...draft, color: e.target.value })}
                  style={{ padding: 4, height: 36 }}/>
              </div>
            </div>
            {!draft.id && companies.length > 0 && (
              <div>
                <div className="label mb-1">Kategorileri Kopyala</div>
                <select className="input" value={draft.copyCategoriesFrom || ""}
                  onChange={e => setDraft({ ...draft, copyCategoriesFrom: e.target.value })}>
                  <option value="">— Boş başla (sadece varsayılan kasa kategorileri) —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>"{c.name}" şirketinden kopyala</option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: "var(--ink-mute)" }}>
                  Tahsilat, ödeme ve kasa kategorileri kopyalanır. Veriler (hücreler, faturalar, transferler) kopyalanmaz — temiz başlar.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ===================================================================== */
function Toast({ msg, kind }) {
  const bg = kind === "err" ? "#b91c1c" : "#0b3d2e";
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded shadow-lg flex items-center gap-2 text-sm z-50"
      style={{ background: bg, color: "#f5f3ef" }}>
      <Check size={13}/> {msg}
    </div>
  );
}
