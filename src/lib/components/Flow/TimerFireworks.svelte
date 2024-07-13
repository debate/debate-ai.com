<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { gsap } from 'gsap';
    
    const dispatch = createEventDispatcher();
    
    let emitter;
    let emitterSize = 30;
    let dotQuantity = 100;
    let dotSizeMin = 2;
    let dotSizeMax = 25;
    let speed = 1;
    let gravity = 0.5;
    let explosionQuantity = 40;
    let explosions = [];
    let currentExplosion = 0;
    let move;
    
    onMount(() => {
      setup();
    });
    
    function createExplosion(container) {
      let tl = gsap.timeline({ paused: true });
      let dots = [];
    
      for (let i = 0; i < dotQuantity; i++) {
        let dot = document.createElement('div');
        dots.push(dot);
        dot.className = 'dot';
        let r = getRandom(30, 255);
        let g = getRandom(30, 230);
        let b = getRandom(30, 230);
        gsap.set(dot, {
          backgroundColor: `rgb(${r},${g},${b})`,
          visibility: 'hidden'
        });
        let size = getRandom(dotSizeMin, dotSizeMax);
        container.appendChild(dot);
        let angle = getRandom(0, 2) * Math.PI;
        let length = Math.random() * (emitterSize / 2 - size / 2);
        let duration = 3 + Math.random();
    
        gsap.set(dot, {
          x: Math.cos(angle) * length,
          y: Math.sin(angle) * length,
          width: size,
          height: size,
          xPercent: -50,
          yPercent: -50,
          visibility: 'hidden',
          force3D: true
        });
    
        let velocity = (100 + Math.random() * 250) * speed;
        let vx = Math.cos(angle) * velocity;
        let vy = Math.sin(angle) * velocity;
    
        tl.to(dot, {
          duration: duration / 2,
          opacity: 0,
          ease: "rough({ template: none, strength: 1, points: 20, taper: 'none', randomize: true, clamp: false})"
        }, 0);
    
        tl.to(dot, {
          duration: duration,
          visibility: 'visible',
          rotationX: `-=${getRandom(720, 1440)}`,
          rotationZ: `+=${getRandom(720, 1440)}`,
          x: `+=${vx * duration}`,
          y: `+=${vy * duration + 0.5 * gravity * 700 * duration * duration}`,
          ease: "power1.out"
        }, 0);
    
        tl.to(dot, {
          duration: 1.25 + Math.random(),
          opacity: 0
        }, duration / 2);
      }
    
      return tl;
    }
    
    function explode(element) {
      let bounds = element.getBoundingClientRect();
      let explosion;
    
      if (++currentExplosion === explosions.length) {
        currentExplosion = 0;
      }
    
      explosion = explosions[currentExplosion];
      gsap.set(explosion.container, {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2
      });
      explosion.animation.restart();
    }
    
    function getRandom(min, max) {
      return min + Math.random() * (max - min);
    }
    
    export function play() {
      move.play(0);
      let intervalCount = 0;
      let interval = setInterval(() => {
        if (intervalCount < 4) {  // Changed from 5 to 4
          explode(emitter);
          intervalCount++;
        } else {
          clearInterval(interval);
          dispatch('complete');
        }
      }, 1000);
    }
    
    function setup() {
      for (let i = 0; i < explosionQuantity; i++) {
        let container = document.createElement('div');
        container.className = 'dot-container';
        document.body.appendChild(container);
        explosions.push({
          container: container,
          animation: createExplosion(container)
        });
      }
    
      move = gsap.timeline({
        paused: true
      }).fromTo(emitter, {
        top: '-20%',
      }, {
        duration: 1, 
        bottom: '0%',

        ease: "none"
      }).fromTo(emitter, {
        bottom: '0%',
        left: '60%'
      }, {
        duration: 2,
        bottom: '0%',
        left: '40%',
        ease: "none"
      }, {
        duration: 4,
        top: '-20%',
        left: '40%',
        ease: "none"
      });
    }
    </script>
    
    <div id="emitter" bind:this={emitter}></div>
    
    <style>
      :global(body), :global(html) {
        background-color: white;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
    
      #emitter {
        visibility: hidden;
        background-color: #222;
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        top: 0%;
        left: 0%;
      }
    
      :global(.dot-container) {
        position: absolute;
        left: 0;
        top: 0;
        overflow: visible;
        z-index: 5000;
        pointer-events: none;
      }
    
      :global(.dot) {
        position: absolute;
        pointer-events: none;
      }
    </style>