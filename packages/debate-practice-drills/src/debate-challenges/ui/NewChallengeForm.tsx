"use client";

/**
 * @fileoverview The form that sends an Online Challenge: who (a player found by
 * name, or the AI at a chosen level), the format, the resolution (any listed
 * topic for that format, or the challenger's own), the side, and — for an Aff
 * challenger — the opening speech that goes out with it.
 */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bot, Loader2, Search, Swords, UserRound } from "lucide-react";

import { cn } from "@debate-ai/round/src/ui/lib/utils";
import { searchChallengeOpponents } from "../client";
import { challengeTopicLabel, challengeTopicsFor } from "../topics";
import {
  AI_LEVELS,
  AI_OPPONENT_ID,
  CHALLENGE_FORMATS,
  MAX_CHALLENGE_NOTE_LENGTH,
  MAX_CHALLENGE_TOPIC_LENGTH,
  MAX_SPEECH_LENGTH,
  MIN_SPEECH_LENGTH,
  RESPONSE_WINDOW_DAYS,
  type AiLevel,
  type ChallengeFormat,
  type ChallengePerson,
  type ChallengeSide,
  type NewDebateChallenge,
} from "../types";

export const challengeInputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const CUSTOM_TOPIC = "__custom__";

export interface NewChallengeFormProps {
  onSubmit: (challenge: NewDebateChallenge) => Promise<void>;
  /** Injected for tests. */
  searchOpponents?: (query: string) => Promise<ChallengePerson[]>;
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
        active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function NewChallengeForm({ onSubmit, searchOpponents = searchChallengeOpponents }: NewChallengeFormProps) {
  const [vsAi, setVsAi] = useState(true);
  const [aiLevel, setAiLevel] = useState<AiLevel>("varsity");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChallengePerson[]>([]);
  const [opponent, setOpponent] = useState<ChallengePerson | null>(null);
  const [format, setFormat] = useState<ChallengeFormat>("pf");
  const topics = useMemo(() => challengeTopicsFor(format), [format]);
  const [topicKey, setTopicKey] = useState<string>(() => challengeTopicsFor("pf")[0]?.key ?? CUSTOM_TOPIC);
  const [customTopic, setCustomTopic] = useState("");
  const [side, setSide] = useState<ChallengeSide>("aff");
  const [speech, setSpeech] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A format change picks that format's newest topic (or the custom box when it has none).
  useEffect(() => {
    setTopicKey(topics[0]?.key ?? CUSTOM_TOPIC);
  }, [topics]);

  useEffect(() => {
    if (vsAi || opponent || !query.trim()) {
      setResults([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      void searchOpponents(query).then((found) => {
        if (live) setResults(found);
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, vsAi, opponent, searchOpponents]);

  const topicText =
    topicKey === CUSTOM_TOPIC ? customTopic.trim() : (topics.find((topic) => topic.key === topicKey)?.text ?? "");
  const speechNeeded = side === "aff";
  const canSend =
    !sending &&
    Boolean(topicText) &&
    (vsAi || opponent !== null) &&
    (!speechNeeded || speech.trim().length >= MIN_SPEECH_LENGTH);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        opponentId: vsAi ? AI_OPPONENT_ID : opponent!.id,
        ...(vsAi ? { aiLevel } : {}),
        format,
        topic: topicText,
        side,
        ...(speechNeeded ? { speech } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSpeech("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the challenge.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" aria-label="New challenge">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Opponent</legend>
        <div className="flex flex-wrap gap-2">
          <Choice active={vsAi} onClick={() => setVsAi(true)}>
            <Bot className="size-4" aria-hidden="true" /> AI opponent
          </Choice>
          <Choice active={!vsAi} onClick={() => setVsAi(false)}>
            <UserRound className="size-4" aria-hidden="true" /> Another player
          </Choice>
        </div>
        {vsAi ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="AI level">
            {AI_LEVELS.map((level) => (
              <Choice key={level.id} active={aiLevel === level.id} onClick={() => setAiLevel(level.id)}>
                {level.label}
              </Choice>
            ))}
          </div>
        ) : opponent ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span>
              Challenging <strong>{opponent.name}</strong>
            </span>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setOpponent(null)}>
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <input
              aria-label="Find a player by name"
              placeholder="Find a player by name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(challengeInputClass, "pl-8")}
            />
            {results.length > 0 ? (
              <ul className="mt-1 flex flex-col overflow-hidden rounded-md border border-border bg-popover" role="listbox">
                {results.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setOpponent(person);
                        setQuery("");
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {person.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Format
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ChallengeFormat)}
            className={challengeInputClass}
          >
            {CHALLENGE_FORMATS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Resolution
          <select value={topicKey} onChange={(event) => setTopicKey(event.target.value)} className={challengeInputClass}>
            {topics.map((topic) => (
              <option key={topic.key} value={topic.key}>
                {challengeTopicLabel(topic)}
              </option>
            ))}
            <option value={CUSTOM_TOPIC}>Write my own…</option>
          </select>
        </label>
      </div>
      {topicKey === CUSTOM_TOPIC ? (
        <input
          aria-label="Your resolution"
          placeholder="Resolved: …"
          maxLength={MAX_CHALLENGE_TOPIC_LENGTH}
          value={customTopic}
          onChange={(event) => setCustomTopic(event.target.value)}
          className={challengeInputClass}
        />
      ) : topicText ? (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{topicText}</p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Your side</legend>
        <div className="flex flex-wrap gap-2">
          <Choice active={side === "aff"} onClick={() => setSide("aff")}>
            Affirmative (you open)
          </Choice>
          <Choice active={side === "neg"} onClick={() => setSide("neg")}>
            Negative
          </Choice>
        </div>
      </fieldset>

      {speechNeeded ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your affirmative constructive
          <textarea
            value={speech}
            onChange={(event) => setSpeech(event.target.value)}
            maxLength={MAX_SPEECH_LENGTH}
            rows={8}
            placeholder="Lay out your case: framework, contentions, warrants and impacts."
            className={challengeInputClass}
          />
          <span className="text-xs font-normal text-muted-foreground">
            {speech.trim().length.toLocaleString("en-US")} / {MAX_SPEECH_LENGTH.toLocaleString("en-US")} characters
          </span>
        </label>
      ) : null}

      {!vsAi ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Note (optional)
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_CHALLENGE_NOTE_LENGTH}
            placeholder="Good luck!"
            className={challengeInputClass}
          />
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Swords className="size-4" aria-hidden="true" />}
          Send challenge
        </button>
        <span className="text-xs text-muted-foreground">
          {vsAi
            ? "The AI answers right away."
            : `They have ${RESPONSE_WINDOW_DAYS} days to answer each speech, or the round is forfeited.`}
        </span>
      </div>
    </form>
  );
}
