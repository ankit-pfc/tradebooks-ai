'use client';

import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Bot, Send, Sparkles, User, AlertCircle } from 'lucide-react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { TradebookAssistantMessage } from '@/lib/ai/agents/tradebook-agent';

interface TradebookChatProps {
  batchId: string;
  batchLabel: string;
}

function textFromMessage(message: TradebookAssistantMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function TradebookChat({ batchId, batchLabel }: TradebookChatProps) {
  const [input, setInput] = useState('');
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/agent/tradebook',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            batchId,
            messages,
          },
        }),
      }),
    [batchId],
  );

  const { messages, sendMessage, status, error } = useChat<TradebookAssistantMessage>({
    transport,
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-ink">Ask about this batch</h2>
            </div>
            <p className="mt-1 text-sm text-ink-2">
              {batchLabel}
            </p>
          </div>
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl border border-hairline bg-surface-2 p-3">
          {messages.length === 0 ? (
            <div className="space-y-2 text-sm text-ink-2">
              <p>Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'What files did I upload?',
                  'Show top traded symbols',
                  'Why are there warnings?',
                  'What are my closing lots?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-md border border-hairline bg-card px-2.5 py-1.5 text-left text-sm text-ink hover:border-primary/40 hover:text-primary transition-colors"
                    onClick={() => sendMessage({ text: prompt })}
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
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-primary text-white'
                        : 'border border-hairline bg-card text-ink'
                    }`}
                  >
                    {text || (toolCount > 0 ? 'Looking up batch data...' : '')}
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
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const prompt = input.trim();
            if (!prompt || isBusy) return;
            sendMessage({ text: prompt });
            setInput('');
          }}
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about trades, files, checks, vouchers, or closing lots..."
            className="min-h-11 flex-1 resize-none text-sm"
            disabled={isBusy}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                const prompt = input.trim();
                if (!prompt || isBusy) return;
                sendMessage({ text: prompt });
                setInput('');
              }
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isBusy}
            className="h-11 px-3"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
