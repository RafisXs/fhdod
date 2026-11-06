# Avaliação do Atendimento — FHDOD

Sistema de pesquisa de satisfação da Fundação Hospitalar Dr. Oswaldo Diesel, com avaliação por setor, painel de gestão, contatos autorizados, indicadores para TV e cartazes com QR Code.

Backend em Node.js/Express e MySQL; frontend em HTML, CSS e JavaScript, servido pela própria aplicação, sem etapa de build.

## Estrutura do projeto

```text
fhdod/
├── src/
│   ├── server/                  # Backend e regras da aplicação
│   │   ├── index.js             # Servidor HTTP e arquivos estáticos
│   │   ├── config.js            # Carregamento do .env
│   │   ├── db.js                # Conexão MySQL
│   │   ├── lib/                 # Avaliações, autenticação e migrações
│   │   └── routes/              # Rotas públicas e administrativas
│   └── public/                  # Frontend
│       ├── index.html           # Pesquisa de satisfação
│       ├── admin.html           # Painel da equipe
│       ├── qr.html              # Cartazes com QR Code
│       ├── tv.html              # TV de indicadores
│       ├── privacidade.html     # Aviso de privacidade
│       ├── css/
│       ├── img/
│       └── js/                  # Scripts das telas; vendor/ para biblioteca QR
├── database/
│   └── schema.sql               # Banco inicial, tabelas e perguntas padrão
├── scripts/
│   ├── database/                # Criação do gerente e migração do banco
│   └── checks/                  # Verificação de sintaxe
├── tests/
│   ├── api/                     # Testes das rotas e validações
│   ├── security/                # Sessões, senhas, permissões e auditoria
│   └── e2e/                     # Fluxos completos no navegador
├── docs/
│   ├── guides/                  # Implantação e operação
│   ├── deploy/                  # Modelos Nginx, systemd e backup
│   ├── development/             # Organização e pendências
│   ├── reference/               # Manual detalhado e indicadores
│   └── reports/                 # Relatórios datados de revisão e testes
├── .editorconfig               # Convenções de edição
├── .gitattributes              # Formatos de texto e arquivos binários
├── .env.example                # Modelo de configuração, sem credenciais reais
├── .gitignore
├── package.json
└── package-lock.json
```

Na cópia de trabalho que contém uma pasta `app/`, esta árvore fica dentro de `app/`, onde está o repositório Git. No GitHub, `src/`, `database/`, `scripts/`, `tests/` e `docs/` aparecem diretamente na raiz. A pasta externa é apenas um workspace com atalhos npm.

Arquivos locais gerados ficam em `verification/`: capturas em `screenshots/`, perfis temporários em `browser/` e evidências antigas em `archive/`. Essa pasta, o `.env` real, backups e `node_modules/` são ignorados pelo Git.

## Instalação

Requisitos: Node.js 18+ e MySQL 8+. Para executar toda a suíte de navegador, utilize Node.js 22+ com `WebSocket` global e Chrome/Chromium instalado. A última validação utilizou Node.js 24.14.1 no Windows.

Dentro da raiz do repositório:

```sh
npm ci
```

Crie o `.env` a partir de [.env.example](.env.example):

```powershell
# PowerShell
Copy-Item .env.example .env
```

```sh
# Linux/macOS
cp .env.example .env
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

No primeiro acesso, a conta precisa trocar a senha provisória. Em instalações existentes, utilize `npm run migrar` para atualizar o banco; o servidor também verifica as migrações ao iniciar. Faça backup antes de atualizar.

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

Use a porta configurada em `PORT`, caso seja diferente de 3000. Os caminhos públicos permanecem os mesmos após a organização em `src/`.

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

A suíte completa cria e remove um banco `fhdod_verify_<identificador>`, inicia um servidor próprio em porta livre e gera capturas em `verification/screenshots/`. O usuário MySQL utilizado nos testes precisa de permissão para criar e remover o banco e criar triggers de teste. Os comandos isolados de API e segurança gravam dados: utilize a suíte completa e consulte [tests/README.md](tests/README.md).

O Chrome é localizado no caminho padrão do Windows. Para outro caminho, defina `CHROME_PATH` no ambiente ou no `.env`. O perfil de teste usa `--no-sandbox` apenas na execução automatizada e não deve ser usado para navegação comum.

Validação após a reorganização: **29 testes da API, 10 verificações de segurança e fluxos de navegador aprovados**, incluindo pesquisa, permissões, Excel, TV, QR e impressão A4. A [vistoria](docs/reports/2026-11-05-vistoria.md) detalha as correções anteriores; a [organização](docs/development/estrutura.md) documenta os caminhos novos.

## Documentação e operação

- [Índice da documentação](docs/README.md).
- [Manual detalhado: funcionalidades, configuração, API e indicadores](docs/reference/manual-detalhado.md).
- [Implantação, HTTPS, serviço e backup](docs/guides/implantacao.md).
- [Estrutura, responsabilidades das pastas e arquivos movidos](docs/development/estrutura.md).
- [Pendências e validações institucionais](docs/development/pendencias.md).
- [Relatórios de revisão e testes](docs/reports/README.md).

O painel carrega até 5.000 avaliações, a exportação até 20.000 e o resultado por pergunta até 200.000 respostas. Ao atingir esses limites, os totais podem ficar incompletos. HTTPS, domínio real, restauração de backup e leitura física dos cartazes precisam ser validados no ambiente de destino. Texto de privacidade e política de retenção dependem da aprovação dos responsáveis do hospital.

## Créditos e licença

Identificação institucional: Fundação Hospitalar Dr. Oswaldo Diesel, Três Coroas — RS. O projeto está marcado como `UNLICENSED`; a publicação do código não concede licença de uso. A biblioteca local de QR Code mantém seu aviso de licença próprio em [src/public/js/vendor/qrcode.js](src/public/js/vendor/qrcode.js).
