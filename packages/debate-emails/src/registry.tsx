import type { ReactElement } from "react";
import { CoachFeaturesEmail, coachFeaturesSubject, type CoachFeaturesEmailProps } from "./templates/CoachFeaturesEmail";
import { FileInviteEmail, fileInviteSubject, type FileInviteEmailProps } from "./templates/FileInviteEmail";
import { RoundInviteEmail, roundInviteSubject, type RoundInviteEmailProps } from "./templates/RoundInviteEmail";
import { WelcomeEmail, welcomeSubject, type WelcomeEmailProps } from "./templates/WelcomeEmail";

/** Props every template accepts, mapped by template id. */
export interface EmailTemplateProps {
  welcome: WelcomeEmailProps;
  "file-invite": FileInviteEmailProps;
  "round-invite": RoundInviteEmailProps;
  "coach-features": CoachFeaturesEmailProps;
}

export type EmailTemplateId = keyof EmailTemplateProps;

export interface EmailTemplate<Id extends EmailTemplateId = EmailTemplateId> {
  id: Id;
  /** Name shown in the admin Emails section. */
  name: string;
  /** When the email is sent. */
  description: string;
  /** Where the app sends it from, or null when nothing sends it yet. */
  sentFrom: string | null;
  subject: (props: EmailTemplateProps[Id]) => string;
  element: (props: EmailTemplateProps[Id]) => ReactElement;
  /** Sample data for previews. */
  sampleProps: EmailTemplateProps[Id];
}

const welcome: EmailTemplate<"welcome"> = {
  id: "welcome",
  name: "Welcome",
  description: "Greets a new account and links the tools most people start with.",
  sentFrom: null,
  subject: welcomeSubject,
  element: (props) => <WelcomeEmail {...props} />,
  sampleProps: WelcomeEmail.PreviewProps,
};

const fileInvite: EmailTemplate<"file-invite"> = {
  id: "file-invite",
  name: "File collaboration invite",
  description: "Someone shared a Debate Editor document with a contact to co-edit it.",
  sentFrom: "POST /api/card-shares",
  subject: fileInviteSubject,
  element: (props) => <FileInviteEmail {...props} />,
  sampleProps: FileInviteEmail.PreviewProps,
};

const roundInvite: EmailTemplate<"round-invite"> = {
  id: "round-invite",
  name: "Debate round invite",
  description: "Someone added this email to a new round in Create New Round and it has no account yet.",
  sentFrom: "POST /api/rounds/invite",
  subject: roundInviteSubject,
  element: (props) => <RoundInviteEmail {...props} />,
  sampleProps: RoundInviteEmail.PreviewProps,
};

const coachFeatures: EmailTemplate<"coach-features"> = {
  id: "coach-features",
  name: "Coach features",
  description: "Tours what coaches get: managing a research team, coaching programs, the team calendar and more.",
  sentFrom: null,
  subject: coachFeaturesSubject,
  element: (props) => <CoachFeaturesEmail {...props} />,
  sampleProps: CoachFeaturesEmail.PreviewProps,
};

/** Every template, in the order the admin Emails section lists them. */
export const EMAIL_TEMPLATES = [welcome, fileInvite, roundInvite, coachFeatures] as const;

export const EMAIL_TEMPLATES_BY_ID: { [Id in EmailTemplateId]: EmailTemplate<Id> } = {
  welcome,
  "file-invite": fileInvite,
  "round-invite": roundInvite,
  "coach-features": coachFeatures,
};

export function isEmailTemplateId(value: unknown): value is EmailTemplateId {
  return typeof value === "string" && Object.hasOwn(EMAIL_TEMPLATES_BY_ID, value);
}
