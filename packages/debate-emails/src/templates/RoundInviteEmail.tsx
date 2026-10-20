import { EmailButton, EmailHeading, EmailLayout, EmailText } from "../components/EmailLayout";
import { APP_NAME, siteUrl } from "../site";

export interface RoundInviteEmailProps {
  /** Who created the round. */
  inviterName: string;
  /** The round's tournament name. */
  tournamentName: string;
  /** The round's level, e.g. "Quarterfinals" or "Round 3". */
  roundLevel?: string | null;
  /** The round's path, e.g. /debate/<slug>. Falls back to /debate. */
  link?: string | null;
  baseUrl?: string;
}

export function roundInviteSubject({ inviterName }: RoundInviteEmailProps): string {
  return `${inviterName} invited you to a debate round`;
}

/** "Tournament — Level", or just the tournament when there is no level. */
export function roundInviteLabel({ tournamentName, roundLevel }: RoundInviteEmailProps): string {
  return roundLevel?.trim() ? `${tournamentName} — ${roundLevel.trim()}` : tournamentName;
}

/**
 * Sent to an invitee without an account when a round is created
 * (POST /api/rounds/invite). Registered users get an in-app notification.
 */
export function RoundInviteEmail(props: RoundInviteEmailProps) {
  const { inviterName, link, baseUrl } = props;
  const label = roundInviteLabel(props);
  const href = siteUrl(baseUrl, link || "/debate");
  return (
    <EmailLayout
      preview={`${inviterName} invited you to ${label} on ${APP_NAME}.`}
      baseUrl={baseUrl}
    >
      <EmailHeading>You're invited to a debate</EmailHeading>
      <EmailText>{inviterName} invited you to a debate round:</EmailText>
      <EmailText>
        <strong>{label}</strong>
      </EmailText>
      <EmailText>
        Open the round to flow it on {APP_NAME}. Create a free account to save your flows and see
        future invites in your notifications.
      </EmailText>
      <EmailButton href={href}>Open the round</EmailButton>
    </EmailLayout>
  );
}

RoundInviteEmail.PreviewProps = {
  inviterName: "Alex Chen",
  tournamentName: "Harvard National Forensics Tournament",
  roundLevel: "Octafinals",
  link: "/debate/2026-harvard/octas-lexington-vs-strake",
} satisfies RoundInviteEmailProps;
