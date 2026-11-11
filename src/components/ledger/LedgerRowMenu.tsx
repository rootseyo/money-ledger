'use client';

import { useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export default function LedgerRowMenu({ label, actions, disabled }: {
  label: string; disabled?: boolean;
  actions: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <div className="ledger-row-menu">
    <button ref={trigger} type="button" className="ledger-row-menu-trigger" aria-label={`${label} 메뉴`} aria-haspopup="menu" aria-expanded={open} popoverTarget={id} disabled={disabled}
      onClick={() => {
        const rect = trigger.current!.getBoundingClientRect();
        const height = actions.length * 38 + 12;
        Object.assign(menu.current!.style, {
          top: `${rect.bottom + height > window.innerHeight ? Math.max(8, rect.top - height) : rect.bottom + 4}px`,
          left: `${Math.max(8, Math.min(rect.right - 170, window.innerWidth - 178))}px`,
        });
      }}><MoreHorizontal size={18}/></button>
    <div ref={menu} id={id} popover="auto" role="menu" aria-label={`${label} 메뉴`} className="ledger-row-menu-popover"
      onToggle={event => {
        const expanded = event.newState === 'open';
        setOpen(expanded);
        if (expanded) menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }}
      onKeyDown={event => {
        const buttons = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus();
        } else if (event.key === 'Escape' || event.key === 'Tab') {
          menu.current?.hidePopover();
          if (event.key === 'Escape') { event.preventDefault(); trigger.current?.focus(); }
        }
      }}>
      {actions.map(action => <button key={action.label} role="menuitem" type="button" className={action.danger ? 'is-danger' : ''} onClick={() => {
        menu.current?.hidePopover(); trigger.current?.focus(); action.onClick();
      }}>{action.label}</button>)}
    </div>
  </div>;
}
