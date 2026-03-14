/**
 * UIScene — a Phaser overlay scene that runs on top of ManorScene.
 * Used for in-canvas UI elements like tooltips or indicators.
 * Most UI is handled via HTML overlays; this scene is reserved for
 * any canvas-rendered HUD elements in the future.
 */
export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create() {
    // Overlay hint text (fades away)
    const { width } = this.cameras.main;
    this.hintText = this.add.text(width / 2, 30, 'Use WASD to move · E to interact', {
      fontFamily: '"Lora", serif',
      fontSize: '14px',
      color: '#c9a84c',
      stroke: '#0a0a0a',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(1);

    this.tweens.add({
      targets: this.hintText,
      alpha: 0,
      delay: 4000,
      duration: 2000,
    });
  }
}
