export const POLICY_VERSION = '2026-10-07';
export function validateSignup(body: Record<string, unknown>): string | null {
  if (body.termsAccepted !== true || body.privacyAccepted !== true) return '서비스 이용약관과 개인정보 처리방침에 동의해주세요.';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email.endsWith('.invalid')) return '올바른 이메일을 입력해주세요.';
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) return '비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해주세요.';
  return null;
}
