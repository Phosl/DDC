import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";

import {
  CANTICA_VFX_ATLAS,
  CANTICA_VFX_FRAMES,
  VFX_POOL_LIMIT,
  createCanticaVfxSystem,
} from "../../src/lib/rise-game/visuals/vfx-system";

class FakeSprite {
  active = true;
  visible = true;
  flipX = false;
  x = 0;
  y = 0;
  frame: string | number | undefined;
  texture = "";
  destroyCalls = 0;

  setActive(value: boolean) { this.active = value; return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  setAlpha() { return this; }
  setScale() { return this; }
  setRotation() { return this; }
  setFlipX(value: boolean) { this.flipX = value; return this; }
  setOrigin() { return this; }
  setDepth() { return this; }
  setTint() { return this; }
  clearTint() { return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setFrame(frame: string | number) { this.frame = frame; return this; }
  setTexture(texture: string, frame?: string | number) {
    this.texture = texture;
    this.frame = frame;
    return this;
  }
  destroy() { this.destroyCalls += 1; this.active = false; }
}

function makeScene(availableTextures = new Set<string>([CANTICA_VFX_ATLAS.key])) {
  const sprites: FakeSprite[] = [];
  const scene = {
    textures: { exists: (key: string) => availableTextures.has(key) },
    add: {
      sprite: (x: number, y: number, texture: string, frame?: number) => {
        const sprite = new FakeSprite();
        sprite.setPosition(x, y).setTexture(texture, frame);
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, sprites };
}

describe("Cantica VFX system", () => {
  it("keeps impact frames in an expanding visual order", () => {
    expect(CANTICA_VFX_FRAMES.verseImpact).toEqual([6, 4, 7, 5]);
    expect(CANTICA_VFX_FRAMES.noiseImpact).toEqual([6, 11]);
    expect(CANTICA_VFX_FRAMES.bossTelegraph).toEqual([9, 10]);
  });

  it("caps the lazy pool and invalidates handles when an old slot is reclaimed", () => {
    const { scene, sprites } = makeScene();
    const vfx = createCanticaVfxSystem(scene);
    const first = vfx.playWorld("boss-burst", 10, 20);

    for (let index = 1; index < VFX_POOL_LIMIT + 6; index += 1) {
      vfx.playWorld("boss-burst", index, index);
    }

    expect(sprites).toHaveLength(VFX_POOL_LIMIT);
    expect(first?.active).toBe(false);
  });

  it("freezes during pause and auto-releases with one completion callback", () => {
    const { scene } = makeScene();
    const onComplete = vi.fn();
    const vfx = createCanticaVfxSystem(scene);
    const handle = vfx.playWorld("verse-impact", 32, 48, { onComplete });

    vfx.pause();
    vfx.update(2_000);
    expect(handle?.active).toBe(true);
    vfx.resume();
    vfx.update(260);

    expect(handle?.active).toBe(false);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("suppresses trails but keeps a readable impact in reduced motion", () => {
    const { scene } = makeScene();
    const vfx = createCanticaVfxSystem(scene, { reducedMotion: true });

    expect(vfx.playWorld("verse-trail", 0, 0)).toBeNull();
    const impact = vfx.playWorld("verse-impact", 0, 0);
    expect(impact?.active).toBe(true);
    vfx.update(129);
    expect(impact?.active).toBe(true);
    vfx.update(1);
    expect(impact?.active).toBe(false);
  });

  it("decorates projectiles without taking ownership of their lifecycle", () => {
    const { scene } = makeScene();
    const vfx = createCanticaVfxSystem(scene);
    const target = { setTexture: vi.fn() };

    const recipe = vfx.applyProjectileVisual(target, "verse", 60);

    expect(recipe).toMatchObject({
      textureKey: CANTICA_VFX_ATLAS.key,
      usesAtlas: true,
      trail: "verse-trail",
      impact: "verse-impact",
    });
    expect(target.setTexture).toHaveBeenCalledWith(CANTICA_VFX_ATLAS.key, recipe?.frame);
    expect(target).not.toHaveProperty("destroy");
  });

  it("selects the existing procedural projectile when the atlas is unavailable", () => {
    const { scene } = makeScene(new Set(["verse-projectile"]));
    const vfx = createCanticaVfxSystem(scene);
    const target = { setTexture: vi.fn() };

    const recipe = vfx.applyProjectileVisual(target, "verse");

    expect(recipe).toMatchObject({
      textureKey: "verse-projectile",
      usesAtlas: false,
      rotationOffset: Math.PI / 2,
      trail: null,
    });
    expect(target.setTexture).toHaveBeenCalledWith("verse-projectile");
  });

  it("destroys every pooled sprite exactly once", () => {
    const { scene, sprites } = makeScene();
    const vfx = createCanticaVfxSystem(scene);
    const handle = vfx.playAttached("player-hit", { x: 10, y: 20 });

    vfx.destroy();
    vfx.destroy();

    expect(handle?.active).toBe(false);
    expect(sprites.map((sprite) => sprite.destroyCalls)).toEqual([1]);
    expect(vfx.playWorld("pickup", 0, 0)).toBeNull();
    expect(vfx.getProjectileVisual("verse")).toBeNull();
  });
});
