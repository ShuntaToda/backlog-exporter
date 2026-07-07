import {WikiSummary} from './wiki.js'

export interface WikiSelection {
  reason: 'all' | 'ids' | 'updatedSince'
  wikis: WikiSummary[]
}

export function selectWikisToExport(
  wikis: WikiSummary[],
  options: {lastUpdated?: string; wikiIds?: string[]},
): WikiSelection {
  if (options.wikiIds && options.wikiIds.length > 0) {
    const wikiIdSet = new Set(options.wikiIds.map(String))
    return {reason: 'ids', wikis: wikis.filter((wiki) => wikiIdSet.has(String(wiki.id)))}
  }

  if (options.lastUpdated) {
    const lastUpdatedDate = new Date(options.lastUpdated)
    return {reason: 'updatedSince', wikis: wikis.filter((wiki) => new Date(wiki.updated) > lastUpdatedDate)}
  }

  return {reason: 'all', wikis}
}
