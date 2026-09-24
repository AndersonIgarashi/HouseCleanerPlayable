export type StepId = 'clean' | 'paint' | 'floor' | 'furniture';

export const config = {
  game: {
    level: 1,
    // Order of the step buttons. Only 'clean' and 'paint' are playable in the
    // exterior version; the rest render locked as a teaser for the interior.
    steps: ['clean', 'paint', 'floor', 'furniture'] as StepId[],
    playableSteps: ['clean', 'paint'] as StepId[],
    showLockedSteps: true,
    stepLabels: { clean: 'CLEAN', paint: 'PAINT', floor: 'FLOOR', furniture: 'FURNITURE' } as Record<StepId, string>,

    // Each paint pass paints one group of the house with one palette
    paintPasses: [
      { id: 'walls', label: 'WALLS', colors: ['#FF7A2F', '#FFC83D', '#3FA9F5', '#8E5BE8'] },
      { id: 'roof', label: 'ROOF', colors: ['#E5483F', '#7B4FD6', '#28B3A1', '#3D5AA8'] }
    ] as { id: 'walls' | 'roof'; label: string; colors: string[] }[],

    // Share of the top progress bar filled by each phase (sums to 1)
    progressShare: { clean: 0.5, walls: 0.3, roof: 0.2 },

    // Broom reach around the bristles, in UI design pixels
    sweepRadius: 105,
    // Remaining debris get auto-swept once this share has been cleared
    cleanAutoFinish: 0.86,
    // Half width of the roller stroke, in world units
    brushHalfWidth: 0.75,
    // Releasing the finger past this share auto-completes the paint pass
    paintAutoFinish: 0.72
  },

  timings: {
    introDelay: 250,
    idleHint: 2600,
    completeToEndcard: 2300
  },

  camera: {
    // Horizontal field of view kept on narrow screens; vertical fov grows up to maxFov
    fov: 36,
    maxFov: 60,
    target: [0, 1.45, 0.8] as [number, number, number],
    direction: [-0.46, 0.55, 1.0] as [number, number, number],
    // World radius kept on screen around the target
    fitRadius: 4.4,
    // Landscape has little vertical room between the HUD bars, so frame tighter
    landscapeZoom: 0.8,
    endcardRadius: 4.0,
    // End card camera swings around the house (radians / speed of the swing)
    orbitSwing: 0.45,
    orbitSpeed: 0.55
  },

  sounds: {
    volume: 1,
    music: 0.35
  },

  haptics: {
    enabled: true,
    hit: 12,
    step: 40,
    win: [60, 50, 60, 50, 120] as number | number[]
  },

  tutorial: {
    enabled: true
  },

  directToStore: {
    // Seconds without any interaction before jumping to the end card
    noInteractionPlaytime: 30,
    // Auto-open the store this many ms after the end card appears (0 = wait for a tap)
    endCardAutoStoreMs: 0
  }
};
