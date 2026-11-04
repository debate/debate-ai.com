import { describe, expect, it, vi } from 'vitest';

import {
  QA_SYSTEM_PROMPT,
  askQuestion,
  followupPrompt,
  parseFollowupQuestions,
  splitQuestions,
  suggestQuestions,
  type GenerateRequest,
} from '../src/questions';

describe('parseFollowupQuestions', () => {
  it('drops numbering, bullets, blanks and fragments, and caps the count', () => {
    const answer = '1. What does the author mean by synergy?\n\n- Why is fiat not solvency?\nok\n* How do critiques fail?\n4) One more question here?';
    expect(parseFollowupQuestions(answer, 3)).toEqual([
      'What does the author mean by synergy?',
      'Why is fiat not solvency?',
      'How do critiques fail?',
    ]);
  });
});

describe('splitQuestions', () => {
  it('splits a line holding several questions', () => {
    expect(splitQuestions(['Why A? Why B?', 'Only one?'])).toEqual(['Why A?', 'Why B?', 'Only one?']);
  });
});

describe('followupPrompt', () => {
  it('caps the text and lists questions already asked', () => {
    const prompt = followupPrompt({
      article: 'x'.repeat(50),
      maxChars: 10,
      chatHistory: [
        { role: 'user', content: 'Asked before?' },
        { role: 'assistant', content: 'An answer.' },
      ],
    });
    expect(prompt).toContain(`${'x'.repeat(10)}\n`);
    expect(prompt).not.toContain('x'.repeat(11));
    expect(prompt).toContain('- Asked before?');
    expect(prompt).not.toContain('An answer.');
  });
});

describe('with a generate function', () => {
  it('suggestQuestions sends the follow-up prompts and parses the reply', async () => {
    const generate = vi.fn(async (_: GenerateRequest) => 'First good question?\nSecond good question?');
    await expect(suggestQuestions(generate, { article: 'Body', maxQuestions: 2 })).resolves.toEqual([
      'First good question?',
      'Second good question?',
    ]);
    expect(generate.mock.calls[0]![0].system).toContain('Generate 2 thought-provoking questions');
  });

  it('askQuestion uses the Q&A system prompt and refuses empty input', async () => {
    const generate = vi.fn(async (_: GenerateRequest) => 'Answer.');
    await expect(askQuestion(generate, { article: 'Body', question: 'Why?' })).resolves.toBe('Answer.');
    expect(generate.mock.calls[0]![0].system).toBe(QA_SYSTEM_PROMPT);
    await expect(askQuestion(generate, { article: '', question: 'Why?' })).rejects.toThrow('empty');
    await expect(askQuestion(generate, { article: 'Body', question: ' ' })).rejects.toThrow('Ask a question');
  });
});
