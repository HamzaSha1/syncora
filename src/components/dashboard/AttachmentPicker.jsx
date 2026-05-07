import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, X, Search, Loader2, Paperclip, FileText, File } from 'lucide-react';

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return <FileText className="w-2.5 h-2.5 shrink-0" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="w-2.5 h-2.5 shrink-0" />;
  if (['eml', 'msg'].includes(ext)) return <Mail className="w-2.5 h-2.5 shrink-0" />;
  return <File className="w-2.5 h-2.5 shrink-0" />;
}

export default function AttachmentPicker({ attachments, onChange, onClose }) {
  const [query, setQuery] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchEmails('');
  }, []);

  const fetchEmails = async (q) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getEmails', { query: q });
      setEmails(res.data.emails || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchEmails(q), 400);
  };

  const addAttachment = (email) => {
    if (attachments.some((a) => a.id === email.id)) return;
    onChange([...attachments, {
      type: 'email',
      id: email.id,
      subject: email.subject || '(no subject)',
      from: email.from?.emailAddress?.address || '',
      fromName: email.from?.emailAddress?.name || '',
      date: email.receivedDateTime,
      webLink: email.webLink,
    }]);
    onClose();
  };

  const removeAttachment = (id) => onChange(attachments.filter((a) => a.id !== id));

  const handleFileUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const newAtts = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newAtts.push({ type: 'file', id: `file_${Date.now()}_${file.name}`, subject: file.name, webLink: file_url });
    }
    onChange([...attachments, ...newAtts]);
    setUploading(false);
  };

  return (
    <div className="mt-1 border border-border rounded-lg bg-background shadow-lg overflow-hidden z-50">
      {attachments.length > 0 && (
        <div className="px-2 pt-2 pb-1.5 flex flex-wrap gap-1 border-b border-border/50">
          {attachments.map((att) => (
            <span key={att.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] max-w-[200px]">
              {att.type === 'file' ? fileIcon(att.subject) : <Mail className="w-2.5 h-2.5 shrink-0" />}
              <span className="truncate">{att.subject}</span>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => removeAttachment(att.id)} className="hover:text-destructive shrink-0 ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/50">
        <Search className="w-3 h-3 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={handleQueryChange}
          placeholder="Search emails…"
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/50 min-w-0"
          onMouseDown={(e) => e.stopPropagation()}
        />
        {(loading || uploading) && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />}
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.eml,.msg,.txt" className="hidden"
          onChange={(e) => handleFileUpload(Array.from(e.target.files))} />
        <button onClick={() => fileInputRef.current?.click()} title="Upload PDF or Word doc"
          className="text-muted-foreground hover:text-foreground shrink-0">
          <Paperclip className="w-3 h-3" />
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="max-h-44 overflow-y-auto">
        {emails.map((email) => {
          const attached = attachments.some((a) => a.id === email.id);
          return (
            <button
              key={email.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addAttachment(email)}
              disabled={attached}
              className={`w-full text-left px-2 py-1.5 hover:bg-secondary transition-colors border-b border-border/30 last:border-0 ${attached ? 'opacity-40 cursor-default' : ''}`}
            >
              <p className="text-[11px] font-medium truncate leading-tight">{email.subject || '(no subject)'}</p>
              <p className="text-[9px] text-muted-foreground truncate">
                {email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown'} · {email.receivedDateTime ? new Date(email.receivedDateTime).toLocaleDateString() : ''}
              </p>
            </button>
          );
        })}
        {!loading && emails.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No emails found</p>
        )}
      </div>
    </div>
  );
}