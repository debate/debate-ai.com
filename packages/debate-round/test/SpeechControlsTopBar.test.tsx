/** Render test for `SpeechControlsTopBar`'s host-supplied leading slot (node env, `react-dom/server` markup). */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SpeechControlsTopBar } from "../src/layout/SpeechControlsTopBar";

const noop = () => {};

const render = (leadingActions?: React.ReactNode, showViewControls?: boolean) =>
  renderToStaticMarkup(
    <SpeechControlsTopBar
      speechName="1AR"
      viewMode="read"
      quoteView={false}
      onViewModeChange={noop}
      onQuoteViewToggle={noop}
      layoutMode="single"
      onToggleLayoutMode={noop}
      onOpenSpeechPanel={noop}
      micDeviceId=""
      onMicDeviceChange={noop}
      recordingEnabled={false}
      onRecordingEnabledChange={noop}
      onResetSpeechTime={noop}
      onSwitchToCrossX={noop}
      onResetPrepTimers={noop}
      hasRecording={false}
      onDeleteRecording={noop}
      showRecordingMenu={false}
      showViewControls={showViewControls}
      leadingActions={leadingActions}
    />,
  );

describe("SpeechControlsTopBar leadingActions", () => {
  it("renders the host's controls first in the bar", () => {
    const html = render(<span data-testid="sync-badge">Saved to your account</span>);
    expect(html).toContain('data-testid="sync-badge"');
    expect(html.indexOf("sync-badge")).toBeLessThan(html.indexOf("1AR speech document"));
  });

  it("renders the bar unchanged when no controls are supplied", () => {
    const html = render();
    expect(html).toContain("1AR speech document");
    expect(html).not.toContain("sync-badge");
  });
});

describe("SpeechControlsTopBar showViewControls", () => {
  it("leaves the view controls out when the round sidebar shows them", () => {
    const html = render(undefined, false);
    expect(html).not.toContain("1AR speech document");
  });
});
