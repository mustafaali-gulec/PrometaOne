/**
 * Construction (Şantiye Yönetim) frontend modülü — public barrel.
 * App.jsx yalnızca ConstructionPage'i import eder (scoped mount).
 */
// --- DTO
export type {
  BoqDto,
  BoqLineDto,
  ContractDto,
  ContractParty,
  CurrencyCode,
  PozDto,
  ProjectDto,
  ProjectStatus,
  ProjectType,
  TenderInfoDto,
} from './application/dto/ConstructionDtos';

// --- Ports / API
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export { StaticAuthTokenProvider } from './application/ports/AuthTokenProvider';
export type { ConstructionApi } from './application/ports/ConstructionApi';
export { ConstructionApiClient } from './infrastructure/api/ConstructionApiClient';

// --- Hooks
export { useProjects } from './presentation/hooks/useProjects';
export { useContracts } from './presentation/hooks/useContracts';
export { usePozCatalog } from './presentation/hooks/usePozCatalog';

// --- Components
export { ProjectsTable } from './presentation/components/ProjectsTable';
export { ProjectsKanban } from './presentation/components/ProjectsKanban';
export { ContractsTable } from './presentation/components/ContractsTable';
export { PozCatalogTable } from './presentation/components/PozCatalogTable';
export { BoqEditor, emptyRow, type BoqEditRow } from './presentation/components/BoqEditor';
export { HakedisManager } from './presentation/components/HakedisManager';
export { HakedisKanban } from './presentation/components/HakedisKanban';
export { FinansManager } from './presentation/components/FinansManager';
export { DepoManager } from './presentation/components/DepoManager';
export { IsgucuManager } from './presentation/components/IsgucuManager';
export { RaporManager } from './presentation/components/RaporManager';

// --- Page (scoped mount)
export { ConstructionPage } from './demo/ConstructionPage';
export type { ConstructionPageProps, ConstructionTab } from './demo/ConstructionPage';
