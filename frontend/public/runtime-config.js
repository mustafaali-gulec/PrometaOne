/* =============================================================================
   M SUITE — ÇALIŞMA ZAMANI YAPILANDIRMASI (build GEREKTİRMEZ)
   -----------------------------------------------------------------------------
   Bu dosya uygulama açılmadan önce yüklenir ve tek build'in hem SaaS hem
   on-prem hem de mobil (ayrık API origin'li) kurulumlarda çalışmasını sağlar.

   VARSAYILAN (tüm alanlar boş): aynı-origin mod. SPA'yı sunan nginx tüm
   /v1/... ve /api/ml/... isteklerini backend'lere proxy'ler; terminaller
   sunucuya IP veya bilgisayar adıyla bağlanabilir ve bu dosyaya DOKUNMAK
   GEREKMEZ. Kurulumların büyük çoğunluğu bu moddadır.

   AYRIK API ORIGIN'İ (ör. SaaS'ta CDN + api.alanadi ayrımı, ya da mobil
   uygulama kabuğunun uzak sunucuya konuşması) gerekiyorsa aşağıdaki satırın
   yorumunu kaldırıp adresi yazın. Sunucu tarafında CORS_ORIGINS bu sayfanın
   origin'ini içermeli (on-prem modda özel-ağ origin'leri zaten otomatiktir).

   Docker'da image'ı yeniden derlemeden değiştirmek için docker-compose.prod.yml
   içindeki web servisinin runtime-config.js volume mount'unu kullanın.
============================================================================= */
window.__MSUITE_RUNTIME__ = window.__MSUITE_RUNTIME__ || {};

// window.__MSUITE_RUNTIME__.apiOrigin = "https://api.ornek.com";
