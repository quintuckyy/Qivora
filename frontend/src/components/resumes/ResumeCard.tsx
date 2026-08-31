import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Resume } from '../../api/types';
import {
  BriefcaseIcon,
  CheckCircleIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  MoreVerticalIcon,
  PencilIcon,
  StarFilledIcon,
  StarIcon,
  TrashIcon,
  TrendingUpIcon,
} from '../icons';
import { fileTypeLabel, formatDate, formatFileSize } from './fileMeta';

interface ResumeCardProps {
  resume: Resume;
  downloading: boolean;
  settingDefault: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onRename: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

export function ResumeCard({
  resume,
  downloading,
  settingDefault,
  onPreview,
  onDownload,
  onRename,
  onSetDefault,
  onDelete,
}: ResumeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const { metrics } = resume;
  const used = resume.applicationCount > 0;

  return (
    <article className={`resume-card${resume.isDefault ? ' resume-card-default' : ''}`}>
      <header className="resume-card-head">
        <span className="resume-card-fileicon" aria-hidden="true">
          <FileIcon />
        </span>
        <div className="resume-card-titles">
          <div className="resume-card-name-row">
            <h2 className="resume-card-name">{resume.name}</h2>
            {resume.isDefault && (
              <span className="resume-badge-default">
                <StarFilledIcon width={12} height={12} />
                Default
              </span>
            )}
          </div>
          <p className="resume-card-meta">
            <span className="resume-card-filename" title={resume.originalName}>
              {resume.originalName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="resume-card-type">{fileTypeLabel(resume.mimeType, resume.originalName)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatFileSize(resume.size)}</span>
          </p>
        </div>

        <div className="resume-card-menu" ref={menuRef}>
          <button
            type="button"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${resume.name}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVerticalIcon />
          </button>
          {menuOpen && (
            <ul className="menu-popover" role="menu">
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onRename();
                  }}
                >
                  <PencilIcon width={15} height={15} />
                  Rename
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  disabled={resume.isDefault || settingDefault}
                  onClick={() => {
                    setMenuOpen(false);
                    onSetDefault();
                  }}
                >
                  <StarIcon width={15} height={15} />
                  {resume.isDefault ? 'Current default' : 'Set as default'}
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item menu-item-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <TrashIcon width={15} height={15} />
                  Delete
                </button>
              </li>
            </ul>
          )}
        </div>
      </header>

      <dl className="resume-metrics">
        <div className="resume-metric">
          <dt>
            <BriefcaseIcon width={15} height={15} />
            Applications
          </dt>
          <dd>{metrics.applications}</dd>
        </div>
        <div className="resume-metric">
          <dt>
            <TrendingUpIcon width={15} height={15} />
            Interviews
          </dt>
          <dd>{metrics.interviews}</dd>
        </div>
        <div className="resume-metric">
          <dt>
            <CheckCircleIcon width={15} height={15} />
            Offers
          </dt>
          <dd>{metrics.offers}</dd>
        </div>
      </dl>

      <p className="resume-card-usage">
        {used ? (
          <>
            Used by{' '}
            <Link to={`/applications?resume=${resume.id}`}>
              {resume.applicationCount}{' '}
              {resume.applicationCount === 1 ? 'application' : 'applications'}
            </Link>
          </>
        ) : (
          'Not assigned to any application yet'
        )}
        <span aria-hidden="true"> · </span>
        <span className="muted">Updated {formatDate(resume.updatedAt)}</span>
      </p>

      <footer className="resume-card-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onPreview}>
          <EyeIcon width={15} height={15} />
          Preview
        </button>
        <Link
          to={`/applications?resume=${resume.id}`}
          className={`btn btn-secondary btn-sm${used ? '' : ' btn-disabled'}`}
          aria-disabled={used ? undefined : true}
          onClick={(e) => {
            if (!used) e.preventDefault();
          }}
        >
          <BriefcaseIcon width={15} height={15} />
          View applications
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onDownload}
          disabled={downloading}
        >
          <DownloadIcon width={15} height={15} />
          {downloading ? 'Downloading…' : 'Download'}
        </button>
      </footer>
    </article>
  );
}
