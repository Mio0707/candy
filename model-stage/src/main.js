import './styles.css';
import { BeastStage, EXPERIENCE_STEPS, FORTUNES } from './BeastStage.js';
import { GestureInput } from './GestureInput.js';
import modelUrl from '../../models/hulushi-web.glb?url';

const pageParams = new URLSearchParams(window.location.search);
const debugMode = pageParams.get('debug') === '1' || pageParams.get('mode') === 'debug';
document.body.classList.toggle('debug-mode', debugMode);
document.body.classList.toggle('formal-mode', !debugMode);
if (debugMode) document.title = '吹糖造物模型舞台 - 调试模式';

const stageElement = document.querySelector('#beast-stage');
const introOverlay = document.querySelector('#intro-overlay');
const startCameraButton = document.querySelector('#start-camera');
const startButtonsButton = document.querySelector('#start-buttons');
const loadingPanel = document.querySelector('#loading-panel');
const titleElement = document.querySelector('#step-title');
const stepChapterElement = document.querySelector('#step-chapter');
const descriptionElement = document.querySelector('#step-description');
const sugarKnowledgeElement = document.querySelector('#sugar-knowledge');
const knowledgeCard = document.querySelector('.knowledge-card');
const progressList = document.querySelector('#progress-list');
const partReport = document.querySelector('#part-report');
const fortunePanel = document.querySelector('#fortune-panel');
const fortuneOptions = document.querySelector('#fortune-options');
const fortuneDescription = document.querySelector('#fortune-description');
const nextButton = document.querySelector('#next-step');
const prevButton = document.querySelector('#prev-step');
const showAllButton = document.querySelector('#show-all');
const cameraBackground = document.querySelector('#camera-background');
const cameraStatus = document.querySelector('#camera-status');
const cameraDebugOutput = document.querySelector('#camera-debug-output');
const retryCameraButton = document.querySelector('#retry-camera');
const gestureDebugOutput = document.querySelector('#gesture-debug-output');
const gestureMeterFill = document.querySelector('#gesture-meter-fill');
const gestureOverlay = document.querySelector('#gesture-overlay');
const stageRitualPrompt = document.querySelector('#stage-ritual-prompt');
const stageGestureHint = document.querySelector('#stage-gesture-hint');
const gestureFeedback = document.querySelector('#gesture-feedback');
const gestureSequence = document.querySelector('#gesture-sequence');
const gestureState = document.querySelector('#gesture-state');
const phaseProgressTrack = document.querySelector('#phase-progress-track');
const phaseProgressCopy = document.querySelector('#phase-progress-copy');
const completionActions = document.querySelector('#completion-actions');
const completionSummary = document.querySelector('#completion-summary');
const restartExperienceButton = document.querySelector('#restart-experience');
const toggleResultFocusButton = document.querySelector('#toggle-result-focus');
const toggleGestureButton = document.querySelector('#toggle-gesture');
const toggleCalibrationButton = document.querySelector('#toggle-calibration');
const calibrationTarget = document.querySelector('#calibration-target');
const resetCalibrationButton = document.querySelector('#reset-calibration');
const calibrationOutput = document.querySelector('#calibration-output');
const stageView = document.querySelector('.stage-view');
const CAMERA_WAIT_HINT_MS = 8000;
let cameraStream = null;
let cameraStatusTimer = null;
let cameraRequestId = 0;
let stageReady = false;
let gestureEnabled = true;
let calibrationMode = false;
let experienceStarted = false;
let buttonOnlyMode = false;
let lastGestureMessage = '等待摄像头...';
let activeGestureStepId = null;
let calibrationStats = createCalibrationStats();
const gestureOverlayContext = gestureOverlay.getContext('2d');

const EXPERIENCE_PHASES = [
  { name: '底座', ids: ['base-small', 'base-mid', 'base-final'] },
  { name: '身体', ids: ['body-block', 'body-place'] },
  { name: '四肢', ids: ['front-legs', 'back-legs', 'back-mustache'] },
  { name: '头部', ids: ['head-block', 'head-place'] },
  { name: '装饰', ids: ['tail', 'turn-front', 'ears', 'head-lines', 'ball-form', 'ball-place'] },
  { name: '赐福', ids: ['complete', 'fortune-select', 'lift-blessing', 'fortune-shell', 'blessing-complete'] },
];

const stage = new BeastStage(stageElement, {
  modelUrl,
});

const STEP_GESTURE_RULES = {
  'base-small': { match: ['fist'], resetMode: 'release-fist', hint: '先张掌，再握拳吹起底座' },
  'body-block': { match: ['fist'], resetMode: 'release-fist', hint: '先松拳，再次握拳放置身体' },
  'front-legs': { match: ['thumb-index-spread'], resetMode: 'thumb-index-closed', hint: '先合拢拇指和食指，再逐渐张开拉出四肢' },
  'back-mustache': { match: ['thumb-index-close'], resetMode: 'thumb-index-open', hint: '先张开拇指和食指，再逐渐并拢贴上糖衣' },
  'head-block': { match: ['open'], resetMode: 'closed-hand', hint: '先收拢手指，再张掌让头部出现' },
  'head-place': { match: ['fist'], resetMode: 'release-fist', hint: '先张掌，再握拳安放头部' },
  tail: { match: ['thumb-index-spread'], resetMode: 'thumb-index-closed', hint: '先合拢拇指和食指，再逐渐张开让尾巴和耳朵出现' },
  ears: { match: ['thumb-index-close'], resetMode: 'thumb-index-open', hint: '逐渐并拢拇指和食指，贴上尾巴和耳朵' },
  'head-lines': { match: ['thumb-index-spread'], resetMode: 'thumb-index-closed', hint: '先合拢拇指和食指，再逐渐张开贴上糖条' },
  'ball-form': { match: ['open'], resetMode: 'closed-hand', hint: '先收拢手指，再张掌让圆球出现' },
  'ball-place': { match: ['fist'], resetMode: 'release-fist', hint: '先张掌，再握拳安放圆球' },
  complete: { match: [], resetMode: null, hint: '瑞兽正在自动旋转展示' },
  'lift-blessing': { match: ['lift'], resetMode: 'lift-ready', hint: '在瑞兽上方张掌，向下托住后保持片刻' },
  'fortune-shell': { match: ['fist'], resetMode: 'release-fist', hint: '粒子成形后握拳收下祝福' },
};

const STAGE_GESTURE_HINTS = {
  'base-small': '握拳，将底座吹起来',
  'body-block': '握拳，把身体糖块吹起并安放',
  'front-legs': '张开两指，从身体中拉出四肢',
  'back-mustache': '并拢两指，把黄色糖衣贴合到身体上',
  'head-block': '张开手掌，让头部糖料逐渐成形',
  'head-place': '握紧拳头，把头部糖块安放到身体上',
  tail: '张开两指，制作尾巴和耳朵糖片',
  ears: '并拢两指，装上带弹簧的尾巴和耳朵',
  'head-lines': '张开两指，搓拉并贴上装饰糖条',
  'ball-form': '张开手掌，把糖料团成爪下圆球',
  'ball-place': '握紧拳头，把圆球安放到瑞兽爪下',
  complete: '',
  'lift-blessing': '张掌向下移动，瑞兽给你带来了一份祝福',
  'fortune-shell': '握紧拳头，将祝福收下',
  'blessing-complete': '造物完成，成功制作了天门糖塑！',
};

const GESTURE_SEQUENCE_HINTS = {
  'base-small': '张开手掌 → 握紧拳头',
  'body-block': '张开手掌 → 握紧拳头',
  'front-legs': '两指合拢 → 逐渐张开',
  'back-mustache': '两指张开 → 逐渐并拢',
  'head-block': '张开手掌',
  'head-place': '张开手掌 → 握紧拳头',
  tail: '两指合拢 → 逐渐张开',
  ears: '两指张开 → 逐渐并拢',
  'head-lines': '两指合拢 → 逐渐张开',
  'ball-form': '收拢手指 → 张开手掌',
  'ball-place': '张开手掌 → 握紧拳头',
  complete: '',
  'lift-blessing': '瑞兽上方张掌 → 向下移动并停留',
  'fortune-shell': '张开手掌 → 握紧拳头',
  'blessing-complete': '造物完成',
};

const CALIBRATION_TARGET_HINTS = {
  fist: '先张开手，再握拳。记录伸直手指数和指尖收拢距离。',
  open: '手掌正对摄像头张开。记录伸直手指数和置信度。',
  pinch: '拇指和食指靠近捏合。记录捏合距离。',
  down: '保持手势，从上往下移动。记录 dy 是否明显为正。',
  swipe: '横向轻扫。记录 dx 是否明显大于 dy。',
  hold: '手掌停住 1 秒左右。记录稳定时间和抖动情况。',
  'thumb-index-spread': '其余手指收拢，先合拢再张开拇指和食指。记录两指距离与手掌宽度的比例。',
  'thumb-index-close': '其余手指收拢，先张开再并拢拇指和食指。记录两指距离与手掌宽度的比例。',
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const gestureInput = new GestureInput({
  videoElement: cameraBackground,
  onAction: handleGestureAction,
  onStatus: renderGestureStatus,
});

function getPhaseIndex(stepId) {
  const index = EXPERIENCE_PHASES.findIndex((phase) => phase.ids.includes(stepId));
  return index < 0 ? 0 : index;
}

function renderPhaseProgress(state) {
  const phaseIndex = getPhaseIndex(state.step.id);
  const allComplete = state.step.id === 'blessing-complete';
  phaseProgressTrack.replaceChildren(
    ...EXPERIENCE_PHASES.map((phase, index) => {
      const item = document.createElement('span');
      item.className = [
        'phase-dot',
        index < phaseIndex || allComplete ? 'complete' : '',
        index === phaseIndex && !allComplete ? 'active' : '',
      ].filter(Boolean).join(' ');
      item.textContent = phase.name;
      item.setAttribute('aria-label', `${phase.name}${index < phaseIndex || allComplete ? '，已完成' : index === phaseIndex ? '，进行中' : '，未开始'}`);
      return item;
    }),
  );
  stepChapterElement.textContent = `第 ${phaseIndex + 1} 阶段 · ${EXPERIENCE_PHASES[phaseIndex].name}`;
  phaseProgressCopy.textContent = `第 ${phaseIndex + 1} 阶段，共 ${EXPERIENCE_PHASES.length} 阶段`;
}

function setGestureFeedback(message, tone = 'neutral') {
  gestureState.textContent = message;
  gestureFeedback.dataset.tone = tone;
}

function beginExperience({ useCamera }) {
  experienceStarted = true;
  buttonOnlyMode = !useCamera;
  introOverlay.hidden = true;
  document.body.classList.toggle('button-only-mode', buttonOnlyMode);
  setGestureFeedback(useCamera ? '正在连接摄像头…' : '按钮模式 · 随时点击“继续造物”', useCamera ? 'neutral' : 'ready');
  if (useCamera) setupCameraBackground();
}

function resetExperience() {
  document.body.classList.remove('result-focus');
  toggleResultFocusButton.textContent = '全屏定格';
  stage.reset();
  setGestureFeedback(buttonOnlyMode ? '按钮模式 · 随时点击“继续造物”' : '请把手掌放入画面中', 'neutral');
}

function renderProgress(state) {
  progressList.replaceChildren(
    ...EXPERIENCE_STEPS.map((step, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = index === state.index ? 'progress-item active' : 'progress-item';
      item.textContent = `${index + 1}. ${step.title}`;
      item.addEventListener('click', () => {
        if (!stage.isInteractionLocked()) stage.setStep(index);
      });
      return item;
    }),
  );
}

function renderReport(report) {
  const missingText = report.missing.length
    ? `缺少：${report.missing.join(', ')}`
    : '必要部件已找到。';

  partReport.textContent = [
    missingText,
    '',
    '已识别部件：',
    ...report.found.map((name) => `- ${name}`),
  ].join('\n');
}

function renderFortunes(state) {
  const shouldShow = ['fortune-shell', 'blessing-complete'].includes(
    state.step.id,
  );
  fortunePanel.hidden = !shouldShow;

  if (!shouldShow) return;

  const selectedFortune = state.selectedFortune ?? FORTUNES[0];
  const result = document.createElement('div');
  result.className = 'fortune-option active fixed';
  result.setAttribute('aria-label', `本次随机祝福：${selectedFortune.name}`);
  result.innerHTML = `<span>${selectedFortune.label}</span><small>${selectedFortune.name}</small>`;
  fortuneOptions.replaceChildren(result);
  fortuneDescription.textContent = selectedFortune.description;
}

function renderNextButton(state) {
  const { step, interactionLocked } = state;
  nextButton.disabled = interactionLocked || step.id === 'blessing-complete';
  if (interactionLocked) {
    nextButton.textContent = '动画进行中...';
    return;
  }

  if (step.id === 'complete') {
    nextButton.textContent = '正在旋转展示';
  } else if (step.id === 'lift-blessing') {
    nextButton.textContent = '托起祝福';
  } else if (step.id === 'fortune-shell') {
    nextButton.textContent = '收下祝福';
  } else if (step.id === 'blessing-complete') {
    nextButton.textContent = '已完成';
  } else {
    nextButton.textContent = '继续造物';
  }
}

function renderInteractionControls(state) {
  renderNextButton(state);
  prevButton.disabled = state.interactionLocked;
  showAllButton.disabled = state.interactionLocked;
  for (const item of progressList.querySelectorAll('.progress-item')) {
    item.disabled = state.interactionLocked;
  }
}

function renderState(state) {
  titleElement.textContent = state.step.title;
  descriptionElement.textContent = state.step.description;
  const knowledgeText = state.step.knowledge ?? '灵感来自国家级非遗天门糖塑。';
  sugarKnowledgeElement.textContent = knowledgeText;
  knowledgeCard.hidden = !knowledgeText;
  renderPhaseProgress(state);
  stageView.classList.toggle(
    'blessing-mode',
    ['lift-blessing', 'fortune-shell', 'blessing-complete'].includes(state.step.id),
  );
  const selectedFortune = state.selectedFortune ?? FORTUNES[0];
  const ritualPromptText = state.step.id === 'fortune-shell'
    ? selectedFortune.blessing
    : '';
  stageView.classList.toggle('ritual-prompt-mode', Boolean(ritualPromptText));
  stageView.classList.toggle('fortune-phrase-mode', state.step.id === 'fortune-shell');
  stageRitualPrompt.textContent = ritualPromptText;
  stageGestureHint.textContent = STAGE_GESTURE_HINTS[state.step.id] ?? '';
  const sequenceHint = GESTURE_SEQUENCE_HINTS[state.step.id] ?? '跟随当前步骤完成动作';
  gestureSequence.textContent = sequenceHint;
  gestureFeedback.hidden = !sequenceHint;
  renderFortunes(state);
  renderProgress(state);
  renderInteractionControls(state);
  renderReport(state.report);
  renderGestureHint(state.step);
  const isComplete = state.step.id === 'blessing-complete';
  document.body.classList.toggle('completion-mode', isComplete);
  completionActions.hidden = !isComplete;
  document.querySelector('.controls').hidden = isComplete;
  if (isComplete) {
    const fortune = state.selectedFortune ?? FORTUNES[0];
    completionSummary.textContent = `你完成了一只“${fortune.name}”瑞兽，也走完了底座、身体、四肢、头部、装饰与赐福 6 个阶段。`;
    setGestureFeedback('造物完成 · 可以定格欣赏成果', 'success');
  }
  if (activeGestureStepId !== state.step.id) {
    const rule = getGestureRule(state.step.id);
    gestureInput.beginStep({ actions: rule.match, resetMode: rule.resetMode });
    activeGestureStepId = state.step.id;
  }
}

function getGestureRule(stepId) {
  return STEP_GESTURE_RULES[stepId] ?? { match: [], hint: '当前步骤可用按钮继续' };
}

function getActionAliases(actionType) {
  if (actionType === 'open-down') return ['open-down', 'down', 'open'];
  if (actionType === 'open-hold') return ['open-hold', 'hold', 'open'];
  if (actionType === 'pinch-down') return ['pinch-down', 'pinch-place', 'down', 'pinch'];
  if (actionType === 'pinch-place') return ['pinch-place', 'down', 'pinch'];
  if (actionType === 'one-finger-swipe') return ['one-finger-swipe', 'swipe'];
  if (actionType === 'two-hands-close') return ['two-hands-close', 'open', 'open-hold'];
  if (actionType === 'two-hands-apart') return ['two-hands-apart'];
  if (actionType === 'circle') return ['circle', 'one-finger-swipe', 'swipe'];
  if (actionType === 'lift') return ['lift'];
  return [actionType];
}

function matchesGestureRule(action, rule) {
  const aliases = getActionAliases(action.type);
  return rule.match.some((type) => aliases.includes(type));
}

function handleGestureAction(action) {
  if (!stageReady || !gestureEnabled) return false;

  if (calibrationMode) {
    lastGestureMessage = `校准捕捉：${action.label}（未推进流程）`;
    return true;
  }

  const state = stage.getState();
  if (state.interactionLocked) return false;
  const rule = getGestureRule(state.step.id);
  if (!matchesGestureRule(action, rule)) return false;

  const advanced = stage.next();
  if (!advanced) return false;
  lastGestureMessage = state.step.id === 'complete'
    ? `已识别：${action.label}，正在旋转展示`
    : `已识别：${action.label}，正在完成造型`;
  return true;
}

function renderGestureHint(step) {
  const rule = getGestureRule(step.id);
  if (!gestureDebugOutput.textContent || gestureDebugOutput.textContent === '等待摄像头...') {
    gestureDebugOutput.textContent = `目标：${rule.hint}\n状态：等待摄像头`;
  }
}

function clampProgress(value) {
  return Math.min(1, Math.max(0, value));
}

function getGesturePreviewProgress(status, state) {
  if (!state || state.interactionLocked || status.state === 'accepted') return null;
  if (status.state !== 'tracking' || !status.hand) return 0;

  const { step } = state;
  const hand = status.hand;

  if (['base-small', 'body-block', 'head-place', 'ball-place'].includes(step.id)) {
    const fingerScore = clampProgress(1 - hand.extendedCount / 4);
    const distanceScore = clampProgress((0.36 - hand.fingertipDistance) / 0.14);
    return fingerScore * 0.45 + distanceScore * 0.55;
  }

  if (['head-block', 'ball-form'].includes(step.id)) {
    const fingerScore = clampProgress(hand.extendedCount / 4);
    const distanceScore = clampProgress((hand.fingertipDistance - 0.18) / 0.2);
    return fingerScore * 0.55 + distanceScore * 0.45;
  }

  if (['front-legs', 'tail', 'head-lines'].includes(step.id)) {
    return clampProgress((hand.thumbIndexSpreadRatio - 0.62) / (1 - 0.62));
  }

  if (['back-mustache', 'ears'].includes(step.id)) {
    const ratioProgress = clampProgress((1 - hand.thumbIndexSpreadRatio) / (1 - 0.35));
    const distanceProgress = clampProgress((0.14 - hand.pinchDistance) / (0.14 - 0.075));
    return Math.max(ratioProgress, distanceProgress);
  }

  if (step.id === 'lift-blessing' && status.pose === 'open') {
    return clampProgress(status.liftState?.progress ?? 0);
  }

  return 0;
}

function updateStageGesturePreview(status, state) {
  const progress = getGesturePreviewProgress(status, state);
  if (progress != null) stage.setGesturePreview(progress);
}

function updateBlessingHandFollow(status, state) {
  if (state?.step.id !== 'fortune-shell') return;
  if (status.hand) {
    stage.setBlessingHandTarget(status.hand.normalizedX, status.hand.normalizedY);
  } else {
    stage.clearBlessingHandTarget();
  }
}

function createCalibrationStats() {
  return {
    samples: 0,
    firstAt: performance.now(),
    minPinch: Infinity,
    maxPinch: 0,
    minFingers: Infinity,
    maxFingers: 0,
    minTipDistance: Infinity,
    maxTipDistance: 0,
    maxAbsDx: 0,
    maxAbsDy: 0,
    maxStableMs: 0,
    lastPose: 'none',
    lastAction: '未触发',
  };
}

function resetCalibrationStats() {
  calibrationStats = createCalibrationStats();
}

function updateCalibrationStats(status) {
  if (!calibrationMode || !status.hand) return;

  const { hand, movement } = status;
  calibrationStats.samples += 1;
  calibrationStats.minPinch = Math.min(calibrationStats.minPinch, hand.pinchDistance);
  calibrationStats.maxPinch = Math.max(calibrationStats.maxPinch, hand.pinchDistance);
  calibrationStats.minFingers = Math.min(calibrationStats.minFingers, hand.extendedCount);
  calibrationStats.maxFingers = Math.max(calibrationStats.maxFingers, hand.extendedCount);
  calibrationStats.minTipDistance = Math.min(calibrationStats.minTipDistance, hand.fingertipDistance);
  calibrationStats.maxTipDistance = Math.max(calibrationStats.maxTipDistance, hand.fingertipDistance);
  calibrationStats.maxAbsDx = Math.max(calibrationStats.maxAbsDx, Math.abs(movement?.dx ?? 0));
  calibrationStats.maxAbsDy = Math.max(calibrationStats.maxAbsDy, Math.abs(movement?.dy ?? 0));
  calibrationStats.maxStableMs = Math.max(calibrationStats.maxStableMs, movement?.stableMs ?? 0);
  calibrationStats.lastPose = status.pose ?? 'none';
  calibrationStats.lastAction = status.action?.label ?? '未触发';
}

function formatRange(min, max, digits = 3) {
  if (!Number.isFinite(min)) return '-';
  return `${min.toFixed(digits)} ~ ${max.toFixed(digits)}`;
}

function renderCalibrationStatus(status) {
  if (!calibrationMode) {
    calibrationOutput.textContent = '校准模式未开启';
    return;
  }

  const target = calibrationTarget.value;
  const hand = status.hand;
  const movement = status.movement;
  const twoHandMovement = status.twoHandMovement;
  const elapsed = Math.max(0, performance.now() - calibrationStats.firstAt);

  calibrationOutput.textContent = [
    `校准：${calibrationTarget.options[calibrationTarget.selectedIndex]?.textContent ?? target}`,
    `提示：${CALIBRATION_TARGET_HINTS[target] ?? '按提示做动作'}`,
    `采样：${calibrationStats.samples} 帧 / ${(elapsed / 1000).toFixed(1)} 秒`,
    `当前判定：${status.action?.label ?? '未触发'} / ${status.pose ?? 'none'}`,
    `置信度：${hand ? Math.round((hand.confidence ?? 0) * 100) + '%' : '-'}`,
    `伸直手指：${hand ? hand.extendedCount : '-'}（范围 ${formatRange(calibrationStats.minFingers, calibrationStats.maxFingers, 0)}）`,
    `捏合距离：${hand ? hand.pinchDistance.toFixed(3) : '-'}（范围 ${formatRange(calibrationStats.minPinch, calibrationStats.maxPinch)}）`,
    `指尖距离：${hand ? hand.fingertipDistance.toFixed(3) : '-'}（范围 ${formatRange(calibrationStats.minTipDistance, calibrationStats.maxTipDistance)}）`,
    `移动 dx/dy：${movement ? `${movement.dx.toFixed(3)}, ${movement.dy.toFixed(3)}` : '-'}`,
    `最大移动：dx ${calibrationStats.maxAbsDx.toFixed(3)} / dy ${calibrationStats.maxAbsDy.toFixed(3)}`,
    `最长稳定：${Math.round(calibrationStats.maxStableMs)} ms`,
  ].join('\n');
}

function resizeGestureOverlay() {
  const width = Math.max(1, stageView.clientWidth);
  const height = Math.max(1, stageView.clientHeight);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  if (gestureOverlay.width !== Math.round(width * ratio) || gestureOverlay.height !== Math.round(height * ratio)) {
    gestureOverlay.width = Math.round(width * ratio);
    gestureOverlay.height = Math.round(height * ratio);
    gestureOverlay.style.width = `${width}px`;
    gestureOverlay.style.height = `${height}px`;
  }

  gestureOverlayContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

function toOverlayPoint(point, width, height) {
  return {
    x: (1 - point.x) * width,
    y: point.y * height,
  };
}

function getPalmPoint(landmarks, width, height) {
  const palmIndexes = [0, 5, 9, 13, 17];
  const total = palmIndexes.reduce(
    (sum, index) => {
      const point = toOverlayPoint(landmarks[index], width, height);
      return { x: sum.x + point.x, y: sum.y + point.y };
    },
    { x: 0, y: 0 },
  );

  return {
    x: total.x / palmIndexes.length,
    y: total.y / palmIndexes.length,
  };
}

function clearGestureOverlay() {
  const { width, height } = resizeGestureOverlay();
  gestureOverlayContext.clearRect(0, 0, width, height);
}

function drawGestureOverlay(status) {
  if (!calibrationMode || !status.hand?.landmarks?.length) {
    clearGestureOverlay();
    return;
  }

  const { width, height } = resizeGestureOverlay();
  const landmarks = status.hand.landmarks;
  const points = landmarks.map((point) => toOverlayPoint(point, width, height));
  const palm = getPalmPoint(landmarks, width, height);
  const thumb = points[4];
  const index = points[8];

  gestureOverlayContext.clearRect(0, 0, width, height);
  gestureOverlayContext.lineCap = 'round';
  gestureOverlayContext.lineJoin = 'round';

  gestureOverlayContext.strokeStyle = 'rgba(255, 248, 237, 0.88)';
  gestureOverlayContext.lineWidth = 3;
  for (const [from, to] of HAND_CONNECTIONS) {
    gestureOverlayContext.beginPath();
    gestureOverlayContext.moveTo(points[from].x, points[from].y);
    gestureOverlayContext.lineTo(points[to].x, points[to].y);
    gestureOverlayContext.stroke();
  }

  gestureOverlayContext.strokeStyle = 'rgba(185, 52, 39, 0.95)';
  gestureOverlayContext.lineWidth = 4;
  gestureOverlayContext.beginPath();
  gestureOverlayContext.moveTo(thumb.x, thumb.y);
  gestureOverlayContext.lineTo(index.x, index.y);
  gestureOverlayContext.stroke();

  for (const [indexNumber, point] of points.entries()) {
    const isTip = [4, 8, 12, 16, 20].includes(indexNumber);
    gestureOverlayContext.beginPath();
    gestureOverlayContext.fillStyle = isTip ? '#f1bc36' : '#38a848';
    gestureOverlayContext.strokeStyle = 'rgba(47, 27, 19, 0.78)';
    gestureOverlayContext.lineWidth = 2;
    gestureOverlayContext.arc(point.x, point.y, isTip ? 6 : 4.5, 0, Math.PI * 2);
    gestureOverlayContext.fill();
    gestureOverlayContext.stroke();
  }

  gestureOverlayContext.beginPath();
  gestureOverlayContext.fillStyle = '#b93427';
  gestureOverlayContext.strokeStyle = '#fff8ed';
  gestureOverlayContext.lineWidth = 2.5;
  gestureOverlayContext.arc(palm.x, palm.y, 8, 0, Math.PI * 2);
  gestureOverlayContext.fill();
  gestureOverlayContext.stroke();

  gestureOverlayContext.font = '12px Microsoft YaHei, sans-serif';
  gestureOverlayContext.fillStyle = 'rgba(47, 27, 19, 0.92)';
  gestureOverlayContext.strokeStyle = 'rgba(255, 248, 237, 0.82)';
  gestureOverlayContext.lineWidth = 4;
  const label = `捏合 ${status.hand.pinchDistance.toFixed(3)}`;
  const labelX = Math.min(width - 96, Math.max(8, (thumb.x + index.x) / 2 + 10));
  const labelY = Math.min(height - 14, Math.max(18, (thumb.y + index.y) / 2));
  gestureOverlayContext.strokeText(label, labelX, labelY);
  gestureOverlayContext.fillText(label, labelX, labelY);
}

function renderGestureStatus(status) {
  updateCalibrationStats(status);
  renderCalibrationStatus(status);
  drawGestureOverlay(status);

  const state = stageReady ? stage.getState() : null;
  updateStageGesturePreview(status, state);
  updateBlessingHandFollow(status, state);
  const rule = state ? getGestureRule(state.step.id) : { hint: '等待模型加载' };
  const hand = status.hand;
  const movement = status.movement;
  const twoHandMovement = status.twoHandMovement;
  const progress = hand ? Math.round((hand.confidence ?? 0) * 100) : 0;
  const actionText = status.action?.label ?? '未触发';
  const poseText = {
    fist: '握拳',
    open: '张掌',
    pinch: '捏合',
    point: '单指',
    'thumb-index-spread': '拇指食指张开',
    'thumb-index-close': '拇指食指并拢',
    hand: '手部',
    none: '未识别',
  }[status.pose] ?? '未识别';
  const stateText = {
    loading: '加载 MediaPipe',
    tracking: '识别中',
    searching: '寻找手部',
    'waiting-camera': '等待摄像头',
    accepted: '已触发',
    error: '识别出错',
    'waiting-reset': '等待手势复位',
  }[status.state] ?? status.state;

  if (experienceStarted && !buttonOnlyMode) {
    if (status.state === 'accepted') {
      setGestureFeedback(`识别成功 · ${status.action?.label ?? '动作完成'}`, 'success');
    } else if (status.state === 'tracking' && hand) {
      setGestureFeedback(`已识别手掌 · 当前${poseText}`, 'ready');
    } else if (status.state === 'waiting-reset') {
      setGestureFeedback(status.resetHint || '请先回到准备手势', 'neutral');
    } else if (status.state === 'searching') {
      setGestureFeedback('未检测到手 · 请将手掌放在画面中央', 'warning');
    } else if (status.state === 'error') {
      setGestureFeedback('手势识别暂不可用 · 可点击按钮继续', 'warning');
    }
  }

  gestureMeterFill.style.width = `${progress}%`;
  if (status.state === 'paused') {
    gestureDebugOutput.textContent = `目标：${rule.hint}\n状态：已暂停\n引擎：MediaPipe Hands`;
    return;
  }

  if (status.state === 'error') {
    gestureDebugOutput.textContent = [
      `目标：${rule.hint}`,
      '状态：识别出错',
      '引擎：MediaPipe Hands',
      `错误：${status.error ?? '未知错误'}`,
    ].join('\n');
    return;
  }

  if (lastGestureMessage && status.state === 'accepted') {
    gestureDebugOutput.textContent = `目标：${rule.hint}\n状态：${lastGestureMessage}\n引擎：MediaPipe Hands`;
    return;
  }

  gestureDebugOutput.textContent = [
    `目标：${rule.hint}`,
    `状态：${stateText}${calibrationMode ? '（校准中，不推进）' : ''}`,
    ...(status.resetHint ? [`准备：${status.resetHint}`] : []),
    '引擎：MediaPipe Hands',
    `当前：${poseText}`,
    `动作：${actionText}`,
    `手数：${status.handCount ?? 0}`,
    `伸指：${hand ? hand.extendedCount : '-'}`,
    `捏合：${hand ? hand.pinchDistance.toFixed(3) : '-'}`,
    `拇食比：${hand ? hand.thumbIndexSpreadRatio.toFixed(2) : '-'}`,
    `位置：${hand ? `${Math.round(hand.normalizedX * 100)}%, ${Math.round(hand.normalizedY * 100)}%` : '-'}`,
    `移动：${movement ? `${movement.dx.toFixed(2)}, ${movement.dy.toFixed(2)}` : '-'}`,
    ...(state?.step.id === 'lift-blessing'
      ? [`托起：${status.liftState?.phase ?? 'ready'} / ${Math.round((status.liftState?.progress ?? 0) * 100)}%`]
      : []),
    `双手：${twoHandMovement ? `${twoHandMovement.distance.toFixed(2)} / ${twoHandMovement.delta.toFixed(2)}` : '-'}`,
  ].join('\n');
}

function showCameraStatus(text, autoHide = false) {
  cameraStatus.hidden = false;
  cameraStatus.textContent = text;
  if (experienceStarted && !buttonOnlyMode) {
    const tone = text.includes('已开启') ? 'ready' : text.includes('未开启') || text.includes('不支持') ? 'warning' : 'neutral';
    setGestureFeedback(text, tone);
  }

  if (cameraStatusTimer) {
    window.clearTimeout(cameraStatusTimer);
    cameraStatusTimer = null;
  }

  if (autoHide) {
    cameraStatusTimer = window.setTimeout(() => {
      cameraStatus.hidden = true;
    }, 1800);
  }
}

function stopCameraStream() {
  if (!cameraStream) return;
  gestureInput.stop();
  for (const track of cameraStream.getTracks()) {
    track.stop();
  }
  cameraStream = null;
}

function formatCameraError(error) {
  const name = error?.name ?? '未知错误';
  const detail = error?.message ? `：${error.message}` : '';

  if (name === 'NotFoundError') {
    return `${name}${detail}\n没有拿到可用摄像头，可能是浏览器看不到设备，或摄像头被别的软件占用。`;
  }

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return `${name}${detail}\n浏览器摄像头权限被拒绝，请在地址栏或系统设置里允许摄像头。`;
  }

  if (name === 'NotReadableError') {
    return `${name}${detail}\n摄像头存在，但暂时无法读取，常见原因是被会议软件或相机应用占用。`;
  }

  if (name === 'SecurityError') {
    return `${name}${detail}\n当前页面环境不允许访问摄像头。`;
  }

  return `${name}${detail}`;
}

async function getCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return {
      supported: false,
      cameras: [],
      error: '浏览器不支持 enumerateDevices',
    };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');
    return { supported: true, cameras };
  } catch (error) {
    return {
      supported: false,
      cameras: [],
      error: formatCameraError(error),
    };
  }
}

async function getCameraPermissionState() {
  if (!navigator.permissions?.query) return '不支持查询';

  try {
    const permission = await navigator.permissions.query({ name: 'camera' });
    return permission.state;
  } catch {
    return '无法查询';
  }
}

function renderCameraDebug({ state, devices, error, stream, permissionState }) {
  const lines = [
    `状态：${state}`,
    `安全上下文：${window.isSecureContext ? '是' : '否'}`,
    `getUserMedia：${navigator.mediaDevices?.getUserMedia ? '支持' : '不支持'}`,
    `权限状态：${permissionState ?? '检测中'}`,
  ];

  if (devices) {
    lines.push(`摄像头数量：${devices.cameras.length}`);
    if (devices.error) lines.push(`设备检测：${devices.error}`);
    for (const [index, device] of devices.cameras.entries()) {
      lines.push(`- ${index + 1}. ${device.label || '未授权前不可见名称'} (${device.deviceId ? '有设备ID' : '无设备ID'})`);
    }
  }

  if (stream) {
    const [track] = stream.getVideoTracks();
    const settings = track?.getSettings?.() ?? {};
    lines.push(`当前视频：${settings.width ?? '?'} x ${settings.height ?? '?'}`);
    lines.push(`当前设备：${track?.label || '未返回名称'}`);
  }

  if (error) {
    lines.push('');
    lines.push('错误：');
    lines.push(error);
  }

  cameraDebugOutput.textContent = lines.join('\n');
}

async function requestCameraStream() {
  const attempts = [
    {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function setupCameraBackground() {
  const requestId = ++cameraRequestId;

  if (!navigator.mediaDevices?.getUserMedia) {
    const devices = await getCameraDevices();
    const permissionState = await getCameraPermissionState();
    showCameraStatus('当前浏览器不支持摄像头背景');
    renderCameraDebug({
      state: '不可用',
      devices,
      permissionState,
      error: 'navigator.mediaDevices.getUserMedia 不存在',
    });
    return;
  }

  retryCameraButton.disabled = true;
  showCameraStatus('正在请求摄像头...');
  stopCameraStream();
  cameraBackground.srcObject = null;

  const devicesBefore = await getCameraDevices();
  const permissionBefore = await getCameraPermissionState();
  renderCameraDebug({ state: '请求中', devices: devicesBefore, permissionState: permissionBefore });

  const waitHintTimer = window.setTimeout(() => {
    if (requestId !== cameraRequestId || cameraStream) return;
    retryCameraButton.disabled = false;
    showCameraStatus('仍在等待摄像头授权，请检查浏览器权限提示');
    renderCameraDebug({
      state: '等待授权',
      devices: devicesBefore,
      permissionState: permissionBefore,
      error: '请求超过 8 秒仍未返回。请在浏览器顶部允许摄像头，或点“重试”。',
    });
  }, CAMERA_WAIT_HINT_MS);

  try {
    const stream = await requestCameraStream();

    if (requestId !== cameraRequestId) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return;
    }

    window.clearTimeout(waitHintTimer);
    cameraStream = stream;
    cameraBackground.srcObject = stream;
    cameraBackground.hidden = false;
    await cameraBackground.play();
    if (gestureEnabled) gestureInput.start();
    const devicesAfter = await getCameraDevices();
    const permissionAfter = await getCameraPermissionState();
    showCameraStatus('摄像头背景已开启', true);
    renderCameraDebug({ state: '已开启', devices: devicesAfter, stream, permissionState: permissionAfter });
  } catch (error) {
    if (requestId !== cameraRequestId) return;

    window.clearTimeout(waitHintTimer);
    cameraBackground.hidden = true;
    const devicesAfter = await getCameraDevices();
    const permissionAfter = await getCameraPermissionState();
    const message = formatCameraError(error);
    showCameraStatus('摄像头未开启，仍可用按钮体验');
    renderCameraDebug({ state: '失败', devices: devicesAfter, permissionState: permissionAfter, error: message });
    console.warn('Camera background unavailable:', error);
  } finally {
    if (requestId === cameraRequestId) {
      retryCameraButton.disabled = false;
    }
  }
}

startCameraButton.addEventListener('click', () => beginExperience({ useCamera: true }));
startButtonsButton.addEventListener('click', () => beginExperience({ useCamera: false }));
nextButton.addEventListener('click', () => {
  stage.next();
});
prevButton.addEventListener('click', () => stage.prev());
document.querySelector('#reset-stage').addEventListener('click', resetExperience);
restartExperienceButton.addEventListener('click', resetExperience);
toggleResultFocusButton.addEventListener('click', () => {
  const focused = document.body.classList.toggle('result-focus');
  toggleResultFocusButton.textContent = focused ? '退出定格' : '全屏定格';
});
showAllButton.addEventListener('click', () => stage.showAll());
retryCameraButton.addEventListener('click', () => setupCameraBackground());
toggleGestureButton.addEventListener('click', () => {
  gestureEnabled = !gestureEnabled;
  toggleGestureButton.textContent = gestureEnabled ? '暂停' : '开启';
  if (gestureEnabled && cameraStream) {
    const state = stage.getState();
    const rule = getGestureRule(state.step.id);
    gestureInput.beginStep({ actions: rule.match, resetMode: rule.resetMode });
    gestureInput.start();
  } else {
    gestureInput.stop();
  }
});
toggleCalibrationButton.addEventListener('click', () => {
  calibrationMode = !calibrationMode;
  gestureInput.setGateBypassed(calibrationMode);
  resetCalibrationStats();
  toggleCalibrationButton.classList.toggle('active', calibrationMode);
  toggleCalibrationButton.textContent = calibrationMode ? '退出校准' : '校准模式';
  lastGestureMessage = calibrationMode ? '校准模式开启，手势不会推进流程' : '校准模式关闭';
  if (!calibrationMode) {
    const state = stage.getState();
    const rule = getGestureRule(state.step.id);
    gestureInput.beginStep({ actions: rule.match, resetMode: rule.resetMode });
    clearGestureOverlay();
  }
  renderCalibrationStatus({ state: 'tracking', hand: null, movement: null, action: null, pose: 'none' });
});
calibrationTarget.addEventListener('change', () => {
  resetCalibrationStats();
  renderCalibrationStatus({ state: 'tracking', hand: null, movement: null, action: null, pose: 'none' });
});
resetCalibrationButton.addEventListener('click', () => {
  resetCalibrationStats();
  renderCalibrationStatus({ state: 'tracking', hand: null, movement: null, action: null, pose: 'none' });
});

stage.addEventListener('stepchange', (event) => renderState(event.detail));
stage.addEventListener('interactionchange', (event) => renderInteractionControls(event.detail.state));

stage
  .load()
  .then(() => {
    stageReady = true;
    loadingPanel.hidden = true;
    renderState(stage.getState());
  })
  .catch((error) => {
    loadingPanel.textContent = `模型加载失败：${error.message}`;
    partReport.textContent = error.stack ?? String(error);
  });
