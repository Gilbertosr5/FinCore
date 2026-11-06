import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/errors';
import { applyApiFieldErrors } from '@/lib/forms/apply-field-errors';

import { isAuthError } from '../../domain/errors/auth-error';
import { PASSWORD_POLICY_DESCRIPTION } from '../../domain/rules/credentials.rules';
import { AuthPageHeader } from '../components/AuthPageHeader';
import { DevAuthNotice } from '../components/DevAuthNotice';
import { useRegister } from '../hooks/use-auth';
import { registerSchema, type RegisterFormValues } from '../schemas/auth.schemas';

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const;

export function RegisterPage() {
  const navigate = useNavigate();
  const registerAccount = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ name, email, password }) => {
    registerAccount.mutate(
      { name, email, password },
      {
        onSuccess: (user) => {
          toast.success(
            `Bem-vindo(a), ${user.name.split(' ')[0] ?? user.name}! Sua conta foi criada.`,
          );
          void navigate(ROUTES.dashboard, { replace: true });
        },
        onError: (error) => {
          if (isAuthError(error, 'email_already_registered')) {
            setError('email', { type: 'server', message: error.message });
            return;
          }
          applyApiFieldErrors(error, setError, FIELDS);
        },
      },
    );
  });

  const showGeneralError =
    registerAccount.isError && !isAuthError(registerAccount.error, 'email_already_registered');

  return (
    <div className="flex flex-col gap-6">
      <AuthPageHeader
        title="Criar conta"
        description="Comece a organizar sua vida financeira em poucos minutos."
      />

      <DevAuthNotice>
        <p className="mt-1">Contas criadas aqui existem apenas até recarregar a página.</p>
      </DevAuthNotice>

      {showGeneralError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{getErrorMessage(registerAccount.error)}</AlertDescription>
        </Alert>
      )}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="Nome completo" error={errors.name?.message}>
          {(control) => <Input {...control} {...register('name')} autoComplete="name" />}
        </FormField>

        <FormField label="E-mail" error={errors.email?.message}>
          {(control) => (
            <Input
              {...control}
              {...register('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="voce@exemplo.com"
            />
          )}
        </FormField>

        <FormField
          label="Senha"
          error={errors.password?.message}
          description={PASSWORD_POLICY_DESCRIPTION}
        >
          {(control) => (
            <PasswordInput {...control} {...register('password')} autoComplete="new-password" />
          )}
        </FormField>

        <FormField label="Confirmar senha" error={errors.confirmPassword?.message}>
          {(control) => (
            <PasswordInput
              {...control}
              {...register('confirmPassword')}
              autoComplete="new-password"
            />
          )}
        </FormField>

        <Button type="submit" size="lg" disabled={registerAccount.isPending} className="mt-2">
          {registerAccount.isPending && <Spinner />}
          {registerAccount.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
