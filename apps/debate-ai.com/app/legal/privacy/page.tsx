import type { Metadata } from "next"
import { APP_NAME } from "debate-ai-webui/lib/config/site"

export const metadata: Metadata = {
    title: `${APP_NAME} Terms of Service and Privacy Policy`,
    description: `Terms of Service and Privacy Policy for ${APP_NAME}`,
};

export { default } from "debate-ai-webui/routes/legal/privacy/page"
