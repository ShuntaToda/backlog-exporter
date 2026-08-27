import {DocumentNode, DocumentSummary, DocumentTree} from './document.js'

// Backlogのドキュメントツリーは、作成後に一度も再保存されていないドキュメントを返さないことがある。
// ツリーだけを辿るとそれらが構造的に取得できないため、全件が載る一覧APIとの差分で拾う。
// ゴミ箱のドキュメントを復活させないよう、trashTreeに載っているものは差分から除く。
export function findDocumentsMissingFromTree(tree: DocumentTree, titlesById: Map<string, string>): DocumentSummary[] {
  const knownIds = new Set<string>()

  const collect = (nodes: DocumentNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      knownIds.add(node.id)
      collect(node.children)
    }
  }

  collect(tree.activeTree.children)
  collect(tree.trashTree?.children)

  const missing: DocumentSummary[] = []
  for (const [id, title] of titlesById) {
    if (!knownIds.has(id)) {
      missing.push({id, title})
    }
  }

  return missing
}
