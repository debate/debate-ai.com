import type { Metadata } from 'next';
import { LegalTermsPrivacyPolicy } from 'legal-terms-privacy-policy/react';
import { APP_NAME, APP_EMAIL, LAST_REVISED_DATE } from '@/lib/config/site';

export const metadata: Metadata = {
    title: `${APP_NAME} Terms of Service and Privacy Policy`,
    description: `Terms of Service and Privacy Policy for ${APP_NAME}`,
};

/**
 * The clauses live in the shared `legal-terms-privacy-policy` package, so this
 * page and the ones on QwkSearch, AI Broker, Grab URL and Rights Institute
 * cannot drift apart. Only what is specific to Debate AI is set here.
 *
 * Opens on the full legal text — the document this page has always published —
 * with a switch to the plain-language summary.
 */
export default function PrivacyPage() {
    return (
        <LegalTermsPrivacyPolicy
            appName={APP_NAME}
            contactEmail={APP_EMAIL}
            lastRevisedDate={LAST_REVISED_DATE}
            homeUrl="/"
            defaultVariant="full"
        />
    );
}
