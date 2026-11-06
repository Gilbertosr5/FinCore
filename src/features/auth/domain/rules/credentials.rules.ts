/**
 * Regras de credenciais — fonte única usada pelos casos de uso (validação de
 * negócio) e pelos schemas de formulário (feedback imediato).
 * O backend deve aplicar as mesmas regras; o frontend nunca é a única barreira.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

export type PasswordIssue = 'too_short' | 'too_long' | 'missing_letter' | 'missing_number';

export const PASSWORD_ISSUE_MESSAGES: Record<PasswordIssue, string> = {
  too_short: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  too_long: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  missing_letter: 'A senha deve conter ao menos uma letra.',
  missing_number: 'A senha deve conter ao menos um número.',
};

export const PASSWORD_POLICY_DESCRIPTION = `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`;

export function getPasswordIssues(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push('too_short');
  if (password.length > PASSWORD_MAX_LENGTH) issues.push('too_long');
  if (!/\p{L}/u.test(password)) issues.push('missing_letter');
  if (!/\d/.test(password)) issues.push('missing_number');
  return issues;
}

/** E-mails são comparados sem diferenciar maiúsculas e sem espaços nas bordas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(normalized);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function isValidName(name: string): boolean {
  const normalized = normalizeName(name);
  return normalized.length >= NAME_MIN_LENGTH && normalized.length <= NAME_MAX_LENGTH;
}
