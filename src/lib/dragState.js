// Global drag state shared between TodoPanel and CalendarPanel
// dataTransfer.getData() is unreliable across panel boundaries
let _draggedText = null;

export const dragState = {
  set(text) { _draggedText = text; },
  get() { return _draggedText; },
  clear() { _draggedText = null; },
};