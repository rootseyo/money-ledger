import jwt from 'jsonwebtoken';
export const KAKAO_STATE_COOKIE = 'money_kakao_state';
export const KAKAO_PENDING_COOKIE = 'money_kakao_pending';
export const oauthCookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 };
export function kakaoConfig() {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim();
  const redirectUri = process.env.KAKAO_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) throw new Error('카카오 로그인이 아직 설정되지 않았습니다. 이메일로 가입하거나 데모를 이용해주세요.');
  return { clientId, redirectUri };
}
function secret() {
  const value = process.env.JWT_SECRET?.trim();
  if (!value) throw new Error('JWT_SECRET is required for Kakao authentication');
  return value;
}
export function signKakaoPending(id: string) { return jwt.sign({ kakaoId: id, purpose: 'kakao-signup' }, secret(), { expiresIn: '10m' }); }
export function readKakaoPending(token?: string): string | null {
  try {
    const payload = jwt.verify(token || '', secret(), { algorithms: ['HS256'] });
    return typeof payload !== 'string' && payload.purpose === 'kakao-signup' && typeof payload.kakaoId === 'string' ? payload.kakaoId : null;
  } catch { return null; }
}

export const KAKAO_ACCOUNT_INTENT_COOKIE = 'money_kakao_account_intent';
export const KAKAO_DELETE_PROOF_COOKIE = 'money_kakao_delete_proof';
export type AccountIntent = { userId: string; state: string; action: 'link' | 'delete'; credential: string };
export function signAccountIntent(intent: AccountIntent) {
  return jwt.sign({ ...intent, purpose: 'kakao-account' }, secret(), { expiresIn: '10m' });
}
export function readAccountIntent(token?: string): AccountIntent | null {
  try {
    const value = jwt.verify(token || '', secret(), { algorithms: ['HS256'] });
    if (typeof value === 'string' || value.purpose !== 'kakao-account' || typeof value.userId !== 'string' || typeof value.state !== 'string' || typeof value.credential !== 'string' || !['link', 'delete'].includes(value.action)) return null;
    return value as AccountIntent;
  } catch { return null; }
}
export function signDeleteProof(userId: string) {
  return jwt.sign({ userId, purpose: 'kakao-account-delete' }, secret(), { expiresIn: '5m' });
}
export function verifyDeleteProof(token: string | undefined, userId: string): boolean {
  try {
    const value = jwt.verify(token || '', secret(), { algorithms: ['HS256'] });
    return typeof value !== 'string' && value.purpose === 'kakao-account-delete' && value.userId === userId;
  } catch { return false; }
}
