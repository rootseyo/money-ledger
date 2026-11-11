'use client';

import { type FormEvent } from 'react';
import { ArrowRight, Briefcase, Check, ChevronDown, KeyRound, LoaderCircle, Target, Users, WalletCards } from 'lucide-react';
import { formatNumberWithCommas } from '@/lib/ledger-cell';
import styles from './WorkspaceOnboarding.module.css';

type Props = {
  mode: 'create' | 'join';
  onModeChange: (mode: 'create' | 'join') => void;
  type: 'WEALTH' | 'CLUB' | 'COMPANY';
  onTypeChange: (type: 'WEALTH' | 'CLUB' | 'COMPANY') => void;
  name: string;
  onNameChange: (name: string) => void;
  goal: string;
  onGoalChange: (goal: string) => void;
  inviteCode: string;
  onInviteCodeChange: (code: string) => void;
  busy: boolean;
  onCreate: (event: FormEvent) => void;
  onJoin: (event: FormEvent) => void;
};

export default function WorkspaceOnboarding({ mode, onModeChange, type, onTypeChange, name, onNameChange, goal, onGoalChange, inviteCode, onInviteCodeChange, busy, onCreate, onJoin }: Props) {
  const isCreate = mode === 'create';
  const goalNumber = Number(goal.replace(/,/g, ''));

  return (
    <main className={styles.setup} aria-labelledby="setup-title">
      <header className={styles.heading}>
        <p className={styles.eyebrow}>나에게 맞는 기록의 시작</p>
        <h1 id="setup-title">첫 가계부를 시작해 볼까요?</h1>
        <p>혼자 쓰는 생활비부터 함께 쓰는 모임 회비까지.<br />새로 만들거나 초대받은 가계부에 참여하세요.</p>
      </header>

      <section className={styles.card} aria-label="가계부 시작하기">
        <div className={styles.modes} role="group" aria-label="가계부 시작 방식">
          <button type="button" aria-pressed={isCreate} disabled={busy} onClick={() => onModeChange('create')}><WalletCards size={18} aria-hidden="true" />새로 만들기</button>
          <button type="button" aria-pressed={!isCreate} disabled={busy} onClick={() => onModeChange('join')}><KeyRound size={18} aria-hidden="true" />초대 코드로 참여</button>
        </div>

        <form onSubmit={isCreate ? onCreate : onJoin} className={styles.form} aria-busy={busy}>
          <fieldset className={styles.fields} disabled={busy}>
            {isCreate ? (
              <>
                <fieldset className={styles.types}>
                  <legend>어떤 용도로 사용할까요?</legend>
                  <div className={styles.typeGrid}>
                    {([
                      ['WEALTH', WalletCards, '개인·가족 가계부', '생활비와 수입·지출 기록'],
                      ['CLUB', Users, '모임 가계부', '회비와 공동 지출 관리'],
                      ['COMPANY', Briefcase, '회사 가계부', '세금계산서·부가세·고정비 예측'],
                    ] as const).map(([value, Icon, title, description]) => (
                      <button key={value} type="button" className={styles.type} aria-pressed={type === value} onClick={() => onTypeChange(value)}>
                        <span className={styles.typeTop}><Icon size={22} aria-hidden="true" /><span className={styles.selection}>{type === value && <Check size={12} aria-hidden="true" />}</span></span>
                        <strong>{title}</strong><span>{description}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className={styles.field}>
                  <div className={styles.labelRow}><label htmlFor="household-name">{type === 'CLUB' ? '모임 이름' : type === 'COMPANY' ? '회사 이름' : '가계부 이름'}</label><span>{name.length}/40</span></div>
                  <input id="household-name" required maxLength={40} value={name} onChange={event => onNameChange(event.target.value)} placeholder={type === 'CLUB' ? '예: 테니스 동호회' : type === 'COMPANY' ? '예: 브라이트네트웍스' : '예: 우리집 가계부'} aria-describedby="name-hint" />
                  <p id="name-hint" className={styles.hint}>이름은 나중에 언제든 바꿀 수 있어요.</p>
                </div>

                {type === 'WEALTH' && (
                  <details className={styles.goal}>
                    <summary><Target size={18} aria-hidden="true" /><strong>목돈 목표 설정</strong><span>선택</span><ChevronDown size={16} aria-hidden="true" /></summary>
                    <div className={styles.goalContent}>
                      <div className={styles.field}>
                        <label htmlFor="household-goal">모으고 싶은 금액</label>
                        <div className={styles.amount}><input id="household-goal" inputMode="numeric" value={goal} onChange={event => onGoalChange(formatNumberWithCommas(event.target.value))} placeholder="예: 10,000,000" aria-describedby="goal-hint" /><span>원</span></div>
                        <div className={styles.presets} aria-label="목표 금액 빠른 선택">
                          {([['1천만', 10000000], ['5천만', 50000000], ['1억', 100000000], ['3억', 300000000]] as const).map(([label, amount]) => <button key={amount} type="button" aria-pressed={goalNumber === amount} onClick={() => onGoalChange(formatNumberWithCommas(amount))}>{label}</button>)}
                        </div>
                        <p id="goal-hint" className={styles.hint}>목표는 나중에 가계부 설정에서 추가하거나 바꿀 수 있어요.</p>
                      </div>
                    </div>
                  </details>
                )}
              </>
            ) : (
              <div className={styles.join}>
                <div><h2>함께 기록할 준비가 됐나요?</h2><p>가족이나 모임에서 받은 초대 코드를 입력해 주세요.</p></div>
                <div className={styles.field}>
                  <label htmlFor="household-invite">초대 코드</label>
                  <input id="household-invite" className={styles.code} autoComplete="off" autoCapitalize="characters" spellCheck={false} pattern="[A-Fa-f0-9]{10}" title="영문 A-F와 숫자로 된 10자리 코드를 입력해 주세요." required maxLength={10} value={inviteCode} onChange={event => onInviteCodeChange(event.target.value.trim().toUpperCase())} placeholder="4A8B21C9EF" aria-describedby="invite-hint" />
                  <p id="invite-hint" className={styles.hint}>영문 A–F와 숫자로 된 10자리 코드예요.<br />초대 링크로 들어오면 코드가 자동으로 입력돼요.</p>
                </div>
              </div>
            )}
          </fieldset>
          <div className={styles.footer}>
            <button type="submit" className={styles.submit} disabled={busy || (isCreate ? !name.trim() : inviteCode.length !== 10)}>
              <span>{busy ? (isCreate ? '가계부를 만들고 있어요…' : '가계부에 참여하고 있어요…') : (isCreate ? '가계부 만들기' : '가계부에 참여하기')}</span>
              {busy ? <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <p className={styles.hint}>{isCreate ? '가계부를 만든 뒤 함께 쓸 사람을 초대할 수 있어요.' : '참여 후 같은 가계부에서 함께 기록할 수 있어요.'}</p>
          </div>
        </form>
      </section>
    </main>
  );
}
