/**
 * Location — mekân kırılımı düğümü. Tablo: cs_locations (005_locations.sql).
 *
 * `path` ve `depth` DB trigger'ı tarafından türetilir; entity bunları salt-okur
 * taşır. Ağaç kısıtları (hangi tip hangi tipin altına gelir) LocationKind VO'da.
 *
 * Immutable — update/deactivate yeni instance döner (modül geneli kalıp).
 */
import { ConstructionValidationError } from '../errors/ConstructionErrors.js';
import { canBeRoot, locationKindLabel, type LocationKind } from '../valueObjects/LocationKind.js';

export interface LocationProps {
  id: number;
  companyId: number;
  projectId: number;
  parentId: number | null;
  kind: LocationKind;
  code: string;
  name: string;
  sortOrder: number;
  /** DB trigger türetir: "A Blok > 2 > Daire 18" */
  path: string;
  /** DB trigger türetir: kökte 0 */
  depth: number;
  unitType: string | null;
  grossArea: number | null;
  netArea: number | null;
  landShare: number | null;
  facade: string | null;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationUpdate {
  name?: string;
  code?: string;
  sortOrder?: number;
  unitType?: string | null;
  grossArea?: number | null;
  netArea?: number | null;
  landShare?: number | null;
  facade?: string | null;
}

function assertName(name: string): string {
  const t = name.trim();
  if (t.length === 0) throw new ConstructionValidationError('lokasyon adı boş olamaz');
  if (t.length > 200) throw new ConstructionValidationError('lokasyon adı 200 karakteri geçemez');
  return t;
}

function assertCode(code: string): string {
  const t = code.trim();
  if (t.length === 0) throw new ConstructionValidationError('lokasyon kodu boş olamaz');
  if (t.length > 40) throw new ConstructionValidationError('lokasyon kodu 40 karakteri geçemez');
  // path ayıracı ' > ' koda girerse materialized path okunamaz hale gelir
  if (t.includes('>')) throw new ConstructionValidationError("lokasyon kodu '>' içeremez");
  return t;
}

function assertArea(value: number | null | undefined, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new ConstructionValidationError(`${label} negatif olamaz`);
  }
  return value;
}

export class Location {
  private constructor(private readonly props: Readonly<LocationProps>) {}

  static create(props: LocationProps): Location {
    if (props.id <= 0) throw new ConstructionValidationError('Location.id pozitif olmalı');
    if (props.companyId <= 0)
      throw new ConstructionValidationError('Location.companyId pozitif olmalı');
    if (props.projectId <= 0)
      throw new ConstructionValidationError('Location.projectId pozitif olmalı');
    if (props.parentId === null && !canBeRoot(props.kind)) {
      throw new ConstructionValidationError(
        `'${locationKindLabel(props.kind)}' kök lokasyon olamaz — bir üst mekâna bağlanmalı`,
      );
    }
    return new Location({
      ...props,
      name: assertName(props.name),
      code: assertCode(props.code),
      grossArea: assertArea(props.grossArea, 'brüt alan'),
      netArea: assertArea(props.netArea, 'net alan'),
      landShare: assertArea(props.landShare, 'arsa payı'),
    });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get parentId(): number | null {
    return this.props.parentId;
  }
  get kind(): LocationKind {
    return this.props.kind;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
  }
  get path(): string {
    return this.props.path;
  }
  get depth(): number {
    return this.props.depth;
  }
  get unitType(): string | null {
    return this.props.unitType;
  }
  get grossArea(): number | null {
    return this.props.grossArea;
  }
  get netArea(): number | null {
    return this.props.netArea;
  }
  get landShare(): number | null {
    return this.props.landShare;
  }
  get facade(): string | null {
    return this.props.facade;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Bağımsız bölüm mü? (satış/gelir/hasar-eksiklik ekranları buna bakar) */
  get isUnit(): boolean {
    return this.props.kind === 'unit';
  }

  update(changes: LocationUpdate, now: Date): Location {
    return new Location({
      ...this.props,
      name: changes.name !== undefined ? assertName(changes.name) : this.props.name,
      code: changes.code !== undefined ? assertCode(changes.code) : this.props.code,
      sortOrder: changes.sortOrder ?? this.props.sortOrder,
      unitType:
        changes.unitType !== undefined ? changes.unitType?.trim() || null : this.props.unitType,
      grossArea:
        changes.grossArea !== undefined
          ? assertArea(changes.grossArea, 'brüt alan')
          : this.props.grossArea,
      netArea:
        changes.netArea !== undefined
          ? assertArea(changes.netArea, 'net alan')
          : this.props.netArea,
      landShare:
        changes.landShare !== undefined
          ? assertArea(changes.landShare, 'arsa payı')
          : this.props.landShare,
      facade: changes.facade !== undefined ? changes.facade?.trim() || null : this.props.facade,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Location {
    if (!this.props.active) return this;
    return new Location({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): Location {
    if (this.props.active) return this;
    return new Location({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): Readonly<LocationProps> {
    return { ...this.props };
  }
}
