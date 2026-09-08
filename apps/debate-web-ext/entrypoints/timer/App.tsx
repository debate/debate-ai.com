import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { browser } from 'wxt/browser';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Timeline } from '@/src/components/Timeline';
import { TimerFace } from '@/src/components/TimerFace';
import { DEBATE_TYPES } from '@/src/timer/constants';
import { useTimer } from '@/src/timer/useTimer';

/** The timer page — rendered in its own browser window, not the action popup. */
export default function App() {
  const timer = useTimer();
  const [tab, setTab] = useState<'timer' | 'timeline'>('timer');

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'timer' | 'timeline')}>
          <div className="app-header">
            <TabsList>
              <TabsTrigger value="timer">Timer</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1.5">
              <Select
                value={String(timer.debateType)}
                onValueChange={(v) => void timer.changeDebateType(Number(v))}
              >
                <SelectTrigger className="h-8 w-[150px]" aria-label="Debate format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEBATE_TYPES.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Extension settings"
                    onClick={() => browser.runtime.openOptionsPage()}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <TabsContent value="timer" className="tab-body">
            {timer.ready && <TimerFace timer={timer} />}
          </TabsContent>

          <TabsContent value="timeline" className="tab-body">
            <Timeline active={tab === 'timeline'} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
