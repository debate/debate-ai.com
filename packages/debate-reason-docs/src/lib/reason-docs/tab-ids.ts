/**
 * @fileoverview How a tab in the strip above Debate Editor names what it
 * shows. Owned documents and public Topic Starters share one tab strip but
 * come from two tables whose ids overlap, so a Topic Starter's tab id is its
 * row id negated: document 7 is tab `7`, Topic Starter 7 is tab `-7`. Both
 * tables number rows from 1, so the two ranges never meet.
 *
 * Kept as plain numbers so the strip's close/reopen transitions
 * (`lib/reason-docs/tab-actions.ts`) work on both kinds unchanged.
 *
 * @module lib/reason-docs/tab-ids
 */

/** The tab id a Topic Starter opens under. */
export function topicTabId(topicId: number): number {
  return -topicId
}

/** Whether `tabId` is a Topic Starter's tab rather than an owned document's. */
export function isTopicTab(tabId: number): boolean {
  return tabId < 0
}

/** The Topic Starter row id behind a {@link topicTabId}. */
export function topicIdOfTab(tabId: number): number {
  return -tabId
}
