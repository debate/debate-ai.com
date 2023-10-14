import { quadIn, sineIn, quadOut, cubicInOut, quadInOut } from 'svelte/easing';
import { crossfade } from 'svelte/transition';
import { Align } from './types';
let transitionSpeed = 200;
export function selectMark(node: HTMLElement, { delay = 0, duration = 500 }) {
  return {
    delay,
    duration,
    css: function (t: number) {
      return `
        display: block;
        opacity: ${Math.cos(t * Math.PI * 4) + 1};
        transform: scale(${t * 2});
      `;
    },
  };
}
export function searchAside(
  node: HTMLElement,
  { delay = 0, duration = transitionSpeed }
) {
  return {
    delay,
    duration,
    css: function (t: number) {
      const eased = quadIn(t);
      if (node.classList.contains('showSearchResults')) {
        return `
        transform: translateX(${(1 - eased) * 100}%);
      `;
      } else {
        return '';
      }
    },
  };
}
export function outlineAside(
  node: HTMLElement,
  { delay = 0, duration = transitionSpeed }
) {
  return {
    delay,
    duration,
    css: function (t: number) {
      const eased = quadIn(t);
      return `
        transform: translateX(${(1 - eased) * -100}%);
      `;
    },
  };
}
export function paraButtons(
  node: HTMLElement,
  { delay = 0, duration = transitionSpeed }
) {
  return {
    delay,
    duration,
    css: function (t: number) {
      const eased = quadIn(t);
      return `
        opacity: ${t};
      `;
    },
  };
}

export function panel(
  node: HTMLElement,
  { delay = 0, duration = transitionSpeed, align = Align.TopRight }
) {
  let x = '1rem';
  let y = '1rem';
  if (
    align == Align.Right ||
    align === Align.TopRight ||
    align == Align.BottomRight
  ) {
    x = 'calc(100% - 1rem)';
  }
  if (
    align == Align.Bottom ||
    align === Align.BottomRight ||
    align == Align.BottomLeft
  ) {
    y = 'calc(100% - 1rem)';
  }

  return {
    delay,
    duration,
    css: function (t: number) {
      const eased = quadIn(t);
      return `
        clip-path: circle(calc(1rem + ${eased * 150}%) at ${x} ${y});
      `;
    },
  };
}

export function checkbox(
  node: HTMLElement,
  { delay = 0, duration = transitionSpeed }
) {
  return {
    delay,
    duration,
    css: function (t: number) {
      const eased = quadIn(t);
      return `
        clip-path: circle(calc(${eased * 150}%) at 50% 50%);
      `;
    },
  };
}

export function accordion(
  node: HTMLElement,
  { delay = 0, duration = transitionSpeed }
) {
  let finalHeight = node.offsetHeight;
  return {
    delay,
    duration,
    css: function (t: number) {
      const eased = quadIn(t);
      return `
        overflow: hidden;
        height: ${eased * finalHeight}px;`;
    },
  };
}
