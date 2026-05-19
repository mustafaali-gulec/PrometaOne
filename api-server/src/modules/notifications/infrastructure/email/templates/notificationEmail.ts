/**
 * notificationEmail — bildirim e-postası için HTML şablonu.
 *
 * Legacy/backend/emailService.js'teki formatNotificationEmail'in
 * TS yeniden yazımı.
 */
import type { Notification } from '../../../domain/entities/Notification.js';

export interface RenderNotificationEmailInput {
  notification: Notification;
  recipientDisplayName: string;
  appUrl: string;
}

export function renderNotificationEmail(input: RenderNotificationEmailInput): string {
  const { notification, recipientDisplayName, appUrl } = input;
  const linkHref = notification.link ? `${appUrl}/${encodeURI(notification.link)}` : appUrl;
  const safeBody = escapeHtml(notification.body).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(notification.title)}</title>
<style>
  body { font-family: 'Segoe UI', Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #0f766e 0%, #15803d 100%); padding: 20px; color: #fff; }
  .header h1 { margin: 0; font-size: 18pt; }
  .header .subtitle { opacity: 0.9; font-size: 11pt; margin-top: 4px; }
  .body { padding: 20px; }
  .body h2 { color: #0f766e; font-size: 13pt; margin-top: 0; }
  .body p { line-height: 1.6; font-size: 11pt; }
  .cta { display: inline-block; padding: 10px 20px; background: #0f766e; color: #fff !important; text-decoration: none; border-radius: 4px; font-weight: 700; margin-top: 12px; }
  .footer { padding: 16px 20px; background: #f3f4f6; font-size: 9pt; color: #6b7280; text-align: center; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Prometa One</h1>
      <div class="subtitle">Otomatik Bildirim</div>
    </div>
    <div class="body">
      <h2>${escapeHtml(notification.title)}</h2>
      <p>${safeBody}</p>
      <a href="${linkHref}" class="cta">Uygulamayı Aç →</a>
    </div>
    <div class="footer">
      Merhaba ${escapeHtml(recipientDisplayName)}, bu otomatik bir bildirimdir.<br>
      E-posta bildirimlerini kapatmak için ayarlarınızı kontrol edin.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
