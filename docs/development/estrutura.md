# Organização do projeto

O backend fica em `src/`, com comandos e dependências no `package.json` da raiz. A interface fica em `frontend/`, mantida como workspace npm. Instale com `npm ci`; `npm start` serve as telas e a API na mesma origem.

## Frontend

| Caminho | Responsabilidade |
| --- | --- |
| `frontend/public/images/` e `public/icons/` | Imagens e ícones públicos. |
| `frontend/src/assets/styles/` | Estilos da pesquisa, painel, privacidade, TV e QR. |
| `frontend/src/assets/vendor/` | Biblioteca QR com licença original. |
| `frontend/src/components/common/` | Componentes visuais compartilhados. |
| `frontend/src/components/ui/` | Campos e seletores reutilizados nas telas. |
| `frontend/src/components/layout/` | Renderização, foco e rodapé compartilhados. |
| `frontend/src/hooks/` | Comportamentos reutilizáveis, em JavaScript nativo. |
| `frontend/src/context/` | Contextos compartilhados entre telas, sem React. |
| `frontend/src/store/` | Estado de interface compartilhado. |
| `frontend/src/routes/` | Mapa conceitual das páginas do frontend. |
| `frontend/src/App.js` | Ponto de composição documentado; não é componente React. |
| `frontend/src/pages/` | HTML e comportamento de cada tela. |
| `frontend/src/services/api.js` | Requisições HTTP, cookies e tratamento de erros. |
| `frontend/src/utils/` | Formatação e escape de texto. |
| `frontend/src/main.js` | Inicialização da pesquisa. |

Os scripts são carregados em ordem pelos HTMLs. O Express serve apenas os recursos de frontend declarados em `src/routes/pages.js`. As telas permanecem em `/`, `/admin`, `/qr.html`, `/tv.html` e `/privacidade.html`.

## Backend

| Caminho | Responsabilidade |
| --- | --- |
| `src/config/` | Carregamento das variáveis de ambiente. |
| `src/db/` | Pool MySQL e migrações de esquema. |
| `src/routes/` | Endpoints e associação de controllers e middleware. |
| `src/controller/` | Leitura de pedidos e construção das respostas HTTP. |
| `src/middleware/` | Cookies, permissões, proteção de requisições e limites. |
| `src/services/` | Regras de avaliação, auditoria e senhas. |
| `src/model/` | Leitura e paginação das avaliações, respeitando o perfil. |
| `src/validations/` | Validação do ambiente, datas, notas e alternativas. |
| `src/uploads/` | Reserva controlada para futuras integrações de upload; não é público. |
| `src/utils/` | Constantes, privacidade e funções de apoio. |
| `src/app.js` | Configuração do Express, segurança e rotas. |
| `src/server.js` | Validação do ambiente, conexão, inicialização e encerramento. |

A configuração local fica em `.env` na raiz, ignorada pelo Git. `src/config/env.js` resolve esse arquivo independentemente da pasta do terminal e preserva as variáveis fornecidas ao processo. O certificado CA público fica em `certs/`; caminhos relativos em `DB_SSL_CA_FILE` são resolvidos a partir da raiz. Não há ambiente público no frontend.

## Ferramentas e operação

O schema permanece em `database/schema.sql`; comandos administrativos em `scripts/database/`; testes em `tests/`; guias e modelos em `docs/`. Relatórios históricos preservam os caminhos vigentes na data em que foram escritos. O serviço systemd utiliza `/opt/fhdod/src/server.js`.

A raiz do repositório contém `package.json` e o lockfile único. Evidências, capturas e perfis temporários ficam em `verification/`, fora do Git. Dependências do servidor ficam na raiz e o frontend é o único workspace npm.

Hooks e context são módulos JavaScript nativos, sem dependência de React. Uploads exigem uma funcionalidade correspondente antes de criar armazenamento no servidor.
