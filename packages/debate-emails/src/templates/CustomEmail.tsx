import { Fragment } from "react";
import { Link } from "@react-email/components";
import { EmailButton, EmailHeading, EmailLayout, EmailText } from "../components/EmailLayout";
import { parseEmailBody, type InlinePart } from "../custom-body";
import { siteUrl } from "../site";

export interface CustomEmailProps {
  subject: string;
  /** Plain-text body in the format `parseEmailBody` documents. */
  body: string;
  baseUrl?: string;
}

export function customSubject(props: CustomEmailProps): string {
  return props.subject.trim();
}

function resolveHref(href: string, baseUrl: string | undefined): string {
  return href.startsWith("/") ? siteUrl(baseUrl, href) : href;
}

function Inline({ parts, baseUrl }: { parts: InlinePart[]; baseUrl?: string }) {
  return (
    <>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <Link key={index} href={resolveHref(part.href, baseUrl)} style={{ color: "#3b82f6" }}>
            {part.label}
          </Link>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * An admin-written email: a saved template's subject and body inside the
 * shared layout, so it always carries the unsubscribe footer.
 */
export function CustomEmail({ subject, body, baseUrl }: CustomEmailProps) {
  return (
    <EmailLayout preview={subject.trim()} baseUrl={baseUrl}>
      {parseEmailBody(body).map((block, index) => {
        if (block.type === "heading") return <EmailHeading key={index}>{block.text}</EmailHeading>;
        if (block.type === "button") {
          return (
            <EmailButton key={index} href={resolveHref(block.href, baseUrl)}>
              {block.label}
            </EmailButton>
          );
        }
        return (
          <EmailText key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Inline parts={line} baseUrl={baseUrl} />
              </Fragment>
            ))}
          </EmailText>
        );
      })}
    </EmailLayout>
  );
}

CustomEmail.PreviewProps = { subject: "Hello", body: "# Hello\n\nWrite your message here." } satisfies CustomEmailProps;
