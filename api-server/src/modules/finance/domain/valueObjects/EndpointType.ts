/**
 * EndpointType — transfer uç noktası türü.
 *
 * DB ENUM `endpoint_type` (004): bank / kasa.
 * Transfer from/to hem banka hesabı hem kasa hesabı olabilir.
 */
export type EndpointType = 'bank' | 'kasa';

export const ALL_ENDPOINT_TYPES: ReadonlyArray<EndpointType> = ['bank', 'kasa'];

export function isEndpointType(value: unknown): value is EndpointType {
  return typeof value === 'string' && (ALL_ENDPOINT_TYPES as ReadonlyArray<string>).includes(value);
}
