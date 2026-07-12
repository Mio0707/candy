import './styles.css';
import { GestureInput } from './GestureInput.js';

const video = document.querySelector('#sampler-video');
const overlay = document.querySelector('#sampler-overlay');
const targetSelect = document.querySelector('#sample-target');
const noteInput = document.querySelector('#sample-note');
const startButton = document.querySelector('#start-sampling');
const stopButton = document.querySelector('#stop-sampling');
const clearButton = document.querySelector('#clear-sampling');
const sendButton = document.querySelector('#send-sampling');
const liveOutput = document.querySelector('#live-output');
const summaryOutput = document.querySelector('#summary-output');
const sendStatus = document.querySelector('#send-status');
const overlayContext = overlay.getContext('2d');

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

let recording = false;
let startedAt = 0;
let samples = [];
let latestStatus = null;

const gestureInput = new GestureInput({
  videoElement: video,
  onAction: () => false,
  onStatus: handleGestureStatus,
});

function getPoseText(pose) {
  return {
    fist: '握拳',
    open: '张掌',
    pinch: '捏合',
    point: '单指',
    hand: '手部',
    none: '未识别',
  }[pose] ?? '未识别';
}

function resizeOverlay() {
  const rect = overlay.parentElement.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  if (overlay.width !== Math.round(width * ratio) || overlay.height !== Math.round(height * ratio)) {
    overlay.width = Math.round(width * ratio);
    overlay.height = Math.round(height * ratio);
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
  }

  overlayContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

function toOverlayPoint(point, width, height) {
  return {
    x: (1 - point.x) * width,
    y: point.y * height,
  };
}

function drawHand(status) {
  const { width, height } = resizeOverlay();
  overlayContext.clearRect(0, 0, width, height);

  const hands = status.hands?.length ? status.hands : (status.hand ? [status.hand] : []);
  if (!hands.length) return;

  overlayContext.lineCap = 'round';
  overlayContext.lineJoin = 'round';

  for (const hand of hands) {
    const points = hand.landmarks.map((point) => toOverlayPoint(point, width, height));
    overlayContext.strokeStyle = 'rgba(255, 248, 237, 0.9)';
    overlayContext.lineWidth = 3;

    for (const [from, to] of HAND_CONNECTIONS) {
      overlayContext.beginPath();
      overlayContext.moveTo(points[from].x, points[from].y);
      overlayContext.lineTo(points[to].x, points[to].y);
      overlayContext.stroke();
    }

    overlayContext.strokeStyle = 'rgba(185, 52, 39, 0.96)';
    overlayContext.lineWidth = 4;
    overlayContext.beginPath();
    overlayContext.moveTo(points[4].x, points[4].y);
    overlayContext.lineTo(points[8].x, points[8].y);
    overlayContext.stroke();

    for (const [index, point] of points.entries()) {
      const isTip = [4, 8, 12, 16, 20].includes(index);
      overlayContext.beginPath();
      overlayContext.fillStyle = isTip ? '#f1bc36' : '#38a848';
      overlayContext.strokeStyle = 'rgba(47, 27, 19, 0.8)';
      overlayContext.lineWidth = 2;
      overlayContext.arc(point.x, point.y, isTip ? 6 : 4.5, 0, Math.PI * 2);
      overlayContext.fill();
      overlayContext.stroke();
    }
  }
}

function makeSample(status) {
  const hand = status.hand;
  const movement = status.movement ?? {};
  const twoHandMovement = status.twoHandMovement ?? {};
  return {
    t: Math.round(performance.now() - startedAt),
    target: targetSelect.value,
    pose: status.pose ?? 'none',
    action: status.action?.type ?? null,
    actionLabel: status.action?.label ?? null,
    confidence: hand.confidence,
    handedness: hand.handedness,
    extendedCount: hand.extendedCount,
    pinch: hand.pinch,
    pinchDistance: hand.pinchDistance,
    fingertipDistance: hand.fingertipDistance,
    normalizedX: hand.normalizedX,
    normalizedY: hand.normalizedY,
    dx: movement.dx ?? 0,
    dy: movement.dy ?? 0,
    distance: movement.distance ?? 0,
    pathLength: movement.pathLength ?? 0,
    spanX: movement.spanX ?? 0,
    spanY: movement.spanY ?? 0,
    stableMs: movement.stableMs ?? 0,
    twoHandDistance: twoHandMovement.distance ?? 0,
    twoHandDelta: twoHandMovement.delta ?? 0,
    twoHandDuration: twoHandMovement.duration ?? 0,
    handCount: status.hands?.length ?? status.handCount ?? 0,
    hands: (status.hands ?? []).map((item) => ({
      confidence: item.confidence,
      handedness: item.handedness,
      extendedCount: item.extendedCount,
      pinch: item.pinch,
      pinchDistance: item.pinchDistance,
      fingertipDistance: item.fingertipDistance,
      normalizedX: item.normalizedX,
      normalizedY: item.normalizedY,
      landmarks: item.landmarks.map((point) => ({
        x: Number(point.x.toFixed(5)),
        y: Number(point.y.toFixed(5)),
        z: Number((point.z ?? 0).toFixed(5)),
      })),
    })),
    landmarks: hand.landmarks.map((point) => ({
      x: Number(point.x.toFixed(5)),
      y: Number(point.y.toFixed(5)),
      z: Number((point.z ?? 0).toFixed(5)),
    })),
  };
}

function summarize() {
  if (!samples.length) {
    summaryOutput.textContent = '还没有采样。';
    return null;
  }

  const values = (key) => samples.map((sample) => sample[key]).filter((value) => Number.isFinite(value));
  const range = (key, digits = 3) => {
    const list = values(key);
    if (!list.length) return '-';
    return `${Math.min(...list).toFixed(digits)} ~ ${Math.max(...list).toFixed(digits)}`;
  };
  const avg = (key, digits = 3) => {
    const list = values(key);
    if (!list.length) return '-';
    return (list.reduce((total, value) => total + value, 0) / list.length).toFixed(digits);
  };
  const poseCounts = samples.reduce((counts, sample) => {
    counts[sample.pose] = (counts[sample.pose] ?? 0) + 1;
    return counts;
  }, {});

  const summary = {
    target: targetSelect.value,
    count: samples.length,
    durationMs: samples.at(-1).t,
    confidenceAvg: avg('confidence', 2),
    extendedCountRange: range('extendedCount', 0),
    pinchDistanceRange: range('pinchDistance'),
    pinchDistanceAvg: avg('pinchDistance'),
    fingertipDistanceRange: range('fingertipDistance'),
    maxAbsDx: Math.max(...values('dx').map(Math.abs)).toFixed(3),
    maxAbsDy: Math.max(...values('dy').map(Math.abs)).toFixed(3),
    maxPathLength: Math.max(...values('pathLength')).toFixed(3),
    maxSpanX: Math.max(...values('spanX')).toFixed(3),
    maxSpanY: Math.max(...values('spanY')).toFixed(3),
    twoHandDistanceRange: range('twoHandDistance'),
    maxAbsTwoHandDelta: Math.max(...values('twoHandDelta').map(Math.abs)).toFixed(3),
    maxStableMs: Math.max(...values('stableMs')).toFixed(0),
    maxHandCount: Math.max(...values('handCount')),
    poseCounts,
  };

  summaryOutput.textContent = [
    `手势：${targetSelect.options[targetSelect.selectedIndex].textContent}`,
    `样本：${summary.count} 帧 / ${summary.durationMs} ms`,
    `平均置信度：${summary.confidenceAvg}`,
    `伸直手指数：${summary.extendedCountRange}`,
    `捏合距离：${summary.pinchDistanceRange}，平均 ${summary.pinchDistanceAvg}`,
    `指尖距离：${summary.fingertipDistanceRange}`,
    `最大移动：dx ${summary.maxAbsDx} / dy ${summary.maxAbsDy}`,
    `最大轨迹：${summary.maxPathLength}，跨度 ${summary.maxSpanX} x ${summary.maxSpanY}`,
    `双手距离：${summary.twoHandDistanceRange}，最大变化 ${summary.maxAbsTwoHandDelta}`,
    `最长稳定：${summary.maxStableMs} ms`,
    `最多手数：${summary.maxHandCount}`,
    `判定分布：${JSON.stringify(summary.poseCounts)}`,
  ].join('\n');

  return summary;
}

function handleGestureStatus(status) {
  latestStatus = status;
  drawHand(status);

  const hand = status.hand;
  const movement = status.movement;
  const twoHandMovement = status.twoHandMovement;
  liveOutput.textContent = [
    `状态：${status.state}`,
    `当前：${getPoseText(status.pose)}`,
    `动作：${status.action?.label ?? '未触发'}`,
    `手数：${status.handCount ?? 0}`,
    `置信度：${hand ? Math.round(hand.confidence * 100) + '%' : '-'}`,
    `伸指：${hand ? hand.extendedCount : '-'}`,
    `捏合：${hand ? hand.pinchDistance.toFixed(3) : '-'}`,
    `指尖：${hand ? hand.fingertipDistance.toFixed(3) : '-'}`,
    `移动：${movement ? `${movement.dx.toFixed(3)}, ${movement.dy.toFixed(3)}` : '-'}`,
    `双手：${twoHandMovement ? `${twoHandMovement.distance.toFixed(3)} / ${twoHandMovement.delta.toFixed(3)}` : '-'}`,
    `采样：${recording ? '进行中' : '停止'} / ${samples.length} 帧`,
  ].join('\n');

  if (recording && hand) {
    samples.push(makeSample(status));
    summarize();
  }
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    await gestureInput.start();
  } catch (error) {
    liveOutput.textContent = `摄像头启动失败：${error?.message ?? String(error)}`;
  }
}

function buildPayload() {
  return {
    type: 'gesture-samples',
    version: 1,
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    target: targetSelect.value,
    targetLabel: targetSelect.options[targetSelect.selectedIndex].textContent,
    note: noteInput.value.trim(),
    summary: summarize(),
    samples,
  };
}

startButton.addEventListener('click', () => {
  samples = [];
  startedAt = performance.now();
  recording = true;
  sendStatus.textContent = '正在采样...';
  if (latestStatus?.hand) samples.push(makeSample(latestStatus));
  summarize();
});

stopButton.addEventListener('click', () => {
  recording = false;
  sendStatus.textContent = `已停止，当前 ${samples.length} 帧。`;
  summarize();
});

clearButton.addEventListener('click', () => {
  recording = false;
  samples = [];
  sendStatus.textContent = '已清空采样。';
  summarize();
});

sendButton.addEventListener('click', async () => {
  recording = false;
  if (!samples.length) {
    sendStatus.textContent = '还没有采样，先点“开始采样”。';
    return;
  }

  try {
    sendStatus.textContent = '正在发送...';
    const response = await fetch('/gesture-samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || '保存失败');
    sendStatus.textContent = `已发送：${result.path}`;
  } catch (error) {
    sendStatus.textContent = `发送失败：${error?.message ?? String(error)}`;
  }
});

targetSelect.addEventListener('change', () => {
  recording = false;
  samples = [];
  sendStatus.textContent = '已切换手势，请重新采样。';
  summarize();
});

window.addEventListener('resize', () => drawHand(latestStatus ?? {}));
setupCamera();
