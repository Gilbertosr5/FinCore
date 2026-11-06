import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { NavigationItem } from '@/constants/navigation';
import { cn } from '@/lib/utils';

import { filterNavigation } from './filter-navigation';

/**
 * Busca global (Ctrl/⌘ + K). Nesta fase pesquisa os módulos da aplicação; a
 * busca de lançamentos, contas e ativos é incorporada conforme os módulos são
 * entregues.
 */
export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const listId = useId();

  const results = useMemo(() => filterNavigation(query), [query]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      setActiveIndex(0);
    }
  };

  const go = (item: NavigationItem) => {
    handleOpenChange(false);
    void navigate(item.path);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) go(item);
    }
  };

  const activeItem = results[activeIndex];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Buscar"
        aria-keyshortcuts="Control+K Meta+K"
        className="h-9 gap-2 text-muted-foreground max-sm:size-9 max-sm:border-0 max-sm:px-0 sm:w-44 sm:justify-start lg:w-56"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Search aria-hidden="true" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 text-[10px] font-medium lg:inline">
          Ctrl K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="top-[20%] max-w-xl translate-y-0 gap-0 p-0"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <DialogDescription className="sr-only">
            Digite para filtrar e use as setas para navegar. Enter abre o item selecionado.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search aria-hidden="true" className="size-4 text-muted-foreground" />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeItem ? `${listId}-${activeItem.id}` : undefined}
              aria-label="Buscar módulos"
              placeholder="Buscar módulos…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
            />
          </div>
          {results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              description={`Nada encontrado para "${query}".`}
            />
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Resultados"
              className="max-h-80 overflow-y-auto p-2"
            >
              {results.map((item, index) => {
                const Icon = item.icon;
                const active = index === activeIndex;
                return (
                  <li
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                      active && 'bg-accent text-accent-foreground',
                    )}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                    tabIndex={-1}
                    onClick={() => {
                      go(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') go(item);
                    }}
                  >
                    <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                    <span className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    {active && (
                      <CornerDownLeft
                        aria-hidden="true"
                        className="ml-auto size-4 text-muted-foreground"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
