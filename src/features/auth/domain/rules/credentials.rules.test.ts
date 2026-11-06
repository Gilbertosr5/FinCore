import {
  getPasswordIssues,
  isValidEmail,
  isValidName,
  normalizeEmail,
  normalizeName,
} from './credentials.rules';
import { getUserInitials } from '../entities/user';

describe('política de senha', () => {
  it('aceita senha com 8+ caracteres, letras e números', () => {
    expect(getPasswordIssues('senhaF0rte')).toEqual([]);
    expect(getPasswordIssues('ação1234')).toEqual([]);
  });

  it.each([
    ['abc1', ['too_short']],
    ['abcdefgh', ['missing_number']],
    ['12345678', ['missing_letter']],
    ['', ['too_short', 'missing_letter', 'missing_number']],
    [`a1${'x'.repeat(127)}`, ['too_long']],
  ])('"%s" => %o', (password, issues) => {
    expect(getPasswordIssues(password)).toEqual(issues);
  });
});

describe('e-mail', () => {
  it('normaliza espaços e maiúsculas', () => {
    expect(normalizeEmail('  Ana.Silva@Exemplo.COM ')).toBe('ana.silva@exemplo.com');
  });

  it.each(['ana@exemplo.com', 'a.b+tag@sub.dominio.com.br', ' ANA@EXEMPLO.COM '])(
    'aceita %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each(['ana', 'ana@', '@exemplo.com', 'ana@exemplo', 'ana silva@exemplo.com', 'a@b.c'])(
    'rejeita %s',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});

describe('nome', () => {
  it('normaliza espaços e valida tamanho', () => {
    expect(normalizeName('  Ana   Maria  ')).toBe('Ana Maria');
    expect(isValidName(' A ')).toBe(false);
    expect(isValidName('Ana')).toBe(true);
  });

  it('gera iniciais para avatar', () => {
    expect(getUserInitials('Ana Maria Souza')).toBe('AS');
    expect(getUserInitials('ana')).toBe('A');
    expect(getUserInitials('   ')).toBe('?');
  });
});
