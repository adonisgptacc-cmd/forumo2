import { ReactNode } from 'react';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  className?: string;
  render?: (item: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  emptyState?: ReactNode;
}

export function DataTable<T>({ columns, data, emptyState }: DataTableProps<T>) {
  if (!data.length) {
    return <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-6 text-slate-400">{emptyState ?? 'No records'}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-900/60 text-slate-300">
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className={`px-4 py-3 font-medium ${column.className ?? ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900/80 text-slate-200">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-slate-900/40">
              {columns.map((column) => (
                <td key={String(column.key)} className={`px-4 py-3 align-top ${column.className ?? ''}`}>
                  {column.render ? column.render(item) : (item as any)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
