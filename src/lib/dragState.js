// Global drag state shared between TodoPanel and CalendarPanel.
// dataTransfer.getData() is unreliable across panel boundaries.
export const dragState = {
  text: null,
  set(t) { this.text = t; },
  get() { return this.text; },
  clear() { this.text = null; },
};
