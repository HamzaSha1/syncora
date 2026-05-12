import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ExternalLink, Loader2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { dragState } from '@/lib/dragState';
import { formatDistanceToNow } from 'date-fns';

export default function EmailSearchPanel({ onDragStart, onDragEnd }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleSearch = async (e) => {
    if (e.key !== 'Enter' || !query.trim()) return;

    setSearching(true);
    setResults(null);
    setStatusMsg('');

    const MAX_EMAILS = 1000;
    const BATCH = 100;
    let found = [];

    for (let skip = 0; skip < MAX_EMAILS; skip += BATCH) {
      const batchNum = skip / BATCH + 1;
      setStatusMsg(`Searching emails ${skip + 1}–${skip + BATCH}…`);

      const res = await base44.functions.invoke('searchEmails', { query: query.trim(), skip });
      const { results: batchResults, exhausted } = res.data;

      if (batchResults && batchResults.length > 0) {
        found = batchResults;
        break;
      }

      if (exhausted) break;
    }

    setResults(found);
    setStatusMsg('');
    setSearching(false);
  };

  const handleDragStart = (e, subject) => {
    dragState.set(subject, null, []);
    e.dataTransfer.setData('text/plain', subject);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.();
  };

  const handleDragEnd = () => onDragEnd?.();

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-muted-foreground">🔍 Search Emails</p>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search emails… (press Enter)"
          className="pl-8 h-8 text-xs"
          disabled={searching}
        />
      </div>

      {searching && (
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {!searching && results !== null && results.length === 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-center py-2">No emails found.</p>
      )}

      {!searching && results && results.length > 0 && (
        <div className="space-y-1.5 mt-3">
          {results.map((email, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => handleDragStart(e, email.subject)}
              onDragEnd={handleDragEnd}
              className="flex items-start gap-2 group cursor-grab active:cursor-grabbing bg-secondary/40 hover:bg-secondary rounded-lg px-2.5 py-2 transition-colors"
            >
              <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{email.subject}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {email.from}
                  {email.receivedDateTime && (
                    <span className="ml-1">· {formatDistanceToNow(new Date(email.receivedDateTime), { addSuffix: true })}</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-2">{email.bodyPreview}</p>
                {email.relevance && (
                  <p className="text-[10px] text-primary/70 mt-0.5 italic">{email.relevance}</p>
                )}
              </div>
              {email.webLink && (
                <a
                  href={email.webLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                  title="Open email"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}