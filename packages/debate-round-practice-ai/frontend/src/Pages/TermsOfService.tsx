// src/Pages/TermsOfService.tsx
import { LegalTermsPrivacyPolicy } from 'legal-terms-privacy-policy/react';

/**
 * The full Terms of Service and Privacy Policy, from the shared
 * `legal-terms-privacy-policy` package — the same document the main Debate AI
 * site publishes, so the two cannot drift apart.
 *
 * `/privacy-policy` renders the same component; they are one combined document,
 * and both routes are kept so existing links keep working.
 */
function TermsOfService() {
  return (
    <LegalTermsPrivacyPolicy
      appName="DebateAI"
      companyName="AOSSIE"
      contactEmail="noreply@debate-ai.com"
      lastRevisedDate="2026-08-26"
      homeUrl="/"
      defaultVariant="full"
    />
  );
}

export default TermsOfService;
