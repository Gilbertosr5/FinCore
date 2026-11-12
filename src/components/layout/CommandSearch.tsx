import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { NAVIGATION_ITEMS } from '@/constants/navigation';
import { cn } from '@/lib/utils';

import { useCommandSearchSource, type SearchResultItem } from './command-search-source';
import { filterNavigation } from './filter-navigation';

/** Espera após a última tecla antes de consultar as entidades. */
const SEARCH_DELAY_MS = 200;

interface ResultEntry {
  key: string;
  label: string;
  description: string;
  href: string;
  module: string;
}

const iconOf = (module: string) =>
  NAVIGATION_ITEMS.find((item) => item.id === module)?.icon ?? Search;

/**
 * Busca global (Ctrl/⌘ + K): módulos da aplicação e, quando há uma fonte de
 * busca (camada de aplicação), lançamentos, contas, cartões, metas, ativos e
 * orçamentos.
 */
export function CommandSearch() {
  const source = useCommandSearchSource();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // Resposta mais recente da busca de entidades, com o termo a que se refere.
  const [answer, setAnswer] = useState<{ term: string; items: SearchResultItem[] }>({
    term: '',
    items: [],
  });
  const navigate = useNavigate();
  const listId = useId();

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

  const term = query.trim();
  const shouldSearch = source !== null && term.length >= 2;
  const entities = useMemo(
    () => (shouldSearch && answer.term === term ? answer.items : []),
    [shouldSearch, answer, term],
  );
  const searching = shouldSearch && answer.term !== term;

  // Consulta as entidades com atraso curto; respostas de termos antigos são descartadas.
  useEffect(() => {
    if (!source || term.length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      void source
        .search(term)
        .catch(() => [])
        .then((items) => {
          if (current) setAnswer({ term, items });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [term, source]);

  const results = useMemo<ResultEntry[]>(
    () => [
      ...filterNavigation(query).map((item) => ({
        key: `module:${item.id}`,
        label: item.label,
        description: item.description,
        href: item.path,
        module: item.id,
      })),
      ...entities.map((item) => ({ ...item, key: item.id })),
    ],
    [query, entities],
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      setActiveIndex(0);
    }
  };

  const go = (entry: ResultEntry) => {
    handleOpenChange(false);
    void navigate(entry.href);
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
      const entry = results[activeIndex];
      if (entry) go(entry);
    }
  };

  const activeEntry = results[Math.min(activeIndex, results.length - 1)];
  const optionId = (entry: ResultEntry) => `${listId}-${entry.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

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
            Pesquise módulos, lançamentos, contas, cartões, metas, investimentos e orçamentos. Use
            as setas para navegar e Enter para abrir.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search aria-hidden="true" className="size-4 text-muted-foreground" />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeEntry ? optionId(activeEntry) : undefined}
              aria-label="Buscar"
              placeholder="Buscar módulos, lançamentos, contas…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
            />
            {searching && <Spinner />}
          </div>
          {results.length === 0 ? (
            searching ? (
              <p role="status" className="p-6 text-center text-sm text-muted-foreground">
                Buscando…
              </p>
            ) : (
              <EmptyState
                icon={Search}
                title="Nenhum resultado"
                description={`Nada encontrado para "${query}".`}
              />
            )
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Resultados"
              className="max-h-80 overflow-y-auto p-2"
            >
              {results.map((entry, index) => {
                const Icon = iconOf(entry.module);
                const active = entry === activeEntry;
                return (
                  <li
                    key={entry.key}
                    id={optionId(entry)}
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
                      go(entry);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') go(entry);
                    }}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{entry.label}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.description}
                      </span>
                    </span>
                    {active && (
                      <CornerDownLeft
                        aria-hidden="true"
                        className="ml-auto size-4 shrink-0 text-muted-foreground"
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
