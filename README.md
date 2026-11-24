# Avaliação do Atendimento — FHDOD

Sistema de pesquisa de satisfação da Fundação Hospitalar Dr. Oswaldo Diesel, com avaliação por setor, painel de gestão, contatos autorizados, indicadores para TV e cartazes com QR Code.

Backend em Node.js/Express e MySQL; frontend em HTML, CSS e JavaScript, servido pela própria aplicação, sem etapa de build.

## Estrutura do projeto

```text
fhdod/
├── frontend/
│   ├── public/
│   │   ├── images/                 # Imagens institucionais
│   │   └── icons/                  # Ícones públicos
│   ├── src/
│   │   ├── assets/{styles,vendor}/ # Estilos e biblioteca QR
│   │   ├── components/
│   │   │   ├── common/             # Componentes visuais comuns
│   │   │   ├── ui/                 # Campos e seletores
│   │   │   └── layout/             # Estrutura compartilhada
│   │   ├── pages/                  # HTML e lógica de cada tela
│   │   ├── services/api.js         # Comunicação HTTP
│   │   ├── utils/                 # Funções auxiliares
│   │   └── main.js                # Entrada da pesquisa
│   ├── index.html
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/                # Ambiente e conexão MySQL
│   │   ├── controllers/           # Tratamento das requisições
│   │   ├── models/                # Consultas de avaliações
│   │   ├── routes/                # Rotas e proteção de acesso
│   │   ├── middleware/            # Autenticação e limites
│   │   ├── services/              # Regras, segurança e migrações
│   │   ├── utils/                 # Constantes e auxiliares
│   │   ├── validations/           # Validação de ambiente e respostas
│   │   ├── app.js                 # Configuração do Express
│   │   └── server.js              # Inicialização e encerramento
│   ├── .env.example
│   └── package.json
├── database/schema.sql
├── scripts/
├── tests/
├── docs/
├── package.json                   # Comandos e npm workspaces
└── package-lock.json              # Dependências dos dois pacotes
```

Na cópia de trabalho que contém uma pasta `app/`, esta árvore fica dentro de `app/`, onde está o repositório Git. No GitHub, `frontend/`, `backend/`, `database/`, `scripts/`, `tests/` e `docs/` aparecem diretamente na raiz. A pasta externa é apenas um workspace com atalhos npm.

Arquivos locais gerados ficam em `verification/`: capturas em `screenshots/`, perfis temporários em `browser/` e evidências antigas em `archive/`. Essa pasta, o `.env` real, backups e `node_modules/` são ignorados pelo Git.

## Instalação

Requisitos: Node.js 18+ e MySQL 8+. Para executar toda a suíte de navegador, utilize Node.js 22+ com `WebSocket` global e Chrome/Chromium instalado. A última validação utilizou Node.js 24.14.1 no Windows.

Dentro da raiz do repositório:

```sh
npm ci
```

Crie `backend/.env` a partir de [backend/.env.example](backend/.env.example):

```powershell
# PowerShell
Copy-Item backend/.env.example backend/.env
```

```sh
# Linux/macOS
cp backend/.env.example backend/.env
```

Preencha `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` com os dados do MySQL. Defina `JWT_SECRET` com um segredo aleatório de pelo menos 24 caracteres; o texto do exemplo não é aceito. Mantenha `COOKIE_SECURE=false` apenas no desenvolvimento por HTTP.

Para a primeira instalação, execute [database/schema.sql](database/schema.sql) no MySQL Workbench. Em um terminal que suporte redirecionamento de entrada:

```sh
mysql -u root -p < database/schema.sql
```

O schema cria o banco `hospital_experiencia`; mantenha `DB_NAME` alinhado com esse nome ou adapte o script antes da instalação.

Depois, crie a conta inicial e inicie o sistema:

```sh
npm run criar-gerente
npm start
```

No primeiro acesso, a conta precisa trocar a senha provisória. Em instalações existentes, utilize `npm run migrar` para atualizar o banco. Em desenvolvimento, o servidor também verifica migrações ao iniciar; em produção elas ficam desabilitadas por padrão para permitir conta de operação sem permissões DDL. Faça backup antes de atualizar.

No PowerShell, use `npm.cmd` se a política local bloquear `npm.ps1`. No workspace que contém `app/`, execute os mesmos comandos de uso pelos atalhos da pasta externa; para instalar, utilize `npm.cmd --prefix app ci`.

## Acesso às telas

| Tela | Endereço local padrão |
| --- | --- |
| Pesquisa | `http://localhost:3000/` |
| Pesquisa de um setor | `http://localhost:3000/?setor=rx` |
| Painel da equipe | `http://localhost:3000/admin` |
| QR Code geral | `http://localhost:3000/qr.html?geral=1` |
| TV de indicadores | `http://localhost:3000/tv.html` |
| Aviso de privacidade | `http://localhost:3000/privacidade.html` |

Use a porta configurada em `PORT`, caso seja diferente de 3000. Os caminhos públicos permanecem os mesmos após a separação entre `frontend/` e `backend/`.

## Funcionalidades e perfis

- Pesquisa por setor, com até 30 perguntas, notas de satisfação, recomendação de 1 a 10 e alternativas de múltipla escolha.
- Aceite de privacidade antes da primeira resposta. Sem marcar a caixa em 30 segundos, a tela retorna à escolha de setor. As respostas são salvas em rascunho; apenas avaliações concluídas entram nos indicadores.
- Telefone opcional para avaliações que exigem atenção, com autorização de contato separada.
- Painel com filtros, gráficos, acompanhamento ao vivo, contatos, Excel e impressão.
- Cartazes QR geral, por setor ou em lote, com download SVG/PNG e impressão A4.
- TV com dados agregados, sem telefones ou observações de contato.

| Perfil | Acesso |
| --- | --- |
| Gerente | Todos os setores, contas, perguntas, contatos e auditoria. |
| Administrador | Resultados, contatos e perguntas do seu setor; gerencia visualizadores desse setor. |
| Visualizador | Consulta de resultados no escopo atribuído, sem telefones e sem alterações. |

## Comandos e testes

| Comando | Finalidade |
| --- | --- |
| `npm start` | Iniciar a aplicação. |
| `npm run dev` | Iniciar com reinício após alterações. |
| `npm run migrar` | Atualizar o esquema do banco configurado. |
| `npm run criar-gerente` | Criar ou redefinir a conta de gerente. |
| `npm run lint` | Conferir sintaxe do código, scripts e testes. |
| `npm run test:painel` | Executar API, segurança e navegador em banco temporário isolado. |
| `npm test` | Executar API contra servidor de teste previamente configurado. |
| `npm run test:seguranca` | Executar segurança no banco temporário permitido pela suíte. |
| `npm run test:unit` | Validar configurações de produção sem acessar o banco. |
| `npm run test:volume` | Executar cenários de volume no banco temporário preparado pela suíte. |
| `npm run monitorar -- https://SEU-DOMINIO` | Verificar disponibilidade do processo e do banco. |

A suíte completa cria e remove um banco `fhdod_verify_<identificador>`, inicia um servidor próprio em porta livre e gera capturas em `verification/screenshots/`. O usuário MySQL utilizado nos testes precisa de permissão para criar e remover o banco e criar triggers de teste. Os comandos isolados de API e segurança gravam dados: utilize a suíte completa e consulte [tests/README.md](tests/README.md).

O Chrome é localizado no caminho padrão do Windows. Para outro caminho, defina `CHROME_PATH` no ambiente ou no `.env`. O perfil de teste usa `--no-sandbox` apenas na execução automatizada e não deve ser usado para navegação comum.

Validação de 24/11/2026: **30 testes da API, 10 verificações de segurança, 7 de integração/volume e 5 testes unitários aprovados**, além dos fluxos de navegador. O cenário de volume utiliza 20.001 avaliações e 220.011 respostas em banco descartável. A [preparação para produção](docs/guides/entrada-em-producao.md) descreve as melhorias e os critérios de liberação.

O workflow em `.github/workflows/validacao.yml` executa sintaxe, testes, auditoria npm, MySQL isolado e Chrome a cada push nas branches configuradas e em pull requests. O Dependabot está configurado para revisar npm e Actions semanalmente; sua ativação depende da configuração estar na branch padrão do GitHub.

## Documentação e operação

- [Índice da documentação](docs/README.md).
- [Manual detalhado: funcionalidades, configuração, API e indicadores](docs/reference/manual-detalhado.md).
- [Briefing, públicos e rastreabilidade dos requisitos](docs/reference/briefing-e-requisitos.md).
- [Decisões arquiteturais e justificativa do SGBD/backend](docs/reference/decisoes-arquiteturais.md).
- [Plano de negócio, precificação e estratégia de escala](docs/reference/plano-de-negocio.md).
- [Oficialização da parceria e isenção da FHDOD](docs/reference/oficializacao-parceria-fhdod.md).
- [Implantação, HTTPS, serviço e backup](docs/guides/implantacao.md).
- [Preparação para uso institucional e critérios de liberação](docs/guides/entrada-em-producao.md).
- [Estrutura, responsabilidades das pastas e arquivos movidos](docs/development/estrutura.md).
- [Pendências e validações institucionais](docs/development/pendencias.md).
- [Relatórios de revisão e testes](docs/reports/README.md).
- [Avaliação acadêmica pelos cinco critérios](docs/reports/2026-11-24-avaliacao-academica.md).

Os antigos cortes em 5.000 avaliações no painel, 20.000 no Excel e 200.000 respostas por pergunta foram removidos. O painel carrega páginas de 500 registros, o Excel é escrito em lotes e o resultado por pergunta é agregado no MySQL. Parte dos gráficos ainda usa a base completa no navegador, então memória e tempo de carregamento devem ser homologados para o volume esperado. HTTPS, domínio real, restauração de backup e leitura física dos cartazes precisam ser validados no destino. MFA ainda está pendente. Texto de privacidade e política de retenção dependem da aprovação dos responsáveis do hospital.

## Créditos e licença

Identificação institucional: Fundação Hospitalar Dr. Oswaldo Diesel, Três Coroas — RS. O projeto está marcado como `UNLICENSED`; a publicação do código não concede licença de uso. A biblioteca local de QR Code mantém seu aviso de licença próprio em [frontend/src/assets/vendor/qrcode.js](frontend/src/assets/vendor/qrcode.js).
