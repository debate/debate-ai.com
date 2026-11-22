/**
 * @fileoverview The arguments each side chose on the setup wizard — shown
 * above a live round (in the prep-brief panel) and again on an expanded
 * round in Debate History, from the plan saved with the round.
 *
 * @module ui/RoundPlanView
 */

import type { RoundPlan } from "../backend/types"

export interface RoundPlanViewProps {
  plan: RoundPlan
  /** The opponent's name, for the second list's heading. */
  botName: string
  /** Optional heading above the lists (Debate History names the section). */
  heading?: string
}

/** One side's chosen arguments, or "Free choice." when it picked none. */
function ArgumentList({ title, args }: { title: string; args: RoundPlan["userArguments"] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      <h4 className="mb-1 font-semibold text-foreground">{title}</h4>
      {args.length === 0 ? (
        <p className="text-muted-foreground">Free choice.</p>
      ) : (
        <ul className="list-disc pl-5 text-foreground">
          {args.map((a, i) => (
            <li key={i}>
              {a.title}
              {a.kind && <span className="ml-1 text-xs text-muted-foreground">({a.kind})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The plan's evidence mode, aff plan and both sides' arguments. */
export function RoundPlanView({ plan, botName, heading }: RoundPlanViewProps) {
  return (
    <section className="flex flex-col gap-2" aria-label={heading ?? "Round plan"} data-testid="round-plan-view">
      {heading && <h3 className="text-sm font-semibold text-foreground">{heading}</h3>}
      <p className="text-xs text-muted-foreground">
        {plan.evidence === "with" ? "Evidence round" : "Round without evidence"}
        {plan.affPlan ? ` · Aff plan: ${plan.affPlan}` : ""}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ArgumentList title="Your arguments" args={plan.userArguments} />
        <ArgumentList title={`${botName}'s arguments`} args={plan.botArguments} />
      </div>
    </section>
  )
}

export default RoundPlanView
