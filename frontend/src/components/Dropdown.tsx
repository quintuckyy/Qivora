import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from './icons';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  /** Shown once, muted, in front of the selected label on the trigger only
   * (e.g. "Sort: ") — kept out of `options[].label` so it isn't repeated on
   * every row of the open menu. */
  triggerPrefix?: string;
}

/** A custom-styled, single-select dropdown matching the dashboard's dark
 * glass/cyan-glow look — used in place of a plain browser `<select>` wherever
 * the filter bar needs to feel consistent with the cards and sidebar. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  triggerPrefix,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`dropdown ${className ?? ''}`} ref={rootRef}>
      <button
        type="button"
        className={`dropdown-trigger ${open ? 'dropdown-trigger-open' : ''}`}
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="dropdown-trigger-label">
          {triggerPrefix && <span className="dropdown-trigger-prefix">{triggerPrefix}</span>}
          {selected?.label ?? ''}
        </span>
        <ChevronDownIcon className={`dropdown-chevron ${open ? 'dropdown-chevron-open' : ''}`} />
      </button>

      {open && (
        <ul className="dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`dropdown-option ${isSelected ? 'dropdown-option-selected' : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className="dropdown-option-check" />
                  <span>{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
