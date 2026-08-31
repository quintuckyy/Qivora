import type { ReactNode } from 'react';
import { BriefcaseIcon, FileIcon, StarIcon, TrendingUpIcon } from '../icons';

const BENEFITS: { icon: ReactNode; title: string }[] = [
  { icon: <FileIcon width={18} height={18} />, title: 'Keep tailored versions' },
  { icon: <BriefcaseIcon width={18} height={18} />, title: 'See where each is used' },
  { icon: <TrendingUpIcon width={18} height={18} />, title: 'Track what performs' },
  { icon: <StarIcon width={18} height={18} />, title: 'Set a default' },
];

export function ResumesEmptyState({ uploadAction }: { uploadAction: ReactNode }) {
  return (
    <section className="card resumes-empty">
      <span className="resumes-empty-icon" aria-hidden="true">
        <FileIcon width={26} height={26} />
      </span>
      <h2>Build your resume library</h2>
      <p className="muted resumes-empty-lead">
        Upload the different versions of your resume then track how each one
        performs across your applications.
      </p>

      <ul className="resumes-empty-benefits">
        {BENEFITS.map((benefit) => (
          <li key={benefit.title}>
            <span className="resumes-empty-benefit-icon" aria-hidden="true">
              {benefit.icon}
            </span>
            <strong>{benefit.title}</strong>
          </li>
        ))}
      </ul>

      {uploadAction}
    </section>
  );
}
