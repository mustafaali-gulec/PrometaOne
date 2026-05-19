/** ID generator port'u — testte deterministik olabilsin diye DI'lanır. */
export interface IdGenerator {
  next(): string;
}
