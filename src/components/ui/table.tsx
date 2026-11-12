import { useEffect, useRef, useState, type ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** A tabela rola na horizontal (tela estreita)? Reavaliado quando o tamanho muda. */
function useHorizontalScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => {
      setScrollable(element.scrollWidth > element.clientWidth + 1);
    };
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
    // Reavalia ao trocar a variante do contêiner (o elemento observado muda).
  }, [scrollable]);
  return { ref, scrollable };
}

interface TableProps extends ComponentProps<'table'> {
  /** Nome da área rolável anunciado por leitores de tela (quando a tabela rola). */
  scrollLabel?: string;
}

export function Table({
  className,
  scrollLabel = 'Tabela com rolagem horizontal',
  ...props
}: TableProps) {
  const { ref, scrollable } = useHorizontalScroll();
  const content = <table className={cn('w-full caption-bottom text-sm', className)} {...props} />;
  const containerClass = 'relative w-full overflow-x-auto rounded-[inherit] outline-none';
  // Quando rola na horizontal, o contêiner vira uma região nomeada e focável para
  // ser acessível pelo teclado (WCAG 2.1.1); caso contrário, é um contêiner comum.
  return scrollable ? (
    <div
      ref={ref}
      data-slot="table-container"
      role="region"
      aria-label={scrollLabel}
      tabIndex={0}
      className={cn(containerClass, 'focus-visible:ring-2 focus-visible:ring-ring')}
    >
      {content}
    </div>
  ) : (
    <div ref={ref} data-slot="table-container" className={containerClass}>
      {content}
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-border bg-muted/50 [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('border-b border-border transition-colors hover:bg-muted/50', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
}
