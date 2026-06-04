/**
 * AssetType — zimmet/varlık türü.
 *
 * Legacy App.jsx zimmet modülündeki türlerle parite:
 *   laptop, desktop, phone, vehicle, card, monitor, headset, tablet,
 *   printer, furniture, key_lock, uniform, ppe, other
 */
export type AssetType =
  | 'laptop'
  | 'desktop'
  | 'phone'
  | 'vehicle'
  | 'card'
  | 'monitor'
  | 'headset'
  | 'tablet'
  | 'printer'
  | 'furniture'
  | 'key_lock'
  | 'uniform'
  | 'ppe'
  | 'other';

export const ALL_ASSET_TYPES: ReadonlyArray<AssetType> = [
  'laptop',
  'desktop',
  'phone',
  'vehicle',
  'card',
  'monitor',
  'headset',
  'tablet',
  'printer',
  'furniture',
  'key_lock',
  'uniform',
  'ppe',
  'other',
];

export function isAssetType(value: unknown): value is AssetType {
  return typeof value === 'string' && (ALL_ASSET_TYPES as ReadonlyArray<string>).includes(value);
}
