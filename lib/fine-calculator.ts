export const PER_ITEM_RULES = new Set(['SEL_PULL001'])
export const PER_FILE_RULES = new Set(['SEL_PULL009'])
export const DUAL_FINE_RULES = new Set(['SEL_PULL008'])

export function isSpecialRule(code: string) {
  return PER_ITEM_RULES.has(code) || PER_FILE_RULES.has(code) || DUAL_FINE_RULES.has(code)
}

export function getMultiplierLabel(code: string): string | null {
  if (PER_ITEM_RULES.has(code)) return 'Number of missing items'
  if (PER_FILE_RULES.has(code)) return 'Number of files affected'
  return null
}

export interface RuleSelection {
  ruleId: string
  ruleCode: string
  fineAmount: number
  multiplier: number
  notes?: string
}

export interface FineBreakdown {
  items: Array<RuleSelection & { lineTotal: number }>
  developerTotal: number
  approverFine: number | null
}

export function computeFine(selections: RuleSelection[]): FineBreakdown {
  const items = selections.map(s => ({
    ...s,
    lineTotal: s.fineAmount * Math.max(1, s.multiplier),
  }))

  const developerTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const hasDual = selections.some(s => DUAL_FINE_RULES.has(s.ruleCode))

  return { items, developerTotal, approverFine: hasDual ? 50 : null }
}
