# ADR 0006 — Autenticação independente de provedor e proteção de rotas

- **Status:** Aceito
- **Data:** 05/11/2026

## Contexto

O backend ainda não existe, mas a aplicação precisa de fluxos completos de
autenticação desde já, sem apresentar uma simulação como segurança real e sem
exigir reescrita quando a API chegar.

## Decisões

1. **Contrato `AuthRepository`** no domínio da feature `auth`, com duas implementações:
   `DevAuthRepository` (local, explicitamente não segura) e `ApiAuthRepository`
   (REST, contrato em `docs/auth-contract.md`). A escolha ocorre em um único ponto
   (`createAuthInfrastructure`) a partir de `VITE_AUTH_ADAPTER`.
2. **Casos de uso** (`LoginUseCase`, `RegisterUseCase`, `LogoutUseCase`,
   `GetCurrentUserUseCase`, `RecoverPasswordUseCase`, `ResetPasswordUseCase`,
   `ChangePasswordUseCase`) validam e normalizam dados antes do repositório.
   As regras (política de senha, e-mail, nome) ficam em `credentials.rules.ts` e
   são reutilizadas pelos schemas Zod dos formulários — sem duplicação.
3. **`AuthProvider`** (camada `app`) compõe repositório + casos de uso e os expõe
   por contexto; aceita injeção para testes.
4. **Estado da sessão no TanStack Query** (`['auth', 'current-user']`), não em um
   store paralelo. `null` = visitante.
5. **Rotas:** `ProtectedRoute` (verifica sessão; redireciona ao login com
   `state.from`), `GuestRoute` (login/cadastro/recuperação inacessíveis a quem
   está autenticado) e rotas públicas (redefinição, sessão expirada, acesso negado).
6. **Redirecionamento seguro:** `getSafeRedirectPath` aceita apenas caminhos
   internos (bloqueia `//host`, URLs absolutas, `/\`, caracteres de controle e
   telas de autenticação) — proteção contra _open redirect_.
7. **Expiração de sessão:** o cliente HTTP tenta `refresh` uma única vez
   (compartilhado entre requisições concorrentes); se falhar, publica um evento em
   `sessionEvents`. `AuthSessionListener` navega para `/sessao-expirada`, que
   **limpa todo o cache** ao montar. A limpeza não ocorre antes da navegação
   porque, durante a transição do React Router, a rota protegida ainda montada
   redirecionaria ao login primeiro (bug encontrado e coberto por teste).
8. **Logout e redefinição de senha limpam todo o cache** de dados — nenhum dado do
   usuário anterior permanece em memória.
9. **Mensagens sem enumeração de contas:** login inválido usa mensagem única;
   recuperação de senha responde igual exista ou não o e-mail.

## Consequências

- Ligar o backend exige apenas `VITE_AUTH_ADAPTER=rest` e a implementação do
  contrato; telas, rotas e casos de uso não mudam.
- O adaptador de desenvolvimento não persiste contas criadas entre recarregamentos
  (escolha deliberada para nunca guardar senhas no navegador).
