import {FolderType, Settings} from '../../settings/domain/settings.js'

export type PruneTarget = 'document' | 'missing-folder-type' | 'not-target' | 'wiki'

// folderTypeが無いのは旧バージョンの設定ファイル。無言でスキップせず理由を伝えるためnot-targetと区別する
export function classifyPruneTarget(settings: Settings): PruneTarget {
  switch (settings.folderType) {
    case FolderType.DOCUMENT: {
      return 'document'
    }

    case FolderType.WIKI: {
      return 'wiki'
    }

    case undefined: {
      return 'missing-folder-type'
    }

    default: {
      return 'not-target'
    }
  }
}
