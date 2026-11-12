# Prompt para iniciar uma nova sessão

Copie o bloco abaixo e envie em uma conversa nova (com a pasta `FinProject` aberta).

```text
Você vai dar continuidade ao projeto FinCore, uma aplicação React + TypeScript de
gestão financeira pessoal, desenvolvida em 9 fases. Responda sempre em português
do Brasil.

Antes de qualquer alteração, leia nesta ordem:
1. fincore/CONTINUAR.md — estado atual, como rodar, regras obrigatórias,
   armadilhas conhecidas e o roteiro da próxima fase;
2. fincore/PENDENCIAS.md — tudo o que está pendente, adiado ou aguardando decisão;
3. fincore/docs/ROADMAP.md — requisitos completos das fases restantes;
4. fincore/PROJECT_STATUS.md e os ADRs em fincore/docs/adr/ quando precisar de detalhes.

Depois:
- rode `git status` e `npm run check` dentro de fincore/ para confirmar que a base está verde;
- inicie a próxima fase pendente indicada no CONTINUAR.md (hoje: Fase 9 —
  Finalização e qualidade), reutilizando o domínio que já existe, sem reescrever o que funciona;
- trabalhe de forma autônoma nas decisões técnicas comuns, documentando as relevantes
  em um novo ADR;
- ao final da fase, rode o portão de qualidade (`npm run check`, `npm run build`,
  `npm run test:e2e`), verifique no navegador (desktop e celular, tema claro e escuro)
  e atualize CONTINUAR.md, PENDENCIAS.md, PROJECT_STATUS.md, README.md e o ROADMAP;
- não faça commit sem eu pedir.

Ao terminar, me apresente um resumo do que foi entregue, das decisões tomadas sem
me consultar e das pendências novas, e pergunte se pode iniciar a fase seguinte.
```
