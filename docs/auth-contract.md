# Contrato HTTP de autenticação (rascunho para o backend)

> **Status:** nenhum destes endpoints existe ainda. Este é o contrato que o
> adaptador REST do frontend (`ApiAuthRepository`) já implementa e que o backend
> Java + Spring Boot (Spring Security) deverá oferecer. Convenções gerais (formato
> de erro RFC 9457, CSRF, datas, dinheiro) em [api-contract.md](./api-contract.md).

## Modelo de sessão

- A sessão é mantida **exclusivamente por cookies emitidos pelo backend**:
  - cookie de sessão/acesso: `HttpOnly; Secure; SameSite=Lax` (ou `Strict`), vida curta;
  - cookie de renovação (refresh), se adotado: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh`.
- O frontend **nunca** recebe, lê ou armazena tokens. Requisições usam
  `withCredentials: true`.
- CSRF: cookie `XSRF-TOKEN` (legível por JS) → header `X-XSRF-TOKEN` em requisições
  que alteram estado (padrão `CookieCsrfTokenRepository` do Spring Security).
- CORS (se frontend e API estiverem em origens diferentes): origem explícita,
  `Access-Control-Allow-Credentials: true`.

## Objeto `User`

```json
{ "id": "6f1c…", "name": "Ana Silva", "email": "ana@exemplo.com" }
```

`id` pode ser string ou número (convertido para string no frontend). Nenhum dado
sensível deve ser retornado.

## Endpoints

| Método | Caminho                 | Corpo                              | Sucesso                                           | Erros relevantes                                                               |
| ------ | ----------------------- | ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| POST   | `/auth/login`           | `{ email, password }`              | `200` + `User` + `Set-Cookie`                     | `401` credenciais inválidas (mensagem genérica); `429` excesso de tentativas   |
| POST   | `/auth/register`        | `{ name, email, password }`        | `201` + `User` + `Set-Cookie` (já autenticado)    | `409` e-mail já cadastrado; `422` com `errors[]` por campo                     |
| POST   | `/auth/logout`          | —                                  | `204` + cookies expirados                         | `401` é tratado como sucesso                                                   |
| GET    | `/auth/me`              | —                                  | `200` + `User`                                    | `401` = não autenticado (não é erro na interface)                              |
| POST   | `/auth/refresh`         | —                                  | `204` + novos cookies                             | `401` = sessão não renovável                                                   |
| POST   | `/auth/password/forgot` | `{ email }`                        | `202` **sempre** (não revela se o e-mail existe)  | `429`                                                                          |
| POST   | `/auth/password/reset`  | `{ token, newPassword }`           | `204`; deve invalidar todas as sessões do usuário | `400`/`404` com `code: "INVALID_RESET_TOKEN"` (inválido, expirado ou já usado) |
| POST   | `/auth/password/change` | `{ currentPassword, newPassword }` | `204`                                             | `400` com `code: "INVALID_CURRENT_PASSWORD"`; `401` sessão expirada            |

Caminhos relativos a `VITE_API_BASE_URL` (ex.: `/api/v1`).

## Regras que o backend deve aplicar (o frontend também valida, mas não é barreira de segurança)

- E-mail normalizado (trim + minúsculas) e único.
- Senha: 8–128 caracteres, ao menos uma letra e um número. Armazenada com hash
  forte (bcrypt/argon2) — nunca em texto.
- Nome: 2–100 caracteres.
- Token de redefinição: aleatório, de uso único, validade de 30 minutos.
- Rate limiting em login, cadastro e recuperação de senha (`429` + `Retry-After`).

## Comportamento do frontend

| Situação                            | Comportamento                                                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401` em requisição autenticada     | Tenta `POST /auth/refresh` **uma vez** (compartilhado entre requisições concorrentes) e repete a requisição original. Se falhar: evento de sessão expirada → tela `/sessao-expirada`, cache limpo, retorno à página original após novo login. |
| `401` em `/auth/me`                 | Usuário tratado como visitante (redireciona ao login nas rotas privadas).                                                                                                                                                                     |
| `401` em login/cadastro/recuperação | Sem refresh e sem evento de sessão expirada.                                                                                                                                                                                                  |
| `403`                               | Tela `/acesso-negado` disponível para recursos sem permissão.                                                                                                                                                                                 |
| Logout                              | Limpa todo o cache de dados mesmo se o servidor falhar.                                                                                                                                                                                       |

## Adaptador de desenvolvimento (`VITE_AUTH_ADAPTER=dev`)

Simulação local para usar a aplicação sem backend. **Não é autenticação real.**

- Conta de demonstração: `demo@fincore.dev` / `Demo@2026`.
- Contas criadas ficam apenas em memória (somem ao recarregar a página).
- Senhas nunca são persistidas. A "sessão" é um marcador `{ userId, expiresAt }`
  (8 h) em `sessionStorage`, sem token.
- Links de redefinição de senha aparecem no console do navegador.
- Bloqueado em builds de produção, exceto com `VITE_DEMO_MODE=true` (`npm run build:demo`).
