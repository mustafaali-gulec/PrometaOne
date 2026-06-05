/**
 * ProjectType / ProjectStatus — DB cs_project_type & cs_project_status ENUM aynası.
 *
 * Proje yaşam döngüsü durum geçişleri burada saf fonksiyon olarak tanımlanır;
 * geçersiz geçiş entity tarafından InvalidStatusTransitionError ile reddedilir.
 */
export const PROJECT_TYPES = ['private', 'public_tender'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = ['planning', 'active', 'suspended', 'completed', 'closed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isProjectType(v: unknown): v is ProjectType {
  return typeof v === 'string' && (PROJECT_TYPES as ReadonlyArray<string>).includes(v);
}

export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === 'string' && (PROJECT_STATUSES as ReadonlyArray<string>).includes(v);
}

/** İzin verilen proje durum geçişleri. */
const ALLOWED: Readonly<Record<ProjectStatus, ReadonlyArray<ProjectStatus>>> = {
  planning: ['active', 'closed'],
  active: ['suspended', 'completed', 'closed'],
  suspended: ['active', 'closed'],
  completed: ['closed', 'active'],
  closed: [],
};

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}
