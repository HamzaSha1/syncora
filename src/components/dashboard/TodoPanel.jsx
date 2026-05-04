import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckSquare, Plus, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TodoPanel() {
  const [todos, setTodos] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Todo.list('order', 100).then((data) => {
      setTodos(data);
      setLoading(false);
    });
  }, []);

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
    const updated = await base44.entities.Todo.update(todo.id, { completed: !todo.completed });
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
  };

  const deleteTodo = async (id) => {
    await base44.entities.Todo.delete(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const active = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <CheckSquare className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm text-foreground">Todos</h2>
        {active.length > 0 && (
          <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
            {active.length}
          </span>
        )}
      </div>

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
        {loading ? (
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
          todo.completed
            ? 'bg-primary border-primary'
            : 'border-border hover:border-primary'
        }`}
      >
        {todo.completed && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
      </button>
      <span
        className={`flex-1 text-sm leading-snug ${
          todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}
      >
        {todo.text}
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