import { NextRequest } from 'next/server';
import { prisma } from './db';
import { verifyAdminToken } from './auth';
import { randomBytes } from 'crypto';

export interface AuthResult {
  authenticated: boolean;
  authType?: 'SESSION' | 'API_TOKEN' | 'API_KEY';
  admin?: any;
  apiToken?: any;
  error?: string;
  status?: number;
}

/**
 * Generate a new secure API token
 * Format: ct_live_<32 hex chars>
 */
export function generateApiToken(): { token: string; prefix: string } {
  const randomHex = randomBytes(24).toString('hex');
  const token = `ct_live_${randomHex}`;
  const prefix = `${token.slice(0, 14)}...`;
  return { token, prefix };
}

/**
 * Verify incoming request authentication.
 * Supports:
 * 1. Admin Session JWT Cookie / Bearer
 * 2. Personal Access API Token (Bearer ct_live_... or x-api-key)
 * 3. Legacy CARD_API_KEY fallback
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // 1. Check Admin Session (Cookie or Bearer JWT)
  const admin = verifyAdminToken(request);
  if (admin) {
    return {
      authenticated: true,
      authType: 'SESSION',
      admin,
    };
  }

  // 2. Extract token from Authorization header or custom headers
  const authHeader = request.headers.get('authorization');
  let tokenCandidate = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!tokenCandidate) {
    tokenCandidate =
      request.headers.get('x-api-key')?.trim() ||
      request.headers.get('x-card-api-key')?.trim() ||
      null;
  }

  if (!tokenCandidate) {
    return {
      authenticated: false,
      error: '인증 토큰이 누락되었습니다. (Authorization: Bearer <token> 또는 x-api-key 필요)',
      status: 401,
    };
  }

  // 3. Check ApiToken table in DB
  try {
    const apiToken = await prisma.apiToken.findUnique({
      where: { token: tokenCandidate },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (apiToken) {
      if (!apiToken.isActive) {
        return {
          authenticated: false,
          error: '비활성화되거나 폐기된 API 토큰입니다.',
          status: 403,
        };
      }

      if (apiToken.expiresAt && new Date() > apiToken.expiresAt) {
        return {
          authenticated: false,
          error: `만료된 API 토큰입니다. (만료일: ${apiToken.expiresAt.toISOString().slice(0, 10)})`,
          status: 403,
        };
      }

      // Update lastUsedAt asynchronously
      prisma.apiToken
        .update({
          where: { id: apiToken.id },
          data: { lastUsedAt: new Date() },
        })
        .catch((err) => {
          console.warn('[ApiToken] Failed to update lastUsedAt:', err);
        });

      return {
        authenticated: true,
        authType: 'API_TOKEN',
        apiToken,
        admin: apiToken.user,
      };
    }
  } catch (err) {
    console.error('[ApiToken] Verification error:', err);
  }

  // 4. Legacy CARD_API_KEY fallback
  const configuredKey = process.env.CARD_API_KEY?.trim();
  if (configuredKey && tokenCandidate === configuredKey) {
    return {
      authenticated: true,
      authType: 'API_KEY',
    };
  }

  return {
    authenticated: false,
    error: '유효하지 않거나 만료된 API 토큰입니다.',
    status: 401,
  };
}
