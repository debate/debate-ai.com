/**
 * The clickable list of AI-suggested follow-up questions.
 *
 * Ported from research-agent-ui's `ArticleFollowupQuestions`, including the
 * splitting of a model reply that crams several questions onto one line. The
 * one change is that questions are rendered as text rather than as HTML: they
 * come straight from a model here, with no server in between to have
 * sanitized them.
 */
import React from 'react';

interface ArticleFollowupQuestionsProps {
  questions: string[];
  summarizePrompt: string;
  isLoading: boolean;
  error: string;
  onQuestionClick: (question: string) => void;
}

const ArticleFollowupQuestions: React.FC<ArticleFollowupQuestionsProps> = ({
  questions,
  summarizePrompt,
  isLoading,
  error,
  onQuestionClick,
}) => {
  // A model asked for one question per line sometimes answers with several in
  // a single line; split those so each is separately clickable.
  const splitQuestions = React.useMemo(() => {
    const result: string[] = [];
    questions.forEach((question) => {
      if (question.includes('?') && question.split('?').length > 2) {
        question
          .split('?')
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => result.push(part.endsWith('?') ? part : `${part}?`));
      } else {
        result.push(question);
      }
    });
    return result;
  }, [questions]);

  return (
    <>
      <div className="space-y-3 rounded-lg border border-primary/20 bg-accent/30 p-3">
        <h3 className="text-sm font-bold text-foreground">Ask about this article</h3>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onQuestionClick(summarizePrompt)}
            className="w-full rounded-md border border-primary/30 bg-background p-2.5 text-left text-sm font-semibold shadow-sm transition-all hover:border-primary hover:bg-primary/10 hover:shadow-md"
          >
            {summarizePrompt}
          </button>
          {splitQuestions.map((question, index) => (
            <button
              key={`${index}-${question.slice(0, 40)}`}
              type="button"
              onClick={() => onQuestionClick(question)}
              className="w-full rounded-md border border-border bg-background p-2.5 text-left text-sm font-medium shadow-sm transition-all hover:border-primary hover:bg-primary/10 hover:shadow-md"
            >
              {question}
            </button>
          ))}
        </div>
        {splitQuestions.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground">
            Press <span className="font-medium">Suggest</span> for questions drawn from this
            article.
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center">
          <div
            role="status"
            aria-label="Generating follow-up questions"
            className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary"
          />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive p-2 text-sm text-destructive-foreground">
          {error}
        </div>
      )}
    </>
  );
};

export default ArticleFollowupQuestions;
