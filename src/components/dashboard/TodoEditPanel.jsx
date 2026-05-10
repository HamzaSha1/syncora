import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import AttachmentPicker from './AttachmentPicker';

const IMPORTANCE_COLORS = {
  1: 'bg-destructive text-white',
  2: 'bg-orange-500 text-white',
  3: 'bg-yellow-400 text-black',
  4: 'bg-blue-400 text-white',
  5: 'bg-muted text-muted-foreground',
};

export default function TodoEditPanel({ todo, onSave, onCancel }) {
  const [text, setText] = useState(todo.text);
  const [dueDate, setDueDate] = useState(todo.due_date || '');
  const [importance, setImportance] = useState(todo.importance ?? 3);
  const [attachments, setAttachments] = useState(
    Array.isArray(todo.attachments) ? todo.attachments : []
  );

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({ text: text.trim(), due_date: dueDate || null, importance, attachments });
  };

  return (
    <div className="ml-6 mt-1 mb-2 bg-secondary/50 rounded-lg p-3 space-y-3 border border-border">
      {/* Text */}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-7 text-sm"
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        autoFocus
      />

      {/* Date + Importance row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Due date:</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-xs bg-background border border-input rounded px-2 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {dueDate && (
            <button onClick={() => setDueDate('')} className="text-muted-foreground hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Priority:</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setImportance(n)}
                className={`w-5 h-5 rounded text-[10px] font-bold transition-all ${
                  importance === n
                    ? IMPORTANCE_COLORS[n] + ' scale-110 shadow'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Attachments */}
      <AttachmentPicker
        attachments={attachments}
        onChange={setAttachments}
        onClose={null}
        inline
      />

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90 transition-colors flex items-center gap-1"
        >
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
}