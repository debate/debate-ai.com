import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Mounts `hook` in a throwaway component and exposes its latest return value,
 * so a hook can be driven through `act()` without a component library.
 */
export async function renderHook<T>(hook: () => T) {
  const result = { current: undefined as unknown as T };
  function Harness() {
    result.current = hook();
    return null;
  }
  const root: Root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(createElement(Harness));
  });
  return {
    result,
    unmount: () => act(async () => root.unmount()),
  };
}
