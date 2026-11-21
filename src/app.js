import { expiryWarningSeconds, loadConfig } from './config.js';
import { decodeBase32, generateTotp } from './totp.js';

const secret = document.getElementById('secret');
const clearButton = document.getElementById('clear');
const copy = document.getElementById('copy');
const code = document.getElementById('code');
const progress = document.getElementById('progress');
const readout = progress.closest('.readout');
const remaining = document.getElementById('remaining');
const error = document.getElementById('error');
const feedback = document.getElementById('feedback');

function start(config, subtle, clipboard) {
  const periodMs = config.periodSeconds * 1000;
  let key = null;
  let revision = 0;
  let windowStartMs = null;
  let currentCode = '';
  let hasGeneratedCode = false;

  function showFeedback(message, visible = false) {
    feedback.classList.toggle('visually-hidden', !visible);
    feedback.textContent = message;
  }

  function clearCode(placeholder = '') {
    currentCode = '';
    code.textContent = placeholder;
    code.classList.toggle('code-pending', placeholder !== '');
    copy.textContent = '复制';
    copy.disabled = true;
  }

  function resetResult() {
    revision += 1;
    key = null;
    windowStartMs = null;
    hasGeneratedCode = false;
    error.textContent = '';
    showFeedback('', true);
    clearButton.disabled = secret.value.length === 0;
    secret.removeAttribute('aria-invalid');
    clearCode();
    progress.value = 0;
    remaining.textContent = '';
    readout.classList.remove('is-expiring');
  }

  async function refresh() {
    if (!key) return;

    const nowMs = Date.now();
    const startMs = Math.floor(nowMs / periodMs) * periodMs;
    const secondsLeft = (startMs + periodMs - nowMs) / 1000;
    progress.value = secondsLeft;
    remaining.textContent = `剩余 ${Math.ceil(secondsLeft)} 秒`;
    readout.classList.toggle('is-expiring', secondsLeft <= expiryWarningSeconds);
    if (windowStartMs === startMs) return;

    windowStartMs = startMs;
    clearCode(hasGeneratedCode ? '正在更新…' : '正在生成…');
    showFeedback('', true);
    const activeRevision = revision;
    try {
      const result = await generateTotp(subtle, key, nowMs, config);
      if (revision !== activeRevision || windowStartMs !== startMs) return;
      if (Math.floor(Date.now() / periodMs) * periodMs !== startMs) {
        void refresh();
        return;
      }
      currentCode = result;
      code.textContent = `${result.slice(0, 3)} ${result.slice(3)}`;
      code.classList.remove('code-pending');
      copy.disabled = false;
      if (!hasGeneratedCode) {
        showFeedback('验证码已生成，可复制。');
        hasGeneratedCode = true;
      }
    } catch {
      if (revision !== activeRevision || windowStartMs !== startMs) return;
      resetResult();
      error.textContent = '无法生成验证码，请重新输入密钥。';
    }
  }

  async function updateSecret() {
    resetResult();
    if (!secret.value.trim()) return;

    let bytes;
    try {
      bytes = decodeBase32(secret.value);
    } catch (failure) {
      secret.setAttribute('aria-invalid', 'true');
      error.textContent = failure.message;
      return;
    }

    const activeRevision = revision;
    clearCode('正在生成…');
    try {
      const importedKey = await subtle.importKey(
        'raw', bytes, { name: 'HMAC', hash: config.hash }, false, ['sign'],
      );
      if (revision !== activeRevision) return;
      key = importedKey;
      void refresh();
    } catch {
      if (revision !== activeRevision) return;
      resetResult();
      error.textContent = '无法读取密钥，请重新输入。';
    } finally {
      bytes.fill(0);
    }
  }

  function clearSecret() {
    secret.value = '';
    resetResult();
  }

  secret.addEventListener('input', updateSecret);
  clearButton.addEventListener('click', () => {
    clearSecret();
    secret.focus();
    showFeedback('密钥已清空。');
  });
  copy.addEventListener('click', async () => {
    void refresh();
    if (!currentCode) {
      showFeedback('验证码正在更新，请重试。', true);
      return;
    }

    const copiedRevision = revision;
    const copiedWindowMs = windowStartMs;
    let message = '已复制';
    try {
      await clipboard.writeText(currentCode);
    } catch {
      message = '无法访问剪贴板，请手动复制验证码。';
    }
    if (copiedRevision !== revision || copiedWindowMs !== windowStartMs) return;
    const copied = message === '已复制';
    copy.textContent = copied ? message : '复制';
    showFeedback(message, !copied);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh();
  });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('pagehide', clearSecret);
  window.setInterval(refresh, 200);
  progress.max = config.periodSeconds;
  clearSecret();
  secret.disabled = false;
}

try {
  const config = loadConfig();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('请通过 HTTPS 或 localhost 打开此页面。');
  start(config, subtle, navigator.clipboard);
} catch (failure) {
  error.textContent = failure.message;
}
