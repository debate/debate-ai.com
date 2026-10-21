"use client"

import { JudgeParadigmEditor } from "../../components/judge-paradigm/JudgeParadigmEditor"

/**
 * `/practice/paradigm`: a judge writes their own paradigm, links it to their
 * Tabroom judge account and verifies it, so it shows when debaters click
 * their name in tournament pairings. See lib/judge-paradigms.
 */
export default function ParadigmEditorPage() {
  return <JudgeParadigmEditor />
}
