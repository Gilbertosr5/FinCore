import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/errors';

import { isAuthError } from '../../domain/errors/auth-error';
import { PASSWORD_POLICY_DESCRIPTION } from '../../domain/rules/credentials.rules';
import { AuthPageHeader } from '../components/AuthPageHeader';
import { useResetPassword } from '../hooks/use-auth';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas/auth.schemas';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const resetPassword = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ newPassword }) => {
    resetPassword.mutate({ token, newPassword });
  });

  const invalidToken = token === '' || isAuthError(resetPassword.error, 'invalid_reset_token');

  if (resetPassword.isSuccess) {
    return (
      <div className="flex flex-col gap-6">
        <AuthPageHeader title="Senha redefinida" />
        <Alert variant="success">
          <CircleCheck aria-hidden="true" />
          <AlertDescription>
            Sua senha foi alterada. Por segurança, sessões anteriores foram encerradas.
          </AlertDescription>
        </Alert>
        <Button asChild size="lg">
          <Link to={ROUTES.login}>Entrar com a nova senha</Link>
        </Button>
      </div>
    );
  }

  if (invalidToken) {
    return (
      <div className="flex flex-col gap-6">
        <AuthPageHeader title="Link inválido" />
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Não foi possível redefinir a senha</AlertTitle>
          <AlertDescription>
            O link de redefinição é inválido, já foi utilizado ou expirou.
          </AlertDescription>
        </Alert>
        <Button asChild size="lg">
          <Link to={ROUTES.forgotPassword}>Solicitar novo link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AuthPageHeader
        title="Redefinir senha"
        description="Escolha uma nova senha para sua conta."
      />

      {resetPassword.isError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{getErrorMessage(resetPassword.error)}</AlertDescription>
        </Alert>
      )}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          label="Nova senha"
          error={errors.newPassword?.message}
          description={PASSWORD_POLICY_DESCRIPTION}
        >
          {(control) => (
            <PasswordInput {...control} {...register('newPassword')} autoComplete="new-password" />
          )}
        </FormField>
        <FormField label="Confirmar nova senha" error={errors.confirmPassword?.message}>
          {(control) => (
            <PasswordInput
              {...control}
              {...register('confirmPassword')}
              autoComplete="new-password"
            />
          )}
        </FormField>
        <Button type="submit" size="lg" disabled={resetPassword.isPending}>
          {resetPassword.isPending && <Spinner />}
          {resetPassword.isPending ? 'Salvando…' : 'Redefinir senha'}
        </Button>
      </form>
    </div>
  );
}
