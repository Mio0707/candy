import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
    description: '捏住向下拉，前脚从身体下方出现。',
    visibleGroups: ['base', 'body', 'frontLegs'],
    baseScale: 1,
  },
  {
    id: 'back-legs',
    title: '拉出后脚',
    description: '再次向下拉，后脚出现并落位。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs'],
    baseScale: 1,
  },
  {
    id: 'back-mustache',
    title: '贴上背部糖衣和胡子',
    description: '黄色背部糖衣和胡子出现，形成更强的糖塑装饰感。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'backMustache'],
    baseScale: 1,
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
    id: 'tail-ears',
    title: '贴上尾巴和耳朵',
    description: '尾巴和耳朵作为独立糖片贴到身体上。',
    visibleGroups: ['base', 'body', 'frontLegs', 'backLegs', 'head', 'tailEars', 'backMustache'],
    baseScale: 1,
  },
  {
    id: 'head-lines',
    title: '贴上头部和嘴部糖条',
    description: '红绿糖条贴到头部和嘴部，形成凸起纹样。',
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tailEars',
      'backMustache',
      'headLines',
    ],
    baseScale: 1,
  },
  {
    id: 'ball',
    title: '安放爪下圆球',
    description: '圆球落到爪子下方，瑞兽主体完成。',
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tailEars',
      'backMustache',
      'headLines',
      'ball',
    ],
    baseScale: 1,
  },
  {
    id: 'complete',
    title: '瑞兽完成',
    description: '严格拆解步骤已走完，下一步可接入气运和粒子效果。',
    visibleGroups: [
      'base',
      'body',
      'frontLegs',
      'backLegs',
      'head',
      'tailEars',
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
  tailEars: ['tail_ears_1', 'tail_ears_2'],
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
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6efe6);

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

    this.setupLights();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
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
        part.scale.copy(original.scale).multiplyScalar(transform.scale);
      }

      if (transform.offset) {
        part.position.copy(original.position).add(new THREE.Vector3(...transform.offset));
      }
    }
  }

  next() {
    this.setStep(this.stepIndex + 1);
  }

  prev() {
    this.setStep(this.stepIndex - 1);
  }

  reset() {
    this.setStep(0);
  }

  showAll() {
    this.setStep(EXPERIENCE_STEPS.length - 1);
  }

  getState() {
    return {
      index: this.stepIndex,
      step: EXPERIENCE_STEPS[this.stepIndex],
      steps: EXPERIENCE_STEPS,
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
    this.modelRoot.rotation.y = Math.sin(elapsed * 0.25) * 0.04;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.controls.dispose();
    this.container.replaceChildren();
  }
}
