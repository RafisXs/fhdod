# Frontend FHDOD

Interface em HTML, CSS e JavaScript nativo. `public/` contém imagens e ícones; `src/` contém páginas, componentes, estilos, serviços HTTP, utilitários, hooks, context, store e rotas conceituais. A estrutura acompanha o modelo visual de frontend, mas não usa React, JSX, Vite ou componentes de framework.

Execute `npm ci` e `npm start` na raiz do repositório. O backend serve as telas e a API na mesma origem, com a porta definida em `backend/.env`. `npm run dev` inicia o backend com reinício automático.

A pesquisa começa em `index.html` e `src/main.js`. As demais telas estão em `src/pages/`. A estrutura detalhada está em [estrutura.md](../docs/development/estrutura.md).
