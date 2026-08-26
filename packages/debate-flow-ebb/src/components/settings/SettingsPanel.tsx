"use client";

import {
    ArrowsClockwise,
    type Icon,
    GridFour,
    Keyboard,
    Palette,
    PencilSimpleLine,
    UsersThree,
    X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import ContactList from "../collab/ContactList";
import DisplayNameRow from "../collab/DisplayNameRow";
import MyEndpointId from "../collab/MyEndpointId";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Tip } from "../ui/tooltip";
import type { CardMirrorTextType } from "../../lib/bridge/cardmirror";
import {
    CARDMIRROR_COMMANDS,
    COLLAB_COMMANDS,
    COMMANDS,
    type CommandId,
} from "../../lib/commands/registry";
import { FONTS, DEFAULT_FONT_ID, type FontId } from "../../lib/fonts/registry";
import { buildChordMap } from "../../lib/keymap/displayChord";
import { eventToChord } from "../../lib/keymap/resolve";
import { restoreMenuAccelerators, suspendMenuAccelerators } from "../../lib/keymap/useDesktopMenu";
import { useSettingsShortcut } from "../../lib/keymap/useSettingsShortcut";
import type { Side } from "../../lib/model/types";
import { isMacPlatform } from "../../lib/platform";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { DEFAULT_SIDE_COLORS } from "../../lib/theme/applySideColors";
import type { ThemeMode } from "../../lib/theme/mode";
import { isDesktop } from "../../lib/update/adapter";
import { cn } from "../../lib/utils";

import FlowsFolderControl from "./FlowsFolderControl";
import SettingRow from "./SettingRow";
import SettingsSection from "./SettingsSection";
import UpdateSettings from "./UpdateSettings";

const THEME_OPTIONS: { id: ThemeMode; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "System" },
];

/** CardMirror's insert types, in the words its own document editor uses:
 *  its outline heading levels, deepest first, then plain body text. */
const CARDMIRROR_TEXT_TYPES: { value: CardMirrorTextType; label: string }[] = [
    { value: "analytic", label: "Analytic" },
    { value: "tag", label: "Tag" },
    { value: "block", label: "Block" },
    { value: "hat", label: "Hat" },
    { value: "pocket", label: "Pocket" },
    { value: "body", label: "Body" },
];

const SIDE_OPTIONS: { id: Side; label: string }[] = [
    { id: "aff", label: "Aff" },
    { id: "neg", label: "Neg" },
];

const COMMAND_LIST = Object.values(COMMANDS);

/**
 * Chords the native menu permanently owns and never exposes to the keymap:
 * Select All and Cut/Copy/Paste keep their own OS accelerators regardless of
 * any rebind, and mod+Q quits the app. Recording one of these is a silent
 * no-op rather than a saved override that would never fire.
 */
function isReservedChord(chord: string): boolean {
    const mod = isMacPlatform() ? "Meta" : "Ctrl";
    return [`${mod}+a`, `${mod}+c`, `${mod}+v`, `${mod}+x`, `${mod}+q`].includes(chord);
}

type Category = "appearance" | "grid" | "editing" | "keyboard" | "collaboration" | "updates";

const BASE_CATEGORIES: { id: Category; label: string; icon: Icon }[] = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "grid", label: "Flow & Grid", icon: GridFour },
    { id: "editing", label: "Editing", icon: PencilSimpleLine },
    { id: "keyboard", label: "Keyboard", icon: Keyboard },
];

// Both trailing categories are desktop-only: the web build has no updater, and
// shared editing runs on an endpoint only the desktop app can bind.
const CATEGORIES: { id: Category; label: string; icon: Icon }[] = isDesktop()
    ? [
          ...BASE_CATEGORIES,
          { id: "collaboration", label: "Collaboration", icon: UsersThree },
          { id: "updates", label: "Updates", icon: ArrowsClockwise },
      ]
    : BASE_CATEGORIES;

export default function SettingsPanel() {
    // The panel owns the chord that opens it, so it works on every screen.
    useSettingsShortcut();

    const open = useFlowStore((s) => s.settingsOpen);
    const keymapOverrides = useFlowStore((s) => s.keymapOverrides);
    const setKeymapOverride = useFlowStore((s) => s.setKeymapOverride);
    const clearKeymapOverride = useFlowStore((s) => s.clearKeymapOverride);
    const setSettingsOpen = useFlowStore((s) => s.setSettingsOpen);
    const flowFont = useFlowStore((s) => s.flowFont);
    const setFlowFont = useFlowStore((s) => s.setFlowFont);
    const theme = useFlowStore((s) => s.theme);
    const setTheme = useFlowStore((s) => s.setTheme);
    const affColor = useFlowStore((s) => s.affColor);
    const negColor = useFlowStore((s) => s.negColor);
    const setSideColor = useFlowStore((s) => s.setSideColor);
    const rfdVim = useFlowStore((s) => s.rfdVim);
    const setRfdVim = useFlowStore((s) => s.setRfdVim);
    const insertPaste = useFlowStore((s) => s.insertPaste);
    const setInsertPaste = useFlowStore((s) => s.setInsertPaste);
    const appendEdit = useFlowStore((s) => s.appendEdit);
    const setAppendEdit = useFlowStore((s) => s.setAppendEdit);
    const cardmirrorTextType = useFlowStore((s) => s.cardmirrorTextType);
    const setCardmirrorTextType = useFlowStore((s) => s.setCardmirrorTextType);
    const cardmirrorEnabled = useFlowStore((s) => s.cardmirrorEnabled);
    const setCardmirrorEnabled = useFlowStore((s) => s.setCardmirrorEnabled);
    const collabEnabled = useFlowStore((s) => s.collabEnabled);
    const setCollabEnabled = useFlowStore((s) => s.setCollabEnabled);
    const collabRelayEnabled = useFlowStore((s) => s.collabRelayEnabled);
    const setCollabRelayEnabled = useFlowStore((s) => s.setCollabRelayEnabled);
    const collabListenEnabled = useFlowStore((s) => s.collabListenEnabled);
    const setCollabListenEnabled = useFlowStore((s) => s.setCollabListenEnabled);
    const collabShowViewers = useFlowStore((s) => s.collabShowViewers);
    const setCollabShowViewers = useFlowStore((s) => s.setCollabShowViewers);
    const scrollZoom = useFlowStore((s) => s.scrollZoom);
    const setScrollZoom = useFlowStore((s) => s.setScrollZoom);
    const alignSpeeches = useFlowStore((s) => s.alignSpeeches);
    const setAlignSpeeches = useFlowStore((s) => s.setAlignSpeeches);
    const tooltips = useFlowStore((s) => s.tooltips);
    const setTooltips = useFlowStore((s) => s.setTooltips);
    const defaultGridZoom = useFlowStore((s) => s.defaultGridZoom);
    const setDefaultGridZoom = useFlowStore((s) => s.setDefaultGridZoom);

    const [recording, setRecording] = useState<CommandId | null>(null);
    const [category, setCategory] = useState<Category>("appearance");
    const [query, setQuery] = useState("");
    const [zoomDraft, setZoomDraft] = useState("");

    // Mirror the stored default zoom into the editable field on open and on
    // external changes (e.g. the field commits a clamped value back).
    useEffect(() => {
        setZoomDraft(String(Math.round(defaultGridZoom * 100)));
    }, [defaultGridZoom, open]);

    function commitZoom() {
        const n = parseInt(zoomDraft, 10);
        if (!Number.isNaN(n)) setDefaultGridZoom(n / 100);
        else setZoomDraft(String(Math.round(defaultGridZoom * 100)));
    }

    // Reset transient UI state whenever the dialog closes.
    useEffect(() => {
        if (!open) {
            setRecording(null);
            setQuery("");
            setCategory("appearance");
        }
    }, [open]);

    // Real menu accelerators would otherwise consume the chord being recorded
    // (and run its command) before the recorder's keydown handler sees it.
    // Suspended for the duration of recording, however it ends: chord
    // accepted, cancelled, or the panel unmounting mid-recording.
    useEffect(() => {
        if (!recording) return;
        suspendMenuAccelerators();
        return () => restoreMenuAccelerators();
    }, [recording]);

    // Inverting a keymap of a few dozen entries, so it is rebuilt rather than
    // memoized on a key the compiler cannot see it read.
    const chordByCommand = buildChordMap();

    // isDesktop() gates the bridge itself; the setting gates the user's choice.
    const cardmirrorOn = cardmirrorEnabled && isDesktop();

    // Rebinding a command a switched-off feature owns is pointless. The
    // collaboration commands are palette-only by design, so they never appear
    // here at all.
    const visibleCommands = useMemo(() => {
        const list = COMMAND_LIST.filter(
            (c) =>
                !COLLAB_COMMANDS.includes(c.id) &&
                (cardmirrorOn || !CARDMIRROR_COMMANDS.includes(c.id)),
        );
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((c) => c.label.toLowerCase().includes(q));
    }, [query, cardmirrorOn]);

    function close() {
        setSettingsOpen(false);
    }

    function onPanelKeyDown(e: React.KeyboardEvent) {
        if (recording) {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setRecording(null);
                return;
            }
            if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return;
            e.preventDefault();
            e.stopPropagation();
            const chord = eventToChord({
                key: e.key,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
            });
            if (isReservedChord(chord)) return;
            setKeymapOverride(recording, chord);
            setRecording(null);
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }

    const activeCategory = CATEGORIES.find((c) => c.id === category);

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) close();
            }}
        >
            <DialogContent
                showCloseButton={false}
                data-testid="settings-panel"
                aria-label="Settings"
                onKeyDown={onPanelKeyDown}
                className="inset-0 top-0 left-0 h-full max-h-full w-full max-w-full translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-full"
            >
                <DialogTitle className="sr-only">Settings</DialogTitle>

                {/* Header */}
                <div className="border-border flex shrink-0 items-center justify-between border-b px-6 py-3.5">
                    <span className="text-foreground text-[15px] font-semibold">Settings</span>
                    <Tip label="Close" hoverOnly>
                        <DialogClose
                            data-testid="settings-close"
                            aria-label="Close settings"
                            className="text-muted-foreground hover:text-foreground rounded transition-colors focus-visible:outline-2"
                        >
                            <X className="size-4" />
                        </DialogClose>
                    </Tip>
                </div>

                {/* Two-pane body, filling the rest of the page */}
                <div className="flex min-h-0 flex-1">
                    {/* Left nav */}
                    <nav
                        className="border-border bg-muted/30 flex w-[240px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-3"
                        aria-label="Settings categories"
                    >
                        <span className="text-muted-foreground px-2.5 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                            Options
                        </span>
                        {CATEGORIES.map((c) => {
                            const active = c.id === category;
                            const Icon = c.icon;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    data-testid={`settings-nav-${c.id}`}
                                    onClick={() => setCategory(c.id)}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors",
                                        active
                                            ? "bg-accent font-medium text-accent-foreground"
                                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                                    )}
                                >
                                    <Icon className="size-[18px] shrink-0 opacity-80" />
                                    {c.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Right content */}
                    <div className="min-w-0 flex-1 overflow-y-auto">
                        <div className="mx-auto max-w-[680px] px-8 py-8">
                            {activeCategory && (
                                <h1 className="text-foreground mb-6 text-xl font-semibold">
                                    {activeCategory.label}
                                </h1>
                            )}
                            {category === "updates" && <UpdateSettings />}
                            {category === "appearance" && (
                                <div>
                                    <SettingsSection title="Theme">
                                        <SettingRow
                                            title="Theme"
                                            control={
                                                <div
                                                    role="radiogroup"
                                                    aria-label="Theme"
                                                    className="flex items-center gap-1"
                                                >
                                                    {THEME_OPTIONS.map((t) => {
                                                        const checked = t.id === theme;
                                                        return (
                                                            <label
                                                                key={t.id}
                                                                className={cn(
                                                                    "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition-colors",
                                                                    checked
                                                                        ? "bg-accent text-foreground"
                                                                        : "text-muted-foreground hover:bg-accent/50",
                                                                )}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name="theme"
                                                                    value={t.id}
                                                                    checked={checked}
                                                                    onChange={() => setTheme(t.id)}
                                                                    data-testid={`theme-${t.id}`}
                                                                    className="accent-sel"
                                                                />
                                                                {t.label}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            }
                                        />
                                        <SettingRow
                                            title="Tooltips"
                                            description="Hover hints on buttons and controls. Turn off to hide them."
                                            control={
                                                <Switch
                                                    checked={tooltips}
                                                    onCheckedChange={setTooltips}
                                                    data-testid="tooltips-toggle"
                                                    aria-label="Tooltips"
                                                />
                                            }
                                        />
                                    </SettingsSection>
                                    <SettingsSection title="Flow styling">
                                        <SettingRow
                                            title="Flow font"
                                            description="Used for the sheet editor."
                                            control={
                                                <>
                                                    <Select
                                                        value={flowFont}
                                                        // Base UI Select renders the raw value unless given a
                                                        // value->label map to resolve the trigger display.
                                                        items={FONTS.map((f) => ({
                                                            value: f.id,
                                                            label: f.label,
                                                        }))}
                                                        onValueChange={(value) =>
                                                            setFlowFont(value as FontId)
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            aria-label="Flow font"
                                                            data-testid="flow-font-select"
                                                            className="w-44"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {FONTS.map((f) => (
                                                                <SelectItem
                                                                    key={f.id}
                                                                    value={f.id}
                                                                    data-testid={`flow-font-${f.id}`}
                                                                    style={{ fontFamily: f.cssVar }}
                                                                >
                                                                    {f.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setFlowFont(DEFAULT_FONT_ID)}
                                                        disabled={flowFont === DEFAULT_FONT_ID}
                                                        data-testid="flow-font-reset"
                                                        aria-label="Reset flow font to default"
                                                    >
                                                        Default
                                                    </Button>
                                                </>
                                            }
                                        >
                                            <p
                                                className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[13px] text-zinc-900"
                                                style={{
                                                    fontFamily:
                                                        FONTS.find((f) => f.id === flowFont)
                                                            ?.cssVar ?? FONTS[0].cssVar,
                                                }}
                                                data-testid="flow-font-sample"
                                            >
                                                Separation of powers outweighs
                                            </p>
                                        </SettingRow>
                                        <SettingRow
                                            title="Side colors"
                                            control={
                                                <>
                                                    {SIDE_OPTIONS.map((s) => {
                                                        const value =
                                                            (s.id === "aff"
                                                                ? affColor
                                                                : negColor) ??
                                                            DEFAULT_SIDE_COLORS[s.id];
                                                        return (
                                                            <label
                                                                key={s.id}
                                                                className="text-muted-foreground flex items-center gap-1.5 text-[13px]"
                                                            >
                                                                <input
                                                                    type="color"
                                                                    value={value}
                                                                    onChange={(e) =>
                                                                        setSideColor(
                                                                            s.id,
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                    data-testid={`side-color-${s.id}`}
                                                                    aria-label={`${s.label} color`}
                                                                    className="border-border h-5 w-8 cursor-pointer rounded border bg-transparent p-0"
                                                                />
                                                                {s.label}
                                                            </label>
                                                        );
                                                    })}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSideColor("aff", null);
                                                            setSideColor("neg", null);
                                                        }}
                                                        disabled={
                                                            affColor === null && negColor === null
                                                        }
                                                        data-testid="side-colors-reset"
                                                        aria-label="Reset side colors to default"
                                                    >
                                                        Default
                                                    </Button>
                                                </>
                                            }
                                        />
                                    </SettingsSection>
                                </div>
                            )}
                            {category === "grid" && (
                                <div>
                                    <SettingsSection title="Zoom & scrolling">
                                        <SettingRow
                                            title="Default zoom"
                                            description="Zoom level the flow grid opens at."
                                            control={
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={zoomDraft}
                                                        onChange={(e) =>
                                                            setZoomDraft(e.target.value)
                                                        }
                                                        onBlur={commitZoom}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter")
                                                                e.currentTarget.blur();
                                                        }}
                                                        aria-label="Default zoom percentage"
                                                        data-testid="default-zoom-input"
                                                        className="h-8 w-16 text-right tabular-nums"
                                                    />
                                                    <span className="text-muted-foreground text-[13px]">
                                                        %
                                                    </span>
                                                </div>
                                            }
                                        />
                                        <SettingRow
                                            title="Scroll to zoom"
                                            description={`Zoom the flow grid by holding ${
                                                isMacPlatform() ? "Cmd" : "Ctrl"
                                            } and scrolling, or pinching on a trackpad. Turn off to leave the wheel alone.`}
                                            control={
                                                <Switch
                                                    checked={scrollZoom}
                                                    onCheckedChange={setScrollZoom}
                                                    data-testid="scroll-zoom-toggle"
                                                    aria-label="Scroll to zoom"
                                                />
                                            }
                                        />
                                    </SettingsSection>
                                    <SettingsSection title="Layout">
                                        <SettingRow
                                            title="Visually align speeches"
                                            description="Line every sheet up on the round's speaking order, so a speech keeps one place on screen as you move between sheets. Speeches which are not accessible for that sheet type are grayed out."
                                            control={
                                                <Switch
                                                    checked={alignSpeeches}
                                                    onCheckedChange={setAlignSpeeches}
                                                    data-testid="align-speeches-toggle"
                                                    aria-label="Visually align speeches"
                                                />
                                            }
                                        />
                                    </SettingsSection>
                                    <SettingsSection title="Cell editing">
                                        <SettingRow
                                            title="Insert paste"
                                            description="With insert paste on, pasted cells push the text already in those columns down instead of writing over it."
                                            control={
                                                <Switch
                                                    checked={insertPaste}
                                                    onCheckedChange={setInsertPaste}
                                                    data-testid="insert-paste-toggle"
                                                    aria-label="Insert paste"
                                                />
                                            }
                                        />
                                        <SettingRow
                                            title="Append mode"
                                            description="With append mode on, typing on a cell that already has text adds to the end of it instead of writing over it."
                                            control={
                                                <Switch
                                                    checked={appendEdit}
                                                    onCheckedChange={setAppendEdit}
                                                    data-testid="append-edit-toggle"
                                                    aria-label="Append mode"
                                                />
                                            }
                                        />
                                    </SettingsSection>
                                    <SettingsSection title="Files">
                                        <SettingRow
                                            title="Flows folder"
                                            description="Where new flows are filed. Existing files stay where they are."
                                            control={<FlowsFolderControl />}
                                        />
                                    </SettingsSection>
                                </div>
                            )}
                            {category === "editing" && (
                                <div>
                                    <SettingsSection title="Text editors">
                                        <SettingRow
                                            title="Vim keybindings"
                                            description="Applies only to the RFD editor."
                                            control={
                                                <Switch
                                                    checked={rfdVim}
                                                    onCheckedChange={setRfdVim}
                                                    data-testid="rfd-vim-toggle"
                                                    aria-label="Vim keybindings"
                                                />
                                            }
                                        />
                                    </SettingsSection>
                                    {isDesktop() && (
                                        <SettingsSection
                                            title="CardMirror integration"
                                            className="mt-4"
                                            data-testid="cardmirror-section"
                                        >
                                            <SettingRow
                                                title="Enable CardMirror integration"
                                                control={
                                                    <Switch
                                                        checked={cardmirrorEnabled}
                                                        onCheckedChange={setCardmirrorEnabled}
                                                        data-testid="cardmirror-enabled-toggle"
                                                        aria-label="Enable CardMirror integration"
                                                    />
                                                }
                                            />
                                            {cardmirrorEnabled && (
                                                <SettingRow
                                                    title="Send to CardMirror as"
                                                    description="What style ebb should apply to text sent to CardMirror."
                                                    control={
                                                        <Select
                                                            value={cardmirrorTextType}
                                                            items={CARDMIRROR_TEXT_TYPES}
                                                            onValueChange={(value) =>
                                                                setCardmirrorTextType(
                                                                    value as CardMirrorTextType,
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                aria-label="Send to CardMirror as"
                                                                data-testid="cardmirror-text-type-select"
                                                                className="w-44"
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {CARDMIRROR_TEXT_TYPES.map((t) => (
                                                                    <SelectItem
                                                                        key={t.value}
                                                                        value={t.value}
                                                                        data-testid={`cardmirror-text-type-${t.value}`}
                                                                    >
                                                                        {t.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    }
                                                />
                                            )}
                                        </SettingsSection>
                                    )}
                                </div>
                            )}
                            {category === "collaboration" && (
                                <div data-testid="collab-section">
                                    <SettingsSection title="Shared editing">
                                        <SettingRow
                                            title="Shared editing"
                                            description="Enables collaboration features, off by default. Off, nothing reaches the network. On, sharing or joining a round does, and so does Listen for invites."
                                            control={
                                                <Switch
                                                    checked={collabEnabled}
                                                    onCheckedChange={setCollabEnabled}
                                                    data-testid="collab-enabled-toggle"
                                                    aria-label="Shared editing"
                                                />
                                            }
                                        />
                                        {collabEnabled && (
                                            <>
                                                <SettingRow
                                                    title="Allow relay"
                                                    description="Off restricts a session to direct connections. On enables connections across networks."
                                                    control={
                                                        <Switch
                                                            checked={collabRelayEnabled}
                                                            onCheckedChange={setCollabRelayEnabled}
                                                            data-testid="collab-relay-toggle"
                                                            aria-label="Allow relay"
                                                        />
                                                    }
                                                />
                                                <SettingRow
                                                    title="Listen for invites"
                                                    description="Keeps an endpoint open the whole time ebb is running so a saved contact can share a round with you."
                                                    control={
                                                        <Switch
                                                            checked={collabListenEnabled}
                                                            onCheckedChange={
                                                                setCollabListenEnabled
                                                            }
                                                            data-testid="collab-listen-toggle"
                                                            aria-label="Listen for invites"
                                                        />
                                                    }
                                                />
                                                <SettingRow
                                                    title="Show viewer cursors"
                                                    description="Marks the cell a view-only peer is looking at. Off hides them, leaving only the cells a partner is editing."
                                                    control={
                                                        <Switch
                                                            checked={collabShowViewers}
                                                            onCheckedChange={
                                                                setCollabShowViewers
                                                            }
                                                            data-testid="collab-show-viewers-toggle"
                                                            aria-label="Show viewer cursors"
                                                        />
                                                    }
                                                />
                                            </>
                                        )}
                                    </SettingsSection>
                                    {collabEnabled && (
                                        <SettingsSection title="Identity & contacts">
                                            <DisplayNameRow />
                                            <MyEndpointId />
                                            <ContactList />
                                        </SettingsSection>
                                    )}
                                </div>
                            )}
                            {category === "keyboard" && (
                                <div className="flex flex-col gap-3">
                                    {/* Filter */}
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Filter shortcuts…"
                                        data-testid="shortcut-filter"
                                        aria-label="Filter shortcuts"
                                        className="h-8"
                                    />

                                    {/* Command list */}
                                    <ul className="border-border bg-card m-0 flex list-none flex-col rounded-lg border p-0">
                                        {visibleCommands.map((cmd) => {
                                            const chord = chordByCommand[cmd.id];
                                            const overridden =
                                                keymapOverrides[cmd.id] !== undefined;
                                            const isRecording = recording === cmd.id;
                                            return (
                                                <li
                                                    key={cmd.id}
                                                    className="border-border/60 grid items-center gap-2.5 border-b px-3 py-1.5 last:border-b-0"
                                                    style={{
                                                        gridTemplateColumns:
                                                            "1fr auto auto auto",
                                                    }}
                                                    data-testid={`cmd-${cmd.id}`}
                                                >
                                                    <span className="text-foreground overflow-hidden text-[13px] text-ellipsis whitespace-nowrap">
                                                        {cmd.label}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "bg-muted min-w-[64px] rounded-md border px-1.5 py-0.5 text-center font-mono text-[12px] whitespace-nowrap",
                                                            overridden
                                                                ? "border-sel text-sel"
                                                                : "border-border text-muted-foreground",
                                                        )}
                                                        data-testid={`chord-${cmd.id}`}
                                                    >
                                                        {isRecording
                                                            ? "Press a key…"
                                                            : (chord ?? "—")}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant={
                                                            isRecording ? "default" : "outline"
                                                        }
                                                        size="sm"
                                                        onClick={() =>
                                                            setRecording(
                                                                isRecording ? null : cmd.id,
                                                            )
                                                        }
                                                        data-testid={`record-${cmd.id}`}
                                                    >
                                                        {isRecording ? "Cancel" : "Record"}
                                                    </Button>
                                                    <Tip label={`Reset ${cmd.label} binding`}>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                clearKeymapOverride(cmd.id)
                                                            }
                                                            disabled={!overridden}
                                                            data-testid={`reset-${cmd.id}`}
                                                            aria-label={`Reset ${cmd.label} binding`}
                                                        >
                                                            Reset
                                                        </Button>
                                                    </Tip>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
