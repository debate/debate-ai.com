/**
 * @fileoverview Debate AI's transactional emails, written with React Email.
 * Render one with `renderEmail(id, props)`; the admin Emails section lists
 * `EMAIL_TEMPLATES` and previews each with its sample data.
 */
export { EMAIL_TEMPLATES, EMAIL_TEMPLATES_BY_ID, isEmailTemplateId } from "./registry";
export type { EmailTemplate, EmailTemplateId, EmailTemplateProps } from "./registry";
export { renderEmail, renderEmailPreview } from "./render";
export type { RenderedEmail } from "./render";
export { DEFAULT_BASE_URL, siteUrl } from "./site";
export { WelcomeEmail } from "./templates/WelcomeEmail";
export type { WelcomeEmailProps } from "./templates/WelcomeEmail";
export { FileInviteEmail } from "./templates/FileInviteEmail";
export type { FileInviteEmailProps } from "./templates/FileInviteEmail";
export { RoundInviteEmail, roundInviteLabel } from "./templates/RoundInviteEmail";
export type { RoundInviteEmailProps } from "./templates/RoundInviteEmail";
export { CoachFeaturesEmail } from "./templates/CoachFeaturesEmail";
export type { CoachFeaturesEmailProps } from "./templates/CoachFeaturesEmail";
