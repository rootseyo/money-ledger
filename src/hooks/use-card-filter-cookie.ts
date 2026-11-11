'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createFilterCookie, readFilterCookie } from '@/lib/card-filter-cookies';

export function useCardFilterCookie<T>(name: string, defaults: T): [T, Dispatch<SetStateAction<T>>] {
  const initial = useRef(defaults);
  const current = useRef(defaults);
  const [value, setValue] = useState(defaults);

  useEffect(() => {
    let restored = initial.current;
    try { restored = readFilterCookie(document.cookie, name, initial.current); } catch {}
    current.current = restored;
    // Browser preferences are restored after hydration; never write defaults on mount.
    setValue(restored);
  }, [name]);

  const update = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const next = typeof action === 'function'
      ? (action as (previous: T) => T)(current.current) : action;
    current.current = next;
    setValue(next);
    try {
      const cookie = createFilterCookie(name, next, window.location.protocol === 'https:');
      if (cookie) document.cookie = cookie;
    } catch {}
  }, [name]);

  return [value, update];
}

// Keep existing per-field setters while storing each table's filters in one cookie.
export function useCardFilterFields<T extends Record<string, string>>(name: string, defaults: T) {
  const [values, setValues] = useCardFilterCookie(name, defaults);
  const fieldSetters = useMemo(() => Object.fromEntries(Object.keys(values).map((key) => [
    key,
    (action: SetStateAction<string>) => setValues((previous) => ({
      ...previous,
      [key]: typeof action === 'function' ? action(previous[key]) : action,
    })),
  ])) as Record<keyof T, Dispatch<SetStateAction<string>>>, [setValues]);
  return useMemo(() => Object.fromEntries(Object.keys(values).map((key) => [
    key,
    [values[key], fieldSetters[key as keyof T]],
  ])) as unknown as { [K in keyof T]: [T[K], Dispatch<SetStateAction<T[K]>>] }, [values, fieldSetters]);
}
