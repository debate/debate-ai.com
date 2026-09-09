"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { copyText, selectNode } from "../../lib/clipboard";
import { aboutRows, formatReport, getAboutSystem, type AboutSystem } from "../../lib/system/about";
import { Button } from "../ui/button";

import SettingRow from "./SettingRow";
import SettingsSection from "./SettingsSection";

/**
 * "About system": what this copy of the app is running on, and a one-click
 * copy of the whole thing for a bug report.
 *
 * Shown on both hosts rather than gated to desktop like the update settings
 * next door — the browser can say less (see `osFromUserAgent`), but "which
 * engine was this" is exactly as useful in a web bug report, and a panel that
 * vanished on the web would just send people hunting for it.
 */
export default function AboutSystemSettings() {
    const [about, setAbout] = useState<AboutSystem | null>(null);
    const [copied, setCopied] = useState(false);
    const reportRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        let cancelled = false;
        void getAboutSystem().then((result) => {
            if (!cancelled) setAbout(result);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Reverts the button's confirmation, and cancels that revert if the user
    // copies again before it lands.
    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), 1600);
        return () => clearTimeout(timer);
    }, [copied]);

    async function copyReport() {
        if (!about) return;
        const ok = await copyText(formatReport(about));
        // A refused clipboard leaves the report selected instead, so the
        // user's own Cmd+C still gets them the same text.
        if (ok) setCopied(true);
        else selectNode(reportRef.current);
    }

    if (!about) {
        return (
            <p className="text-muted-foreground py-3 text-[13px]" data-testid="about-system-loading">
                Reading system information…
            </p>
        );
    }

    const rows = aboutRows(about);

    return (
        <div className="flex flex-col" data-testid="about-system">
            <SettingsSection
                title="About system"
                description="What this copy of the app is running on. Include it when you report a bug."
            >
                {rows.map((row) => (
                    <SettingRow
                        key={row.label}
                        title={row.label}
                        control={
                            <span className="text-foreground max-w-[320px] truncate text-right text-[13px]">
                                {row.value}
                            </span>
                        }
                    />
                ))}
            </SettingsSection>

            <SettingsSection
                title="Bug report"
                description="The same details as plain text, plus the full user agent string."
            >
                <SettingRow
                    title="System report"
                    control={
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyReport()}
                            data-testid="copy-system-report"
                        >
                            {copied ? <Check /> : <Copy />}
                            {copied ? "Copied" : "Copy"}
                        </Button>
                    }
                >
                    <pre
                        ref={reportRef}
                        data-testid="system-report"
                        className="text-muted-foreground bg-muted/40 overflow-x-auto rounded-md p-3 text-[11.5px] leading-relaxed whitespace-pre"
                    >
                        {formatReport(about)}
                    </pre>
                </SettingRow>
            </SettingsSection>
        </div>
    );
}
