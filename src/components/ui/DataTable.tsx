import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { EmptyState, ErrorState, LoadingState } from './StateViews';

export interface DataColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  numeric?: boolean;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  widthClass?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchPlaceholder?: string;
  searchPredicate?: (row: T, query: string) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  toolbarRight?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  isLoading = false,
  error = null,
  onRetry,
  searchPlaceholder = 'Filter records...',
  searchPredicate,
  emptyTitle = 'No matching records',
  emptyDescription = 'Adjust your filters or add a new record to populate this table.',
  emptyActionLabel,
  onEmptyAction,
  toolbarRight,
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filteredData = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    let rows = data;
    if (trimmed && searchPredicate) {
      rows = data.filter((row) => searchPredicate(row, trimmed));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        const getter = col.sortValue;
        rows = [...rows].sort((a, b) => {
          const av = getter(a);
          const bv = getter(b);
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    return rows;
  }, [data, query, searchPredicate, sortKey, sortDir, columns]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <div className="space-y-3">
      {(searchPredicate || toolbarRight) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {searchPredicate ? (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="h-4 w-4 text-[#718096] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] text-[#182238] dark:text-slate-100 placeholder:text-[#718096] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbarRight && (
            <div className="flex items-center gap-2 flex-wrap">{toolbarRight}</div>
          )}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : filteredData.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#101B35]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#223257] bg-[#F6F8FC] dark:bg-[#0E172E]">
                {columns.map((col) => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        'h-10 px-4 text-xs font-semibold text-[#718096] dark:text-slate-400 whitespace-nowrap',
                        col.align === 'right' && 'text-right',
                        col.widthClass,
                      )}
                    >
                      {col.sortable && col.sortValue ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 hover:text-[#182238] dark:hover:text-slate-100 cursor-pointer focus-visible:outline-none focus-visible:underline',
                            col.align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          <span>{col.header}</span>
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-[#4169F5]" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-[#4169F5]" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-[#223257]">
              {filteredData.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'h-10 transition-colors duration-100 hover:bg-slate-50/90 dark:hover:bg-[#162342]/70',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 text-[#182238] dark:text-slate-200 align-middle',
                        col.align === 'right' && 'text-right',
                        col.numeric && 'tabular-nums font-mono text-[13px]',
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
