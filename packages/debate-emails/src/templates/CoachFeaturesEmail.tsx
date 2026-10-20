import { EmailButton, EmailDivider, EmailHeading, EmailLayout, EmailText } from "../components/EmailLayout";
import { FeatureList } from "../components/FeatureList";
import { APP_NAME, siteUrl } from "../site";

export interface CoachFeaturesEmailProps {
  /** The coach's display name. */
  name?: string;
  baseUrl?: string;
}

export function coachFeaturesSubject(_props: CoachFeaturesEmailProps = {}): string {
  return `Run your debate program on ${APP_NAME}`;
}

/**
 * A tour of what the site gives coaches. Each entry is a real page, described
 * the way its help doc describes it (packages/debate-help-docs features/
 * ai-coaching/coaching.mdx, research-evidence/team-research.mdx and
 * team-collaboration/school-pages.mdx), so update both together.
 */
export function CoachFeaturesEmail({ name, baseUrl }: CoachFeaturesEmailProps) {
  const url = (path: string) => siteUrl(baseUrl, path);
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <EmailLayout
      preview="Manage your research team, run coaching programs and keep your squad's calendar in one place."
      baseUrl={baseUrl}
      footerNote={`You're getting this because you have a ${APP_NAME} account.`}
    >
      <EmailHeading>{firstName ? `${firstName}, here's what you can do as a coach` : "Everything you get as a coach"}</EmailHeading>
      <EmailText>
        {APP_NAME} gives debate coaches one place to manage research, prep and practice for the
        whole squad.
      </EmailText>

      <EmailText>
        <strong>Manage your research team</strong>
      </EmailText>
      <FeatureList
        features={[
          {
            title: "Task Inbox",
            description: "Route research tasks to debaters by skill level, grouped by topic, with peer verification.",
            href: url("/research/team?section=inbox"),
          },
          {
            title: "Review Queue",
            description: "Move submitted cards through peer review: comment, request changes, approve and publish.",
            href: url("/research/team?section=reviews"),
          },
          {
            title: "Prep Room",
            description: "A topic's shared prep space: its evidence, draft blocks and routed research tasks.",
            href: url("/research/team?section=prep-room"),
          },
          {
            title: "Topic Coverage",
            description: "See which arguments are well covered, thin or missing, by card and word count.",
            href: url("/research/team?section=coverage"),
          },
        ]}
      />

      <EmailDivider />
      <EmailText>
        <strong>Coach your squad</strong>
      </EmailText>
      <FeatureList
        features={[
          {
            title: "Coach Workspace",
            description: "Every round and coaching panel, grouped by stage: flow, coaching, prep, scouting and practice.",
            href: url("/coaching?section=workspace"),
          },
          {
            title: "Coaching Programs",
            description: "Group coaching spaces for a squad roster, with roster analytics and drill reviews.",
            href: url("/coaching?section=programs"),
          },
          {
            title: "AI Coach Mode",
            description: "Extension, refutation, collapse and weighing prompts generated from each round's flow.",
            href: url("/coaching?section=ai-coach"),
          },
          {
            title: "Team Calendar",
            description: "Research tasks, assignments, deadlines and group-only virtual tournaments for each group you coach.",
            href: url("/coaching?section=calendar"),
          },
          {
            title: "Coach Materials",
            description: "Upload lectures and camp files to ground a private team coach AI in your own teaching.",
            href: url("/coaching?section=materials"),
          },
        ]}
      />

      <EmailDivider />
      <EmailText>
        <strong>Bring your team together</strong>
      </EmailText>
      <FeatureList
        features={[
          {
            title: "Organizations",
            description: "A shared workspace for your squad, so contacts and shared files follow the team you pick.",
            href: url("/contacts"),
          },
          {
            title: "Claim your school page",
            description: "Once approved, manage which teams and students are part of your school, and its logo.",
            href: url("/settings?category=my-school"),
          },
        ]}
      />

      <EmailButton href={url("/coaching")}>Open the Coach Workspace</EmailButton>
    </EmailLayout>
  );
}

CoachFeaturesEmail.PreviewProps = { name: "Morgan Patel" } satisfies CoachFeaturesEmailProps;
