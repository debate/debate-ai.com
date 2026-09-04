import { cn } from "../../lib/utils";

/**
 * A neutral placeholder block for loading states. Pulses only when motion is
 * allowed; collapses to a static tint under prefers-reduced-motion.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="skeleton"
            className={cn("rounded-md bg-accent motion-safe:animate-pulse", className)}
            {...props}
        />
    );
}

export { Skeleton };
