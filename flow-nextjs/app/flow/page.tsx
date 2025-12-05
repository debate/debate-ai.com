"use client";

import { MainFlow } from "@/components/flow/main-flow";
import { FlowProvider } from "@/contexts/flow-context";
import { SettingsProvider } from "@/contexts/settings-context";

export default function FlowPage() {
  return (
    <SettingsProvider>
      <FlowProvider>
        <MainFlow />
      </FlowProvider>
    </SettingsProvider>
  );
}
