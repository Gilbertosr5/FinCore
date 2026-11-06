import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CircleAlert, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/errors';

import { AuthPageHeader } from '../components/AuthPageHeader';
import { DevAuthNotice } from '../components/DevAuthNotice';
import { useRecoverPassword } from '../hooks/use-auth';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas/auth.schemas';

export function ForgotPasswordPage() {
  const recover = useRecoverPassword();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(({ email }) => {
    recover.mutate(email);
  });

  const backToLogin = (
    <Link
      to={ROUTES.login}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar para o login
    </Link>
  );

  if (recover.isSuccess) {
    return (
      <div className="flex flex-col gap-6">
        <AuthPageHeader title="Verifique seu e-mail" />
        <Alert variant="success">
          <MailCheck aria-hidden="true" />
          <AlertTitle>Solicitação recebida</AlertTitle>
          <AlertDescription>
            Se existir uma conta para <strong>{getValues('email')}</strong>, você receberá um link
            para redefinir sua senha. O link expira em 30 minutos.
          </AlertDescription>
        </Alert>
        <DevAuthNotice>
          <p className="mt-1">
            Sem envio de e-mail: o link de redefinição é exibido no console do navegador.
          </p>
        </DevAuthNotice>
        {backToLogin}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AuthPageHeader
        title="Recuperar senha"
        description="Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha."
      />

      {recover.isError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{getErrorMessage(recover.error)}</AlertDescription>
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
        <Button type="submit" size="lg" disabled={recover.isPending}>
          {recover.isPending && <Spinner />}
          {recover.isPending ? 'Enviando…' : 'Enviar link de redefinição'}
        </Button>
      </form>

      {backToLogin}
    </div>
  );
}
