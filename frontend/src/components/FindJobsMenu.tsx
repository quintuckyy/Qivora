import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { ExternalLinkIcon, SearchIcon } from './icons';
import indeedLogo from '../assets/logos/indeed.svg';
import jobStreetLogo from '../assets/logos/jobstreet.png';
import linkedInLogo from '../assets/logos/linkedin.svg';

interface JobPlatform {
  name: string;
  url: string;
  logo: string;
}

// Locale-targeted where the platform is region-split (this tracker's users are
// PH-based); LinkedIn serves one global jobs surface.
const JOB_PLATFORMS: JobPlatform[] = [
  { name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/', logo: linkedInLogo },
  { name: 'JobStreet', url: 'https://ph.jobstreet.com/', logo: jobStreetLogo },
  { name: 'Indeed', url: 'https://ph.indeed.com/', logo: indeedLogo },
];

/** Dashboard CTA: opens a popover of supported job platforms, each launching
 * in a new tab. Manual application creation lives on the Applications page. */
export function FindJobsMenu() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;

    // Move focus into the popover so arrow keys / Enter work immediately.
    itemRefs.current[0]?.focus();

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function focusItem(index: number) {
    const count = JOB_PLATFORMS.length;
    itemRefs.current[((index % count) + count) % count]?.focus();
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(JOB_PLATFORMS.length - 1);
        break;
    }
  }

  // Close when focus tabs out of the popover entirely (keyboard exit).
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && rootRef.current && !rootRef.current.contains(next)) {
      setOpen(false);
    }
  }

  return (
    <div className="find-jobs" ref={rootRef} onBlur={handleBlur}>
      <button
        type="button"
        ref={triggerRef}
        className="btn btn-primary find-jobs-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <SearchIcon className="find-jobs-search" />
        Find jobs
      </button>

      {open && (
        <ul className="find-jobs-menu" id={menuId} role="menu" aria-label="Job platforms">
          {JOB_PLATFORMS.map((platform, index) => (
            <li key={platform.name} role="none">
              <a
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="menuitem"
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="find-jobs-item"
                onClick={() => setOpen(false)}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
              >
                <img className="find-jobs-logo" src={platform.logo} alt="" width={26} height={26} />
                {platform.name}
                <ExternalLinkIcon className="find-jobs-ext" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
