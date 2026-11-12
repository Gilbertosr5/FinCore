# Segurança do front-end FinCore

Resumo das proteções do cliente e do que o servidor que hospedar o build deve
complementar. Decisões: [ADR 0005](./adr/0005-seguranca-sessao-e-configuracao.md)
e [ADR 0014](./adr/0014-qualidade-acessibilidade-performance-seguranca.md).

## O que o cliente já faz

| Tema                  | Proteção                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão                | Sem tokens ou senhas no navegador: sessão por cookie HttpOnly/Secure/SameSite (contrato em `auth-contract.md`); `localStorage` só guarda preferências de interface                    |
| CSRF                  | O cliente HTTP envia `X-XSRF-TOKEN` a partir do cookie `XSRF-TOKEN`                                                                                                                   |
| CSP                   | Meta CSP no build de produção (`build/csp-plugin.ts`): scripts só da origem + hash do script de tema; `object-src 'none'`; `connect-src` restrito à origem e à API                    |
| XSS                   | React escapa todo conteúdo; não há `dangerouslySetInnerHTML`; dados lidos do armazenamento e da API são validados com Zod                                                             |
| Exportações           | CSV com proteção contra injeção de fórmulas; PDF/CSV/JSON gerados localmente, nada é enviado a servidores                                                                             |
| Mensagens de erro     | Só mensagens de domínio/API são exibidas; erros técnicos viram mensagens genéricas ou orientações (armazenamento, nova versão)                                                        |
| Dados de demonstração | IndexedDB local apenas com dados fictícios; login de demonstração bloqueado em produção sem `VITE_DEMO_MODE=true`                                                                     |
| Dependências          | Versões fixadas onde há risco (ADR 0002; jsPDF/autotable/axe exatos); `npm audit --omit=dev`: 0 vulnerabilidades em 12/11/2026 (as moderadas restantes são só de ferramentas de lint) |

## Headers recomendados no servidor (não funcionam via `<meta>`)

```
Content-Security-Policy: <mesma política da meta tag>; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
```

- Sirva `index.html` com `Cache-Control: no-cache` e os arquivos de `assets/`
  (nomes com hash) com cache longo e imutável — evita a tela "Atualização
  necessária" por módulos antigos.
- Se a API estiver em outra origem, configure CORS com `credentials` e a lista
  exata de origens; o build inclui a origem de `VITE_API_BASE_URL` no `connect-src`.

## Responsabilidades do backend

O cliente **não** é barreira de segurança: todas as regras de negócio (ADR 0007,
0009–0013) devem ser revalidadas no servidor, com autenticação, autorização por
usuário, rate limiting e registro de auditoria na mesma transação das alterações.
