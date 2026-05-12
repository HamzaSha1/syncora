import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ExternalLink, Loader2, GripVertical, Send, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { dragState } from '@/lib/dragState';
import { formatDistanceToNow } from 'date-fns';

// Conversation states
const STATE = {
  IDLE: 'idle',           // show initial search box
  CLARIFYING: 'clarifying', // AI is asking clarifying questions
  SEARCHING: 'searching', // actively searching batches
  RESULTS: 'results',     // showing results
};

export default function EmailSearchPanel({ onDragStart, onDragEnd }) {
  const [state, setState] = useState(STATE.IDLE);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', text }
  const [statusMsg, setStatusMsg] = useState('');
  const [results, setResults] = useState([]);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusMsg]);

  const addMessage = (role, text) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  // Step 1: user submits initial query → AI decides if it needs clarification or goes straight to search
  const handleInitialSubmit = async () => {
    const query = inputText.trim();
    if (!query) return;
    setInputText('');
    setState(STATE.CLARIFYING);
    addMessage('user', query);

    // Ask AI: do you need more info, or is this enough to search?
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an email search assistant helping a user find a specific email in their Outlook inbox.

The user said: "${query}"

Your job is to decide:
1. If the query is already specific enough to search (you know enough about sender, topic, timeframe, document type, etc.) — respond with a search-ready structured summary.
2. If the query is vague and you need more details to find the right email — ask ONE focused clarifying question. 

Rules:
- If you need clarification, ask only ONE question at a time. Be concise and conversational.
- If you have enough info (or after enough context), respond with JSON mode: set "ready" to true and fill out "searchContext".
- "searchContext" should be a rich natural-language description of what to look for, including all known details.

Respond in JSON.`,
      response_json_schema: {
        type: 'object',
        properties: {
          ready: { type: 'boolean' },
          question: { type: 'string' },
          searchContext: { type: 'string' },
        },
      },
    });

    if (res.ready && res.searchContext) {
      addMessage('assistant', `Got it! Searching for: "${res.searchContext}"`);
      await runSearch(res.searchContext);
    } else if (res.question) {
      addMessage('assistant', res.question);
    }
  };

  // Step 2: user answers a clarifying question → AI evaluates again
  const handleClarifyReply = async () => {
    const reply = inputText.trim();
    if (!reply) return;
    setInputText('');
    addMessage('user', reply);

    // Build full conversation history for context
    const history = [...messages, { role: 'user', text: reply }]
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an email search assistant. Here is the conversation so far:

${history}

Based on everything the user has told you, decide:
1. Do you have enough context to search? If yes, set "ready": true and provide a rich "searchContext" describing exactly what email to look for (include sender hints, topic, timeframe, document type, keywords — everything mentioned).
2. If you still need more info, ask ONE more focused clarifying question.

Respond in JSON.`,
      response_json_schema: {
        type: 'object',
        properties: {
          ready: { type: 'boolean' },
          question: { type: 'string' },
          searchContext: { type: 'string' },
        },
      },
    });

    if (res.ready && res.searchContext) {
      addMessage('assistant', `Perfect, I have enough context. Searching now…`);
      await runSearch(res.searchContext);
    } else if (res.question) {
      addMessage('assistant', res.question);
    }
  };

  // Step 3: actual batch search using the enriched searchContext
  const runSearch = async (searchContext) => {
    setState(STATE.SEARCHING);
    const MAX_EMAILS = 1000;
    const BATCH = 100;
    let found = [];

    for (let skip = 0; skip < MAX_EMAILS; skip += BATCH) {
      setStatusMsg(`Scanning emails ${skip + 1}–${Math.min(skip + BATCH, MAX_EMAILS)}…`);
      const res = await base44.functions.invoke('searchEmails', { query: searchContext, skip });
      const { results: batchResults, exhausted } = res.data;

      if (batchResults && batchResults.length > 0) {
        found = batchResults;
        break;
      }
      if (exhausted) break;
    }

    setResults(found);
    setStatusMsg('');
    setState(STATE.RESULTS);
  };

  const handleReset = () => {
    setState(STATE.IDLE);
    setInputText('');
    setMessages([]);
    setResults([]);
    setStatusMsg('');
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (state === STATE.IDLE) handleInitialSubmit();
    else if (state === STATE.CLARIFYING) handleClarifyReply();
  };

  const handleDragStart = (e, subject) => {
    dragState.set(subject, null, []);
    e.dataTransfer.setData('text/plain', subject);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.();
  };
  const handleDragEnd = () => onDragEnd?.();

  const isInputDisabled = state === STATE.SEARCHING;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat / status area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {state === STATE.IDLE && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Search className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Describe the email you're looking for.<br />
              The AI will ask clarifying questions to find it precisely.
            </p>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Searching status */}
        {state === STATE.SEARCHING && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Results */}
        {state === STATE.RESULTS && (
          <div>
            {results.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No matching emails found.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
                {results.map((email, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => handleDragStart(e, email.subject)}
                    onDragEnd={handleDragEnd}
                    className="flex items-start gap-2 group cursor-grab active:cursor-grabbing bg-secondary/40 hover:bg-secondary rounded-xl px-3 py-3 transition-colors"
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{email.subject}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {email.from}
                        {email.fromEmail && email.fromEmail !== email.from && (
                          <span className="ml-1 opacity-60">({email.fromEmail})</span>
                        )}
                        {email.receivedDateTime && (
                          <span className="ml-1">· {formatDistanceToNow(new Date(email.receivedDateTime), { addSuffix: true })}</span>
                        )}
                      </p>
                      {email.bodyPreview && (
                        <p className="text-[11px] text-foreground/70 mt-1.5 leading-relaxed whitespace-pre-wrap">{email.bodyPreview}</p>
                      )}
                      {email.relevance && (
                        <p className="text-[11px] text-primary mt-1.5 italic font-medium">↳ {email.relevance}</p>
                      )}
                    </div>
                    {email.webLink && (
                      <a
                        href={email.webLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                        title="Open in Outlook"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-4 pb-3 pt-2 border-t border-border">
        <div className="flex gap-2 items-center">
          {(state !== STATE.IDLE) && (
            <button onClick={handleReset} className="text-muted-foreground hover:text-foreground shrink-0" title="Start over">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="relative flex-1">
            {state === STATE.IDLE && (
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            )}
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                state === STATE.IDLE ? 'Describe the email you\'re looking for…' :
                state === STATE.CLARIFYING ? 'Type your answer…' :
                state === STATE.RESULTS ? 'Search again…' :
                'Searching…'
              }
              className={`h-8 text-xs ${state === STATE.IDLE ? 'pl-8' : 'pl-3'}`}
              disabled={isInputDisabled}
            />
          </div>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={isInputDisabled || !inputText.trim()}
            onClick={() => {
              if (state === STATE.IDLE) handleInitialSubmit();
              else if (state === STATE.CLARIFYING) handleClarifyReply();
              else if (state === STATE.RESULTS) { handleReset(); }
            }}
            title="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}