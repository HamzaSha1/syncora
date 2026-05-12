import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, RefreshCw, GripVertical, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dragState } from '@/lib/dragState';
import { formatDistanceToNow } from 'date-fns';

const CATEGORIES = [
  { key: 'focus_today', label: '🎯 Focus Today', color: 'text-destructive' },
  { key: 'need_to_reply', label: '↩️ Need to Reply', color: 'text-orange-500' },
  { key: 'need_to_read', label: '📬 Need to Read', color: 'text-primary' },
  { key: 'opened_not_replied', label: '👁️ Opened, Not Replied', color: 'text-muted-foreground' },
];

export default function EmailIntelPanel({ onDragStart, onDragEnd }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLatest();
  }, []);

  const loadLatest = async () => {
    setLoading(true);
    const results = await base44.entities.EmailIntelResult.list('-created_date', 1);
    if (results.length > 0) setData(results[0]);
    setLoading(false);
  };

  const scan = async () => {
    setScanning(true);
    setError(null);
    const res = await base44.functions.invoke('analyzeEmails', {});
    setData(res.data);
    setScanning(false);
  };

  const handleDragStart = (e, text) => {
    dragState.set(text, null, []);
    e.dataTransfer.setData('text/plain', text);
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

        {!isLoading && data && (
          <div className="space-y-4">
            {CATEGORIES.map(({ key, label, color }) => {
              const items = data[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${color}`}>{label}</p>
                  <div className="space-y-1">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={handleDragEnd}
                        className="flex items-start gap-2 group cursor-grab active:cursor-grabbing bg-secondary/40 hover:bg-secondary rounded-lg px-2.5 py-2 transition-colors"
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-xs text-foreground leading-snug">{item}</span>
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