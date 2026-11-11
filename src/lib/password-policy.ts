export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8 || new TextEncoder().encode(password).length > 72) return '비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.';
  return null;
}

