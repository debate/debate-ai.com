import { EmailButton, EmailHeading, EmailLayout, EmailQuote, EmailText } from "../components/EmailLayout";
import { APP_NAME, siteUrl } from "../site";

export interface FileInviteEmailProps {
  /** Who shared the file. */
  inviterName: string;
  /** The shared document's title. */
  fileTitle: string;
  /** The optional note the sender attached. */
  message?: string | null;
  /**
   * Where the file opens. Defaults to the Shared cards tab of /contacts,
   * where every card shared with the account is listed.
   */
  link?: string;
  baseUrl?: string;
}

export function fileInviteSubject({ inviterName, fileTitle }: FileInviteEmailProps): string {
  return `${inviterName} invited you to collaborate on "${fileTitle}"`;
}

/**
 * Sent when someone shares a CardMirror document with a contact
 * (POST /api/card-shares) so they can co-edit it live.
 */
export function FileInviteEmail({ inviterName, fileTitle, message, link, baseUrl }: FileInviteEmailProps) {
  const href = siteUrl(baseUrl, link || "/contacts?tab=shared");
  return (
    <EmailLayout
      preview={`${inviterName} shared "${fileTitle}" with you on ${APP_NAME}.`}
      baseUrl={baseUrl}
    >
      <EmailHeading>{inviterName} invited you to collaborate</EmailHeading>
      <EmailText>
        {inviterName} shared <strong>{fileTitle}</strong> with you. Open it to edit together in real
        time: every change, highlight and comment syncs as you both work.
      </EmailText>
      {message ? <EmailQuote>“{message}”</EmailQuote> : null}
      <EmailButton href={href}>Open the file</EmailButton>
      <EmailText>
        The file stays listed under Shared cards in your Contacts, on every device you sign in on.
      </EmailText>
    </EmailLayout>
  );
}

FileInviteEmail.PreviewProps = {
  inviterName: "Sam Rivera",
  fileTitle: "Space Militarization Aff — 1AC",
  message: "Can you cut a few more solvency cards for the second advantage before Saturday?",
} satisfies FileInviteEmailProps;
