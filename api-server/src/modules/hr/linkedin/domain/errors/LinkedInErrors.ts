/**
 * LinkedIn işe alım entegrasyonu domain hataları.
 *
 * presentation/errorMapping.ts HTTP koduna map'ler. Dış sistem (LinkedIn REST)
 * kaynaklı hatalar ayrı tutulur — 502 döner, 500 değil.
 */

export class LinkedInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// --- Doğrulama -------------------------------------------------------------
export class InvalidLinkedInChannelError extends LinkedInError {
  constructor(value: unknown) {
    super(`Geçersiz LinkedIn kanalı: ${String(value)} (share, feed, job_api)`);
  }
}

export class InvalidLinkedInPostStatusError extends LinkedInError {
  constructor(value: unknown) {
    super(`Geçersiz LinkedIn gönderi durumu: ${String(value)}`);
  }
}

export class InvalidOrganizationUrnError extends LinkedInError {
  constructor(value: unknown) {
    super(
      `Geçersiz LinkedIn organizasyon URN'i: ${String(value)} ` +
        `(urn:li:organization:12345 bekleniyor)`,
    );
  }
}

// --- Bağlantı / yapılandırma ----------------------------------------------
export class LinkedInConnectionNotFoundError extends LinkedInError {
  constructor(companyId: number) {
    super(`Şirket ${companyId} için LinkedIn bağlantısı tanımlı değil`);
  }
}

export class LinkedInNotConnectedError extends LinkedInError {
  constructor() {
    super(
      'LinkedIn hesabı yetkilendirilmemiş — İşe Alım › İlanlar › LinkedIn Ayarları ekranından ' +
        'şirket sayfanızı bağlayın',
    );
  }
}

export class LinkedInOrganizationNotSelectedError extends LinkedInError {
  constructor() {
    super('İlanın gideceği LinkedIn şirket sayfası seçilmemiş');
  }
}

export class LinkedInTokenExpiredError extends LinkedInError {
  constructor() {
    super('LinkedIn erişim izni süresi dolmuş — şirket sayfasını yeniden yetkilendirin');
  }
}

export class LinkedInCredentialDecryptError extends LinkedInError {
  constructor(reason: string) {
    super(
      `LinkedIn kimlik bilgisi çözülemedi (${reason}) — bağlantıyı yeniden yetkilendirin. ` +
        `Muhtemel neden: HR_LINKEDIN_MASTER_KEY / EINVOICE_MASTER_KEY değişti.`,
    );
  }
}

// --- Yayınlama -------------------------------------------------------------
export class JobPostingNotPublishableError extends LinkedInError {
  constructor(reason: string) {
    super(`İlan LinkedIn'e gönderilemez: ${reason}`);
  }
}

export class JobPostingFeedEntryNotFoundError extends LinkedInError {
  constructor(postingRef: string) {
    super(`Yayın kaydı bulunamadı: ${postingRef}`);
  }
}

export class InvalidFeedTokenError extends LinkedInError {
  constructor() {
    super('İlan beslemesi jetonu geçersiz');
  }
}

/** Partner onayı gerektiren kanal — Job Posting API. */
export class LinkedInChannelUnavailableError extends LinkedInError {
  constructor(channel: string, reason: string) {
    super(`LinkedIn '${channel}' kanalı kullanılamıyor: ${reason}`);
  }
}

// --- Dış sistem ------------------------------------------------------------
export class LinkedInAuthError extends LinkedInError {
  constructor(detail: string) {
    super(`LinkedIn kimlik doğrulama hatası: ${detail}`);
  }
}

export class LinkedInApiError extends LinkedInError {
  constructor(
    detail: string,
    public readonly httpStatus?: number,
  ) {
    super(`LinkedIn API hatası: ${detail}`);
  }
}
