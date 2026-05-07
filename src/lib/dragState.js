// Global drag state — module-level variable bypasses dataTransfer cross-panel issues
export const dragState = {
  text: null,
  todoId: null,
  set(text, todoId) { this.text = text; this.todoId = todoId ?? null; },
  get() { return this.text; },
  clear() { this.text = null; this.todoId = null; },
};
