# Backend

O servidor fica diretamente em `src/`. Execute `npm ci` e `npm start` na raiz do repositório; `npm run dev` ativa o reinício automático. A configuração local fica no `.env` da raiz.

| Pasta | Responsabilidade |
| --- | --- |
| `config/` | Carregamento do ambiente. |
| `controller/` | Requisições e respostas HTTP. |
| `db/` | Conexão MySQL e migrações. |
| `middleware/` | Autenticação, permissões e limites. |
| `model/` | Consultas de avaliações. |
| `routes/` | Rotas da API e páginas públicas. |
| `services/` | Regras de negócio e segurança. |
| `validations/` | Validação de entradas e ambiente. |
| `utils/` | Constantes e funções auxiliares. |

`app.js` configura o Express; `server.js` inicializa e encerra o serviço. Consulte a [estrutura completa](../docs/development/estrutura.md) e o [guia de implantação](../docs/guides/implantacao.md).
