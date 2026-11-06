# ADR 0004 — Datas de calendário e fuso horário

- **Status:** Aceito
- **Data:** 05/11/2026

## Contexto

Datas de competência, vencimento e pagamento são **datas de calendário**, não
instantes. O uso de `new Date('2026-03-01')` (interpretado como UTC) seguido de
exibição em horário local (UTC−3) transforma 01/03 em 28/02 — um bug clássico.

## Decisão

- Datas de calendário são do tipo **`IsoDate`**: string `"YYYY-MM-DD"` com
  _brand_ de tipo, validada (`asIsoDate`, `isIsoDate`). Sem hora, sem fuso.
- Aritmética de calendário (`addDays`, `addMonths`, `addYears`,
  `differenceInDays`, `startOfMonth`, `endOfMonth`) opera sobre componentes
  ano/mês/dia usando somente métodos UTC internamente — independente do fuso
  da máquina e imune a horário de verão.
- `addMonths` **ajusta ao fim do mês** (31/01 + 1 mês = 28/02 ou 29/02) e calcula
  sempre a partir da data original, então parcelas não "derivam" de dia
  (31/01 → 28/02 → 31/03 → 30/04).
- "Hoje" é sempre `todayIn(timeZone)`, com fuso IANA explícito
  (padrão `America/Sao_Paulo`, configurável em `VITE_DEFAULT_TIMEZONE` e, na
  Fase 2+, nas preferências do usuário).
- Formatação de exibição: `DD/MM/AAAA` (`formatDateBR`) e mês por extenso com
  `date-fns` + locale `ptBR`.
- **Instantes** (ex.: `createdAt`, auditoria) são strings ISO 8601 com offset,
  tratadas separadamente.
- Os testes rodam com `TZ=America/Sao_Paulo` fixo para determinismo.

## Consequências

- Comparar datas é comparação de strings (formato de largura fixa).
- O backend deve usar `LocalDate` para esses campos e `OffsetDateTime`/`Instant`
  para instantes.
