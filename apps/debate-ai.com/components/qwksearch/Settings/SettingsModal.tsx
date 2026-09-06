'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { configureResearchAgentUI } from 'research-agent-ui';
import { Dialog, DialogContent, DialogTitle } from '@/components/qwksearch/ui/dialog';
import SettingsContent from './SettingsContent';

interface SettingsModalContextValue {
  /**
   * Opens settings in the modal. Always returns `true`: unlike qwksearch-web
   * (which navigates small screens to its /settings route), debate-ai has no
   * qwksearch settings route to fall back to — /settings here is the host
   * app's own, unrelated settings page — so the modal handles every screen
   * size and callers must never route-navigate.
   */
  openSettings: (section?: string) => boolean;
  closeSettings: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

export function useSettingsModal(): SettingsModalContextValue {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error('useSettingsModal must be used within a SettingsModalProvider');
  }
  return ctx;
}

export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | undefined>(undefined);

  const openSettings = useCallback((next?: string) => {
    setSection(next);
    setOpen(true);
    return true;
  }, []);

  const closeSettings = useCallback(() => setOpen(false), []);

  // Let the shared research-agent-ui package (e.g. the input box's settings
  // menu item) route through the modal on desktop instead of navigating.
  useEffect(() => {
    configureResearchAgentUI({ onOpenSettings: openSettings });
    return () => configureResearchAgentUI({ onOpenSettings: undefined });
  }, [openSettings]);

  return (
    <SettingsModalContext.Provider value={{ openSettings, closeSettings }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideCloseButton
          className="p-0 gap-0 max-w-4xl w-[calc(100%-2rem)] h-[85vh] overflow-hidden"
        >
          <DialogTitle className="sr-only">Settings</DialogTitle>
          {open && (
            <div className="flex h-full w-full flex-col overflow-hidden">
              {/* Re-mount per section so deep links pick the right initial tab */}
              <SettingsContent
                key={section ?? 'default'}
                onClose={closeSettings}
                initialSection={section}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SettingsModalContext.Provider>
  );
}
