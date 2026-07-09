import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL = '../../模型/葫芦狮-原件.glb';

const stages = [
  {
    key: 'intro',
    title: '准备开始',
    text: '完整模型先隐藏，舞台上只保留一团糖的起点。',
    focus: new THREE.Vector3(0, -0.24, 0),
  },
  {
    key: 'base',
    title: '吹起底座',
    text: '红色糖团鼓起，模拟“吹出中空体量”。',
    focus: new THREE.Vector3(0, -0.32, 0),
  },
  {
    key: 'body',
    title: '放置身体',
    text: '完整瑞兽低透明显现，像黑糖块慢慢落到底座上。',
    focus: new THREE.Vector3(0, -0.08, 0.02),
  },
  {
    key: 'legs',
    title: '拉出四肢',
    text: '脚部附近出现光圈和糖粒，提示四肢被拉出。',
    focus: new THREE.Vector3(0.06, -0.28, 0.08),
  },
  {
    key: 'head',
    title: '安放头部',
    text: '镜头推向头部，头部区域发光，模拟红色头部糖块就位。',
    focus: new THREE.Vector3(0.12, 0.28, 0.03),
  },
  {
    key: 'decor',
    title: '贴上装饰',
    text: '红绿光带扫过表面，代替真实拆开的糖条和胡子。',
    focus: new THREE.Vector3(0.08, 0.08, 0.02),
  },
  {
    key: 'fortune',
    title: '选择气运',
    text: '完整瑞兽完全显现，选择一种气运颜色。',
    focus: new THREE.Vector3(0, 0.02, 0),
  },
  {
    key: 'lift',
    title: '托起瑞兽',
    text: '整只瑞兽上浮，粒子释放，完成“气运加持”。',
    focus: new THREE.Vector3(0, 0.05, 0),
  },
];

const fortunes = [
  { key: 'shun', label: '顺', color: '#47d16c' },
  { key: 'xi', label: '喜', color: '#ffd45a' },
  { key: 'yong', label: '勇', color: '#111111' },
  { key: 'wang', label: '旺', color: '#e3342f' },
];

const viewport = document.querySelector('#viewport');
const loading = document.querySelector('#loading');
const hintTitle = document.querySelector('#hintTitle');
const hintText = document.querySelector('#hintText');
const nextButton = document.querySelector('#nextButton');
const resetButton = document.querySelector('#resetButton');
const stageList = document.querySelector('#stageList');
const fortuneGrid = document.querySelector('#fortuneGrid');

let currentStage = 0;
let selectedFortune = fortunes[3];
let model = null;
let modelMaterials = [];
let modelBox = new THREE.Box3();
let modelCenter = new THREE.Vector3();
let modelSize = new THREE.Vector3();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x160b09);
scene.fog = new THREE.Fog(0x160b09, 3, 9);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(0.35, 0.22, 2.4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const root = new THREE.Group();
scene.add(root);

const ambient = new THREE.AmbientLight(0xffe0b3, 1.35);
scene.add(ambient);

const keyLight = new THREE.SpotLight(0xffd28a, 8, 6, Math.PI / 5, 0.45, 1.3);
keyLight.position.set(1.7, 2.6, 2.4);
keyLight.castShadow = true;
scene.add(keyLight);

const redLight = new THREE.PointLight(0xd7261e, 2.5, 3);
redLight.position.set(-1.2, 0.2, 1.2);
scene.add(redLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(1.2, 96),
  new THREE.MeshStandardMaterial({
    color: 0x2c120c,
    roughness: 0.72,
    metalness: 0.02,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.52;
floor.receiveShadow = true;
scene.add(floor);

const sugarBlob = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 48, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xd7261e,
    roughness: 0.26,
    metalness: 0.02,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    transmission: 0.08,
  }),
);
sugarBlob.position.set(0, -0.33, 0);
sugarBlob.scale.set(0.35, 0.22, 0.35);
sugarBlob.castShadow = true;
scene.add(sugarBlob);

const focusRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.2, 0.008, 12, 96),
  new THREE.MeshBasicMaterial({
    color: 0xffd45a,
    transparent: true,
    opacity: 0,
  }),
);
focusRing.rotation.x = Math.PI / 2;
scene.add(focusRing);

const sweepRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.48, 0.006, 12, 128),
  new THREE.MeshBasicMaterial({
    color: 0x42d15f,
    transparent: true,
    opacity: 0,
  }),
);
sweepRing.rotation.x = Math.PI / 2;
scene.add(sweepRing);

const particles = createParticles();
scene.add(particles);

const loader = new GLTFLoader();
loader.load(
  MODEL_URL,
  (gltf) => {
    model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0;
        child.material.roughness = Math.min(child.material.roughness ?? 0.35, 0.42);
        child.material.metalness = 0;
        modelMaterials.push(child.material);
      }
    });

    modelBox.setFromObject(model);
    modelBox.getCenter(modelCenter);
    modelBox.getSize(modelSize);
    model.position.sub(modelCenter);
    const scale = 0.9 / Math.max(modelSize.x, modelSize.y, modelSize.z);
    model.scale.setScalar(scale);
    model.rotation.y = -0.42;
    root.add(model);
    loading.classList.add('hidden');
    applyStage(0, true);
  },
  undefined,
  (error) => {
    loading.textContent = `模型加载失败：${error.message}`;
  },
);

function createParticles() {
  const count = 260;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.14 + Math.random() * 0.55;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = -0.35 + Math.random() * 0.2;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    speeds[i] = 0.15 + Math.random() * 0.45;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: selectedFortune.color,
      size: 0.018,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function renderStageList() {
  stageList.innerHTML = stages
    .map((stage, index) => `
      <div class="stage-item ${index === currentStage ? 'active' : ''}">
        <div class="index">${index + 1}</div>
        <div>${stage.title}</div>
      </div>
    `)
    .join('');
}

function renderFortunes() {
  fortuneGrid.innerHTML = fortunes
    .map((fortune) => `
      <div class="fortune ${fortune.key === selectedFortune.key ? 'active' : ''}" data-fortune="${fortune.key}">
        <strong style="color:${fortune.color}">${fortune.label}</strong>
      </div>
    `)
    .join('');

  fortuneGrid.querySelectorAll('[data-fortune]').forEach((item) => {
    item.addEventListener('click', () => {
      selectedFortune = fortunes.find((fortune) => fortune.key === item.dataset.fortune) ?? fortunes[0];
      particles.material.color.set(selectedFortune.color);
      renderFortunes();
    });
  });
}

function setModelOpacity(opacity) {
  for (const material of modelMaterials) {
    material.opacity = opacity;
    material.depthWrite = opacity > 0.88;
  }
}

function applyStage(index, immediate = false) {
  currentStage = index;
  const stage = stages[currentStage];
  hintTitle.textContent = stage.title;
  hintText.textContent = stage.text;
  nextButton.textContent = currentStage === stages.length - 1 ? '再看一遍' : '继续造物';
  renderStageList();

  const progress = currentStage / (stages.length - 1);
  const modelOpacity = currentStage < 2 ? 0 : Math.min(1, 0.22 + progress * 0.92);
  setModelOpacity(modelOpacity);

  sugarBlob.visible = currentStage <= 3;
  const baseScale = currentStage === 0 ? 0.85 : currentStage === 1 ? 1.35 : 1.8;
  sugarBlob.scale.set(baseScale * 0.52, baseScale * 0.34, baseScale * 0.52);
  sugarBlob.material.opacity = currentStage > 3 ? 0 : 1;

  focusRing.material.opacity = ['legs', 'head', 'decor'].includes(stage.key) ? 0.88 : 0;
  sweepRing.material.opacity = stage.key === 'decor' ? 0.76 : 0;
  particles.material.opacity = ['fortune', 'lift'].includes(stage.key) ? 0.72 : 0;

  if (stage.key === 'legs') {
    focusRing.position.set(0.12, -0.36, 0.08);
    focusRing.scale.set(1.1, 1.1, 1.1);
  }

  if (stage.key === 'head') {
    focusRing.position.set(0.12, 0.26, 0.02);
    focusRing.scale.set(0.86, 0.86, 0.86);
  }

  if (stage.key === 'decor') {
    focusRing.position.set(0, 0.06, 0.02);
    focusRing.scale.set(1.65, 1.65, 1.65);
  }

  if (model) {
    root.position.y = stage.key === 'lift' ? 0.22 : 0;
  }

  const cameraTargets = {
    intro: [0.35, 0.22, 2.9],
    base: [0.25, -0.02, 2.55],
    body: [0.36, 0.12, 2.45],
    legs: [0.34, -0.04, 2.18],
    head: [0.18, 0.34, 1.75],
    decor: [0.42, 0.18, 2.05],
    fortune: [0.45, 0.28, 2.65],
    lift: [0.55, 0.38, 2.85],
  };

  targetCameraPosition.fromArray(cameraTargets[stage.key]);
  targetLookAt.copy(stage.focus);

  if (immediate) {
    camera.position.copy(targetCameraPosition);
    lookAt.copy(targetLookAt);
  }
}

const targetCameraPosition = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();
const lookAt = new THREE.Vector3(0, 0, 0);
const clock = new THREE.Clock();

nextButton.addEventListener('click', () => {
  if (currentStage === stages.length - 1) {
    applyStage(0);
    return;
  }

  applyStage(currentStage + 1);
});

resetButton.addEventListener('click', () => applyStage(0));

renderStageList();
renderFortunes();
applyStage(0, true);

function resize() {
  const rect = viewport.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / Math.max(1, rect.height);
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

function animate() {
  const elapsed = clock.getElapsedTime();

  camera.position.lerp(targetCameraPosition, 0.045);
  lookAt.lerp(targetLookAt, 0.055);
  camera.lookAt(lookAt);

  sugarBlob.rotation.y += 0.012;
  sugarBlob.scale.y += Math.sin(elapsed * 4) * 0.0008;

  if (model) {
    model.rotation.y += currentStage >= 6 ? 0.004 : 0.0015;
    root.position.y += (currentStage === stages.length - 1 ? Math.sin(elapsed * 2.4) * 0.003 : 0);
  }

  focusRing.rotation.z += 0.018;
  focusRing.scale.x = focusRing.scale.y = focusRing.scale.z = focusRing.scale.x + Math.sin(elapsed * 4) * 0.0008;
  sweepRing.rotation.z += 0.03;

  const positions = particles.geometry.attributes.position.array;
  const speeds = particles.geometry.attributes.speed.array;
  for (let i = 0; i < speeds.length; i += 1) {
    positions[i * 3 + 1] += speeds[i] * 0.006;
    if (positions[i * 3 + 1] > 0.85) {
      positions[i * 3 + 1] = -0.42;
    }
  }
  particles.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
