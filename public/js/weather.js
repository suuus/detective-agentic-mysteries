/**
 * Weather system for Phaser 3 scenes.
 * Supports: rain, fog, storm, snow, clear.
 *
 * Usage:
 *   import { createWeatherTextures, createWeather, stopWeather } from '../weather.js';
 *   // In create():
 *   createWeatherTextures(this);
 *   createWeather(this, 'rain', mapWidth, mapHeight, tileSize);
 *   // To change/stop:
 *   stopWeather(this);
 */

/**
 * Generate all weather-related textures (call once in create()).
 */
export function createWeatherTextures(scene) {
  // Rain drop — 1×6 blue-grey vertical line
  if (!scene.textures.exists('weather_rain')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x8899bb, 1);
    g.fillRect(0, 0, 1, 6);
    g.generateTexture('weather_rain', 1, 6);
    g.destroy();
  }

  // Rain splash — 3×1 light blue
  if (!scene.textures.exists('weather_splash')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xaabbdd, 1);
    g.fillRect(0, 0, 3, 1);
    g.generateTexture('weather_splash', 3, 1);
    g.destroy();
  }

  // Fog patch — 64×32 soft white rectangle
  if (!scene.textures.exists('weather_fog')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xcccccc, 1);
    g.fillRect(0, 0, 64, 32);
    g.generateTexture('weather_fog', 64, 32);
    g.destroy();
  }

  // Snow flake — 2×2 white dot
  if (!scene.textures.exists('weather_snow')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture('weather_snow', 2, 2);
    g.destroy();
  }

  // Lightning flash — full-screen white rectangle (sized later via scale)
  if (!scene.textures.exists('weather_flash')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture('weather_flash', 16, 16);
    g.destroy();
  }
}

/**
 * Create weather effects on a scene.
 * @param {Phaser.Scene} scene
 * @param {string} type - rain|fog|storm|snow|clear
 * @param {number} mapWidth  - map width in tiles
 * @param {number} mapHeight - map height in tiles
 * @param {number} tileSize  - tile size in pixels (usually 32)
 */
export function createWeather(scene, type, mapWidth, mapHeight, tileSize) {
  stopWeather(scene);
  scene._weatherEffects = { type, emitters: [], tweens: [], timers: [], images: [] };

  const worldW = mapWidth * tileSize;
  const worldH = mapHeight * tileSize;
  const cam = scene.cameras.main;
  const viewW = cam.width;
  const viewH = cam.height;

  switch (type) {
    case 'rain':
      _createRain(scene, worldW, worldH);
      break;
    case 'fog':
      _createFog(scene, viewW, viewH);
      break;
    case 'storm':
      _createRain(scene, worldW, worldH);
      _createLightning(scene, viewW, viewH);
      break;
    case 'snow':
      _createSnow(scene, worldW, worldH);
      break;
    case 'clear':
    default:
      break;
  }
}

/**
 * Remove all weather effects from a scene.
 */
export function stopWeather(scene) {
  const fx = scene._weatherEffects;
  if (!fx) return;

  for (const e of fx.emitters) {
    if (e && e.destroy) e.destroy();
  }
  for (const t of fx.tweens) {
    if (t && t.destroy) t.destroy();
  }
  for (const t of fx.timers) {
    if (t && t.destroy) t.destroy();
  }
  for (const img of fx.images) {
    if (img && img.destroy) img.destroy();
  }
  scene._weatherEffects = null;
}

// ── Rain ─────────────────────────────────────────────

function _createRain(scene, worldW, worldH) {
  const fx = scene._weatherEffects;

  // Rain particles — fall diagonally across world space
  const rain = scene.add.particles(0, 0, 'weather_rain', {
    x: { min: -100, max: worldW + 100 },
    y: -20,
    lifespan: 1200,
    speedY: { min: 280, max: 360 },
    speedX: { min: -60, max: -30 },
    alpha: { start: 0.5, end: 0.15 },
    scale: { start: 1, end: 0.6 },
    frequency: 18,
    quantity: 2,
    blendMode: 'ADD',
    rotate: { min: -8, max: -4 },
  }).setDepth(90);
  fx.emitters.push(rain);

  // Splash particles at ground level
  const splash = scene.add.particles(0, 0, 'weather_splash', {
    x: { min: 0, max: worldW },
    y: worldH - 8,
    lifespan: 300,
    speedY: { min: -20, max: -5 },
    speedX: { min: -15, max: 15 },
    alpha: { start: 0.4, end: 0 },
    scale: { start: 0.8, end: 0.2 },
    frequency: 50,
    quantity: 1,
    blendMode: 'ADD',
  }).setDepth(90);
  fx.emitters.push(splash);
}

// ── Fog ──────────────────────────────────────────────

function _createFog(scene, viewW, viewH) {
  const fx = scene._weatherEffects;

  // Create several fog patches that drift across the screen (screen-space)
  const patchCount = 6;
  for (let i = 0; i < patchCount; i++) {
    const fogImg = scene.add.image(
      Phaser.Math.Between(-viewW, viewW * 2),
      Phaser.Math.Between(0, viewH),
      'weather_fog'
    )
      .setScrollFactor(0)
      .setDepth(88)
      .setAlpha(Phaser.Math.FloatBetween(0.04, 0.12))
      .setScale(Phaser.Math.FloatBetween(2, 5), Phaser.Math.FloatBetween(1.5, 3))
      .setBlendMode('ADD');
    fx.images.push(fogImg);

    // Drift tween — loop horizontally
    const drift = scene.tweens.add({
      targets: fogImg,
      x: { from: -viewW * 0.5, to: viewW * 1.5 },
      alpha: {
        getStart: () => Phaser.Math.FloatBetween(0.03, 0.08),
        getEnd: () => Phaser.Math.FloatBetween(0.06, 0.14),
      },
      duration: Phaser.Math.Between(18000, 30000),
      delay: Phaser.Math.Between(0, 8000),
      repeat: -1,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    fx.tweens.push(drift);
  }
}

// ── Lightning (storm addition) ───────────────────────

function _createLightning(scene, viewW, viewH) {
  const fx = scene._weatherEffects;

  // Full-screen flash overlay (screen-space)
  const flash = scene.add.image(viewW / 2, viewH / 2, 'weather_flash')
    .setScrollFactor(0)
    .setDepth(95)
    .setDisplaySize(viewW + 50, viewH + 50)
    .setAlpha(0)
    .setBlendMode('ADD');
  fx.images.push(flash);

  // Periodic lightning timer
  const timer = scene.time.addEvent({
    delay: Phaser.Math.Between(4000, 10000),
    loop: true,
    callback: () => {
      // Flash pulse
      scene.tweens.add({
        targets: flash,
        alpha: { from: 0.35, to: 0 },
        duration: 200,
        ease: 'Quad.easeOut',
        onComplete: () => {
          // Optional double-flash
          if (Math.random() < 0.4) {
            scene.time.delayedCall(120, () => {
              scene.tweens.add({
                targets: flash,
                alpha: { from: 0.2, to: 0 },
                duration: 150,
                ease: 'Quad.easeOut',
              });
            });
          }
        },
      });

      // Subtle screen shake
      if (scene.cameras.main && Math.random() < 0.5) {
        scene.cameras.main.shake(200, 0.003);
      }

      // Randomize next strike interval
      timer.delay = Phaser.Math.Between(4000, 12000);
    },
  });
  fx.timers.push(timer);
}

// ── Snow ─────────────────────────────────────────────

function _createSnow(scene, worldW, worldH) {
  const fx = scene._weatherEffects;

  const snow = scene.add.particles(0, 0, 'weather_snow', {
    x: { min: -50, max: worldW + 50 },
    y: -10,
    lifespan: 6000,
    speedY: { min: 25, max: 55 },
    speedX: { min: -15, max: 15 },
    alpha: { start: 0.7, end: 0.1 },
    scale: { start: 0.6, end: 1.2 },
    frequency: 80,
    quantity: 1,
    blendMode: 'ADD',
  }).setDepth(90);
  fx.emitters.push(snow);
}
