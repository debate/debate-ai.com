import type { Metadata } from "next"
import { APP_NAME } from "@debate-ai/webview/lib/config/site"

export const metadata: Metadata = {
    title: `About ${APP_NAME}`,
    description: `${APP_NAME} is founded by ex-debaters and AI researchers, and open to contributions.`,
};

export { default } from "@debate-ai/webview/routes/about/page"
