import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, ChevronDown, RefreshCw, X, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';

export default function NotesTab() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState(null);
  const [content, setContent] = useState('');
  const saveRef = useRef(null);

  // OneNote linking per note
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [notePageMap, setNotePageMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('note_onenote_map') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    base44.entities.Note.list('-updated_date', 100).then((data) => {
      setNotes(data);
      setLoading(false);
    });
  }, []);

  const saveNotePageMap = (map) => {
    setNotePageMap(map);
    localStorage.setItem('note_onenote_map', JSON.stringify(map));
  };

  const openNote = (note) => {
    setActiveNote(note);
    setContent(note.content || '');
  };

  const saveContent = useCallback(async (note, text) => {
    if (!note) return;
    const updated = await base44.entities.Note.update(note.id, { content: text });
    setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, content: text } : n));
    setActiveNote((prev) => prev?.id === note.id ? { ...prev, content: text } : prev);
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!activeNote) return;
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => saveContent(activeNote, content), 800);
    return () => clearTimeout(saveRef.current);
  }, [content, activeNote, saveContent]);

  const createNote = async () => {
    const note = await base44.entities.Note.create({ title: 'Untitled', content: '' });
    setNotes((prev) => [note, ...prev]);
    openNote(note);
  };

  const deleteNote = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Note.delete(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNote?.id === id) setActiveNote(null);
    const map = { ...notePageMap };
    delete map[id];
    saveNotePageMap(map);
  };

  const updateTitle = async (title) => {
    setActiveNote((prev) => ({ ...prev, title }));
    setNotes((prev) => prev.map((n) => n.id === activeNote.id ? { ...n, title } : n));
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      await base44.entities.Note.update(activeNote.id, { title });
    }, 600);
  };

  // OneNote page picker
  const openPicker = async () => {
    setShowPicker(true);
    if (pages.length > 0) return;
    setPagesLoading(true);
    try {
      const res = await base44.functions.invoke('getOneNotePages', {});
      setPages(res.data.pages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setPagesLoading(false);
    }
  };

  const linkPage = (page) => {
    const map = { ...notePageMap, [activeNote.id]: { id: page.id, title: page.title } };
    saveNotePageMap(map);
    setShowPicker(false);
    loadOneNotePage(page.id);
  };

  const unlinkPage = () => {
    const map = { ...notePageMap };
    delete map[activeNote.id];
    saveNotePageMap(map);
  };

  const loadOneNotePage = async (pageId) => {
    try {
      const res = await base44.functions.invoke('getOneNotePages', { pageId });
      const items = res.data.items || [];
      if (items.length > 0) {
        const text = items.map((i) => i.text).join('\n');
        setContent(text);
        await base44.entities.Note.update(activeNote.id, { content: text });
        setNotes((prev) => prev.map((n) => n.id === activeNote.id ? { ...n, content: text } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const linkedPage = activeNote ? notePageMap[activeNote.id] : null;

  // ── Note list view ──
  if (!activeNote) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground">Notes</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={createNote}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center h-16">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No notes yet. Create one!</p>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                onClick={() => openNote(note)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{note.title || 'Untitled'}</p>
                  <button
                    onClick={(e) => deleteNote(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {note.content && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{note.content}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Note editor view ──
  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setActiveNote(null)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Input
          value={activeNote.title || ''}
          onChange={(e) => updateTitle(e.target.value)}
          className="h-7 text-sm font-medium border-none shadow-none px-1 focus-visible:ring-0"
          placeholder="Title…"
        />
      </div>

      {/* OneNote link bar */}
      <div className="px-4 py-1.5 border-b border-border shrink-0 flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {linkedPage ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <button onClick={openPicker} className="text-xs text-primary hover:underline truncate flex-1 text-left">
              {linkedPage.title}
            </button>
            <button onClick={() => loadOneNotePage(linkedPage.id)} className="text-muted-foreground hover:text-foreground shrink-0" title="Reload from OneNote">
              <RefreshCw className="w-3 h-3" />
            </button>
            <button onClick={unlinkPage} className="text-muted-foreground hover:text-destructive shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={openPicker} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Link OneNote page <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Page picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border shrink-0 overflow-hidden"
          >
            <div className="px-4 py-2 max-h-40 overflow-y-auto space-y-0.5">
              {pagesLoading ? (
                <div className="flex items-center justify-center py-3">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : pages.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No pages found.</p>
              ) : (
                pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => linkPage(page)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-secondary text-xs truncate"
                  >
                    <span className="font-medium">{page.title || 'Untitled'}</span>
                    {page.parentNotebook?.displayName && (
                      <span className="text-muted-foreground ml-1">· {page.parentNotebook.displayName}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text area */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your note…"
        className="flex-1 resize-none p-4 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}