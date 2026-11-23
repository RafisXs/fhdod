# Organização do projeto

O projeto está dividido em dois npm workspaces: `frontend/` e `backend/`. Instale as dependências uma vez na raiz com `npm ci`; `npm start` inicia o Express e disponibiliza as telas e a API na mesma origem. O frontend continua em HTML, CSS e JavaScript e utiliza as pastas correspondentes ao modelo de organização adotado.

## Frontend

| Caminho | Responsabilidade |
| --- | --- |
| `frontend/public/images/` e `public/icons/` | Imagens e ícones públicos. |
| `frontend/src/assets/styles/` | Estilos da pesquisa, painel, privacidade, TV e QR. |
| `frontend/src/assets/vendor/` | Biblioteca QR com licença original. |
| `frontend/src/components/common/` | Componentes visuais compartilhados. |
| `frontend/src/components/ui/` | Campos e seletores reutilizados nas telas. |
| `frontend/src/components/layout/` | Renderização, foco e rodapé compartilhados. |
| `frontend/src/pages/` | HTML e comportamento de cada tela. |
| `frontend/src/services/api.js` | Requisições HTTP, cookies e tratamento de erros. |
| `frontend/src/utils/` | Formatação e escape de texto. |
| `frontend/src/main.js` | Inicialização da pesquisa. |

Os scripts são carregados em ordem pelos HTMLs. O Express serve apenas os recursos de frontend declarados em `backend/src/routes/pages.js`. As telas permanecem em `/`, `/admin`, `/qr.html`, `/tv.html` e `/privacidade.html`.

## Backend

| Caminho | Responsabilidade |
| --- | --- |
| `backend/src/config/` | Carregamento do ambiente e pool MySQL. |
| `backend/src/routes/` | Endpoints e associação de controllers e middleware. |
| `backend/src/controllers/` | Leitura de pedidos e construção das respostas HTTP. |
| `backend/src/middleware/` | Cookies, permissões, proteção de requisições e limites. |
| `backend/src/services/` | Regras de avaliação, auditoria, senhas e migrações. |
| `backend/src/models/` | Leitura e paginação das avaliações, respeitando o perfil. |
| `backend/src/validations/` | Validação do ambiente, datas, notas e alternativas. |
| `backend/src/utils/` | Constantes, privacidade e funções de apoio. |
| `backend/src/app.js` | Configuração do Express, segurança e rotas. |
| `backend/src/server.js` | Validação do ambiente, conexão, inicialização e encerramento. |

A configuração local fica em `backend/.env`, ignorada pelo Git. `config/env.js` também aceita os caminhos antigos como fallback; variáveis já fornecidas ao processo têm prioridade. Segredos pertencem ao backend. Não é necessário arquivo de ambiente público no frontend.

## Ferramentas e operação

O schema permanece em `database/schema.sql`; comandos administrativos em `scripts/database/`; testes em `tests/`; guias e modelos em `docs/`. Relatórios históricos preservam os caminhos vigentes na data em que foram escritos. O serviço systemd utiliza `/opt/fhdod/backend/src/server.js`.

Na cópia local, `app/` é a raiz do repositório. A pasta externa mantém os atalhos npm. Evidências, capturas e perfis temporários ficam em `verification/`, fora do Git. O lockfile único na raiz controla as dependências dos dois workspaces.

Pastas específicas de React, como hooks e context, serão introduzidas se houver uma migração para esse framework. Uploads também exigem uma funcionalidade correspondente antes de criar armazenamento no servidor.
