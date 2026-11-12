import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { NotificationsButton, type NotificationItem } from './NotificationsButton';

const items: NotificationItem[] = [
  {
    id: 'a',
    severity: 'critical',
    title: 'Fatura vencida',
    description: 'R$ 100,00 em aberto',
    href: '/cartoes/c1',
  },
  { id: 'b', severity: 'info', title: 'Fatura vence em 2 dias', description: '', href: '/cartoes' },
];

function renderButton(props: Parameters<typeof NotificationsButton>[0]) {
  return render(
    <MemoryRouter>
      <NotificationsButton {...props} />
    </MemoryRouter>,
  );
}

describe('NotificationsButton', () => {
  it('mostra estado vazio sem alertas', async () => {
    const user = userEvent.setup();
    renderButton({ items: [], status: 'ready' });
    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(await screen.findByText('Nenhuma notificação')).toBeInTheDocument();
  });

  it('conta apenas alertas importantes e lista links com a severidade em texto', async () => {
    const user = userEvent.setup();
    renderButton({ items, status: 'ready' });
    const trigger = screen.getByRole('button', { name: 'Notificações (1 alerta importante)' });
    await user.click(trigger);
    const panel = await screen.findByRole('dialog', { name: 'Notificações' });
    const link = within(panel).getByRole('link', { name: /Crítico: Fatura vencida/ });
    expect(link).toHaveAttribute('href', '/cartoes/c1');
    expect(within(panel).getAllByRole('link')).toHaveLength(2);
  });

  it('informa erro ao carregar', async () => {
    const user = userEvent.setup();
    renderButton({ items: [], status: 'error' });
    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
  });
});
