# Organização do projeto

O repositório contém uma única aplicação Node.js. Cada pasta tem uma responsabilidade; não há cópia separada de frontend ou backend fora de `src/`.

| Caminho | Responsabilidade |
| --- | --- |
| `src/server/` | Inicialização Express, configuração e conexão MySQL. |
| `src/server/routes/` | Endpoints públicos e administrativos. |
| `src/server/lib/` | Regras de avaliação, autenticação, privacidade, auditoria e migrações. |
| `src/public/` | HTML das telas; os URLs servidos continuam em `/`, `/admin`, `/qr.html` e `/tv.html`. |
| `src/public/css/` | Estilos da pesquisa, painel, TV, cartazes e privacidade. |
| `src/public/js/` | Scripts das telas e componentes compartilhados. |
| `src/public/js/vendor/` | Biblioteca QR de terceiros, com licença preservada. |
| `src/public/img/` | Logo e ícone institucional. |
| `database/` | Schema SQL inicial; não contém dumps de dados reais. |
| `scripts/database/` | Comandos administrativos de migração e criação do gerente. |
| `scripts/checks/` | Verificações de desenvolvimento. |
| `tests/api/` | Testes HTTP de funcionalidades e validações. |
| `tests/security/` | Testes de contas, sessões e auditoria. |
| `tests/e2e/` | Orquestração do banco temporário, servidor, API, segurança e navegador. |
| `docs/` | Guias, referência, modelos, pendências e relatórios. |
| `verification/screenshots/` | Capturas geradas pelos testes; ignoradas pelo Git. |
| `verification/browser/` | Perfis de navegador usados na validação; ignorados. |
| `verification/archive/` | Evidências locais antigas preservadas; ignoradas. |

## Caminhos alterados nesta organização

| Antes | Agora |
| --- | --- |
| `server/` | `src/server/` |
| `public/` | `src/public/` |
| `server/scripts/migrar.js` | `scripts/database/migrar.js` |
| `server/scripts/criar-gerente.js` | `scripts/database/criar-gerente.js` |
| `server/scripts/verificar-sintaxe.js` | `scripts/checks/verificar-sintaxe.js` |
| `tests/api.test.js` | `tests/api/api.test.js` |
| `tests/seguranca.test.js` | `tests/security/seguranca.test.js` |
| `tests/painel.test.cjs` | `tests/e2e/painel.test.cjs` |
| `docs/implantacao.md` | `docs/guides/implantacao.md` |
| `docs/pendencias.md` | `docs/development/pendencias.md` |
| `RELATORIO_REVISAO.md` | `docs/reports/2026-10-30-revisao.md` |
| `docs/testes-seguranca.md` | `docs/reports/2026-10-29-seguranca.md` |
| `docs/VISTORIA_2026-11-05.md` | `docs/reports/2026-11-05-vistoria.md` |
| README extenso | README de entrada e `docs/reference/manual-detalhado.md` |

Os comandos npm preservam os nomes. O serviço systemd aponta agora para `/opt/fhdod/src/server/index.js`. As URLs públicas e a localização de `database/schema.sql` permanecem iguais.

## Configuração e workspace local

O `.env` real fica na raiz do repositório, ao lado de `.env.example`; suas credenciais não entram no Git. `src/server/config.js` resolve esse arquivo a partir da própria localização, sem depender da pasta do terminal, e mantém o fallback antigo para a pasta externa por compatibilidade.

Na cópia de trabalho existente, `app/` é a raiz Git. A pasta externa possui apenas um README de orientação e os atalhos npm, além do `.gitignore` do workspace. As evidências que estavam soltas na pasta externa foram preservadas em `app/verification/archive/workspace/`, e o antigo perfil de navegador foi movido para `app/verification/browser/legacy-profile/`. O `.env` que ficava fora da aplicação foi movido para `app/.env`.

Em um clone do GitHub, execute os comandos na raiz clonada: não crie outra pasta `app/` nem copie o projeto para dentro dele mesmo. A suíte E2E resolve a raiz pelo arquivo do teste e funciona sem depender de uma pasta externa com nome específico.

## Critérios de organização no Git

- Versionar código-fonte, schema inicial, testes, documentação, modelos sem segredos e o lockfile.
- Manter credenciais, dumps, logs, capturas e dependências instaladas fora do versionamento.
- Preservar relatórios anteriores por data e registrar novos resultados em arquivos próprios.
- Manter links relativos para que README e documentação funcionem no GitHub e em clones locais.
