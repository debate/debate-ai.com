"use client";

/**
 * @fileoverview Collapsible component for showing/hiding content
 * @module components/debate/flow/ui/primitives/collapsible
 */

import { ChevronDown } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "../lib/utils";

interface CollapsibleProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Collapsible = forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ children, className, open, defaultOpen = false, onOpenChange, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const controlled = open !== undefined;
    const currentOpen = controlled ? open : isOpen;

    const handleOpenChange = (value: boolean) => {
      if (!controlled) setIsOpen(value);
      onOpenChange?.(value);
    };

    return (
      <div
        ref={ref}
        className={cn("border border-border rounded-lg", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Collapsible.displayName = "Collapsible";

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export const CollapsibleTrigger = forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ children, className, asChild, ...props }, ref) => {
    // Find parent Collapsible context
    // For simplicity, we'll use a simple implementation
    const [isOpen, setIsOpen] = useState(false);

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-left font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
    );
  }
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
  forceMount?: boolean;
}

export const CollapsibleContent = forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ children, className, forceMount, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!isOpen && !forceMount) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isOpen ? "animate-collapsible-down" : "animate-collapsible-up",
          className
        )}
        {...props}
      >
        <div className="pt-0 pb-4">{children}</div>
      </div>
    );
  }
);
CollapsibleContent.displayName = "CollapsibleContent";