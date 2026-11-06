import {
  addDays,
  addMonths,
  addYears,
  asIsoDate,
  daysInMonth,
  differenceInDays,
  endOfMonth,
  formatDateBR,
  formatMonthYear,
  InvalidDateError,
  isIsoDate,
  isLeapYear,
  isValidTimeZone,
  isWithinRange,
  parseDateBR,
  startOfMonth,
  todayIn,
} from './iso-date';

const d = asIsoDate;

describe('validação', () => {
  it.each(['2026-02-28', '2024-02-29', '2026-12-31'])('aceita %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-04-31', '26-01-01', '2026-1-1', ''])(
    'rejeita %s',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );

  it('asIsoDate lança erro em data inválida', () => {
    expect(() => asIsoDate('2026-02-30')).toThrow(InvalidDateError);
  });
});

describe('anos bissextos', () => {
  it.each([
    [2024, true],
    [2026, false],
    [1900, false],
    [2000, true],
  ])('%i bissexto = %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it('fevereiro tem 29 dias em ano bissexto', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
});

describe('formatação pt-BR', () => {
  it('formata como DD/MM/AAAA', () => {
    expect(formatDateBR(d('2026-03-01'))).toBe('01/03/2026');
  });

  it('converte DD/MM/AAAA para ISO', () => {
    expect(parseDateBR('01/03/2026')).toBe('2026-03-01');
    expect(parseDateBR('29/02/2024')).toBe('2024-02-29');
  });

  it('rejeita datas inexistentes', () => {
    expect(parseDateBR('29/02/2026')).toBeNull();
    expect(parseDateBR('2026-03-01')).toBeNull();
  });

  it('formata mês/ano por extenso', () => {
    expect(formatMonthYear(d('2026-03-15'))).toBe('março de 2026');
  });
});

describe('aritmética de calendário', () => {
  it('soma dias atravessando virada de mês e ano', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28');
    expect(addDays(d('2024-02-28'), 1)).toBe('2024-02-29');
  });

  it('soma meses ajustando ao fim do mês', () => {
    expect(addMonths(d('2026-01-31'), 1)).toBe('2026-02-28');
    expect(addMonths(d('2024-01-31'), 1)).toBe('2024-02-29');
    expect(addMonths(d('2026-03-31'), 1)).toBe('2026-04-30');
    expect(addMonths(d('2026-11-15'), 3)).toBe('2027-02-15');
    expect(addMonths(d('2026-01-15'), -2)).toBe('2025-11-15');
  });

  it('parcelas mensais a partir do dia 31 não "derivam" de dia', () => {
    const start = d('2026-01-31');
    const dates = Array.from({ length: 4 }, (_, i) => addMonths(start, i));
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('soma anos a partir de 29/02', () => {
    expect(addYears(d('2024-02-29'), 1)).toBe('2025-02-28');
    expect(addYears(d('2024-02-29'), 4)).toBe('2028-02-29');
  });

  it('calcula diferença em dias ignorando horário de verão', () => {
    expect(differenceInDays(d('2026-03-01'), d('2026-02-01'))).toBe(28);
    expect(differenceInDays(d('2018-11-05'), d('2018-11-03'))).toBe(2);
  });

  it('início, fim e intervalo de mês', () => {
    expect(startOfMonth(d('2024-02-17'))).toBe('2024-02-01');
    expect(endOfMonth(d('2024-02-17'))).toBe('2024-02-29');
    expect(isWithinRange(d('2026-05-31'), d('2026-05-01'), d('2026-05-31'))).toBe(true);
    expect(isWithinRange(d('2026-06-01'), d('2026-05-01'), d('2026-05-31'))).toBe(false);
  });
});

describe('fuso horário', () => {
  it('calcula "hoje" no fuso informado, não em UTC', () => {
    // 02:30 UTC de 01/03 ainda é 28/02 em São Paulo (UTC-3).
    const instant = new Date('2026-03-01T02:30:00Z');
    expect(todayIn('America/Sao_Paulo', instant)).toBe('2026-02-28');
    expect(todayIn('UTC', instant)).toBe('2026-03-01');
  });

  it('valida identificadores IANA', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
