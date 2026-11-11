export default function MoneyValue({ value, prefix = '' }: { value: number | null; prefix?: string }) {
  return <span className="ledger-money">{value === null ? '—' : `${prefix}₩${value.toLocaleString('ko-KR')}`}</span>;
}
