import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

/**
 * One settings row: title and optional description on the left, a control on
 * the right, divided from its neighbors by a hairline. Extra full-width content
 * (a preview, a sub-list) goes in `children`, rendered below the row.
 */
export default function SettingRow({
    title,
    description,
    control,
    className,
    children,
}: {
    title: ReactNode;
    description?: ReactNode;
    control?: ReactNode;
    className?: string;
    children?: ReactNode;
}) {
    return (
        <div className={cn("border-border/60 border-b py-3 last:border-b-0", className)}>
            <div className="flex items-center justify-between gap-8">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-foreground text-[14px] font-medium">{title}</span>
                    {description && (
                        <p className="text-muted-foreground text-[12px] leading-snug">
                            {description}
                        </p>
                    )}
                </div>
                {control && <div className="flex shrink-0 items-center gap-2">{control}</div>}
            </div>
            {children && <div className="mt-2">{children}</div>}
        </div>
    );
}
