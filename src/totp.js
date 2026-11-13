const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function decodeBase32(text) {
  const normalized = text.replace(/\s/g, '').replace(/[a-z]/g, (letter) => letter.toUpperCase());
  const body = normalized.replace(/=+$/, '');
  const padding = normalized.length - body.length;
  const standardLength = ![1, 3, 6].includes(body.length % 8);
  if (body.length < 2 || !/^[A-Z2-7]+$/.test(body)
      || (padding && (!standardLength || padding > 6 || normalized.length % 8 !== 0))) {
    throw new Error('请粘贴完整的绑定密钥，使用字母 A–Z 和数字 2–7，可含空格。');
  }

  const bytes = new Uint8Array(Math.floor(body.length * 5 / 8));
  let bits = 0;
  let buffer = 0;
  let index = 0;
  for (const character of body) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = buffer >> bits;
      buffer &= (1 << bits) - 1;
    }
  }
  // Some unpadded keys use nonstandard lengths. Decode their whole bytes only.
  if (standardLength && buffer !== 0) {
    throw new Error('密钥末尾格式有误，请从原处重新复制完整密钥。');
  }
  return bytes;
}

export async function generateTotp(subtle, key, timestampMs, config) {
  const counter = BigInt(Math.floor(timestampMs / (config.periodSeconds * 1000)));
  const message = new DataView(new ArrayBuffer(8));
  message.setBigUint64(0, counter);
  const digest = new DataView(await subtle.sign('HMAC', key, message));
  const offset = digest.getUint8(digest.byteLength - 1) & 0x0f;
  const value = digest.getUint32(offset) & 0x7fffffff;
  return String(value % 10 ** config.digits).padStart(config.digits, '0');
}
