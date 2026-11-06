import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/errors';

import { AuthPageHeader } from '../components/AuthPageHeader';
import { DevAuthNotice } from '../components/DevAuthNotice';
import { useAuthServices } from '../context/auth-context';
import { useLogin } from '../hooks/use-auth';
import { loginSchema, type LoginFormValues } from '../schemas/auth.schemas';
import { getFromState, getSafeRedirectPath } from '../utils/safe-redirect';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = getFromState(location.state);
  const { demoCredentials } = useAuthServices();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => {
        void navigate(getSafeRedirectPath(from), { replace: true });
      },
    });
  });

  const fillDemoAccount = () => {
    if (!demoCredentials) return;
    setValue('email', demoCredentials.email, { shouldValidate: true });
    setValue('password', demoCredentials.password, { shouldValidate: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <AuthPageHeader title="Entrar" description="Acesse sua conta para continuar." />

      {from !== undefined && !login.isError && (
        <Alert variant="info">
          <Info aria-hidden="true" />
          <AlertDescription>Faça login para acessar esta página.</AlertDescription>
        </Alert>
      )}

      <DevAuthNotice>
        {demoCredentials && (
          <div className="mt-2 flex flex-col gap-2">
            <p>
              Conta de demonstração: <strong>{demoCredentials.email}</strong> / senha{' '}
              <strong>{demoCredentials.password}</strong>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={fillDemoAccount}
            >
              Usar conta de demonstração
            </Button>
          </div>
        )}
      </DevAuthNotice>

      {login.isError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{getErrorMessage(login.error)}</AlertDescription>
        </Alert>
      )}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
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
          labelAction={
            <Link
              to={ROUTES.forgotPassword}
              className="text-xs font-medium text-primary hover:underline"
            >
              Esqueceu a senha?
            </Link>
          }
        >
          {(control) => (
            <PasswordInput {...control} {...register('password')} autoComplete="current-password" />
          )}
        </FormField>

        <Button type="submit" size="lg" disabled={login.isPending} className="mt-2">
          {login.isPending && <Spinner />}
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link to={ROUTES.register} className="font-medium text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
