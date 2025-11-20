import { ReactNode } from 'react';

export interface FilterChip {
  key: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export interface FilterBarProps {
  title?: string;
  actions?: ReactNode;
  chips?: FilterChip[];
  children?: ReactNode;
}

export function FilterBar({ title, actions, chips, children }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {title ? <h3 className="text-sm font-medium text-slate-200">{title}</h3> : null}
        {chips?.length ? (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onClick}
                className={`rounded-full border px-3 py-1 text-xs ${
                  chip.active ? 'border-amber-400 bg-amber-400/10 text-amber-100' : 'border-slate-700 text-slate-300'
                }`}
                type="button"
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}
        {children ? <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">{children}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
