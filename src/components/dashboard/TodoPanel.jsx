import { useState, useEffect, useRef } from 'react';
import { dragState } from '@/lib/dragState';
import { todoSync } from '@/lib/todoSync';
import { base44 } from '@/api/base44Client';
import { CheckSquare, Plus, Trash2, Check, BookOpen, ChevronDown, RefreshCw, X, FileText, Mail, Pencil, Calendar } from 'lucide-react';
import TodoEditPanel from './TodoEditPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NotesTab from './NotesTab';

const parseAttachments = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

export default function TodoPanel({ onDragStart, onDragEnd }) {
  const [activeTab, setActiveTab] = useState('todos');
  const [todos, setTodos] = useState([]);
  const [inputText, setInputText] = useState('');
  const [inputImportance, setInputImportance] = useState(3);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // OneNote state
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(() => localStorage.getItem('todo_onenote_page') || null);
  const [selectedPageTitle, setSelectedPageTitle] = useState(() => localStorage.getItem('todo_onenote_page_title') || null);
  const [showImportance, setShowImportance] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);
  const syncIntervalRef = useRef(null);

  // Load local todos and reinstate any stale scheduled ones (scheduled on a past day and not completed)
  useEffect(() => {
    base44.entities.Todo.list('order', 200).then(async (data) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const stale = data.filter((t) => t.scheduled_date && t.scheduled_date < todayStr && !t.completed);
      if (stale.length > 0) {
        await Promise.all(stale.map((t) => base44.entities.Todo.update(t.id, { scheduled_date: null })));
        const fresh = await base44.entities.Todo.list('order', 200);
        setTodos(fresh);
      } else {
        setTodos(data);
      }
      setLoading(false);
    });
  }, []);

  // Register callbacks so CalendarPanel can update todo state
  useEffect(() => {
    todoSync.onTodoCompleted = (todoId, completed) => {
      setTodos((prev) => prev.map((t) => t.id === todoId ? { ...t, completed } : t));
    };
    todoSync.onTodoScheduled = (todoId, date) => {
      setTodos((prev) => prev.map((t) => t.id === todoId ? { ...t, scheduled_date: date } : t));
      base44.entities.Todo.update(todoId, { scheduled_date: date }).catch(console.error);
    };
    todoSync.onTodoReinstated = (todoId) => {
      setTodos((prev) => prev.map((t) => t.id === todoId ? { ...t, scheduled_date: null } : t));
      base44.entities.Todo.update(todoId, { scheduled_date: null }).catch(console.error);
    };
    return () => {
      todoSync.onTodoCompleted = null;
      todoSync.onTodoScheduled = null;
      todoSync.onTodoReinstated = null;
    };
  }, []);

  // Auto-sync from OneNote every 60s when a page is linked
  useEffect(() => {
    if (selectedPageId) {
      syncFromOneNote(selectedPageId);
      syncIntervalRef.current = setInterval(() => syncFromOneNote(selectedPageId), 60000);
    }
    return () => clearInterval(syncIntervalRef.current);
  }, [selectedPageId]);

  // Sync from OneNote → app: update completion state AND add new items
  const syncFromOneNote = async (pageId, silent = true) => {
    if (!silent) setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncOneNoteItems', { pageId });
      const oneNoteItems = res.data.items || [];
      if (oneNoteItems.length === 0) return;

      // Get current todos from DB
      const currentTodos = await base44.entities.Todo.list('order', 200);
      const updates = [];
      const creates = [];

      for (const onItem of oneNoteItems) {
        const match = currentTodos.find((t) => t.onenote_element_id === onItem.elementId);
        if (match) {
          // Update completion state if changed
          if (match.completed !== onItem.completed) {
            updates.push(base44.entities.Todo.update(match.id, { completed: onItem.completed }));
          }
        } else {
          // New item added in OneNote — create it locally
          creates.push(
            base44.entities.Todo.create({
              text: onItem.text,
              completed: onItem.completed,
              order: currentTodos.length + creates.length,
              onenote_element_id: onItem.elementId,
              onenote_page_id: pageId,
            })
          );
        }
      }

      if (updates.length > 0 || creates.length > 0) {
        await Promise.all([...updates, ...creates]);
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
    setShowImportance(true);
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
    setShowImportance(false);
    importFromOneNote(page.id);
  };

  const clearPage = () => {
    setSelectedPageId(null);
    setSelectedPageTitle(null);
    clearInterval(syncIntervalRef.current);
    localStorage.removeItem('todo_onenote_page');
    localStorage.removeItem('todo_onenote_page_title');
  };

  const doAddTodo = async () => {
    if (!inputText.trim()) return;
    const newTodo = await base44.entities.Todo.create({
      text: inputText.trim(),
      completed: false,
      order: todos.length,
      importance: inputImportance,
    });
    setTodos((prev) => [...prev, newTodo]);
    setInputText('');
    setInputImportance(3);
  };

  const addTodo = async (e) => {
    e.preventDefault();
    await doAddTodo();
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

  const setImportance = async (todo, value) => {
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, importance: value } : t)));
    await base44.entities.Todo.update(todo.id, { importance: value });
  };

  const handleAttachmentsChange = (todoId, attachments) => {
    setTodos((prev) => prev.map((t) => t.id === todoId ? { ...t, attachments } : t));
  };

  const editTodo = async (todoId, changes) => {
    setTodos((prev) => prev.map((t) => t.id === todoId ? { ...t, ...changes } : t));
    await base44.entities.Todo.update(todoId, changes);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const sortActive = (list) => list.sort((a, b) => {
    const aOverdue = a.due_date && a.due_date < todayStr;
    const bOverdue = b.due_date && b.due_date < todayStr;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    // Both overdue or both not: sort by due_date (soonest first, no date last), then importance
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return (a.importance ?? 3) - (b.importance ?? 3);
  });

  const active = sortActive(todos.filter((t) => !t.completed && !t.scheduled_date));
  const scheduled = todos
    .filter((t) => !t.completed && t.scheduled_date === todayStr)
    .sort((a, b) => (a.importance ?? 3) - (b.importance ?? 3));
  const done = todos.filter((t) => t.completed);

  if (activeTab === 'notes') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setActiveTab('todos')}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Todos
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-foreground border-b-2 border-primary transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> Notes
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <NotesTab />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-foreground border-b-2 border-primary transition-colors"
        >
          <CheckSquare className="w-3.5 h-3.5" /> Todos
          {active.length > 0 && (
            <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full leading-none">
              {active.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="w-3.5 h-3.5" /> Notes
        </button>
      </div>

      {/* OneNote todo-page selector */}
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
        {showImportance && (
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
      <form onSubmit={addTodo} className="flex flex-col gap-1.5 px-4 py-3 shrink-0 border-b border-border">
        <div className="flex gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Add a task…"
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAddTodo(); } }}
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Importance:</span>
          <ImportancePicker value={inputImportance} onChange={setInputImportance} />
        </div>
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
                <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} onSetImportance={setImportance} onDragStart={onDragStart} onDragEnd={onDragEnd} onAttachmentsChange={handleAttachmentsChange} onEdit={editTodo} todayStr={todayStr} />
              ))}
            </AnimatePresence>
            {scheduled.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest pt-2 pb-1 flex items-center gap-1">
                  <span>📅</span> Scheduled Today
                </p>
                <AnimatePresence>
                  {scheduled.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} onSetImportance={setImportance} onDragStart={onDragStart} onDragEnd={onDragEnd} onAttachmentsChange={handleAttachmentsChange} onEdit={editTodo} todayStr={todayStr} isScheduled />
                  ))}
                </AnimatePresence>
              </>
            )}
            {done.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest pt-2 pb-1">Completed</p>
                <AnimatePresence>
                  {done.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} onSetImportance={setImportance} onDragStart={onDragStart} onDragEnd={onDragEnd} onAttachmentsChange={handleAttachmentsChange} onEdit={editTodo} todayStr={todayStr} />
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

const IMPORTANCE_COLORS = {
  1: 'bg-destructive text-white',
  2: 'bg-orange-500 text-white',
  3: 'bg-yellow-400 text-black',
  4: 'bg-blue-400 text-white',
  5: 'bg-muted text-muted-foreground',
};

function ImportancePicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-5 h-5 rounded text-[10px] font-bold transition-all ${
            value === n
              ? IMPORTANCE_COLORS[n] + ' scale-110 shadow'
              : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
          }`}
          title={`Importance ${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function TodoItem({ todo, onToggle, onDelete, onSetImportance, onDragStart, onDragEnd, onAttachmentsChange, onEdit, isScheduled, todayStr }) {
  const imp = todo.importance ?? 3;
  const [editing, setEditing] = useState(false);
  const isOverdue = !todo.completed && todo.due_date && todo.due_date < todayStr;

  const handleDragStart = (e) => {
    if (isScheduled || editing) { e.preventDefault(); return; }
    dragState.set(todo.text, todo.id, parseAttachments(todo.attachments));
    e.dataTransfer.setData('text/plain', todo.text);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.();
  };

  const handleDragEnd = () => { onDragEnd?.(); };

  const handleSaveEdit = (changes) => {
    onEdit(todo.id, changes);
    setEditing(false);
  };

  const formatDate = (d) => {
    const [y, m, day] = d.split('-');
    return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className={isScheduled ? 'opacity-50' : ''}
    >
      {/* Main row */}
      <div className="flex items-start gap-2 group py-1">
        {/* Draggable: checkbox + text */}
        <div
          draggable={!isScheduled && !editing}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className={`flex items-start gap-2 flex-1 min-w-0 ${isScheduled || editing ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        >
          <button
            onClick={() => onToggle(todo)}
            className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
              todo.completed ? 'bg-primary border-primary' : 'border-border hover:border-primary'
            }`}
          >
            {todo.completed && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
          </button>
          <div className="flex flex-col min-w-0">
            <span className={`text-sm leading-snug mt-0.5 ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {todo.text}
              {todo.onenote_element_id && (
                <span className="ml-1 text-[9px] text-muted-foreground/50">↔</span>
              )}
            </span>
            {todo.due_date && !todo.completed && (
              <span className={`inline-flex items-center gap-0.5 text-[9px] mt-0.5 font-medium px-1.5 py-0.5 rounded w-fit ${
                isOverdue
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-secondary text-muted-foreground'
              }`}>
                <Calendar className="w-2 h-2 shrink-0" />
                {isOverdue ? 'Late · ' : ''}{formatDate(todo.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* Attachment chips */}
        {parseAttachments(todo.attachments).map((att) => (
          <a
            key={att.id}
            href={att.webLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 bg-primary/10 text-primary hover:bg-primary/20 rounded px-1.5 py-0.5 text-[10px] max-w-[140px] transition-colors shrink-0 mt-0.5"
            title={att.subject}
          >
            <Mail className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{att.subject}</span>
          </a>
        ))}

        {/* Edit pencil */}
        {!todo.completed && (
          <button
            onClick={() => setEditing((p) => !p)}
            className={`shrink-0 mt-0.5 transition-opacity ${editing ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-60 text-muted-foreground hover:text-foreground'}`}
            title="Edit todo"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Priority badge */}
        {!todo.completed && !editing && (
          <span
            className={`text-[10px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 ${IMPORTANCE_COLORS[imp]}`}
          >
            {imp}
          </span>
        )}

        <button
          onClick={() => onDelete(todo.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline edit panel */}
      {editing && (
        <TodoEditPanel
          todo={todo}
          onSave={handleSaveEdit}
          onCancel={() => setEditing(false)}
        />
      )}
    </motion.div>
  );
}