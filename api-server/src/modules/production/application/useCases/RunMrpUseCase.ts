/**
 * RunMrpUseCase — MRP koşusunu çalıştırır.
 *
 * İstek payload'ından (materials/inventory/boms/workCenters/demand + params)
 * MrpCalculator ile planı hesaplar, koşuyu production_mrp_runs'a JSONB olarak
 * persist eder ve planı + meta (runAt, no) döndürür.
 *
 * Stok seviyeleri InventoryProvider portundan alınır; WMS backend'i yokken
 * RequestInventoryProvider isteğin inventory dizisini sarmalar. Böylece motor
 * payload'a, use-case ise porta bağımlıdır (gelecekte PgInventoryProvider).
 *
 * Determinizm: hesaplayıcı saf; runAt ve "no" Clock'tan türetilir (yan etki
 * use-case sınırında tutulur).
 */
import {
  MrpCalculator,
  type InventoryLevel,
  type MrpResult,
} from '../../domain/services/MrpCalculator.js';
import type { RunMrpRequestDto, RunMrpResponseDto } from '../dto/MrpDtos.js';
import type { Clock } from '../ports/Clock.js';
import { RequestInventoryProvider, type InventoryProvider } from '../ports/InventoryProvider.js';
import type { MrpRunRepository } from '../ports/MrpRunRepository.js';

/** MRP koşu numarası üret: MRP-YYYYMMDD-HHMMSS. */
function buildRunNo(at: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const y = at.getUTCFullYear();
  const mo = pad(at.getUTCMonth() + 1);
  const d = pad(at.getUTCDate());
  const h = pad(at.getUTCHours());
  const mi = pad(at.getUTCMinutes());
  const s = pad(at.getUTCSeconds());
  return `MRP-${y}${mo}${d}-${h}${mi}${s}`;
}

export class RunMrpUseCase {
  private readonly calculator = new MrpCalculator();

  constructor(
    private readonly runs: MrpRunRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RunMrpRequestDto): Promise<RunMrpResponseDto> {
    // Stok sağlayıcı: WMS backend'i yokken isteğin inventory'sini sarmala.
    const provider: InventoryProvider = new RequestInventoryProvider(input.inventory);
    const snapshot = await provider.getLevels(input.companyId);
    const inventory: InventoryLevel[] = [...snapshot.values()];

    const result: MrpResult = this.calculator.compute({
      params: input.params,
      materials: input.materials,
      inventory,
      boms: input.boms,
      workCenters: input.workCenters,
      demand: input.demand,
    });

    const runAt = this.clock.now();
    const no = buildRunNo(runAt);

    await this.runs.insert({
      companyId: input.companyId,
      no,
      runAt,
      params: input.params,
      result,
    });

    return {
      runAt: runAt.toISOString(),
      no,
      ...result,
    };
  }
}
