import type { Metadata } from "next"
import { APP_NAME } from "debate-webview/lib/config/site"

export const metadata: Metadata = {
    title: `${APP_NAME} Terms of Service and Privacy Policy`,
    description: `Terms of Service and Privacy Policy for ${APP_NAME}`,
};

export { default } from "debate-webview/routes/legal/privacy/page"
