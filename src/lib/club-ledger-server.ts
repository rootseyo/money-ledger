import { dataScope } from './data-scope';
import { prisma } from './db';

export class ClubLedgerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function clubWorkspace() {
  const scope = dataScope.getStore();
  if (!scope?.householdId) throw new ClubLedgerError('모임 가계부에서 사용할 수 있습니다.');
  const setting = await prisma.systemSetting.findUnique({ where: { key: `household:${scope.householdId}` } });
  const household = setting ? JSON.parse(setting.value) : null;
  if (household?.type !== 'CLUB') throw new ClubLedgerError('모임 회계형 가계부에서 사용할 수 있습니다.');
  return { scope, workspaceId: scope.householdId, household };
}

export async function validateDuesEdit(id: string, patch: { type?: unknown; amount?: unknown }) {
  if (patch.type === undefined && patch.amount === undefined) return;
  const payment = await prisma.duesPayment.findUnique({ where: { transactionId: id } });
  if (payment && ((patch.type !== undefined && patch.type !== 'DEPOSIT') || (patch.amount !== undefined && (!Number.isSafeInteger(patch.amount) || Number(patch.amount) <= 0)))) {
    throw new ClubLedgerError('회비는 0원보다 큰 수입 거래여야 합니다. 회비 연결을 해제한 뒤 구분을 변경해 주세요.');
  }
}
