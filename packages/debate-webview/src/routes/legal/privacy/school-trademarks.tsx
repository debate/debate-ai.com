import type { LegalVariant } from "legal-terms-privacy-policy/react"

/**
 * Debate AI's own clause on school and university names, logos and other
 * marks, shown on team, school, rankings and round pages. The shared
 * `legal-terms-privacy-policy` document has no slot for site-specific clauses,
 * so this section is appended after it: numbered 19 to follow the shared
 * document's last section (18) in the full text, and as a short paragraph in
 * the plain-language summary.
 */
export function SchoolTrademarksSection({
    appName,
    variant,
}: {
    appName: string
    variant: LegalVariant
}) {
    if (variant === "summary") {
        return (
            <section id="school-trademarks">
                <h2>School names and logos</h2>
                <p>
                    School names, logos, and wordmarks belong to their respective owners.{" "}
                    {appName} is an independent service and is not affiliated with, sponsored by,
                    or endorsed by the institutions shown.
                </p>
            </section>
        )
    }

    return (
        <section id="school-trademarks">
            <h2>19. School Names, Logos, and Trademarks</h2>
            <p>
                All school and university names, logos, wordmarks, seals, and other trademarks
                displayed on {appName} are the property of their respective owners. These marks
                are used solely to identify and reference the relevant institutions. {appName}{" "}
                claims no ownership of these marks.
            </p>
            <p>
                {appName} is an independent service and is not affiliated with, sponsored by,
                endorsed by, or officially connected with any school or university identified on
                the service, unless expressly stated otherwise. The display of an
                institution&apos;s name or marks does not imply that institution&apos;s approval
                of {appName}, its services, or its content.
            </p>
            <p>Nothing in these Terms grants users any rights to use third-party trademarks.</p>
        </section>
    )
}
