import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckSquare, Plus, Trash2, Check, BookOpen, ChevronDown, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TodoPanel() {
  const [todos, setTodos] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // OneNote state
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(() => localStorage.getItem('todo_onenote_page') || null);
  const [selectedPageTitle, setSelectedPageTitle] = useState(() => localStorage.getItem('todo_onenote_page_title') || null);
  const [showPicker, setShowPicker] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);
  const syncIntervalRef = useRef(null);

  // Load local todos
  useEffect(() => {
    base44.entities.Todo.list('order', 200).then((data) => {
      setTodos(data);
      setLoading(false);
    });
  }, []);

  // Auto-sync from OneNote every 60s when a page is linked
  useEffect(() => {
    if (selectedPageId) {
      syncFromOneNote(selectedPageId);
      syncIntervalRef.current = setInterval(() => syncFromOneNote(selectedPageId), 60000);
    }
    return () => clearInterval(syncIntervalRef.current);
  }, [selectedPageId]);

  // Sync from OneNote → app: update completion state of existing todos
  const syncFromOneNote = async (pageId, silent = true) => {
    if (!silent) setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncOneNoteItems', { pageId });
      const oneNoteItems = res.data.items || [];
      if (oneNoteItems.length === 0) return;

      // Get current todos from DB
      const currentTodos = await base44.entities.Todo.list('order', 200);
      const updates = [];

      for (const onItem of oneNoteItems) {
        const match = currentTodos.find((t) => t.onenote_element_id === onItem.elementId);
        if (match && match.completed !== onItem.completed) {
          updates.push(base44.entities.Todo.update(match.id, { completed: onItem.completed }));
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        // Refresh local state
        const fresh = await base44.entities.Todo.list('order', 200);
        setTodos(fresh);
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  const importFromOneNote = async (pageId) => {
    setImporting(true);
    try {
      const res = await base44.functions.invoke('getOneNotePages', { pageId });
      const items = res.data.items || [];

      const existing = await base44.entities.Todo.list('order', 200);
      const existingTexts = new Set(existing.map((t) => t.text.trim().toLowerCase()));
      const newItems = items.filter((item) => !existingTexts.has(item.text.trim().toLowerCase()));

      if (newItems.length > 0) {
        const maxOrder = existing.length;
        const created = await Promise.all(
          newItems.map((item, i) =>
            base44.entities.Todo.create({
              text: item.text,
              completed: item.completed,
              order: maxOrder + i,
              onenote_element_id: item.elementId,
              onenote_page_id: pageId,
            })
          )
        );
        setTodos((prev) => [...prev, ...created]);
      }

      // Also update completion state of already-imported items
      const updates = [];
      for (const item of items) {
        if (!item.elementId) continue;
        const match = existing.find((t) => t.onenote_element_id === item.elementId);
        if (match && match.completed !== item.completed) {
          updates.push(base44.entities.Todo.update(match.id, { completed: item.completed }));
        }
      }
      if (updates.length > 0) {
        await Promise.all(updates);
        const fresh = await base44.entities.Todo.list('order', 200);
        setTodos(fresh);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const openPicker = async () => {
    setShowPicker(true);
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

  const selectPage = (page) => {
    setSelectedPageId(page.id);
    setSelectedPageTitle(page.title);
    localStorage.setItem('todo_onenote_page', page.id);
    localStorage.setItem('todo_onenote_page_title', page.title);
    setShowPicker(false);
    importFromOneNote(page.id);
  };

  const clearPage = () => {
    setSelectedPageId(null);
    setSelectedPageTitle(null);
    clearInterval(syncIntervalRef.current);
    localStorage.removeItem('todo_onenote_page');
    localStorage.removeItem('todo_onenote_page_title');
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const newTodo = await base44.entities.Todo.create({
      text: inputText.trim(),
      completed: false,
      order: todos.length,
    });
    setTodos((prev) => [...prev, newTodo]);
    setInputText('');
  };

  const toggleTodo = async (todo) => {
    const newCompleted = !todo.completed;
    // Optimistic update
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: newCompleted } : t)));
    await base44.entities.Todo.update(todo.id, { completed: newCompleted });

    // Sync to OneNote if this todo has an element ID
    if (todo.onenote_element_id && todo.onenote_page_id) {
      base44.functions.invoke('updateOneNoteItem', {
        pageId: todo.onenote_page_id,
        elementId: todo.onenote_element_id,
        completed: newCompleted,
      }).catch(console.error);
    }
  };

  const deleteTodo = async (id) => {
    await base44.entities.Todo.delete(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const active = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <CheckSquare className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm text-foreground">Todos</h2>
        {active.length > 0 && (
          <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
            {active.length}
          </span>
        )}
      </div>

      {/* OneNote selector */}
      <div className="px-4 py-2 border-b border-border shrink-0 flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {selectedPageTitle ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <button onClick={openPicker} className="text-xs text-primary hover:underline truncate flex-1 text-left">
              {selectedPageTitle}
            </button>
            <button
              onClick={() => { setSyncing(true); syncFromOneNote(selectedPageId, false); importFromOneNote(selectedPageId); }}
              disabled={syncing || importing}
              className="text-muted-foreground hover:text-foreground shrink-0"
              title="Sync with OneNote"
            >
              <RefreshCw className={`w-3 h-3 ${(syncing || importing) ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={clearPage} className="text-muted-foreground hover:text-destructive shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={openPicker} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Import from OneNote <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Page picker dropdown */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border shrink-0 overflow-hidden"
          >
            <div className="px-4 py-2 max-h-48 overflow-y-auto space-y-0.5">
              {pagesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : pages.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No pages found.</p>
              ) : (
                pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => selectPage(page)}
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

      {/* Add input */}
      <form onSubmit={addTodo} className="flex gap-2 px-4 py-3 shrink-0 border-b border-border">
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Add a task…"
          className="h-8 text-sm"
        />
        <Button type="submit" size="icon" className="h-8 w-8 shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </form>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {loading || importing ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <AnimatePresence>
              {active.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
              ))}
            </AnimatePresence>
            {done.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest pt-2 pb-1">Completed</p>
                <AnimatePresence>
                  {done.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                  ))}
                </AnimatePresence>
              </>
            )}
            {todos.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Nothing here yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="flex items-start gap-2 group py-1"
    >
      <button
        onClick={() => onToggle(todo)}
        className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
          todo.completed ? 'bg-primary border-primary' : 'border-border hover:border-primary'
        }`}
      >
        {todo.completed && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
      </button>
      <span className={`flex-1 text-sm leading-snug ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {todo.text}
        {todo.onenote_element_id && (
          <span className="ml-1 text-[9px] text-muted-foreground/50">↔</span>
        )}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}