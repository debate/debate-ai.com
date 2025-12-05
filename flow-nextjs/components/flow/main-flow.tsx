"use client";

import React from "react";
import { useFlowContext } from "@/contexts/flow-context";
import { useSettings } from "@/contexts/settings-context";
import { FlowTab } from "./flow-tab";
import { FlowDisplay } from "./flow-display";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Settings as SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function MainFlow() {
  const { flows, selectedIndex, setSelectedIndex, addFlow, deleteFlow, updateFlow } =
    useFlowContext();
  const { settings } = useSettings();

  const selectedFlow = flows[selectedIndex];
  const debateStyles = settings.debateStyle.options;
  const currentDebateStyle = debateStyles[settings.debateStyle.value];

  // Handle add flow
  const handleAddFlow = (type: "primary" | "secondary") => {
    addFlow(type);
  };

  // Handle delete flow
  const handleDeleteFlow = (index: number) => {
    if (flows.length > 1 || window.confirm("Delete the last flow?")) {
      deleteFlow(index);
    }
  };

  // Handle export flows
  const handleExport = () => {
    const dataStr = JSON.stringify(flows, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `flows-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle import flows
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const imported = JSON.parse(e.target?.result as string);
            // TODO: Validate and set flows
            console.log("Imported flows:", imported);
          } catch (error) {
            console.error("Failed to import flows:", error);
            alert("Failed to import flows. Please check the file format.");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="main-flow flex flex-col h-screen bg-background">
      {/* Top Bar */}
      <div className="top-bar flex items-center justify-between gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">FLOW</h1>
          <span className="text-sm text-muted-foreground">{currentDebateStyle}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="icon">
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar flex items-end gap-1 px-2 pt-2 border-b overflow-x-auto">
        <ScrollArea className="w-full">
          <div className="flex items-end gap-1 min-w-max">
            {flows.map((flow, index) => (
              <FlowTab
                key={flow.id}
                flow={flow}
                selected={index === selectedIndex}
                onClick={() => setSelectedIndex(index)}
                onClose={flows.length > 1 ? () => handleDeleteFlow(index) : undefined}
              />
            ))}

            {/* Add Flow Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 rounded-t-lg rounded-b-none"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleAddFlow("primary")}>
                  Add Primary Flow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddFlow("secondary")}>
                  Add Secondary Flow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ScrollArea>
      </div>

      {/* Flow Content */}
      <div
        className="flow-content-area flex-1 overflow-hidden"
        style={{
          // Apply CSS variables from settings
          "--column-width": `${settings.columnWidth.value}px`,
          "--accent-hue": settings.accentHue.value,
          "--accent-secondary-hue": settings.accentSecondaryHue.value,
          "--border-radius": `${settings.borderRadius.value}px`,
          "--padding": `${settings.padding.value}px`,
          "--gap": `${settings.gap.value}px`,
          "--transition-speed": `${settings.transitionSpeed.value}ms`,
        } as React.CSSProperties}
      >
        {selectedFlow ? (
          <FlowDisplay
            flow={selectedFlow}
            onUpdate={(updatedFlow) => updateFlow(selectedIndex, updatedFlow)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-4">No flows yet</p>
              <Button onClick={() => handleAddFlow("primary")}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Flow
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved changes indicator */}
      {flows.length > 0 && (
        <div className="status-bar px-4 py-1 text-xs text-muted-foreground border-t bg-muted/30">
          {flows.length} flow{flows.length !== 1 ? "s" : ""} • Auto-saved
        </div>
      )}
    </div>
  );
}
