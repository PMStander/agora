import { useState } from 'react';
import { SOUL_BUILDER_QUESTIONS } from '../../../lib/agentGenerator';
import type { SoulProfile } from '../../../types/supabase';
import { cn } from '../../../lib/utils';

interface WizardStepSoulBuilderProps {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  onAddMessage: (msg: { role: 'system' | 'user'; content: string }) => void;
  onAutoGenerate: () => void;
  onNext: (soul: SoulProfile) => void;
  onBack: () => void;
}

export function WizardStepSoulBuilder({
  messages,
  onAddMessage,
  onAutoGenerate,
  onNext,
  onBack,
}: WizardStepSoulBuilderProps) {
  const [input, setInput] = useState('');

  // Determine which question we're on
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const currentQuestionIndex = userMessageCount;
  const allQuestionsAnswered = currentQuestionIndex >= SOUL_BUILDER_QUESTIONS.length;

  // If no messages yet, seed with the first question
  if (messages.length === 0) {
    const intro = `Let's build a soul for your new agent. I'll ask a few questions to understand the personality you want.\n\n${SOUL_BUILDER_QUESTIONS[0]}`;
    onAddMessage({ role: 'system', content: intro });
  }

  const handleSend = () => {
    if (!input.trim()) return;
    onAddMessage({ role: 'user', content: input.trim() });
    setInput('');

    // Show next question (or completion message) after a brief delay
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < SOUL_BUILDER_QUESTIONS.length) {
      setTimeout(() => {
        onAddMessage({
          role: 'system',
          content: `Got it. ${SOUL_BUILDER_QUESTIONS[nextIndex]}`,
        });
      }, 300);
    } else {
      setTimeout(() => {
        onAddMessage({
          role: 'system',
          content: "Great, I have everything I need to generate candidate profiles. Click 'Generate Candidates' to proceed.",
        });
      }, 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSkipQuestion = () => {
    onAddMessage({ role: 'user', content: '(skipped)' });
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < SOUL_BUILDER_QUESTIONS.length) {
      setTimeout(() => {
        onAddMessage({
          role: 'system',
          content: `No problem, skipping that one. ${SOUL_BUILDER_QUESTIONS[nextIndex]}`,
        });
      }, 300);
    } else {
      setTimeout(() => {
        onAddMessage({
          role: 'system',
          content: "Got it. Click 'Generate Candidates' to proceed.",
        });
      }, 300);
    }
  };

  // Build a draft soul from the answers for the "Generate Candidates" flow
  const buildDraftSoulFromAnswers = (): SoulProfile => {
    const answers: Record<number, string> = {};
    let answerIdx = 0;
    for (const msg of messages) {
      if (msg.role === 'user' && msg.content !== '(skipped)') {
        answers[answerIdx] = msg.content;
      }
      if (msg.role === 'user') answerIdx++;
    }

    return {
      origin: '',
      philosophy: answers[0] ? answers[0].split(/[,;.\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5) : [],
      inspirations: answers[1]
        ? answers[1].split(/[,;.\n]/).map((s) => s.trim()).filter(Boolean).map((name) => ({ name, relationship: '' }))
        : [],
      communicationStyle: {
        tone: answers[2] ?? 'Professional and adaptable',
        formality: 'balanced',
        verbosity: 'balanced',
        quirks: [],
      },
      neverDos: answers[3] ? answers[3].split(/[,;.\n]/).map((s) => s.trim()).filter(Boolean) : [],
      preferredWorkflows: answers[4] ? answers[4].split(/[,;.\n]/).map((s) => s.trim()).filter(Boolean) : [],
      additionalNotes: null,
    };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">Build the Soul</h3>
        <p className="text-sm text-zinc-500">
          Answer a few questions to shape this agent's personality, or auto-generate from the role spec.
        </p>
      </div>

      {/* Auto-generate shortcut */}
      <div className="mb-4">
        <button
          onClick={onAutoGenerate}
          className="px-4 py-2 text-sm border border-zinc-700 bg-zinc-800 text-zinc-300 rounded-lg hover:border-amber-500/40 hover:text-amber-400 transition-colors"
        >
          Auto-Generate from Role Spec (skip Q&A)
        </button>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] px-4 py-2.5 rounded-xl text-sm',
                msg.role === 'user'
                  ? 'bg-amber-500/15 text-amber-100 rounded-br-none'
                  : 'bg-zinc-800 text-zinc-300 rounded-bl-none'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      {!allQuestionsAnswered ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
          <button
            onClick={handleSkipQuestion}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip
          </button>
        </div>
      ) : null}

      {/* Footer navigation */}
      <div className="flex justify-between pt-4 border-t border-zinc-800 mt-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => onNext(buildDraftSoulFromAnswers())}
          disabled={userMessageCount < 1}
          className="px-6 py-2.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Generate Candidates
        </button>
      </div>
    </div>
  );
}
