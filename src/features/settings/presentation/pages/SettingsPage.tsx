import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

import { appConfig } from '@/app/config/app.config';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ROUTES } from '@/constants/routes';
import { ChangePasswordForm, getUserInitials, useCurrentUser, useLogout } from '@/features/auth';
import { CategoriesManager } from '@/features/transactions';

import { AppearanceSettings } from '../components/AppearanceSettings';
import { DemoDataSettings } from '../components/DemoDataSettings';
import { SettingsSection } from '../components/SettingsSection';
import { useDemoDataManager } from '../context/demo-data-context';

const UPCOMING = [
  'Moeda principal, formato de data e fuso horário',
  'Preferências de notificações',
  'Exportação dos dados e exclusão da conta (requer backend)',
  'Histórico de sessões (requer backend)',
];

export function SettingsPage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const demoData = useDemoDataManager();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SettingsSection title="Perfil" description="Dados da sua conta.">
        {user && (
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-semibold text-primary"
            >
              {getUserInitials(user.name)}
            </span>
            <dl className="grid min-w-0 gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="sr-only">Nome</dt>
                <dd className="truncate font-medium">{user.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">E-mail</dt>
                <dd className="truncate text-muted-foreground">{user.email}</dd>
              </div>
            </dl>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Categorias"
        description="Categorias de receitas e despesas usadas nos lançamentos, orçamentos e relatórios."
      >
        <CategoriesManager />
      </SettingsSection>

      <SettingsSection title="Aparência" description="Escolha o tema da interface.">
        <AppearanceSettings />
      </SettingsSection>

      <SettingsSection
        title="Segurança"
        description={
          appConfig.authAdapter === 'dev'
            ? 'Alteração de senha no adaptador de desenvolvimento (válida até recarregar a página).'
            : 'Altere sua senha de acesso.'
        }
      >
        <div className="flex flex-col gap-6">
          <ChangePasswordForm />
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Encerrar sessão</p>
              <p className="text-sm text-muted-foreground">
                Sai da sua conta neste dispositivo e remove os dados carregados.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={logout.isPending}
              onClick={() => {
                logout.mutate(undefined, {
                  onSettled: () => {
                    void navigate(ROUTES.login, { replace: true });
                  },
                });
              }}
            >
              {logout.isPending ? <Spinner /> : <LogOut aria-hidden="true" />}
              Sair da conta
            </Button>
          </div>
        </div>
      </SettingsSection>

      {demoData && (
        <SettingsSection
          title="Ambiente de demonstração"
          description="Dados fictícios guardados apenas neste navegador (IndexedDB)."
        >
          <DemoDataSettings manager={demoData} />
        </SettingsSection>
      )}

      <SettingsSection
        title="Em breve"
        description="Preferências previstas para as próximas fases."
      >
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {UPCOMING.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
