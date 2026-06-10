/**
 * !由于密钥将直接暴露在客户端，此处签名安全系数并不高，只防接口滥用，挡 curl、护有道配额等，切勿用于其他安全场景！
 */

export const buildCanonicalV1 = ({
  method,
  path,
  timestamp,
  clientId,
  body,
}) => {
  return `v1\n${method}\n${path}\n${timestamp}\n${clientId}\n${body}`;
};

const bytesToHex = (bytes) => {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
};

export const generateAbuseGuardSignV1 = async (secret, message) => {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sign = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return bytesToHex(sign);
};
