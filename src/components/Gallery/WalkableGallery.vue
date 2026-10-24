<!-- WalkableGallery.vue -->
<template>
  <div ref="container" class="walkable-gallery">
    <!-- Center reticle -->
    <div
      v-if="!lightboxMedia"
      class="reticle"
      :class="{ 'reticle--active': !!focusedMedia }"
    ></div>

    <!-- Idle hint -->
    <transition name="fade-ui">
      <div v-if="showEnterPrompt && !mobile" class="enter-prompt" @click="enterWorld">
        <span class="enter-prompt-title">Click to Enter</span>
        <span class="enter-prompt-sub">WASD to walk &middot; mouse to look &middot; click a photo to view</span>
      </div>
    </transition>

    <transition name="fade-ui">
      <div v-if="showMobileHint && mobile" class="mobile-hint">
        <span>Drag to look &middot; hold the arrows to walk &middot; tap a photo to view</span>
      </div>
    </transition>

    <!-- Focused caption -->
    <transition name="fade-ui">
      <div v-if="focusedMedia && !lightboxMedia" class="focus-caption">
        {{ focusedMedia.caption }}
      </div>
    </transition>

    <!-- Mobile movement controls -->
    <div v-if="mobile" class="touch-controls">
      <button
        class="touch-button"
        @pointerdown.prevent="movingForward = true"
        @pointerup.prevent="movingForward = false"
        @pointerleave.prevent="movingForward = false"
        aria-label="Walk forward"
      >
        &uarr;
      </button>
      <button
        class="touch-button"
        @pointerdown.prevent="movingBackward = true"
        @pointerup.prevent="movingBackward = false"
        @pointerleave.prevent="movingBackward = false"
        aria-label="Walk backward"
      >
        &darr;
      </button>
    </div>

    <!-- Lightbox -->
    <transition name="fade-ui">
      <div v-if="lightboxMedia" class="lightbox" @click.self="closeLightbox">
        <img
          class="lightbox-image"
          :src="lightboxMedia.imageUrls?.jpegFull || lightboxMedia.imageUrls?.webpFull"
          :alt="lightboxMedia.caption"
        />
        <div class="lightbox-caption">{{ lightboxMedia.caption }}</div>
        <button class="lightbox-close" @click="closeLightbox" aria-label="Close">Close</button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, watch, PropType } from "vue";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { Media } from "../../models/media";
import { MediaType } from "../../types/media";
import { trackMediaOnce } from "../../composables/useTracking";

const props = defineProps({
  media: {
    type: Array as PropType<Media[]>,
    required: true,
  },
});

const mobile: boolean = inject("mobile", false);

const container = ref<HTMLElement | null>(null);
const showEnterPrompt = ref(true);
const showMobileHint = ref(true);
const focusedMedia = ref<Media | null>(null);
const lightboxMedia = ref<Media | null>(null);
// Opening a photo in the lightbox counts as a view of that photo.
watch(lightboxMedia, (m) => {
  if (m) trackMediaOnce(m);
});
const movingForward = ref(false);
const movingBackward = ref(false);

// --- Three.js internals (kept out of Vue reactivity on purpose) ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: PointerLockControls;
let raycaster: THREE.Raycaster;
let clock: THREE.Clock;
let animationId = 0;

const WALL_X = 4.2;
const SPACING = 5;
const EYE_HEIGHT = 1.6;
const FOCUS_DISTANCE = 6;
const MOVE_SPEED = 4.5;

interface Frame {
  mesh: THREE.Mesh;
  backing: THREE.Mesh;
  media: Media;
}
const frames: Frame[] = [];

const keysPressed = new Set<string>();

const buildFloor = () => {
  const grid = new THREE.GridHelper(200, 80, 0xffffff, 0xffffff);
  const material = grid.material as THREE.Material & { opacity: number; transparent: boolean };
  material.opacity = 0.08;
  material.transparent = true;
  scene.add(grid);
};

const buildFrames = () => {
  const images = props.media.filter((m) => m.fileType === MediaType.Image);
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  images.forEach((item, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const pairIndex = Math.floor(index / 2);
    const z = -(pairIndex + 1) * SPACING;
    const x = side * WALL_X;

    const defaultWidth = 2.4;
    const defaultHeight = 1.6;

    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(defaultWidth + 0.16, defaultHeight + 0.16),
      new THREE.MeshBasicMaterial({ color: 0xf2f2f2 })
    );
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(defaultWidth, defaultHeight),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    mesh.position.set(0, 0, 0.01);
    backing.add(mesh);

    backing.position.set(x, EYE_HEIGHT, z);
    backing.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(backing);

    frames.push({ mesh, backing, media: item });

    const url = item.imageUrls?.webpSmall || item.imageUrls?.jpegSmall || item.imageUrls?.webpFull || item.imageUrls?.jpegFull;
    if (!url) return;

    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = texture.image.width / texture.image.height;
      const height = defaultHeight;
      const width = height * aspect;

      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(width, height);
      mesh.material.map = texture;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;

      backing.geometry.dispose();
      backing.geometry = new THREE.PlaneGeometry(width + 0.16, height + 0.16);
    });
  });

  return Math.ceil(images.length / 2) * SPACING + 6;
};

const enterWorld = () => {
  if (mobile) return;
  controls.lock();
};

const closeLightbox = () => {
  lightboxMedia.value = null;
};

const onKeyDown = (event: KeyboardEvent) => keysPressed.add(event.code);
const onKeyUp = (event: KeyboardEvent) => keysPressed.delete(event.code);

const onCanvasClick = () => {
  if (mobile) {
    if (focusedMedia.value) lightboxMedia.value = focusedMedia.value;
    return;
  }
  if (!controls.isLocked) {
    enterWorld();
    return;
  }
  if (focusedMedia.value) {
    lightboxMedia.value = focusedMedia.value;
    controls.unlock();
  }
};

// --- Mobile look/move state ---
let touchLookId: number | null = null;
let lastTouchX = 0;
let lastTouchY = 0;
let yaw = 0;
let pitch = 0;

const onTouchStart = (event: TouchEvent) => {
  const touch = event.changedTouches[0];
  touchLookId = touch.identifier;
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
  showMobileHint.value = false;
};

const onTouchMove = (event: TouchEvent) => {
  const touch = Array.from(event.changedTouches).find((t) => t.identifier === touchLookId);
  if (!touch) return;
  const dx = touch.clientX - lastTouchX;
  const dy = touch.clientY - lastTouchY;
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;

  yaw -= dx * 0.004;
  pitch -= dy * 0.004;
  pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitch));
  camera.rotation.set(pitch, yaw, 0, "YXZ");
};

const onTouchEnd = (event: TouchEvent) => {
  const touch = Array.from(event.changedTouches).find((t) => t.identifier === touchLookId);
  if (touch) {
    touchLookId = null;
    onCanvasClick();
  }
};

let corridorLength = 40;

const clampCameraPosition = () => {
  camera.position.x = Math.max(-WALL_X + 1.1, Math.min(WALL_X - 1.1, camera.position.x));
  camera.position.z = Math.max(-corridorLength, Math.min(4, camera.position.z));
  camera.position.y = EYE_HEIGHT;
};

const updateFocus = () => {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  raycaster.set(camera.position, direction);
  const hits = raycaster.intersectObjects(frames.map((f) => f.mesh));
  if (hits.length && hits[0].distance < FOCUS_DISTANCE) {
    const hit = frames.find((f) => f.mesh === hits[0].object);
    focusedMedia.value = hit ? hit.media : null;
  } else {
    focusedMedia.value = null;
  }
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (!mobile && controls.isLocked) {
    const step = MOVE_SPEED * delta;
    if (keysPressed.has("KeyW") || keysPressed.has("ArrowUp")) controls.moveForward(step);
    if (keysPressed.has("KeyS") || keysPressed.has("ArrowDown")) controls.moveForward(-step);
    if (keysPressed.has("KeyA") || keysPressed.has("ArrowLeft")) controls.moveRight(-step);
    if (keysPressed.has("KeyD") || keysPressed.has("ArrowRight")) controls.moveRight(step);
    clampCameraPosition();
    updateFocus();
  } else if (mobile) {
    const step = MOVE_SPEED * delta;
    if (movingForward.value || movingBackward.value) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      camera.position.addScaledVector(dir, movingForward.value ? step : -step);
      clampCameraPosition();
    }
    updateFocus();
  }

  renderer.render(scene, camera);
};

const onResize = () => {
  if (!container.value) return;
  const { clientWidth, clientHeight } = container.value;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
};

onMounted(() => {
  if (!container.value) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 6, 26);

  camera = new THREE.PerspectiveCamera(
    70,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, EYE_HEIGHT, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  container.value.appendChild(renderer.domElement);

  raycaster = new THREE.Raycaster();
  clock = new THREE.Clock();

  buildFloor();
  corridorLength = buildFrames();

  if (!mobile) {
    controls = new PointerLockControls(camera, renderer.domElement);
    controls.addEventListener("lock", () => (showEnterPrompt.value = false));
    controls.addEventListener("unlock", () => (showEnterPrompt.value = true));
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("click", onCanvasClick);
  } else {
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: true });
    renderer.domElement.addEventListener("touchend", onTouchEnd, { passive: true });
  }

  window.addEventListener("resize", onResize);
  animate();
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener("resize", onResize);

  if (!mobile) {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    renderer?.domElement.removeEventListener("click", onCanvasClick);
    controls?.dispose();
  } else {
    renderer?.domElement.removeEventListener("touchstart", onTouchStart);
    renderer?.domElement.removeEventListener("touchmove", onTouchMove);
    renderer?.domElement.removeEventListener("touchend", onTouchEnd);
  }

  frames.forEach((f) => {
    f.mesh.geometry.dispose();
    const mat = f.mesh.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.dispose();
    f.backing.geometry.dispose();
    (f.backing.material as THREE.Material).dispose();
  });
  renderer?.dispose();
  renderer?.domElement.remove();
});
</script>

<style scoped>
.walkable-gallery {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #000;
  cursor: pointer;
}

.reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.4);
  transition: transform 0.2s ease, background-color 0.2s ease;
  pointer-events: none;
  z-index: 5;
}

.reticle--active {
  background: rgba(255, 255, 255, 0.95);
  transform: scale(2.2);
}

.enter-prompt {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.35);
  z-index: 10;
  cursor: pointer;
}

.enter-prompt-title {
  font-family: "Arial", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fff;
}

.enter-prompt-sub {
  font-family: "Arial", sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.55);
}

.mobile-hint {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: "Arial", sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(0, 0, 0, 0.4);
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  z-index: 10;
  text-align: center;
  max-width: 80%;
}

.focus-caption {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: "Arial", sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  z-index: 6;
  pointer-events: none;
}

.touch-controls {
  position: absolute;
  bottom: 1.5rem;
  right: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  z-index: 10;
}

.touch-button {
  width: 52px;
  height: 52px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
}

.lightbox-image {
  max-width: 90%;
  max-height: 75%;
  object-fit: contain;
}

.lightbox-caption {
  font-family: "Arial", sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
}

.lightbox-close {
  font-family: "Arial", sans-serif;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.lightbox-close:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
}

.fade-ui-enter-active,
.fade-ui-leave-active {
  transition: opacity 0.25s ease;
}
.fade-ui-enter-from,
.fade-ui-leave-to {
  opacity: 0;
}
</style>
