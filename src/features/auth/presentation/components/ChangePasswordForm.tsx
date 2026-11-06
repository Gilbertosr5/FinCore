import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/lib/errors';
import { applyApiFieldErrors } from '@/lib/forms/apply-field-errors';

import { isAuthError } from '../../domain/errors/auth-error';
import { PASSWORD_POLICY_DESCRIPTION } from '../../domain/rules/credentials.rules';
import { useChangePassword } from '../hooks/use-auth';
import { changePasswordSchema, type ChangePasswordFormValues } from '../schemas/auth.schemas';

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;
const EMPTY: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          reset(EMPTY);
          toast.success('Senha alterada com sucesso.');
        },
        onError: (error) => {
          if (isAuthError(error, 'invalid_current_password')) {
            setError('currentPassword', { type: 'server', message: error.message });
            return;
          }
          if (!applyApiFieldErrors(error, setError, FIELDS)) {
            toast.error(getErrorMessage(error));
          }
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <FormField label="Senha atual" error={errors.currentPassword?.message}>
        {(control) => (
          <PasswordInput
            {...control}
            {...register('currentPassword')}
            autoComplete="current-password"
          />
        )}
      </FormField>
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
      <Button type="submit" className="w-fit" disabled={changePassword.isPending}>
        {changePassword.isPending && <Spinner />}
        Alterar senha
      </Button>
    </form>
  );
}
