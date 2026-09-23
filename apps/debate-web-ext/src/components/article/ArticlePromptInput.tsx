/**
 * The "ask AI anything about this article" box. Submits on Enter.
 *
 * Ported from research-agent-ui's `ArticlePromptInput`.
 */
import React from 'react';

interface ArticlePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const ArticlePromptInput: React.FC<ArticlePromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
}) => (
  <input
    value={value}
    onChange={(event) => onChange(event.target.value)}
    onKeyDown={(event) => {
      if (event.key === 'Enter') onSubmit();
    }}
    disabled={disabled}
    type="text"
    placeholder="Ask AI any question…"
    aria-label="Ask AI about this article"
    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
  />
);

export default ArticlePromptInput;
