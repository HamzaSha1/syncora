import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, RefreshCw, GripVertical, AlertCircle, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dragState } from '@/lib/dragState';
import { formatDistanceToNow } from 'date-fns';
import EmailSearchPanel from './EmailSearchPanel';

const CATEGORIES = [
  { key: 'focus_today', label: '🎯 Focus Today', color: 'text-destructive' },
  { key: 'need_to_reply', label: '↩️ Need to Reply', color: 'text-orange-500' },
  { key: 'need_to_read', label: '📬 Need to Read', color: 'text-primary' },
  { key: 'opened_not_replied', label: '👁️ Opened, Not Replied', color: 'text-muted-foreground' },
];

export default function EmailIntelPanel({ onDragStart, onDragEnd }) {
  const [data, setData] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  // dismissed: { focus_today: Set, need_to_reply: Set, ... }
  const [dismissed, setDismissed] = useState({});

  useEffect(() => {
    loadLatest();
  }, []);

  const loadLatest = async () => {
    setLoading(true);
    const results = await base44.entities.EmailIntelResult.list('-created_date', 1);
    if (results.length > 0) {
      setData(results[0]);
      setRecordId(results[0].id);
      setDismissed(results[0].dismissed || {});
    }
    setLoading(false);
  };

  const scan = async () => {
    setScanning(true);
    setError(null);
    const res = await base44.functions.invoke('analyzeEmails', {});
    setData(res.data);
    setDismissed({});
    // After scan, reload to get new record id
    const results = await base44.entities.EmailIntelResult.list('-created_date', 1);
    if (results.length > 0) setRecordId(results[0].id);
    setScanning(false);
  };

  const discard = async (categoryKey, label) => {
    const current = dismissed[categoryKey] || [];
    const next = [...new Set([...current, label])];
    const nextDismissed = { ...dismissed, [categoryKey]: next };
    setDismissed(nextDismissed);
    if (recordId) {
      await base44.entities.EmailIntelResult.update(recordId, { dismissed: nextDismissed });
    }
  };

  const handleDragStart = (e, label) => {
    dragState.set(label, null, []);
    e.dataTransfer.setData('text/plain', label);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.();
  };

  const handleDragEnd = () => onDragEnd?.();

  const isLoading = loading || scanning;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <Mail className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm text-foreground flex-1">Email Intel</h2>
        {data?.scanned_at && !isLoading && (
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(data.scanned_at), { addSuffix: true })}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={scan}
          disabled={isLoading}
          title="Scan emails now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">
              {scanning ? 'Scanning your inbox with AI…' : 'Loading…'}
            </p>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-center gap-2 text-destructive text-xs p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!isLoading && !data && !error && (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <Mail className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground text-center">
              Auto-scans daily at 8am and hourly until 5pm.<br />Or click refresh to scan now.
            </p>
            <Button size="sm" className="h-7 text-xs" onClick={scan}>Scan Now</Button>
          </div>
        )}

        {!isLoading && (
          <EmailSearchPanel onDragStart={onDragStart} onDragEnd={onDragEnd} />
        )}

        {!isLoading && data && (
          <div className="space-y-4">
            {CATEGORIES.map(({ key, label, color }) => {
              const dismissedSet = new Set(dismissed[key] || []);
              // Support both old string format and new object format
              const rawItems = (data[key] || []);
              const items = rawItems
                .map((item) => typeof item === 'string' ? { label: item, webLink: null } : item)
                .filter((item) => !dismissedSet.has(item.label));
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${color}`}>{label}</p>
                  <div className="space-y-1">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.label)}
                        onDragEnd={handleDragEnd}
                        className="flex items-start gap-2 group cursor-grab active:cursor-grabbing bg-secondary/40 hover:bg-secondary rounded-lg px-2.5 py-2 transition-colors"
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-xs text-foreground leading-snug flex-1">{item.label}</span>
                        {item.webLink && (
                          <a
                            href={item.webLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                            title="Open email"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); discard(key, item.label); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                          title="Discard"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}