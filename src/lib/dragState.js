const COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#06b6d4',
  '#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f59e0b',
];
let colorIdx = 0;

const dragState = {
  task: null,        // { text, color }
  dropHandler: null, // (clientX, clientY) => void — registered by CalendarPanel
  nextColor() { return COLORS[colorIdx++ % COLORS.length]; },
};

export default dragState;
