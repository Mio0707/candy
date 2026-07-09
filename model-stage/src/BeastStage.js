import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MODEL_DISPLAY_ROTATION_Y = -Math.PI / 3;
const BALL_PICKUP_OFFSET = [0, 0.68, -0.45];
const POINT_CLOUD_COUNT = 3600;
const BLESSING_POINT_CLOUD_COUNT = 10800;
const POINT_CLOUD_GATHER_DURATION = 2.35;
const POINT_CLOUD_STAGGER_DURATION = 0.62;
const PARTICLE_TRAIL_LENGTH = 0.18;
const BLESSING_ROTATION_SPEED = 0.208;
const TWO_PI = Math.PI * 2;
const DEFAULT_STAGE_BACKGROUND = 0xf6efe6;
const BLESSING_STAGE_BACKGROUND = 0x050403;

export const FORTUNES = [
  { id: 'shun', label: '顺', name: '顺遂', color: 0x38a848, description: '绿色光流从底部升起，再落下汇成瑞兽轮廓。' },
  { id: 'xi', label: '喜', name: '喜乐', color: 0xf1bc36, description: '金黄色光流从底部升起，再落下汇成瑞兽轮廓。' },
  { id: 'yong', label: '勇', name: '镇护', color: 0xffffff, description: '纯白光流从底部升起，再落下汇成瑞兽轮廓。' },
  { id: 'wang', label: '旺', name: '兴旺', color: 0xd73327, description: '红色光流从底部升起，再落下汇成瑞兽轮廓。' },
];

const DEFAULT_FORTUNE_ID = 'shun';
const DEFAULT_PARTICLE_PROFILE = {
  size: 0.028,
  opacity: 0.92,
  trailLength: PARTICLE_TRAIL_LENGTH,
  groupFloat: 0.01,
  groupSway: 0.018,
};
const PART_PARTICLE_WEIGHTS = {
  head: 2,
  head_lines: 0.3,
};

export const EXPERIENCE_STEPS = [
  {
    id: 'base-small',
    title: '吹起底座 1/3',
    description: '握拳一次，让红色糖团开始鼓起。',
    visibleGroups: ['base'],
    baseScale: 0.45,
  },
  {
    id: 'base-mid',
    title: '吹起底座 2/3',
    description: '再次握拳，糖团继续变得饱满。',
    visibleGroups: ['base'],
    baseScale: 0.75,
  },
  {
    id: 'base-final',
    title: '吹起底座 3/3',
    description: '第三次握拳，红色葫芦状底座定型。',
    visibleGroups: ['base'],
    baseScale: 1,
  },
  {
    id: 'body-block',
    title: '取黑色身体糖块',
    description: '握拳一次，黑色身体糖块悬空出现。',
    visibleGroups: ['base', 'body'],
    baseScale: 1,
    partTransforms: {
      body_core: { scale: 0.7, offset: [0, 0.42, 0] },
    },
  },
  {
    id: 'body-place',
    title: '放置身体',
    description: '捏住黑色糖块向底座移动，身体吸附到底座上。',
    visibleGroups: ['base', 'body'],
    baseScale: 1,
  },
  {
    id: 'front-legs',
    title: '拉出前脚',
    description: '捏住向下拉，前脚像从身体里被慢慢拉出来。',
    visibleGroups: ['base', 'body', 'frontLegs'],
    baseScale: 1,
    enterFrom: {
      front_legs: {
        sourcePart: 'body_core',
        sourceOffset: [0, -0.08, 0],
        scale: [0.18, 0.08, 0.18],
        duration: 0.9,
      },
    },
  },
  {
    id: 'back-legs',
    title: '拉出后脚',
    description: '再次向下拉，后脚从身体里延展出来并落位。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs'],
    baseScale: 1,
    enterFrom: {
      back_legs: {
        sourcePart: 'body_core',
        sourceOffset: [0, -0.08, 0],
        scale: [0.18, 0.08, 0.18],
        duration: 0.9,
      },
    },
  },
  {
    id: 'back-mustache',
    title: '贴上背部糖衣',
    description: '黄色背部糖衣贴到身体上，形成更强的糖塑装饰感。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'backMustache'],
    baseScale: 1,
    enterFrom: {
      back_mustache: { offset: [0, 0.28, -0.18], scale: 0.72, duration: 0.75 },
    },
  },
  {
    id: 'head-block',
    title: '取红色头部糖块',
    description: '握拳一次，红色头部糖块悬空出现。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'backMustache', 'head'],
    baseScale: 1,
    partTransforms: {
      head: { scale: 0.7, offset: [0.18, 0.48, 0] },
    },
  },
  {
    id: 'head-place',
    title: '安放头部',
    description: '捏住头部糖块向身体前方移动，头部落位。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'backMustache', 'head'],
    baseScale: 1,
  },
  {
    id: 'tail',
    title: '贴上尾巴',
    description: '先把尾巴糖片贴到身体后方。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'head', 'tail', 'backMustache'],
    baseScale: 1,
    enterFrom: {
      tail_ears_1: { offset: [0, 0.2, -0.22], scale: 0.7, duration: 0.75 },
    },
  },
  {
    id: 'turn-front',
    title: '转到展示角度',
    description: '做一个旋转手势，让瑞兽转到斜正面的展示角度，准备贴耳朵和头部糖条。',
    frontView: true,
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'head', 'tail', 'backMustache'],
    baseScale: 1,
  },
  {
    id: 'ears',
    title: '贴上两个耳朵',
    description: '再把两个耳朵糖片贴到头部两侧。',
    frontView: true,
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'head', 'tail', 'ears', 'backMustache'],
    baseScale: 1,
    enterFrom: {
      tail_ears_2: { offset: [0, 0.24, 0.12], scale: 0.7, duration: 0.75 },
    },
  },
  {
    id: 'head-lines',
    title: '贴上头部和嘴部糖条',
    description: '红绿糖条贴到头部和嘴部，形成凸起纹样。',
    frontView: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
    ],
    baseScale: 1,
  },
  {
    id: 'ball-form',
    title: '捏出爪下圆球',
    description: '双手靠近时，圆球糖料先像头部糖块一样在空中出现。',
    frontView: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
    partTransforms: {
      ball: { scale: 0.7, offset: BALL_PICKUP_OFFSET },
    },
    enterFrom: {
      ball: { offset: [0, 0.12, 0], scale: 0.18, duration: 0.65 },
    },
  },
  {
    id: 'ball-place',
    title: '安放爪下圆球',
    description: '捏合向下时，圆球落到爪子下方，瑞兽主体完成。',
    frontView: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
    enterFrom: {
      ball: { offset: BALL_PICKUP_OFFSET, scale: 0.7, duration: 0.75 },
    },
  },
  {
    id: 'complete',
    title: '旋转展示',
    description: '伸出一根手指朝上绕一圈，整件作品平行旋转一圈，展示完整瑞兽。',
    frontView: true,
    showcaseSpin: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
  },
  {
    id: 'fortune-select',
    title: '选择祝福',
    description: '从“顺、喜、勇、旺”里选择一种祝福，准备送给糖塑瑞兽。',
    frontView: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
  },
  {
    id: 'lift-blessing',
    title: '托起瑞兽',
    description: '手掌停在瑞兽下方，托起整件作品，让选中的祝福开始流动。',
    frontView: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
  },
  {
    id: 'fortune-shell',
    title: '祝福显形',
    description: '瑞兽短暂化成由祝福粒子组成的轮廓。捏拳收拢，把这份祝福带走。',
    frontView: true,
    ethereal: true,
    blessingSpin: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
  },
  {
    id: 'blessing-complete',
    title: '祝福完成',
    description: '你的糖塑瑞兽已收到祝福。它带着这份心意，完成了今天的吹糖造物。',
    frontView: true,
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tail',
      'ears',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
  },
];

const PART_GROUPS = {
  base: ['base'],
  body: ['body_core'],
  frontLegs: ['front_legs'],
  backLegs: ['back_legs'],
  head: ['head'],
  tail: ['tail_ears_1'],
  ears: ['tail_ears_2'],
  backMustache: ['back_mustache'],
  headLines: ['head_lines'],
  ball: ['ball'],
};

export class BeastStage extends EventTarget {
  constructor(container, options = {}) {
    super();
    this.container = container;
    this.modelUrl = options.modelUrl ?? '/models/hulushi-web.glb';
    this.stepIndex = 0;
    this.parts = new Map();
    this.originalPartTransforms = new Map();
    this.partGroups = PART_GROUPS;
    this.baseOriginalScale = new THREE.Vector3(1, 1, 1);
    this.materialStates = new Map();
    this.activeTransitions = new Map();
    this.showcaseSpin = null;
    this.selectedFortune = null;
    this.absorbAnimation = null;
    this.blessingParticles = null;
    this.clock = new THREE.Clock();
    this.particleTexture = this.createParticleTexture();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(DEFAULT_STAGE_BACKGROUND);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    this.camera.position.set(0, 1.1, 3.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.35, 0);

    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);

    this.particleRoot = new THREE.Group();
    this.scene.add(this.particleRoot);

    this.setupLights();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
  }

  createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);

    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.82)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xfff7ef, 0x5c3b24, 2.2);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(2.5, 3.5, 4);
    key.castShadow = true;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffd7a3, 1.2);
    fill.position.set(-3, 1.5, -2);
    this.scene.add(fill);
  }

  async load() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(this.modelUrl);
    this.modelRoot.clear();
    this.modelRoot.add(gltf.scene);

    this.parts.clear();
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      this.parts.set(node.name, node);
      node.userData.targetVisible = false;
      node.userData.fade = 0;
    });

    this.normalizeModel(gltf.scene);
    this.originalPartTransforms.clear();
    for (const [name, part] of this.parts) {
      this.originalPartTransforms.set(name, {
        position: part.position.clone(),
        rotation: part.rotation.clone(),
        scale: part.scale.clone(),
      });
    }

    const base = this.parts.get('base');
    if (base) this.baseOriginalScale.copy(base.scale);
    this.captureMaterialStates();
    this.setStep(0);
    return this.getReport();
  }

  normalizeModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.65 / maxAxis;

    object.scale.setScalar(scale);
    object.position.set(-center.x * scale, -center.y * scale + 0.15, -center.z * scale);
  }

  setStep(index) {
    this.stepIndex = THREE.MathUtils.clamp(index, 0, EXPERIENCE_STEPS.length - 1);
    const step = EXPERIENCE_STEPS[this.stepIndex];
    const visiblePartNames = new Set();
    const blessingStartIndex = EXPERIENCE_STEPS.findIndex((item) => item.id === 'fortune-select');
    this.activeTransitions.clear();
    this.showcaseSpin = null;
    this.absorbAnimation = null;
    this.clearBlessingParticles();
    this.modelRoot.position.y = 0;
    this.scene.background = new THREE.Color(
      this.stepIndex >= blessingStartIndex ? BLESSING_STAGE_BACKGROUND : DEFAULT_STAGE_BACKGROUND,
    );

    for (const groupName of step.visibleGroups) {
      for (const partName of this.partGroups[groupName] ?? []) {
        visiblePartNames.add(partName);
      }
    }

    for (const [partName, part] of this.parts) {
      const shouldShow = visiblePartNames.has(partName);
      this.restorePartTransform(partName, part);
      part.visible = shouldShow;
      part.userData.targetVisible = shouldShow;
      part.userData.fade = shouldShow ? 1 : 0;
    }

    const base = this.parts.get('base');
    if (base) {
      base.scale.copy(this.baseOriginalScale).multiplyScalar(step.baseScale ?? 1);
      base.visible = true;
    }

    this.applyStepTransforms(step);
    this.applyEnterTransitions(step);
    this.setModelEthereal(Boolean(step.ethereal));
    if (step.frontView) this.focusFrontView();
    if (step.showcaseSpin) this.startShowcaseSpin();
    if (step.id === 'fortune-shell') {
      if (!this.selectedFortune) this.selectedFortune = FORTUNES[0];
      this.createBlessingParticles({ count: BLESSING_POINT_CLOUD_COUNT });
    }
    if (step.id === 'blessing-complete') {
      this.setModelEthereal(false);
    }

    this.dispatchEvent(new CustomEvent('stepchange', { detail: this.getState() }));
  }

  restorePartTransform(partName, part) {
    const original = this.originalPartTransforms.get(partName);
    if (!original) return;

    part.position.copy(original.position);
    part.rotation.copy(original.rotation);
    part.scale.copy(original.scale);
  }

  applyStepTransforms(step) {
    if (!step.partTransforms) return;

    for (const [partName, transform] of Object.entries(step.partTransforms)) {
      const part = this.parts.get(partName);
      const original = this.originalPartTransforms.get(partName);
      if (!part || !original) continue;

      if (transform.scale != null) {
        part.scale.copy(this.getScaledVector(original.scale, transform.scale));
      }

      if (transform.offset) {
        part.position.copy(original.position).add(new THREE.Vector3(...transform.offset));
      }
    }
  }

  applyEnterTransitions(step) {
    if (!step.enterFrom) return;

    const now = this.clock.getElapsedTime();

    for (const [partName, transform] of Object.entries(step.enterFrom)) {
      const part = this.parts.get(partName);
      if (!part || !part.visible) continue;

      const targetPosition = part.position.clone();
      const targetScale = part.scale.clone();
      const fromPosition = this.getTransitionStartPosition(part, targetPosition, transform);
      const fromScale = this.getScaledVector(targetScale, transform.scale ?? 1);

      part.position.copy(fromPosition);
      part.scale.copy(fromScale);

      this.activeTransitions.set(partName, {
        part,
        fromPosition,
        targetPosition,
        fromScale,
        targetScale,
        start: now,
        duration: transform.duration ?? 0.75,
      });
    }
  }

  getTransitionStartPosition(part, targetPosition, transform) {
    if (transform.sourcePart) {
      const sourcePart = this.parts.get(transform.sourcePart);

      if (sourcePart) {
        const sourceBox = new THREE.Box3().setFromObject(sourcePart);
        const sourceCenter = sourceBox.getCenter(new THREE.Vector3());
        const localSourceCenter = part.parent
          ? part.parent.worldToLocal(sourceCenter.clone())
          : sourceCenter;

        return localSourceCenter.add(new THREE.Vector3(...(transform.sourceOffset ?? [0, 0, 0])));
      }
    }

    return targetPosition.clone().add(new THREE.Vector3(...(transform.offset ?? [0, 0, 0])));
  }

  getScaledVector(baseScale, scale) {
    if (Array.isArray(scale)) {
      return baseScale.clone().multiply(new THREE.Vector3(...scale));
    }

    return baseScale.clone().multiplyScalar(scale);
  }

  focusFrontView() {
    this.camera.position.set(0, 1.1, 3.2);
    this.controls.target.set(0, 0.35, 0);
    this.controls.update();
    this.modelRoot.rotation.y = MODEL_DISPLAY_ROTATION_Y;
  }

  startShowcaseSpin() {
    this.showcaseSpin = {
      start: this.clock.getElapsedTime(),
      duration: 2.4,
      from: MODEL_DISPLAY_ROTATION_Y,
      to: MODEL_DISPLAY_ROTATION_Y + Math.PI * 2,
    };
  }

  next() {
    const step = EXPERIENCE_STEPS[this.stepIndex];

    if (step.id === 'fortune-select') {
      this.selectFortune(this.selectedFortune?.id ?? DEFAULT_FORTUNE_ID);
      return;
    }

    if (step.id === 'lift-blessing') {
      if (!this.selectedFortune) this.selectedFortune = FORTUNES[0];
      this.setStep(this.stepIndex + 1);
      return;
    }

    if (step.id === 'fortune-shell') {
      this.startAbsorbFortune();
      return;
    }

    this.setStep(this.stepIndex + 1);
  }

  prev() {
    this.setStep(this.stepIndex - 1);
  }

  reset() {
    this.selectedFortune = null;
    this.setModelEthereal(false);
    this.setStep(0);
  }

  showAll() {
    this.setStep(EXPERIENCE_STEPS.length - 1);
  }

  selectFortune(fortuneId) {
    this.selectedFortune = FORTUNES.find((fortune) => fortune.id === fortuneId) ?? FORTUNES[0];
    const fortuneIndex = EXPERIENCE_STEPS.findIndex((step) => step.id === 'fortune-select');

    if (this.stepIndex <= fortuneIndex) {
      this.setStep(fortuneIndex + 1);
    } else {
      this.dispatchEvent(new CustomEvent('stepchange', { detail: this.getState() }));
    }
  }

  getFortuneParticleProfile() {
    return { ...DEFAULT_PARTICLE_PROFILE };
  }

  getBlessingParticleOrigin({ center, radius, theta, targetX, targetZ }) {
    const sourceSpread = radius * (0.36 + Math.random() * 0.28);

    return {
      x: THREE.MathUtils.lerp(center.x + Math.cos(theta) * sourceSpread, targetX, 0.16),
      y: center.y - radius * (1.18 + Math.random() * 0.36),
      z: THREE.MathUtils.lerp(center.z + Math.sin(theta) * sourceSpread, targetZ, 0.16),
    };
  }

  getBlessingParticleApex({ center, radius, theta, origin, targetX, targetY, targetZ }) {
    const arcSpread = radius * (0.18 + Math.random() * 0.2);

    return {
      x: THREE.MathUtils.lerp(origin.x, targetX, 0.45) + Math.cos(theta * 1.31) * arcSpread,
      y: Math.max(targetY, center.y) + radius * (1.05 + Math.random() * 0.48),
      z: THREE.MathUtils.lerp(origin.z, targetZ, 0.45) + Math.sin(theta * 1.17) * arcSpread,
    };
  }

  createBlessingParticles(options = {}) {
    this.clearBlessingParticles();

    const fortune = this.selectedFortune ?? FORTUNES[0];
    const profile = this.getFortuneParticleProfile();
    const particleSize = options.particleSize ?? profile.size;
    const particleOpacity = options.opacity ?? profile.opacity;
    const particleBlending = options.blending ?? THREE.AdditiveBlending;
    const hasTrails = options.trails ?? true;
    const sample = this.sampleModelSurfacePoints(options.count ?? POINT_CLOUD_COUNT);
    const { targets, center, radius } = sample;
    const count = targets.length / 3;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const origins = new Float32Array(count * 3);
    const apexes = new Float32Array(count * 3);
    const seeds = [];
    const particleColor = new THREE.Color(fortune.color);

    for (let index = 0; index < count; index += 1) {
      const x = targets[index * 3];
      const y = targets[index * 3 + 1];
      const z = targets[index * 3 + 2];
      const theta = index * 2.399963 + Math.random() * 0.42;
      const origin = this.getBlessingParticleOrigin({
        center,
        radius,
        theta,
        targetX: x,
        targetZ: z,
      });
      const apex = this.getBlessingParticleApex({
        center,
        radius,
        theta,
        origin,
        targetX: x,
        targetY: y,
        targetZ: z,
      });

      origins[index * 3] = origin.x;
      origins[index * 3 + 1] = origin.y;
      origins[index * 3 + 2] = origin.z;
      apexes[index * 3] = apex.x;
      apexes[index * 3 + 1] = apex.y;
      apexes[index * 3 + 2] = apex.z;
      positions[index * 3] = origin.x;
      positions[index * 3 + 1] = origin.y;
      positions[index * 3 + 2] = origin.z;
      colors[index * 3] = particleColor.r;
      colors[index * 3 + 1] = particleColor.g;
      colors[index * 3 + 2] = particleColor.b;
      seeds.push({
        phase: Math.random() * TWO_PI,
        speed: 0.62 + Math.random() * 0.58,
        drift: 0.018 + Math.random() * 0.028,
        delay: Math.random() * POINT_CLOUD_STAGGER_DURATION,
        trailScale: 0.85 + Math.random() * 0.72,
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: particleSize,
      map: this.particleTexture,
      transparent: true,
      opacity: particleOpacity,
      alphaTest: 0.02,
      depthWrite: false,
      vertexColors: true,
      blending: particleBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.particleRoot.add(points);

    const trail = hasTrails ? this.createParticleTrail(positions, colors, particleOpacity) : null;
    if (trail) this.particleRoot.add(trail);

    this.blessingParticles = {
      points,
      trail,
      seeds,
      fortune,
      profile,
      origins,
      apexes,
      targets,
      center,
      radius,
      mode: 'gather',
      start: this.clock.getElapsedTime(),
    };
  }

  createParticleTrail(positions, colors, opacity) {
    const count = positions.length / 3;
    const trailPositions = new Float32Array(count * 2 * 3);
    const trailColors = new Float32Array(count * 2 * 3);

    for (let index = 0; index < count; index += 1) {
      const pointOffset = index * 3;
      const lineOffset = index * 6;
      trailPositions[lineOffset] = positions[pointOffset];
      trailPositions[lineOffset + 1] = positions[pointOffset + 1];
      trailPositions[lineOffset + 2] = positions[pointOffset + 2];
      trailPositions[lineOffset + 3] = positions[pointOffset];
      trailPositions[lineOffset + 4] = positions[pointOffset + 1];
      trailPositions[lineOffset + 5] = positions[pointOffset + 2];

      trailColors[lineOffset] = colors[pointOffset];
      trailColors[lineOffset + 1] = colors[pointOffset + 1];
      trailColors[lineOffset + 2] = colors[pointOffset + 2];
      trailColors[lineOffset + 3] = colors[pointOffset] * 0.35;
      trailColors[lineOffset + 4] = colors[pointOffset + 1] * 0.35;
      trailColors[lineOffset + 5] = colors[pointOffset + 2] * 0.35;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));

    const material = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: Math.min(0.46, opacity * 0.62),
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    return new THREE.LineSegments(geometry, material);
  }

  sampleModelSurfacePoints(count) {
    const visibleMeshes = [...this.parts.values()].filter((part) => part.visible && part.geometry);
    const targets = new Float32Array(count * 3);
    const vector = new THREE.Vector3();
    const bounds = new THREE.Box3();
    const meshBounds = new THREE.Box3();
    const weightedMeshes = [];
    let totalWeight = 0;

    if (visibleMeshes.length === 0) {
      return {
        targets,
        center: new THREE.Vector3(),
        radius: 1,
      };
    }

    this.modelRoot.updateWorldMatrix(true, true);
    for (const mesh of visibleMeshes) {
      bounds.union(meshBounds.setFromObject(mesh));
      const weight = PART_PARTICLE_WEIGHTS[mesh.name] ?? 1;
      if (weight <= 0) continue;
      totalWeight += weight;
      weightedMeshes.push({ mesh, totalWeight });
    }

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);

    for (let index = 0; index < count; index += 1) {
      const pick = Math.random() * totalWeight;
      const mesh = weightedMeshes.find((item) => pick <= item.totalWeight)?.mesh
        ?? weightedMeshes[weightedMeshes.length - 1].mesh;
      const positions = mesh.geometry.attributes.position;
      const vertexIndex = Math.floor(Math.random() * positions.count);

      vector.fromBufferAttribute(positions, vertexIndex);
      mesh.localToWorld(vector);

      targets[index * 3] = vector.x;
      targets[index * 3 + 1] = vector.y;
      targets[index * 3 + 2] = vector.z;
    }

    return {
      targets,
      center,
      radius,
    };
  }

  startAbsorbFortune() {
    if (!this.blessingParticles) {
      this.createBlessingParticles();
    }

    const positions = this.blessingParticles.points.geometry.attributes.position.array;
    const origins = new Float32Array(positions);
    const targets = new Float32Array(positions.length);
    const seeds = [];
    const { center, radius } = this.blessingParticles;

    for (let index = 0; index < positions.length / 3; index += 1) {
      const originX = origins[index * 3];
      const originY = origins[index * 3 + 1];
      const originZ = origins[index * 3 + 2];
      const angle = index * 2.399963 + Math.random() * 0.55;
      const vertical = 0.18 + Math.random() * 0.58;
      const direction = new THREE.Vector3(
        (originX - center.x) * 0.55 + Math.cos(angle) * radius * 0.62,
        (originY - center.y) * 0.22 + vertical * radius,
        (originZ - center.z) * 0.55 + Math.sin(angle) * radius * 0.62,
      ).normalize();
      const distance = radius * (0.62 + Math.random() * 0.62);

      targets[index * 3] = originX + direction.x * distance;
      targets[index * 3 + 1] = originY + direction.y * distance;
      targets[index * 3 + 2] = originZ + direction.z * distance;
      seeds.push({
        phase: Math.random() * TWO_PI,
        delay: Math.random() * 0.28,
        swirl: (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.16),
        lift: radius * (0.08 + Math.random() * 0.18),
      });
    }

    this.absorbAnimation = {
      start: this.clock.getElapsedTime(),
      duration: 1.95,
      origins,
      targets,
      seeds,
    };
  }

  clearBlessingParticles() {
    if (!this.blessingParticles) return;

    this.particleRoot.remove(this.blessingParticles.points);
    this.blessingParticles.points.geometry.dispose();
    this.blessingParticles.points.material.dispose();
    if (this.blessingParticles.trail) {
      this.particleRoot.remove(this.blessingParticles.trail);
      this.blessingParticles.trail.geometry.dispose();
      this.blessingParticles.trail.material.dispose();
    }
    this.blessingParticles = null;
  }

  captureMaterialStates() {
    this.materialStates.clear();

    for (const part of this.parts.values()) {
      const materials = Array.isArray(part.material) ? part.material : [part.material];

      for (const material of materials) {
        if (!material || this.materialStates.has(material)) continue;

        this.materialStates.set(material, {
          transparent: material.transparent,
          opacity: material.opacity,
          depthWrite: material.depthWrite,
        });
      }
    }
  }

  setModelEthereal(enabled) {
    for (const [material, original] of this.materialStates) {
      if (enabled) {
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
      } else {
        material.transparent = original.transparent;
        material.opacity = original.opacity;
        material.depthWrite = original.depthWrite;
      }

      material.needsUpdate = true;
    }
  }

  getState() {
    return {
      index: this.stepIndex,
      step: EXPERIENCE_STEPS[this.stepIndex],
      steps: EXPERIENCE_STEPS,
      fortunes: FORTUNES,
      selectedFortune: this.selectedFortune,
      report: this.getReport(),
    };
  }

  getReport() {
    const found = [...this.parts.keys()].sort();
    const missing = Object.values(this.partGroups)
      .flat()
      .filter((name) => !this.parts.has(name));

    return { found, missing, groups: this.partGroups };
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();
    const step = EXPERIENCE_STEPS[this.stepIndex];
    this.updateModelRotation(elapsed, step);
    this.updateTransitions(elapsed);
    this.updateBlessingParticles(elapsed);
    this.updateAbsorbAnimation(elapsed);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  updateBlessingParticles(elapsed) {
    if (!this.blessingParticles || this.absorbAnimation || this.blessingParticles.mode === 'dissolve') return;

    const { points, trail, seeds, origins, apexes, targets, start, radius, profile } = this.blessingParticles;
    const positions = points.geometry.attributes.position.array;
    const trailPositions = trail?.geometry.attributes.position.array;
    const time = elapsed - start;

    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index];
      const progress = THREE.MathUtils.clamp(
        (time - seed.delay) / POINT_CLOUD_GATHER_DURATION,
        0,
        1,
      );
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const settle = Math.min(1, Math.max(0, (progress - 0.78) / 0.22));
      const wave = Math.sin(time * seed.speed + seed.phase) * seed.drift * (1 - settle * 0.72);
      const sideDrift = Math.cos(time * seed.speed * 0.78 + seed.phase) * seed.drift * 0.64 * (1 - settle);
      const originX = origins[index * 3];
      const originY = origins[index * 3 + 1];
      const originZ = origins[index * 3 + 2];
      const apexX = apexes[index * 3];
      const apexY = apexes[index * 3 + 1];
      const apexZ = apexes[index * 3 + 2];
      const targetX = targets[index * 3];
      const targetY = targets[index * 3 + 1];
      const targetZ = targets[index * 3 + 2];

      const previousX = positions[index * 3];
      const previousY = positions[index * 3 + 1];
      const previousZ = positions[index * 3 + 2];
      const inv = 1 - eased;
      let nextX = inv * inv * originX + 2 * inv * eased * apexX + eased * eased * targetX;
      let nextY = inv * inv * originY + 2 * inv * eased * apexY + eased * eased * targetY;
      let nextZ = inv * inv * originZ + 2 * inv * eased * apexZ + eased * eased * targetZ;

      nextX += wave;
      nextY += Math.sin(time * seed.speed * 1.2 + seed.phase) * seed.drift * 0.42 * (1 - settle);
      nextZ += sideDrift;

      if (progress >= 1) {
        const surfaceShimmer = Math.sin(time * 2.4 + seed.phase) * seed.drift * 0.22;
        nextX = targetX + surfaceShimmer;
        nextY = targetY + Math.cos(time * 1.7 + seed.phase) * seed.drift * 0.18;
        nextZ = targetZ - surfaceShimmer;
      }

      positions[index * 3] = nextX;
      positions[index * 3 + 1] = nextY;
      positions[index * 3 + 2] = nextZ;

      if (trailPositions) {
        const dx = nextX - previousX;
        const dy = nextY - previousY;
        const dz = nextZ - previousZ;
        const length = Math.hypot(dx, dy, dz) || 1;
        const trailLength = profile.trailLength * seed.trailScale * (0.6 + Math.sin(progress * Math.PI) * 0.85);
        const lineOffset = index * 6;

        trailPositions[lineOffset] = nextX;
        trailPositions[lineOffset + 1] = nextY;
        trailPositions[lineOffset + 2] = nextZ;
        trailPositions[lineOffset + 3] = nextX - (dx / length) * trailLength;
        trailPositions[lineOffset + 4] = nextY - (dy / length) * trailLength;
        trailPositions[lineOffset + 5] = nextZ - (dz / length) * trailLength;
      }
    }

    points.material.opacity = THREE.MathUtils.lerp(0.24, profile.opacity, Math.min(1, time / 0.9));
    points.rotation.y = Math.sin(time * 0.42) * profile.groupSway;
    points.position.y = Math.sin(time * 0.8) * profile.groupFloat;
    if (trail) {
      const trailEnter = Math.min(1, time / 0.55);
      const trailExit = 1 - THREE.MathUtils.clamp(
        (time - POINT_CLOUD_GATHER_DURATION - POINT_CLOUD_STAGGER_DURATION) / 1.05,
        0,
        1,
      );
      trail.material.opacity = THREE.MathUtils.lerp(
        0.14,
        Math.min(0.58, profile.opacity * 0.62),
        trailEnter,
      ) * trailExit;
      trail.rotation.copy(points.rotation);
      trail.position.copy(points.position);
      trail.geometry.attributes.position.needsUpdate = true;
    }
    points.geometry.attributes.position.needsUpdate = true;
  }

  updateAbsorbAnimation(elapsed) {
    if (!this.absorbAnimation || !this.blessingParticles) return;

    const { points, trail } = this.blessingParticles;
    const positions = points.geometry.attributes.position.array;
    const trailPositions = trail?.geometry.attributes.position.array;
    const progress = THREE.MathUtils.clamp(
      (elapsed - this.absorbAnimation.start) / this.absorbAnimation.duration,
      0,
      1,
    );
    const globalEase = 1 - Math.pow(1 - progress, 3);

    for (let index = 0; index < positions.length / 3; index += 1) {
      const seed = this.absorbAnimation.seeds[index];
      const localProgress = THREE.MathUtils.clamp((progress - seed.delay) / (1 - seed.delay), 0, 1);
      const eased = 1 - Math.pow(1 - localProgress, 3);
      const bloom = Math.sin(localProgress * Math.PI);
      const originX = this.absorbAnimation.origins[index * 3];
      const originY = this.absorbAnimation.origins[index * 3 + 1];
      const originZ = this.absorbAnimation.origins[index * 3 + 2];
      const targetX = this.absorbAnimation.targets[index * 3];
      const targetY = this.absorbAnimation.targets[index * 3 + 1];
      const targetZ = this.absorbAnimation.targets[index * 3 + 2];
      const angle = seed.phase + globalEase * Math.PI * 1.25;
      const swirlX = Math.cos(angle) * seed.swirl * bloom;
      const swirlZ = Math.sin(angle) * seed.swirl * bloom;

      const nextX = THREE.MathUtils.lerp(originX, targetX, eased) + swirlX;
      const nextY = THREE.MathUtils.lerp(originY, targetY, eased) + seed.lift * bloom;
      const nextZ = THREE.MathUtils.lerp(originZ, targetZ, eased) + swirlZ;

      positions[index * 3] = nextX;
      positions[index * 3 + 1] = nextY;
      positions[index * 3 + 2] = nextZ;

      if (trailPositions) {
        const tailProgress = Math.max(0, eased - 0.08);
        const tailX = THREE.MathUtils.lerp(originX, targetX, tailProgress);
        const tailY = THREE.MathUtils.lerp(originY, targetY, tailProgress);
        const tailZ = THREE.MathUtils.lerp(originZ, targetZ, tailProgress);
        const lineOffset = index * 6;

        trailPositions[lineOffset] = nextX;
        trailPositions[lineOffset + 1] = nextY;
        trailPositions[lineOffset + 2] = nextZ;
        trailPositions[lineOffset + 3] = tailX;
        trailPositions[lineOffset + 4] = tailY;
        trailPositions[lineOffset + 5] = tailZ;
      }
    }

    points.material.opacity = 0.78 * (1 - Math.max(0, progress - 0.72) / 0.28);
    if (trail) {
      trail.material.opacity = 0.28 * (1 - Math.max(0, progress - 0.48) / 0.52);
      trail.geometry.attributes.position.needsUpdate = true;
    }
    points.geometry.attributes.position.needsUpdate = true;

    if (progress >= 1) {
      this.absorbAnimation = null;
      this.setModelEthereal(false);
      this.clearBlessingParticles();
      this.setStep(this.stepIndex + 1);
    }
  }

  updateModelRotation(elapsed, step) {
    if (this.showcaseSpin) {
      const progress = THREE.MathUtils.clamp(
        (elapsed - this.showcaseSpin.start) / this.showcaseSpin.duration,
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);

      this.modelRoot.rotation.y = THREE.MathUtils.lerp(
        this.showcaseSpin.from,
        this.showcaseSpin.to,
        eased,
      );

      if (progress >= 1) {
        this.modelRoot.rotation.y = MODEL_DISPLAY_ROTATION_Y;
        this.showcaseSpin = null;
      }

      return;
    }

    if (step.blessingSpin && this.blessingParticles) {
      const time = elapsed - this.blessingParticles.start;
      const settle = THREE.MathUtils.smoothstep(time, POINT_CLOUD_GATHER_DURATION, POINT_CLOUD_GATHER_DURATION + 1.2);
      const rotation = MODEL_DISPLAY_ROTATION_Y + Math.max(0, time - POINT_CLOUD_GATHER_DURATION) * BLESSING_ROTATION_SPEED * settle;

      this.modelRoot.rotation.y = rotation;
      this.particleRoot.rotation.y = rotation - MODEL_DISPLAY_ROTATION_Y;
      return;
    }

    this.particleRoot.rotation.y = 0;
    this.modelRoot.rotation.y = step.frontView
      ? MODEL_DISPLAY_ROTATION_Y
      : Math.sin(elapsed * 0.25) * 0.04;
  }

  updateTransitions(elapsed) {
    for (const [partName, transition] of this.activeTransitions) {
      const progress = THREE.MathUtils.clamp(
        (elapsed - transition.start) / transition.duration,
        0,
        1,
      );
      const eased = progress * progress * (3 - 2 * progress);

      transition.part.position.lerpVectors(transition.fromPosition, transition.targetPosition, eased);
      transition.part.scale.lerpVectors(transition.fromScale, transition.targetScale, eased);

      if (progress >= 1) {
        transition.part.position.copy(transition.targetPosition);
        transition.part.scale.copy(transition.targetScale);
        this.activeTransitions.delete(partName);
      }
    }
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.controls.dispose();
    this.container.replaceChildren();
  }
}
