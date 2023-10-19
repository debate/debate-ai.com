import {
  backInOut,
  backIn,
  backOut,
  bounceOut,
  bounceInOut,
  bounceIn,
  circInOut,
  circIn,
  circOut,
  cubicInOut,
  cubicIn,
  cubicOut,
  elasticInOut,
  elasticIn,
  elasticOut,
  expoInOut,
  expoIn,
  expoOut,
  quadInOut,
  quadIn,
  quadOut,
  quartInOut,
  quartIn,
  quartOut,
  quintInOut,
  quintIn,
  quintOut,
  sineInOut,
  sineIn,
  sineOut,
} from 'svelte/easing';

let easingFunctions = {
  backInOut,
  backIn,
  backOut,
  bounceOut,
  bounceInOut,
  bounceIn,
  circInOut,
  circIn,
  circOut,
  cubicInOut,
  cubicIn,
  cubicOut,
  elasticInOut,
  elasticIn,
  elasticOut,
  expoInOut,
  expoIn,
  expoOut,
  quadInOut,
  quadIn,
  quadOut,
  quartInOut,
  quartIn,
  quartOut,
  quintInOut,
  quintIn,
  quintOut,
  sineInOut,
  sineIn,
  sineOut,
};

export let transitionDuration = 200;

export function createTransition(
  transition: (t?: number, eased?: number | null, info?: any) => string,
  easingKey: string | null = null,
  options: {
    durationMultiplier?: number;
    delay?: number;
    preRun?: null | ((node: HTMLElement) => any);
  } = {}
) {
  let optionsDefault = {
    durationMultiplier: 1,
    preRun: null,
    delay: 0,
  };
  options = Object.assign(optionsDefault, options);

  return function (
    node: HTMLElement,
    {
      delay = options.delay,
      duration = transitionDuration * options.durationMultiplier,
    } = {}
  ) {
    let info: any = null;
    if (options.preRun != null) {
      info = options.preRun(node);
    }
    let easingFunction: null | ((t?: number) => number) = null;
    if (easingKey != null) {
      easingFunction = easingFunctions[easingKey];
    }
    return {
      delay,
      duration,
      css: (t: number) => {
        let eased: number | null = null;
        if (easingFunction != null) {
          eased = easingFunction(t);
        }
        return transition(t, eased, info);
      },
    };
  };
}
