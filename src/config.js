const defaults = Object.freeze({ periodSeconds: 30, digits: 6, hash: 'SHA-1' });
export const expiryWarningSeconds = 5;

export function loadConfig(overrides = {}) {
  if (overrides === null || typeof overrides !== 'object'
      || Object.getPrototypeOf(overrides) !== Object.prototype) {
    throw new Error('配置必须是普通对象。');
  }

  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(defaults, key)) {
      throw new Error(`未知配置项：${key}`);
    }
  }

  const config = { ...defaults, ...overrides };
  if (!Number.isInteger(config.periodSeconds) || config.periodSeconds < 1
      || !Number.isSafeInteger(config.periodSeconds * 1000)) {
    throw new Error('验证码周期必须是正整数秒。');
  }
  if (config.digits !== 6 || config.hash !== 'SHA-1') {
    throw new Error('此页面使用 6 位验证码和 SHA-1。');
  }
  return Object.freeze(config);
}
