'use client';

import { useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Bot, HelpCircle, MessageCircle, Send, User, X } from 'lucide-react';
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
        <div className="flex h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 bg-[#0B1F33] px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">TradeBooks Support</h2>
                <p className="truncate text-xs text-white/65">FAQ, files, workflow, and app help</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label="Close support chat"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
            {messages.length === 0 ? (
              <div className="space-y-3 text-sm text-gray-600">
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-gray-700">
                  Ask about the app, supported files, upload flow, Tally XML export, storage, or common setup questions.
                </div>
                <div className="grid gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-[#2D9CDB]/40 hover:text-[#0B1F33]"
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
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B1F33] text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${
                        message.role === 'user'
                          ? 'bg-[#2D9CDB] text-white'
                          : 'border border-gray-200 bg-white text-gray-800'
                      }`}
                    >
                      {text || (toolCount > 0 ? 'Checking support docs...' : '')}
                    </div>
                    {message.role === 'user' && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error.message}
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-gray-200 bg-white p-3"
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
              className="min-h-11 flex-1 resize-none border-gray-200 text-sm"
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
              className="h-11 bg-[#2D9CDB] px-3 text-white hover:bg-[#2387bf]"
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
        className="h-14 w-14 rounded-full bg-[#0B1F33] text-white shadow-xl hover:bg-[#12304d]"
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
