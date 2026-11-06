import { z } from 'zod';

import {
  EMAIL_MAX_LENGTH,
  getPasswordIssues,
  isValidEmail,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_ISSUE_MESSAGES,
} from '../../domain/rules/credentials.rules';

/**
 * Schemas de formulário. Reutilizam as regras do domínio (credentials.rules)
 * para não duplicar a política de senha e e-mail.
 */

const emailField = z
  .string()
  .trim()
  .min(1, 'Informe seu e-mail.')
  .max(EMAIL_MAX_LENGTH, 'E-mail muito longo.')
  .refine(isValidEmail, 'Informe um e-mail válido.');

const strongPasswordField = z.string().superRefine((password, ctx) => {
  const [issue] = getPasswordIssues(password);
  if (issue) ctx.addIssue({ code: 'custom', message: PASSWORD_ISSUE_MESSAGES[issue] });
});

const PASSWORD_MISMATCH = { message: 'As senhas não coincidem.', path: ['confirmPassword'] };

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Informe sua senha.'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(NAME_MIN_LENGTH, 'Informe seu nome completo.')
      .max(NAME_MAX_LENGTH, `Use no máximo ${NAME_MAX_LENGTH} caracteres.`),
    email: emailField,
    password: strongPasswordField,
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, PASSWORD_MISMATCH);
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: strongPasswordField,
    confirmPassword: z.string().min(1, 'Confirme sua nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, PASSWORD_MISMATCH);
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe sua senha atual.'),
    newPassword: strongPasswordField,
    confirmPassword: z.string().min(1, 'Confirme sua nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, PASSWORD_MISMATCH)
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da atual.',
    path: ['newPassword'],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
