/**
 * AppState domain hata → HTTP status mapping.
 *
 * AppState modülünde özel domain hatası yoktur (NotFound durumu route'ta açıkça
 * 404 ile döner). Bu fonksiyon expense modülüyle simetri için tutulur; bilinen
 * bir hata yoksa olduğu gibi yeniden fırlatır → global handler → 500.
 */
export function mapAppStateError(err: unknown): never {
  throw err;
}
