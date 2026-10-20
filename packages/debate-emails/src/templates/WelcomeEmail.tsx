import { EmailButton, EmailHeading, EmailLayout, EmailText } from "../components/EmailLayout";
import { FeatureList } from "../components/FeatureList";
import { APP_NAME, siteUrl } from "../site";

export interface WelcomeEmailProps {
  /** The new account's display name. */
  name?: string;
  baseUrl?: string;
}

export function welcomeSubject(_props: WelcomeEmailProps = {}): string {
  return `Welcome to ${APP_NAME}`;
}

/**
 * Sent once to a new account. The links match the first-sign-in welcome
 * dialog (packages/debate-webview FirstLoginWelcomeDialog) so the email and
 * the app point new users at the same places.
 */
export function WelcomeEmail({ name, baseUrl }: WelcomeEmailProps) {
  const url = (path: string) => siteUrl(baseUrl, path);
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <EmailLayout
      preview={`Research, flow and practice in one place. Here's where to start.`}
      baseUrl={baseUrl}
    >
      <EmailHeading>{firstName ? `Welcome, ${firstName}!` : `Welcome to ${APP_NAME}!`}</EmailHeading>
      <EmailText>
        {APP_NAME} is one place for competitive debaters in Policy, LD and Public Forum to
        research evidence, cut cards, flow rounds and practice. Here's where most people start:
      </EmailText>
      <FeatureList
        features={[
          {
            title: "Research evidence",
            description: "Search millions of cards and cut your own in the card editor.",
            href: url("/research"),
          },
          {
            title: "Practice debates",
            description: "Flow a round with the smart timer, or open a real one.",
            href: url("/debate"),
          },
          {
            title: "Debate vs AI",
            description: "Argue a full round against an AI opponent, in any format.",
            href: url("/practice/versus-ai"),
          },
          {
            title: "Watch videos",
            description: "NDT, Public Forum and LD rounds plus coaching lectures.",
            href: url("/videos"),
          },
          {
            title: "Explore the docs",
            description: "Guides for every tool, from cutting cards to flowing rounds.",
            href: url("/docs"),
          },
        ]}
      />
      <EmailButton href={url("/")}>Open {APP_NAME}</EmailButton>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = { name: "Jordan Lee" } satisfies WelcomeEmailProps;
