/**
 * ContractParty — DB cs_contract_party ENUM aynası.
 *   employer      → işveren ile sözleşme (biz yükleniciyiz; hakediş = gelir)
 *   subcontractor → taşeron ile sözleşme (biz idareyiz; hakediş = gider)
 */
export const CONTRACT_PARTIES = ['employer', 'subcontractor'] as const;
export type ContractParty = (typeof CONTRACT_PARTIES)[number];

export function isContractParty(v: unknown): v is ContractParty {
  return typeof v === 'string' && (CONTRACT_PARTIES as ReadonlyArray<string>).includes(v);
}
