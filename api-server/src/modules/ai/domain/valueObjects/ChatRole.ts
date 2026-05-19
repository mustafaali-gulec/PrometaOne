/**
 * ChatRole — bir chat mesajının kaynağı.
 *
 * - 'user': son kullanıcı
 * - 'assistant': model (Claude)
 *
 * Anthropic API bu iki rolü destekler ('system' ayrı bir parametre olarak).
 */
export type ChatRole = 'user' | 'assistant';
