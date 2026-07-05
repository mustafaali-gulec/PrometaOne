/**
 * UserRepository — kullanıcı kalıcılığı port'u.
 *
 * Auth use-case'lerinin DB'den habersiz çalışmasını sağlar.
 */
import type { User } from '../../domain/entities/User.js';

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /**
   * Kullanıcı adı VEYA email ile bulur. Forgot-password akışında girdi
   * tek bir alan olabilir (username veya email) — bu metot ikisini de denemeye
   * gerek bırakmaz.
   */
  findByEmailOrUsername(input: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  /** Kayıtlı hash'i çekmek için (login flow). User entity'sinde hash YOK. */
  findPasswordHashByUserId(userId: number): Promise<string | null>;
  /** Yeni şifre hash'ini günceller. */
  updatePasswordHash(userId: number, newHash: string): Promise<void>;
  /** lastLoginAt + diğer prop'ları kaydet. */
  save(user: User): Promise<void>;
  /**
   * Kullanıcının erişebileceği şirket id'leri (user_company_access).
   * Access-token'a gömülür; companyId yetkilendirmesi buna karşı yapılır.
   * Admin kullanıcılar sınırsızdır (bu liste boş olsa da tüm şirketlere erişir).
   */
  listAccessibleCompanyIds(userId: number): Promise<number[]>;
}
