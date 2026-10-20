import type { ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { APP_NAME, LOGO_HEIGHT, LOGO_WIDTH, SUPPORT_EMAIL, siteUrl } from "../site";

/**
 * The shell every Debate AI email shares: the wordmark, a white card on a
 * light grey page, and a footer linking back to the site. Styles are inline
 * because most mail clients drop `<style>` blocks.
 */
export function EmailLayout({
  preview,
  baseUrl,
  children,
  footerNote,
}: {
  /** The inbox preview line shown after the subject. */
  preview: string;
  /** Origin the links and logo point at, e.g. https://d.ebate.app. */
  baseUrl?: string;
  children: ReactNode;
  /** Why the reader got this email, shown above the footer links. */
  footerNote?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Link href={siteUrl(baseUrl, "/")}>
              <Img
                src={siteUrl(baseUrl, "/logo.png")}
                width={LOGO_WIDTH / 2}
                height={LOGO_HEIGHT / 2}
                alt={APP_NAME}
              />
            </Link>
          </Section>
          <Section style={card}>{children}</Section>
          <Section style={footer}>
            {footerNote ? <Text style={footerText}>{footerNote}</Text> : null}
            <Text style={footerText}>
              <Link href={siteUrl(baseUrl, "/")} style={footerLink}>
                {APP_NAME}
              </Link>
              {" · "}
              <Link href={siteUrl(baseUrl, "/docs")} style={footerLink}>
                Help docs
              </Link>
              {" · "}
              <Link href={siteUrl(baseUrl, "/settings")} style={footerLink}>
                Settings
              </Link>
              {" · "}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
                {SUPPORT_EMAIL}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** The one call to action an email leads with. */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Button href={href} style={button}>
        {children}
      </Button>
    </Section>
  );
}

export function EmailHeading({ children }: { children: ReactNode }) {
  return <Text style={heading}>{children}</Text>;
}

export function EmailText({ children }: { children: ReactNode }) {
  return <Text style={text}>{children}</Text>;
}

/** A quoted note from the sender, set apart from the email's own copy. */
export function EmailQuote({ children }: { children: ReactNode }) {
  return <Text style={quote}>{children}</Text>;
}

export function EmailDivider() {
  return <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />;
}

export const colors = {
  text: "#171717",
  muted: "#737373",
  accent: "#3b82f6",
  border: "#e5e5e5",
  page: "#f5f5f5",
};

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const body = { backgroundColor: colors.page, fontFamily, margin: 0, padding: "24px 0" };
const container = { maxWidth: "560px", margin: "0 auto", padding: "0 16px" };
const header = { padding: "8px 0 20px" };
const card = {
  backgroundColor: "#ffffff",
  border: `1px solid ${colors.border}`,
  borderRadius: "12px",
  padding: "32px",
};
const heading = {
  color: colors.text,
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "30px",
  margin: "0 0 16px",
};
const text = { color: colors.text, fontSize: "15px", lineHeight: "24px", margin: "0 0 14px" };
const quote = {
  ...text,
  borderLeft: `3px solid ${colors.border}`,
  color: colors.muted,
  fontStyle: "italic" as const,
  paddingLeft: "12px",
};
const button = {
  backgroundColor: colors.text,
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};
const footer = { padding: "20px 4px 0" };
const footerText = { color: colors.muted, fontSize: "12px", lineHeight: "18px", margin: "0 0 6px" };
const footerLink = { color: colors.muted, textDecoration: "underline" };
