import { NextResponse } from "next/server"
import { SUBMIT_JUDGE_BALLOT_TOOL } from "@debate-ai/tournaments/ballots"

/**
 * GET — the `submit_judge_ballot` tool definition (JSON schema), for an agent
 * acting for a signed-in judge. Calling the tool means `POST
 * /api/judge-ballots` with the tool's arguments as the JSON body, under the
 * judge's session; the email-match rule applies exactly as for the form.
 */
export function GET() {
  return NextResponse.json({
    tool: SUBMIT_JUDGE_BALLOT_TOOL,
    endpoint: { method: "POST", path: "/api/judge-ballots", tabroomTokenHeader: "x-tabroom-token" },
  })
}
