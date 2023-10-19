let shortcuts: { [key: string]: () => void } = {};
export function register(command: string, callback: () => void) {
  shortcuts[command] = callback;
}
window.addEventListener('keydown', function (e: KeyboardEvent) {
  for (let shortcut of Object.keys(shortcuts)) {
    let keys = shortcut.split('+');
    let trigger = true;
    for (let key of keys) {
      if (key == 'CommandOrControl') trigger = e.metaKey || e.ctrlKey;
      else if (key == 'Control') trigger = e.ctrlKey;
      else if (key == 'Command') trigger = e.metaKey;
      else if (key == 'Shift' && e.shiftKey) trigger = e.shiftKey;
      else if (key == 'Alt' && e.altKey) trigger = e.altKey;
      else trigger = key.toLowerCase() == e.key.toLowerCase();
      if (!trigger) break;
    }
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      shortcuts[shortcut]();
    }
  }
});
