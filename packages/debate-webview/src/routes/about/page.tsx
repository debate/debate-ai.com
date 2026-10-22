import { DebateAiLogo } from "@debate/icons/brand"
import {
    APP_LOGO_HEIGHT,
    APP_LOGO_WIDTH,
    APP_NAME,
} from "../../lib/config/site"

/** The open-source repository the About page invites contributions to. */
const ABOUT_REPO_URL = "https://github.com/debate/debate-ai.com"

/**
 * The About page, linked from the sidebar footer. One short paragraph on who
 * builds Debate AI, under the same logo-linked-home header as the privacy page.
 */
export default function AboutPage() {
    return (
        <div className="mx-auto max-w-2xl px-4 py-8">
            <div className="flex justify-center">
                <a href="/" aria-label={`${APP_NAME} home`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={DebateAiLogo}
                        alt={APP_NAME}
                        width={APP_LOGO_WIDTH}
                        height={APP_LOGO_HEIGHT}
                        className="h-auto w-full max-w-[280px]"
                    />
                </a>
            </div>
            <h1 className="mt-8 text-2xl font-semibold">About {APP_NAME}</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
                {APP_NAME} was founded by former competitive debaters and AI
                technology researchers. The project is open source, and we
                welcome contributions on{" "}
                <a
                    href={ABOUT_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                >
                    GitHub
                </a>
                . With every card cut, round flowed and idea shared, {APP_NAME}{" "}
                keeps growing as a decentralized brain for the debate community.
            </p>
        </div>
    );
}
