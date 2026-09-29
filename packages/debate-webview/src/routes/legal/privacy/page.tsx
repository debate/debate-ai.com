import { LegalTermsPrivacyPolicy } from "legal-terms-privacy-policy/react"
import {
    APP_EMAIL,
    APP_LOGO,
    APP_LOGO_HEIGHT,
    APP_LOGO_WIDTH,
    APP_NAME,
    LAST_REVISED_DATE,
} from "../../../lib/config/site"

/**
 * The clauses live in the shared `legal-terms-privacy-policy` package, so this
 * page and the ones on QwkSearch, AI Broker, Grab URL and Rights Institute
 * cannot drift apart. Only what is specific to Debate AI is set here.
 *
 * Opens on the full legal text — the document this page has always published —
 * with a switch to the plain-language summary. The shared component has no
 * logo slot, so the Debate AI logo sits above it, linked home.
 */
export default function PrivacyPage() {
    return (
        <>
            <div className="flex justify-center px-4 pt-8">
                <a href="/" aria-label={`${APP_NAME} home`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={APP_LOGO}
                        alt={APP_NAME}
                        width={APP_LOGO_WIDTH}
                        height={APP_LOGO_HEIGHT}
                        className="h-auto w-full max-w-[280px]"
                    />
                </a>
            </div>
            <LegalTermsPrivacyPolicy
                appName={APP_NAME}
                contactEmail={APP_EMAIL}
                lastRevisedDate={LAST_REVISED_DATE}
                homeUrl="/"
                defaultVariant="full"
            />
        </>
    );
}
