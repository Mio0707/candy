import './styles.css';
import { BeastStage, EXPERIENCE_STEPS } from './BeastStage.js';
import modelUrl from '../../models/hulushi-web.glb?url';

const stageElement = document.querySelector('#beast-stage');
const loadingPanel = document.querySelector('#loading-panel');
const titleElement = document.querySelector('#step-title');
const descriptionElement = document.querySelector('#step-description');
const progressList = document.querySelector('#progress-list');
const partReport = document.querySelector('#part-report');

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

function renderState(state) {
  titleElement.textContent = state.step.title;
  descriptionElement.textContent = state.step.description;
  renderProgress(state);
  renderReport(state.report);
}

document.querySelector('#next-step').addEventListener('click', () => stage.next());
document.querySelector('#prev-step').addEventListener('click', () => stage.prev());
document.querySelector('#reset-stage').addEventListener('click', () => stage.reset());
document.querySelector('#show-all').addEventListener('click', () => stage.showAll());

stage.addEventListener('stepchange', (event) => renderState(event.detail));

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
