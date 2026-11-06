import '@/styles/globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { BootstrapError } from '@/components/feedback/BootstrapError';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento #root não encontrado em index.html.');
}

const root = createRoot(container);

/*
 * O App é importado dinamicamente para que falhas de inicialização — como
 * configuração de ambiente inválida (AppConfigError) — sejam exibidas em uma
 * tela amigável, em vez de uma página em branco.
 */
import('./App')
  .then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    root.render(<BootstrapError error={error} />);
  });
