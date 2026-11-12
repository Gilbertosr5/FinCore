import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: [singular: string, plural: string];
}

export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
  itemLabel = ['item', 'itens'],
}: PaginationProps) {
  return (
    <nav
      aria-label="Paginação"
      className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row"
    >
      <p className="text-muted-foreground">
        {total} {total === 1 ? itemLabel[0] : itemLabel[1]}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" />
            Anterior
          </Button>
          <span aria-live="polite" className="tabular-nums">
            Página {page} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => {
              onPageChange(page + 1);
            }}
          >
            Próxima
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}
