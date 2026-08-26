import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

/**
 * One labeled group of settings rows inside a category page: a small
 * heading (+ optional description) above a bordered card holding the
 * rows. Rows supply their own divider between each other (see
 * `SettingRow`) — the card only needs the outer border.
 */
export default function SettingsSection({
    title,
    description,
    className,
    children,
    "data-testid": dataTestId,
}: {
    title: ReactNode;
    description?: ReactNode;
    className?: string;
    children: ReactNode;
    "data-testid"?: string;
}) {
    return (
        <section className={cn("mt-8 first:mt-0", className)} data-testid={dataTestId}>
            <div className="mb-3">
                <h2 className="text-foreground text-[13px] font-semibold">{title}</h2>
                {description && (
                    <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
                        {description}
                    </p>
                )}
            </div>
            <div className="border-border bg-card rounded-lg border px-4">{children}</div>
        </section>
    );
}
