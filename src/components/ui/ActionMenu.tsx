'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

const ACTION_MENU_ITEM_CLASS =
  'relative z-10 w-full text-left px-4 py-2.5 text-sm text-text-primary transition-colors duration-150 ease-out hover:text-primary';

const ACTION_MENU_ITEM_DISABLED_CLASS =
  'relative z-10 w-full text-left px-4 py-2.5 text-sm text-text-muted cursor-not-allowed';

export type ActionMenuItem = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
};

type ActionMenuAlign = 'left' | 'right';

type MenuHighlight = { top: number; height: number };

interface ActionMenuProps {
  trigger: React.ReactNode | ((props: { isOpen: boolean; toggle: () => void }) => React.ReactNode);
  items: ActionMenuItem[];
  align?: ActionMenuAlign;
  width?: string;
  className?: string;
  menuClassName?: string;
  header?: React.ReactNode;
  /** When true, render a fixed backdrop behind the panel (helps click-outside on layered UIs). */
  useBackdrop?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ActionMenu({
  trigger,
  items,
  align = 'right',
  width = 'w-56',
  className = '',
  menuClassName = '',
  header,
  useBackdrop = true,
  isOpen: controlledOpen,
  onOpenChange,
}: ActionMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const toggle = useCallback(() => setOpen(!isOpen), [isOpen, setOpen]);

  const [highlight, setHighlight] = useState<MenuHighlight | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuListRef = useRef<HTMLDivElement>(null);

  const clearHighlight = useCallback(() => setHighlight(null), []);

  const updateHighlightFromButton = useCallback(
    (button: HTMLButtonElement) => {
      if (button.disabled) {
        clearHighlight();
        return;
      }
      const list = menuListRef.current;
      if (!list) return;
      const listRect = list.getBoundingClientRect();
      const btnRect = button.getBoundingClientRect();
      setHighlight({
        top: btnRect.top - listRect.top,
        height: btnRect.height,
      });
    },
    [clearHighlight]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        clearHighlight();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, clearHighlight, setOpen]);

  useEffect(() => {
    if (!isOpen) clearHighlight();
  }, [isOpen, clearHighlight]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        clearHighlight();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setOpen, clearHighlight]);

  const runAction = (item: ActionMenuItem) => {
    if (item.disabled || !item.onClick) return;
    item.onClick();
    setOpen(false);
    clearHighlight();
  };

  const triggerNode =
    typeof trigger === 'function' ? trigger({ isOpen, toggle }) : trigger;

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div className={`relative ${isOpen ? 'z-[100]' : ''} ${className}`} ref={menuRef}>
      {triggerNode}

      {isOpen && (
        <>
          {useBackdrop && (
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          )}
          <div
            className={`absolute ${alignClass} mt-2 ${width} rounded-lg shadow-lg bg-background-card border border-border z-50 overflow-hidden ${menuClassName}`}
          >
            {header}
            <div ref={menuListRef} className="relative py-1" role="menu" onMouseLeave={clearHighlight}>
              <div
                aria-hidden
                className="absolute left-1.5 right-1.5 rounded-md pointer-events-none bg-primary/20 shadow-[inset_0_0_0_1px_rgba(0,194,224,0.35)] transition-[top,height,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  top: highlight?.top ?? 0,
                  height: highlight?.height ?? 0,
                  opacity: highlight ? 1 : 0,
                }}
              />
              {items.map((item, index) => (
                <button
                  key={`${item.label}-${index}`}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => runAction(item)}
                  onMouseEnter={(e) =>
                    item.disabled ? clearHighlight() : updateHighlightFromButton(e.currentTarget)
                  }
                  className={
                    item.disabled
                      ? ACTION_MENU_ITEM_DISABLED_CLASS
                      : `${ACTION_MENU_ITEM_CLASS}${item.icon ? ' flex items-center gap-3' : ''}`
                  }
                  role="menuitem"
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
