/**
 * The article panel's toolbar: Ask AI, Suggest, Copy, Share, Highlight, the
 * card-reuse check, open-in-tab, zoom and close.
 *
 * Ported from research-agent-ui's `ArticleActionButtons`
 * (qwksearch-research-agent/packages/research-agent-ui/src/components/ArticleReader),
 * including its tooltips and the exported shortcut table the panel binds keys
 * from, so the displayed shortcut and the actual binding cannot drift apart.
 *
 * One action is not the original's: where the app had "favorite", which is an
 * account feature debate-ai.com does not have, this has the card-reuse check —
 * has anyone on my team already cut a card from this page? That is the
 * question a debater reading a page actually has, and the extension already
 * answers it in its popup.
 */
import {
  Bot,
  Clipboard,
  ExternalLink,
  Highlighter,
  Layers,
  MessageCircleQuestion,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Keyboard shortcut definitions for the toolbar actions. `alt` means the
 * shortcut requires the Alt/Option modifier; `close` uses a bare Escape key.
 */
export const ARTICLE_TOOLBAR_SHORTCUTS = {
  ask: { alt: true, key: 'a' },
  suggest: { alt: true, key: 's' },
  copy: { alt: true, key: 'c' },
  highlight: { alt: true, key: 'h' },
  cards: { alt: true, key: 'k' },
  open: { alt: true, key: 'o' },
  zoomOut: { alt: true, key: '-' },
  zoomReset: { alt: true, key: '0' },
  zoomIn: { alt: true, key: '=' },
  close: { alt: false, key: 'Escape' },
} as const;

export type ArticleToolbarAction = keyof typeof ARTICLE_TOOLBAR_SHORTCUTS;

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

/** A shortcut as a short, platform-aware label ("⌥A", "Alt+A", "Esc"). */
export function formatToolbarShortcut(action: ArticleToolbarAction): string {
  const { alt, key } = ARTICLE_TOOLBAR_SHORTCUTS[action];
  const keyLabel = key === 'Escape' ? 'Esc' : key.length === 1 ? key.toUpperCase() : key;
  if (!alt) return keyLabel;
  return isMac ? `⌥${keyLabel}` : `Alt+${keyLabel}`;
}

interface ArticleActionButtonsProps {
  isLoadingAI: boolean;
  isLoadingFollowups: boolean;
  isCheckingCards: boolean;
  isHighlightMode: boolean;
  articleUrl?: string;
  fontScale?: number;
  onAskClick: () => void;
  onSuggestClick: () => void;
  onCopyClick: () => void;
  onShareClick: () => void;
  onCheckCardsClick: () => void;
  onHighlightToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClose: () => void;
}

const iconButtonClass = cn(
  'h-8 w-8 rounded-xl transition-all duration-200',
  'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
);

/** Wraps a control in a tooltip showing its label and keyboard shortcut. */
const ToolbarTip: React.FC<{
  label: string;
  action?: ArticleToolbarAction;
  children: React.ReactNode;
}> = ({ label, action, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom">
      <span className="flex items-center gap-1.5">
        <span>{label}</span>
        {action && (
          <kbd className="rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] font-semibold leading-none tracking-wide">
            {formatToolbarShortcut(action)}
          </kbd>
        )}
      </span>
    </TooltipContent>
  </Tooltip>
);

const ArticleActionButtons: React.FC<ArticleActionButtonsProps> = ({
  isLoadingAI,
  isLoadingFollowups,
  isCheckingCards,
  isHighlightMode,
  articleUrl,
  fontScale = 1,
  onAskClick,
  onSuggestClick,
  onCopyClick,
  onShareClick,
  onCheckCardsClick,
  onHighlightToggle,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClose,
}) => {
  const zoomPercent = Math.round(fontScale * 100);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-muted bg-gradient-to-b from-background to-muted/30 p-1 shadow-sm">
      <ToolbarTip label="Ask AI about this article" action="ask">
        <Button
          onClick={onAskClick}
          disabled={isLoadingAI}
          variant="ghost"
          size="sm"
          className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground"
        >
          <Bot className="size-4" />
          <span className="font-medium">{isLoadingAI ? '…' : 'Ask'}</span>
        </Button>
      </ToolbarTip>

      <ToolbarTip label="Suggest follow-up questions" action="suggest">
        <Button
          onClick={onSuggestClick}
          disabled={isLoadingFollowups}
          variant="ghost"
          size="sm"
          className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground"
        >
          <MessageCircleQuestion className="size-4" />
          <span className="font-medium">Suggest</span>
        </Button>
      </ToolbarTip>

      <ToolbarTip label="Copy article with citation" action="copy">
        <Button onClick={onCopyClick} variant="ghost" size="icon" className={iconButtonClass}>
          <Clipboard className="size-4" />
        </Button>
      </ToolbarTip>

      <ToolbarTip label="Share article">
        <Button onClick={onShareClick} variant="ghost" size="icon" className={iconButtonClass}>
          <Share2 className="size-4" />
        </Button>
      </ToolbarTip>

      <ToolbarTip
        label={isHighlightMode ? 'Disable highlighting' : 'Enable highlighting'}
        action="highlight"
      >
        <Button
          onClick={onHighlightToggle}
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 rounded-xl transition-all duration-200',
            isHighlightMode
              ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:hover:bg-yellow-950/50'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
          )}
        >
          <Highlighter className="size-4" />
        </Button>
      </ToolbarTip>

      <ToolbarTip label="Has a card already been cut from this page?" action="cards">
        <Button
          onClick={onCheckCardsClick}
          disabled={isCheckingCards}
          variant="ghost"
          size="icon"
          className={iconButtonClass}
        >
          <Layers className="size-4" />
        </Button>
      </ToolbarTip>

      {articleUrl && (
        <ToolbarTip label="Open in a new tab" action="open">
          <Button asChild variant="ghost" size="icon" className={iconButtonClass}>
            <a href={articleUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </ToolbarTip>
      )}

      <div className="ml-auto flex items-center gap-0.5 rounded-xl border border-muted/60 bg-muted/20 px-1">
        <ToolbarTip label="Zoom out" action="zoomOut">
          <Button
            onClick={onZoomOut}
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground"
          >
            <ZoomOut className="size-4" />
          </Button>
        </ToolbarTip>
        <ToolbarTip label="Reset zoom" action="zoomReset">
          <button
            type="button"
            onClick={onZoomReset}
            className="min-w-[2.75rem] rounded-md px-1 text-center text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground"
          >
            {zoomPercent}%
          </button>
        </ToolbarTip>
        <ToolbarTip label="Zoom in" action="zoomIn">
          <Button
            onClick={onZoomIn}
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground"
          >
            <ZoomIn className="size-4" />
          </Button>
        </ToolbarTip>
      </div>

      <ToolbarTip label="Close the panel" action="close">
        <Button onClick={onClose} variant="ghost" size="icon" className={iconButtonClass}>
          <X className="size-4" />
        </Button>
      </ToolbarTip>
    </div>
  );
};

export default ArticleActionButtons;
