import {describe, expect, it} from 'vitest'

import {
  buildChildIndex,
  buildIssueRefIndex,
  findChildren,
  findParent,
  withParentsAndChildren,
} from './issue-relations.js'
import {Issue} from './issue.js'

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  assignee: null,
  category: [],
  created: '2026-01-02T00:00:00Z',
  customFields: [],
  description: '本文',
  dueDate: null,
  id: 1,
  issueKey: 'TEST-1',
  issueType: {id: 1, name: 'タスク'},
  parentIssueId: null,
  priority: {id: 2, name: '中'},
  startDate: null,
  status: {id: 1, name: '未対応'},
  summary: 'テスト課題',
  updated: '2026-01-03T00:00:00Z',
  ...overrides,
})

describe('issue-relations', () => {
  describe('findParent', () => {
    it('親を持たない課題はnullを返すこと', () => {
      const target = issue()
      expect(findParent(target, buildIssueRefIndex([target]))).to.equal(null)
    })

    it('取得済み課題に親がいる場合は課題キーと件名を解決すること', () => {
      const parent = issue({id: 10, issueKey: 'TEST-10', summary: '親課題'})
      const child = issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10})

      expect(findParent(child, buildIssueRefIndex([parent, child]))).to.deep.equal({
        parentIssueId: 10,
        ref: {issueKey: 'TEST-10', summary: '親課題'},
      })
    })

    it('取得済み課題に親がいない場合はrefをnullにしてIDのみ返すこと', () => {
      const child = issue({id: 11, issueKey: 'TEST-11', parentIssueId: 999})

      expect(findParent(child, buildIssueRefIndex([child]))).to.deep.equal({parentIssueId: 999, ref: null})
    })
  })

  describe('findChildren', () => {
    it('子を持たない課題は空配列を返すこと', () => {
      const target = issue()
      expect(findChildren(target, buildChildIndex([target]))).to.deep.equal([])
    })

    it('parentIssueIdが一致する課題を課題ID昇順に列挙すること', () => {
      const parent = issue({id: 10, issueKey: 'TEST-10', summary: '親課題'})
      const childA = issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10, summary: '子課題A'})
      const childB = issue({id: 12, issueKey: 'TEST-12', parentIssueId: 10, summary: '子課題B'})
      const other = issue({id: 13, issueKey: 'TEST-13', parentIssueId: 99, summary: '別の親の子'})

      // 一覧APIは新しい課題から返すことがあるため、降順で渡しても昇順に並ぶこと
      expect(findChildren(parent, buildChildIndex([other, childB, childA, parent]))).to.deep.equal([
        {issueKey: 'TEST-11', summary: '子課題A'},
        {issueKey: 'TEST-12', summary: '子課題B'},
      ])
    })
  })

  describe('withParentsAndChildren', () => {
    it('更新された課題に加えて、その直接の親と子だけを含めること', () => {
      const grandparent = issue({id: 9, issueKey: 'TEST-9'})
      const parent = issue({id: 10, issueKey: 'TEST-10', parentIssueId: 9})
      const updated = issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10})
      const child = issue({id: 12, issueKey: 'TEST-12', parentIssueId: 11})
      const grandchild = issue({id: 13, issueKey: 'TEST-13', parentIssueId: 12})
      const sibling = issue({id: 14, issueKey: 'TEST-14', parentIssueId: 10})
      const unrelated = issue({id: 15, issueKey: 'TEST-15'})

      const result = withParentsAndChildren(
        [grandparent, parent, updated, child, grandchild, sibling, unrelated],
        [updated],
      )

      expect(result.map((target) => target.issueKey)).to.deep.equal(['TEST-10', 'TEST-11', 'TEST-12'])
    })

    it('親を持たない課題が更新されても無関係な課題を含めないこと', () => {
      const updated = issue({id: 11, issueKey: 'TEST-11'})
      const unrelated = issue({id: 12, issueKey: 'TEST-12'})

      expect(withParentsAndChildren([updated, unrelated], [updated])).to.deep.equal([updated])
    })

    it('親と子が両方とも更新されていても重複させないこと', () => {
      const parent = issue({id: 10, issueKey: 'TEST-10'})
      const child = issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10})

      expect(withParentsAndChildren([parent, child], [parent, child])).to.deep.equal([parent, child])
    })
  })
})
