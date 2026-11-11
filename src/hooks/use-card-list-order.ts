'use client';

import { useEffect, useRef, useState } from 'react';
import { applyListOrder, moveListItem, validListOrder, type CardList } from '@/lib/card-list-order';

export function useCardListOrder<T extends { id: string }>(list: CardList, items: T[], visible: T[]) {
  const [order, setOrder] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const ordered = applyListOrder(visible, order);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/card-transactions/list-order?list=${list}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !validListOrder(data.ids)) throw new Error(data.error || '순서 조회 실패');
        setOrder(data.ids);
        setReady(true);
      })
      .catch((error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [list]);

  const save = async (next: string[]) => {
    if (busy.current || !ready) return;
    busy.current = true;
    const previous = order;
    setOrder(next);
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/card-transactions/list-order', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list, ids: next }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '순서 저장 실패');
      }
    } catch (error) {
      setOrder(previous);
      setError(error instanceof Error ? error.message : '순서 저장 실패');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return {
    ordered, saving, error, disabled: !ready || saving, custom: order.length > 0,
    move: (source: string, target: string) => {
      if (source !== target) void save(moveListItem(order, items.map((item) => item.id), ordered.map((item) => item.id), source, target));
    },
    reset: () => { void save([]); },
  };
}
