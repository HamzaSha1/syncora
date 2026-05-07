// Global drag state — module-level variable bypasses dataTransfer cross-panel issues
export const dragState = {
  text: null,
  todoId: null,
  attachments: null,
  set(text, todoId, attachments) {
    this.text = text;
    this.todoId = todoId ?? null;
    this.attachments = attachments ?? null;
  },
  get() { return this.text; },
  clear() { this.text = null; this.todoId = null; this.attachments = null; },
};
