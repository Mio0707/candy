import './styles.css';
import { BeastStage, EXPERIENCE_STEPS, FORTUNES } from './BeastStage.js';
import modelUrl from '../../models/hulushi-web.glb?url';

const stageElement = document.querySelector('#beast-stage');
const loadingPanel = document.querySelector('#loading-panel');
const titleElement = document.querySelector('#step-title');
const descriptionElement = document.querySelector('#step-description');
const sugarKnowledgeElement = document.querySelector('#sugar-knowledge');
const progressList = document.querySelector('#progress-list');
const partReport = document.querySelector('#part-report');
const fortunePanel = document.querySelector('#fortune-panel');
const fortuneOptions = document.querySelector('#fortune-options');
const fortuneDescription = document.querySelector('#fortune-description');
const nextButton = document.querySelector('#next-step');
const cameraBackground = document.querySelector('#camera-background');
const cameraStatus = document.querySelector('#camera-status');
const stageView = document.querySelector('.stage-view');

const stage = new BeastStage(stageElement, {
  modelUrl,
});

function renderProgress(state) {
  progressList.replaceChildren(
    ...EXPERIENCE_STEPS.map((step, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = index === state.index ? 'progress-item active' : 'progress-item';
      item.textContent = `${index + 1}. ${step.title}`;
      item.addEventListener('click', () => stage.setStep(index));
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
  const shouldShow = ['fortune-select', 'lift-blessing', 'fortune-shell', 'blessing-complete'].includes(
    state.step.id,
  );
  fortunePanel.hidden = !shouldShow;

  if (!shouldShow) return;

  const selectedFortune = state.selectedFortune ?? FORTUNES[0];
  fortuneOptions.replaceChildren(
    ...FORTUNES.map((fortune) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = fortune.id === selectedFortune.id ? 'fortune-option active' : 'fortune-option';
      button.dataset.fortune = fortune.id;
      button.innerHTML = `<span>${fortune.label}</span><small>${fortune.name}</small>`;
      button.addEventListener('click', () => stage.selectFortune(fortune.id));
      return button;
    }),
  );
  fortuneDescription.textContent = selectedFortune.description;
}

function renderNextButton(step) {
  if (step.id === 'fortune-select') {
    nextButton.textContent = '默认选择“顺”';
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

function renderState(state) {
  titleElement.textContent = state.step.title;
  descriptionElement.textContent = state.step.description;
  sugarKnowledgeElement.textContent = state.step.knowledge ?? '灵感来自国家级非遗天门糖塑。';
  stageView.classList.toggle(
    'blessing-mode',
    ['fortune-select', 'lift-blessing', 'fortune-shell', 'blessing-complete'].includes(state.step.id),
  );
  renderNextButton(state.step);
  renderFortunes(state);
  renderProgress(state);
  renderReport(state.report);
}

async function setupCameraBackground() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = '当前浏览器不支持摄像头背景';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    });

    cameraBackground.srcObject = stream;
    cameraBackground.hidden = false;
    cameraStatus.textContent = '手势感应背景已开启';
    window.setTimeout(() => {
      cameraStatus.hidden = true;
    }, 1800);
  } catch (error) {
    cameraBackground.hidden = true;
    cameraStatus.textContent = '摄像头未开启，仍可用按钮体验';
    console.warn('Camera background unavailable:', error);
  }
}

nextButton.addEventListener('click', () => stage.next());
document.querySelector('#prev-step').addEventListener('click', () => stage.prev());
document.querySelector('#reset-stage').addEventListener('click', () => stage.reset());
document.querySelector('#show-all').addEventListener('click', () => stage.showAll());

stage.addEventListener('stepchange', (event) => renderState(event.detail));
setupCameraBackground();

stage
  .load()
  .then(() => {
    loadingPanel.hidden = true;
    renderState(stage.getState());
  })
  .catch((error) => {
    loadingPanel.textContent = `模型加载失败：${error.message}`;
    partReport.textContent = error.stack ?? String(error);
  });
