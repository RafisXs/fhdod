# Scripts de manutenção

Execute pela raiz do projeto, usando os comandos npm para evitar dependência dos caminhos internos.

| Script | Comando | Finalidade |
| --- | --- | --- |
| `database/migrar.js` | `npm run migrar` | Atualizar um banco já criado, preservando dados existentes. |
| `database/criar-gerente.js` | `npm run criar-gerente` | Criar o gerente inicial ou redefinir sua senha provisória. |
| `checks/verificar-sintaxe.js` | `npm run lint` | Conferir a sintaxe dos scripts, backend, frontend e testes. |

Os scripts de banco usam `src/server/config.js` e as mesmas variáveis da aplicação. Faça backup antes de atualizar um banco existente. A migração não cria o banco inicial: utilize `database/schema.sql` na primeira instalação.
