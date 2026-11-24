# Backend FHDOD

API Node.js/Express com MySQL. `src/app.js` configura o Express; `src/server.js` valida o ambiente, conecta ao banco e inicia o processo HTTP. `src/uploads/` fica reservado para futuros uploads controlados e não é servido publicamente.

Copie `.env.example` para `.env` nesta pasta e preencha os dados locais. Execute `npm ci` na raiz do repositório para instalar os workspaces. Inicie pela raiz com `npm start` ou nesta pasta com `npm start`.

Rotas, controllers, middleware, serviços, modelos, validações e utilitários têm diretórios próprios em `src/`. Os comandos de migração e criação do gerente continuam disponíveis na raiz. Consulte [estrutura.md](../docs/development/estrutura.md) e o [guia de implantação](../docs/guides/implantacao.md).
