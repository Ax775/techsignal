import type { TechCategory } from '../types';

interface TechBadgeProps {
  tech: string;
  category: TechCategory;
}

// Border + text only — no fill. Color encodes the category.
const CATEGORY_STYLES: Record<TechCategory, string> = {
  ecommerce: 'border-violet-700 text-violet-400',
  martech: 'border-orange-700 text-orange-400',
  infrastructure: 'border-sky-700 text-sky-400',
  analytics: 'border-emerald-700 text-emerald-400',
  cms: 'border-slate-600 text-slate-400',
};

export default function TechBadge({ tech, category }: TechBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${CATEGORY_STYLES[category]}`}
      title={category}
    >
      {tech}
    </span>
  );
}
