// Shared callbacks so CalendarPanel can notify TodoPanel of state changes
export const todoSync = {
  onTodoCompleted: null,   // (todoId: string, completed: bool) => void
  onTodoScheduled: null,   // (todoId: string, date: string) => void — mark as scheduled
  onTodoReinstated: null,  // (todoId: string) => void — remove scheduled_date
};