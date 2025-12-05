"use client";

import { FlowWithHistory } from "@/components/flow/flow-with-history";
import { FlowProvider } from "@/contexts/flow-context";
import { SettingsProvider } from "@/contexts/settings-context";

export default function FlowPage() {
  return (
    <SettingsProvider>
      <FlowProvider>
        <FlowWithHistory />
      </FlowProvider>
    </SettingsProvider>
  );
}
