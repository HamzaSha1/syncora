// Shared callback so CalendarPanel can notify TodoPanel when a todo is completed
export const todoSync = {
  onTodoCompleted: null, // (todoId: string) => void — registered by TodoPanel
};
