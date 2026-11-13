import { expiryWarningSeconds, loadConfig } from './config.js';
import { decodeBase32, generateTotp } from './totp.js';

const secret = document.getElementById('secret');
const toggle = document.getElementById('toggle');
const clear = document.getElementById('clear');
const copy = document.getElementById('copy');
const code = document.getElementById('code');
const progress = document.getElementById('progress');
const timer = progress.parentElement;
const remaining = document.getElementById('remaining');
const error = document.getElementById('error');
const feedback = document.getElementById('feedback');

function start(config, subtle, clipboard) {
  const periodMs = config.periodSeconds * 1000;
  let key = null;
  let revision = 0;
  let windowStartMs = null;
  let currentCode = '';

  function clearCode(placeholder = '等待输入密钥') {
    currentCode = '';
    code.textContent = placeholder;
    code.classList.add('code-empty');
    copy.textContent = '复制';
    copy.disabled = true;
  }

  function resetResult() {
    revision += 1;
    key = null;
    windowStartMs = null;
    error.textContent = '';
    feedback.textContent = '';
    secret.removeAttribute('aria-invalid');
    clearCode();
    progress.value = 0;
    remaining.textContent = '—';
    timer.classList.remove('is-expiring');
  }

  async function refresh() {
    if (!key) return;

    const nowMs = Date.now();
    const startMs = Math.floor(nowMs / periodMs) * periodMs;
    const secondsLeft = (startMs + periodMs - nowMs) / 1000;
    progress.value = secondsLeft;
    remaining.textContent = `${Math.ceil(secondsLeft)} 秒`;
    timer.classList.toggle('is-expiring', secondsLeft <= expiryWarningSeconds);
    if (windowStartMs === startMs) return;

    windowStartMs = startMs;
    clearCode('正在更新');
    feedback.textContent = '';
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
      code.classList.remove('code-empty');
      copy.disabled = false;
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
    try {
      const importedKey = await subtle.importKey(
        'raw', bytes, { name: 'HMAC', hash: config.hash }, false, ['sign'],
      );
      if (revision !== activeRevision) return;
      key = importedKey;
      void refresh();
    } catch {
      if (revision !== activeRevision) return;
      error.textContent = '无法读取密钥，请重新输入。';
    } finally {
      bytes.fill(0);
    }
  }

  function setVisible(visible) {
    secret.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? '隐藏' : '显示';
  }

  function clearSecret() {
    secret.value = '';
    setVisible(false);
    resetResult();
  }

  secret.addEventListener('input', updateSecret);
  toggle.addEventListener('click', () => setVisible(secret.type === 'password'));
  clear.addEventListener('click', () => {
    clearSecret();
    secret.focus();
  });
  copy.addEventListener('click', async () => {
    void refresh();
    if (!currentCode) {
      feedback.classList.remove('visually-hidden');
      feedback.textContent = '验证码正在更新，请重试。';
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
    feedback.textContent = message;
    feedback.classList.toggle('visually-hidden', copied);
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
  toggle.disabled = false;
  clear.disabled = false;
}

try {
  const config = loadConfig();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('请通过 HTTPS 或 localhost 打开此页面。');
  start(config, subtle, navigator.clipboard);
} catch (failure) {
  error.textContent = failure.message;
}
