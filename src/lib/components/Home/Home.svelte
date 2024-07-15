<script>
  import Particles, { particlesInit } from '@tsparticles/svelte';
  import { loadSlim } from '@tsparticles/slim';
  import { Card, CardContent } from "$lib/components/ui/card";

  let particlesConfig = {
    particles: {
      color: {
        value: '#ffffff'
      },
      links: {
        enable: true,
        color: '#ffffff',
        distance: 150,
        opacity: 0.5,
        width: 1
      },
      move: {
        enable: true,
        speed: 3,
        direction: 'none',
        random: true,
        straight: false,
        outModes: {
          default: 'bounce'
        }
      },
      number: {
        value: 150,
        density: {
          enable: true,
          area: 800
        }
      },
      size: {
        value: { min: 1, max: 3 }
      },
      opacity: {
        value: 0.8
      }
    },
    interactivity: {
      events: {
        onHover: {
          enable: true,
          mode: 'grab'
        }
      },
      modes: {
        grab: {
          distance: 200,
          links: {
            opacity: 1
          }
        }
      }
    },
    background: {
      opacity: 0
    }
  };

  let particlesContainer;

  let onParticlesLoaded = (event) => {
    particlesContainer = event.detail.particles;
  };

  void particlesInit(async (engine) => {
    await loadSlim(engine);
  });

  function handleMouseMove(event) {
    if (particlesContainer) {
      particlesContainer.addParticle({
        x: event.clientX,
        y: event.clientY
      });
    }
  }
</script>

<svelte:head>
  <title>Debate AI</title>
</svelte:head>

<div class="relative h-screen w-full overflow-hidden" on:mousemove={handleMouseMove}>
  <!-- Background Image -->
  <img
    src='/assets/background1.jpg'
    alt="AI and modern office"
    class="absolute inset-0 w-full h-full object-cover"
  />
  
  <!-- Overlay -->
  <div class="absolute inset-0 bg-black bg-opacity-50"></div>
  
  <!-- Particles -->
  <Particles
    id="tsparticles"
    options={particlesConfig}
    on:particlesLoaded={onParticlesLoaded}
    class="absolute inset-0"
  />
  
  <!-- Content -->
  <div class="relative z-10 h-full flex flex-col items-center justify-center text-white text-center px-4">
    <Card class="bg-black bg-opacity-30 border-none max-w-3xl">
      <CardContent class="pt-6">
        <h1 class="text-3xl font-bold mb-4">
          Creating Collective Consciousness 
        </h1>
        <p class="text-xl mb-8">
          Critical times call for critical thinkers to create the decentralized AI Knowledge Graph — a crowdsourced argument reasoning dataset for AI models to recommend arguments and evolve tree-of-thought reasoning. Debate should be a war of warrants where victories are vectorized as weights — for the AI collective mind to make decisions which weighs the best arguments from many perspectives. AI is inevitable, so it is necessary to have public safety testing to train AI models to unlock faster ways to read a long text, monitor developments in a complex literature base, and crowdsource decentralized AI tree-of-thought decisionmaking reasoning.
        </p>
        <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
          Login with Google 
        </button>
      </CardContent>
    </Card>
  </div>
</div>

<style>
  /* You can add any additional styles here if needed */
</style>