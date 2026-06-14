'use client';

import { useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { AlertCircle, Bot, HelpCircle, MessageCircle, Send, User, X } from 'lucide-react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SupportAssistantMessage } from '@/lib/ai/agents/support-agent';

const suggestedPrompts = [
  'How does TradeBooks work?',
  'Which files do I need?',
  'Do you store my uploads?',
  'Does it connect to Zerodha or Tally?',
];

function textFromMessage(message: SupportAssistantMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function SupportChatFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/agent/support',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat<SupportAssistantMessage>({
    transport,
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  const submitPrompt = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-hairline bg-card e3">
          {/* Panel header — uses primary as bg for brand identity */}
          <div className="flex items-center justify-between border-b border-hairline bg-primary px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">TradeBooks Support</h2>
                <p className="truncate text-xs text-white/70">FAQ, files, workflow, and app help</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/15 hover:text-white"
              aria-label="Close support chat"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-surface-2 p-4">
            {messages.length === 0 ? (
              <div className="space-y-3 text-sm text-ink-2">
                <div className="rounded-xl border border-hairline bg-card p-3 text-ink">
                  Ask about the app, supported files, upload flow, Tally XML export, storage, or common setup questions.
                </div>
                <div className="grid gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-md border border-hairline bg-card px-3 py-2 text-left text-sm text-ink transition-colors hover:border-primary/40 hover:text-primary"
                      onClick={() => submitPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const text = textFromMessage(message);
                const toolCount = message.parts.filter(isToolUIPart).length;
                return (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role !== 'user' && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-6 ${
                        message.role === 'user'
                          ? 'bg-primary text-white'
                          : 'border border-hairline bg-card text-ink'
                      }`}
                    >
                      {text || (toolCount > 0 ? 'Checking support docs...' : '')}
                    </div>
                    {message.role === 'user' && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-2">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-neg/20 bg-neg/10 px-3 py-2 text-sm text-neg">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {error.message}
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-hairline bg-card p-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt(input);
            }}
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a support question..."
              className="min-h-11 flex-1 resize-none text-sm"
              disabled={isBusy}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitPrompt(input);
                }
              }}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isBusy}
              className="h-11 px-3"
              aria-label="Send support message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <Button
        type="button"
        size="icon-lg"
        className="h-14 w-14 rounded-full"
        aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((current) => !current);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}
