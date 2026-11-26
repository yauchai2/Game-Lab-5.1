function redactDevText(value, limit) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 16000)
    .replace(/\/\/[^\s/@]+:[^\s/@]+@/g, '//[redacted]@')
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/gi, '$1')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/(["']?(?:password|passwd|passcode|pwd|token|cookie|authorization|api[-_ ]?key|secret)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}]+)/gi, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\/(Users|home)\/[^/\s]+\//g, '/$1/[user]/')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .slice(0, limit);
}

module.exports = { redactDevText };
