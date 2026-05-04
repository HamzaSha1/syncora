import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Plus, Trash2, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NotesPanel() {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const saveTimer = useRef(null);

  useEffect(() => {
    base44.entities.Note.list('-updated_date', 100).then((data) => {
      setNotes(data);
      setLoading(false);
    });
  }, []);

  const selectNote = (note) => {
    setSelected(note);
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setShowList(false);
  };

  const createNote = async () => {
    const newNote = await base44.entities.Note.create({ title: 'New Note', content: '' });
    setNotes((prev) => [newNote, ...prev]);
    selectNote(newNote);
  };

  const deleteNote = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Note.delete(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selected?.id === id) {
      setSelected(null);
      setShowList(true);
    }
  };

  const autoSave = (field, value) => {
    if (!selected) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updates = field === 'title' ? { title: value } : { content: value };
      const updated = await base44.entities.Note.update(selected.id, updates);
      setNotes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, ...updates } : n)));
    }, 600);
  };

  const handleTitleChange = (e) => {
    setEditTitle(e.target.value);
    autoSave('title', e.target.value);
  };

  const handleContentChange = (e) => {
    setEditContent(e.target.value);
    autoSave('content', e.target.value);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        {!showList && (
          <button onClick={() => setShowList(true)} className="text-muted-foreground hover:text-foreground mr-1">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm text-foreground">
          {showList ? 'Notes' : (editTitle || 'Note')}
        </h2>
        {showList && (
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={createNote}>
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {showList ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute inset-0 overflow-y-auto px-4 py-2 space-y-1"
            >
              {loading ? (
                <div className="flex items-center justify-center h-16">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
                  <p className="text-xs text-muted-foreground">No notes yet.</p>
                  <Button size="sm" variant="outline" onClick={createNote}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> New Note
                  </Button>
                </div>
              ) : (
                notes.map((note) => (
                  <motion.button
                    key={note.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => selectNote(note)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary group flex items-start justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{note.title}</p>
                      {note.content && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {note.content.slice(0, 60)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => deleteNote(note.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.button>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute inset-0 flex flex-col px-4 py-3 gap-2"
            >
              <Input
                value={editTitle}
                onChange={handleTitleChange}
                placeholder="Note title…"
                className="h-8 text-sm font-medium border-none shadow-none px-0 focus-visible:ring-0 bg-transparent"
              />
              <div className="h-px bg-border" />
              <textarea
                value={editContent}
                onChange={handleContentChange}
                placeholder="Start writing…"
                className="flex-1 text-sm resize-none bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground leading-relaxed"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}