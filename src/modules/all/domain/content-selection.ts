import {ExportTarget} from '../use-case/export-all.js'

export type ContentSelection = 'both' | 'documents' | 'wiki'

// 空入力・不正入力は「両方」として扱う（従来動作がデフォルト）
export function parseContentSelection(input: string): ContentSelection {
  const normalized = input.trim().toLowerCase()
  if (normalized === '2' || normalized === 'wiki') return 'wiki'
  if (normalized === '3' || normalized === 'document' || normalized === 'documents') return 'documents'
  return 'both'
}

export function applyContentSelection(targets: ExportTarget[], selection: ContentSelection): ExportTarget[] {
  if (selection === 'wiki') return targets.filter((target) => target !== 'documents')
  if (selection === 'documents') return targets.filter((target) => target !== 'wiki')
  return targets
}
