/**
 * CORS origin politikası — SaaS + on-prem ikili dağıtım çekirdeği.
 *
 * DEPLOY_MODE=onprem (varsayılan): terminaller sunucuya IP veya bilgisayar
 * adıyla bağlanır. DHCP değişimi, yeni ağ kartı ya da makine-adı erişimi
 * .env.prod'un yeniden yazılmasını gerektirmesin diye CORS_ORIGINS listesine
 * EK olarak özel-ağ origin'leri (RFC1918/CGNAT IP, tek etiketli makine adı,
 * *.local mDNS, localhost) otomatik kabul edilir. Genel internet origin'leri
 * yine yalnız açık listeyle geçer.
 *
 * DEPLOY_MODE=saas: yalnız CORS_ORIGINS listesi geçerlidir. Liste girdileri
 * joker alt alan adı destekler: `https://*.msuite.app` → tüm alt alan adları.
 * `*` girdisi her origin'i kabul eder (yalnız bilinçli kullanım için).
 *
 * NOT: api-server’da bu dosyanın eş kopyası vardır
 * (api-server/src/corsPolicy.ts) — davranış değişikliklerini iki
 * dosyada birden yapın (servisler ayrı paketlerdir, ortak import yolu yok).
 */

export type DeployMode = 'onprem' | 'saas';

/** Origin string'ini parçala; geçersizse null. */
function parseOrigin(origin: string): { scheme: string; host: string; port: string } | null {
  const m = /^(https?):\/\/([^/:]+|\[[0-9a-fA-F:]+\])(?::(\d+))?$/.exec(origin.trim());
  if (!m) return null;
  return { scheme: m[1]!, host: m[2]!.toLowerCase(), port: m[3] ?? '' };
}

/** RFC1918 / CGNAT / loopback / link-local IPv4 mü? */
function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // link-local (APIPA)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (100.64/10)
  return false;
}

/** Özel-ağ host'u mu? (on-prem modda otomatik kabul edilen sınıf) */
function isPrivateNetworkHost(host: string): boolean {
  if (host === 'localhost' || host === '[::1]') return true;
  if (isPrivateIpv4(host)) return true;
  // IPv6 link-local / ULA (kaba kontrol — köşeli parantezli literal)
  if (/^\[fe80:/i.test(host) || /^\[f[cd][0-9a-f]{2}:/i.test(host)) return true;
  // Tek etiketli makine adı (NetBIOS/LLMNR: http://sunucu-pc gibi) — nokta yok
  if (!host.includes('.') && !host.startsWith('[')) return true;
  // mDNS: sunucu-pc.local
  if (host.endsWith('.local')) return true;
  return false;
}

/** Liste girdisi origin'i karşılar mı? (`*` ve `scheme://*.domain` jokerli) */
function matchesAllowedEntry(entry: string, origin: string): boolean {
  if (entry === '*') return true;
  if (entry.includes('*')) {
    const eo = /^(https?):\/\/\*\.(.+)$/.exec(entry.trim());
    const po = parseOrigin(origin);
    if (!eo || !po) return false;
    const [, scheme, rest] = eo;
    const restParsed = /^([^/:]+)(?::(\d+))?$/.exec(rest!);
    if (!restParsed) return false;
    const suffix = restParsed[1]!.toLowerCase();
    const port = restParsed[2] ?? '';
    return (
      po.scheme === scheme &&
      po.port === port &&
      po.host !== suffix &&
      po.host.endsWith('.' + suffix)
    );
  }
  return entry.replace(/\/+$/, '').toLowerCase() === origin.replace(/\/+$/, '').toLowerCase();
}

/**
 * Hono `cors({ origin })` için çözücü üretir: izinliyse origin string'i,
 * değilse null döner (header yazılmaz → tarayıcı engeller).
 */
export function makeCorsOriginResolver(opts: {
  deployMode: DeployMode;
  allowedOrigins: string[];
}): (origin: string) => string | null {
  const { deployMode, allowedOrigins } = opts;
  return (origin: string): string | null => {
    if (!origin) return null;
    for (const entry of allowedOrigins) {
      if (matchesAllowedEntry(entry, origin)) return origin;
    }
    if (deployMode === 'onprem') {
      const parsed = parseOrigin(origin);
      if (parsed && isPrivateNetworkHost(parsed.host)) return origin;
    }
    return null;
  };
}
