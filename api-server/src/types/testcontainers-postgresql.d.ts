/**
 * Minimal ambient declaration for `@testcontainers/postgresql`.
 *
 * Faz 4-bis integration testleri için kullanılan yüzey. Paket kendi
 * tipini yayınlamadığı için bu declaration sadece bizim setup.ts içinde
 * kullandığımız sembolleri kapsar.
 */
declare module '@testcontainers/postgresql' {
  export class PostgreSqlContainer {
    constructor(image?: string);
    withDatabase(database: string): this;
    withUsername(username: string): this;
    withPassword(password: string): this;
    start(): Promise<StartedPostgreSqlContainer>;
  }

  export class StartedPostgreSqlContainer {
    getHost(): string;
    getMappedPort(port: number): number;
    getDatabase(): string;
    getUsername(): string;
    getPassword(): string;
    stop(): Promise<void>;
  }
}
