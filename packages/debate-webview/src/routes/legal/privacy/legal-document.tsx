"use client"

import { useState } from "react"
import {
    FullLegalTerms,
    LegalSummary,
    legalTermsStyles,
    type LegalVariant,
} from "legal-terms-privacy-policy/react"
import { SchoolTrademarksSection } from "./school-trademarks"

/**
 * The shared Terms of Service and Privacy Policy, plus Debate AI's own
 * sections. Mirrors `LegalTermsPrivacyPolicy` from the shared package (same
 * classes, same full/summary switch) but composes it from the package's
 * exported parts, because that component has no way to add a section.
 */
export function LegalDocument({
    appName,
    contactEmail,
    lastRevisedDate,
    homeUrl,
    defaultVariant = "full",
}: {
    appName: string
    contactEmail: string
    lastRevisedDate: string
    homeUrl?: string
    defaultVariant?: LegalVariant
}) {
    const [variant, setVariant] = useState<LegalVariant>(defaultVariant)
    const showingSummary = variant === "summary"

    return (
        <main className="legal-terms-page">
            <style>{legalTermsStyles}</style>

            <div className="legal-terms-header">
                {homeUrl ? (
                    <a href={homeUrl} className="legal-terms-back">
                        Back to Home
                    </a>
                ) : (
                    <span />
                )}
                <button
                    type="button"
                    className="legal-terms-switch"
                    onClick={() => setVariant(showingSummary ? "full" : "summary")}
                    aria-pressed={showingSummary}
                >
                    {showingSummary ? "Read the full legal text" : "Read the plain-language summary"}
                </button>
            </div>

            <h1>{appName} Terms of Service and Privacy Policy</h1>
            <p>
                <strong>Revised Date: {lastRevisedDate}</strong>
            </p>

            {showingSummary ? (
                <LegalSummary appName={appName} contactEmail={contactEmail} />
            ) : (
                <FullLegalTerms appName={appName} contactEmail={contactEmail} />
            )}
            <SchoolTrademarksSection appName={appName} variant={variant} />
        </main>
    )
}
