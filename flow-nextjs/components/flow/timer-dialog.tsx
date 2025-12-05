"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Timer as TimerIcon } from "lucide-react";
import { SpeechTimer } from "@/components/timer/speech-timer";
import { debateStyles } from "@/lib/flow/types";
import { useSettings } from "@/contexts/settings-context";

interface TimerDialogProps {
  trigger?: React.ReactNode;
}

export function TimerDialog({ trigger }: TimerDialogProps) {
  const { settings } = useSettings();

  // Get current debate style
  const debateStyleIndex = settings.debateStyle.value;
  const currentDebateStyle = debateStyles[debateStyleIndex];

  // Get timer speeches from debate style
  const speeches = currentDebateStyle.timer || [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <TimerIcon className="h-4 w-4 mr-2" />
            Timer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Speech Timer</DialogTitle>
          <DialogDescription>
            Timer for {currentDebateStyle.name}
          </DialogDescription>
        </DialogHeader>

        {speeches.length > 0 ? (
          <SpeechTimer speeches={speeches} />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No timer preset available for this debate style.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
