import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hideReadingButton, showReadingButton } from '@/src/page-tools/reading-button';

const HOST = 'debate-ai-reading-button';

/** The shadow root is closed on purpose, so tests capture it as it is attached. */
let roots: ShadowRoot[];

beforeEach(() => {
  document.body.innerHTML = '';
  roots = [];
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init) {
    const root = attach.call(this, init);
    roots.push(root);
    return root;
  });
});

afterEach(() => {
  hideReadingButton();
  vi.restoreAllMocks();
});

describe('showReadingButton', () => {
  it('adds one host element with a closed shadow root holding a labelled button', () => {
    showReadingButton('Open in reading mode (1,200 words)', () => {});

    expect(document.querySelectorAll(`#${HOST}`)).toHaveLength(1);
    expect(document.getElementById(HOST)!.shadowRoot).toBeNull();
    const button = roots[0].querySelector('button')!;
    expect(button.title).toBe('Open in reading mode (1,200 words)');
    expect(button.getAttribute('aria-label')).toBe('Open in reading mode (1,200 words)');
    expect(button.type).toBe('button');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(roots[0].querySelector('style')!.textContent).toContain('position: fixed');
  });

  it('calls onOpen on click without letting the click reach the page', () => {
    const onOpen = vi.fn();
    const pageClick = vi.fn();
    document.addEventListener('click', pageClick);
    showReadingButton('Read', onOpen);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    roots[0].querySelector('button')!.dispatchEvent(click);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(click.defaultPrevented).toBe(true);
    expect(pageClick).not.toHaveBeenCalled();
    document.removeEventListener('click', pageClick);
  });

  it('does not add a second button when called again', () => {
    const first = vi.fn();
    const second = vi.fn();
    showReadingButton('One', first);
    showReadingButton('Two', second);

    expect(document.querySelectorAll(`#${HOST}`)).toHaveLength(1);
    expect(roots).toHaveLength(1);
    roots[0].querySelector('button')!.click();
    expect(first).toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});

describe('hideReadingButton', () => {
  it('removes the button, allows it to be shown again, and is safe when absent', () => {
    expect(() => hideReadingButton()).not.toThrow();

    showReadingButton('Read', () => {});
    hideReadingButton();
    expect(document.getElementById(HOST)).toBeNull();

    showReadingButton('Read again', () => {});
    expect(document.getElementById(HOST)).not.toBeNull();
  });
});
