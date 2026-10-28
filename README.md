# Avaliação do Atendimento - FHDOD (protótipo acadêmico)

Sistema web para coletar a avaliação do atendimento por setor (pesquisa de satisfação com NPS) e acompanhar os resultados em um painel com perfis de acesso, TV Wall e exportação em Excel.

> **Projeto acadêmico / protótipo de solução** para a Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD), Três Coroas - RS. **Não é o sistema oficial da instituição.** Os dados exibidos pelo sistema podem ser demonstrativos.

- **Autores:** `Rafael Bazotti` e `Pedro Goetz`

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Perfis de acesso](#perfis-de-acesso)
3. [Tecnologias](#tecnologias)
4. [Estrutura do repositório](#estrutura-do-repositório)
5. [Instalação](#instalação)
6. [Variáveis de ambiente](#variáveis-de-ambiente)
7. [Execução](#execução)
8. [Banco de dados](#banco-de-dados)
9. [API](#api)
10. [Segurança e LGPD](#segurança-e-lgpd)
11. [Testes](#testes)
12. [Solução de problemas](#solução-de-problemas)
13. [Limitações conhecidas](#limitações-conhecidas)
14. [Fontes institucionais](#fontes-institucionais)

## Funcionalidades

**Pesquisa (pacientes e familiares, sem login) - `/`**

- Escolha do setor e perguntas **sem limite fixo de 5** (até 30 por setor). O padrão de cada setor é: duas de nota (5 níveis), a **recomendação de 1 a 10 com carinhas na 3ª posição**, uma de pontos positivos e uma de pontos a melhorar. Cada setor tem exatamente uma pergunta de recomendação, que não pode ser excluída.
- **Gravação em tempo real:** cada resposta é gravada no banco assim que o paciente responde (como rascunho). Os painéis e a TV só contam as avaliações enviadas. Se a internet falhar no meio do caminho, o envio final manda as respostas de novo.
- Passo final: dia do atendimento, turno (Dia ou Noite), paciente ou familiar e tipo de atendimento (SUS, Plano de Saúde ou Particular).
- Quando a nota fica abaixo da média, aparece um campo **opcional** de telefone, com autorização expressa de contato, para a gestão do setor ligar e entender o que houve.
- Link direto por setor, para gerar QR Code: `/?setor=rx`.
- Layout para celular, navegação por teclado e foco visível.

**Área restrita (equipe) - `/admin`**

- Resultados: indicadores, gráficos, ranking por setor, filtros (período, setor, turno, tipo de atendimento), comparação com o período anterior, impressão e exportação em Excel.
- Contatos: pessoas que deixaram o telefone, com situação (pendente, contatado, resolvido) e observações.
- **Ao vivo:** no topo de Resultados, um painel mostra quem está respondendo agora e quem não terminou, com as respostas já dadas (nota, recomendação, pontos positivos e a melhorar). Cada resposta aparece quando o paciente avança, e o painel se atualiza sozinho a cada 8 segundos. Esses rascunhos não entram nos indicadores, que contam só as avaliações enviadas. Quando alguém termina, os indicadores se atualizam sozinhos. Respeita o setor de cada perfil e nunca mostra telefone.
- Perguntas: **adicionar, excluir, reordenar (subir e descer)**, editar texto, tipo e opções, e ativar ou desativar. A pergunta de recomendação (1 a 10) é protegida: dá para mudar o texto e a posição, não excluir. Perguntas excluídas não apagam as respostas já dadas.
- **Setores (só o gerente):** criar setor novo (nasce com 5 perguntas padrão e o seu link da pesquisa para virar QR Code), renomear, mudar a ordem, ativar e desativar. Setor desativado some da pesquisa e da TV, mas o histórico fica. Não há exclusão definitiva.
- **QR Code pelo painel:** na aba Setores, cada setor tem o botão **QR Code**, que abre um cartaz A4 pronto para imprimir (ou salvar em PDF), com o logo, o nome do setor e o QR Code, e permite baixar o QR em PNG ou SVG. Há também o botão para imprimir os cartazes de todos os setores ativos de uma vez. O QR é gerado no próprio navegador (biblioteca local, sem site externo). Informe antes o **endereço do site publicado** (campo na aba Setores, guardado neste navegador): um QR com `localhost` só funciona no seu computador.
- **Resultado por pergunta:** em Resultados, nota média, NPS e opções mais escolhidas de cada pergunta, inclusive as novas.
- Equipe: criação e desativação de contas, conforme o perfil.

**TV Wall - `/tv.html`**

- Painel para **televisão de 32 polegadas** (Full HD 1920x1080 ou HD 1366x768), vista de longe: números grandes, cores de status (verde, amarelo, vermelho), relógio, sem barra de rolagem. Atualiza a cada 30 segundos. Nunca mostra telefone, nome ou resposta individual.
- Dica: abra em tela cheia (F11) no navegador da TV.

**Painel da equipe em monitor de computador**

- A partir de 1100 px de largura o painel usa o espaço do monitor: indicadores numa linha, gráficos lado a lado e tabela por setor em largura total. No celular e no tablet continua em coluna única.

## Perfis de acesso

| Recurso | Gerente | Administrador de setor | Visualizador |
| --- | --- | --- | --- |
| Alcance dos dados | Todos os setores | Somente o seu setor | O seu setor (ou todos, se criado sem setor) |
| Ver resultados e exportar Excel | Sim | Sim | Sim |
| Ver telefones e registrar contato | Sim | Sim (do seu setor) | **Nunca** |
| Adicionar, excluir, reordenar e editar perguntas | Todos os setores | Somente o seu setor | Não |
| Criar, renomear, ordenar e desativar setores | **Sim (só ele)** | Não | Não |
| Equipe | Cria e gerencia todas as contas, **sendo o único que cria administradores** (1 por setor) e outros gerentes | Cria e gerencia apenas visualizadores do seu setor; não cria admins nem muda perfis | Não |
| Atalho da TV Wall no painel | Sim | Não | Não |

Regras:

- Cada setor pode ter **no máximo 1 administrador ativo** (garantido pelo banco de dados). Para trocar, desative o atual e crie ou ative outro.
- Precisa existir pelo menos um gerente ativo, e ninguém desativa ou rebaixa a própria conta.
- O primeiro gerente é criado pelo terminal (`npm run criar-gerente`). Não existe cadastro público.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js 18+ e Express 5 |
| Banco de dados | MySQL 8.0+ (driver `mysql2`) |
| Autenticação | JWT em cookie `httpOnly`, senhas com `bcryptjs` |
| Segurança | `helmet` (CSP), `express-rate-limit`, consultas parametrizadas |
| Excel | `exceljs` |
| Frontend | HTML, CSS e JavaScript puros (sem build), servidos pelo próprio backend |
| Configuração | `dotenv` (arquivo `.env`) |

## Estrutura do repositório

```
.
├── database/
│   └── schema.sql             # Tabelas, restrições e dados iniciais (MySQL)
├── public/                    # Frontend
│   ├── index.html             # Pesquisa
│   ├── admin.html             # Área restrita
│   ├── tv.html                # TV Wall
│   ├── qr.html                # Cartaz com QR Code por setor (js/qr.js, js/vendor/qrcode.js)
│   ├── css/  img/  js/
├── server/
│   ├── index.js               # Servidor Express
│   ├── db.js                  # Conexão com o MySQL (pool) e teste de conexão
│   ├── lib/                   # Autenticação, validação de avaliações, utilidades
│   ├── routes/                # public.js (pesquisa, login, TV) e admin.js (área restrita)
│   └── scripts/criar-gerente.js, migrar.js
├── tests/api.test.js          # Testes automatizados da API
├── .env.example               # Modelo das variáveis de ambiente
└── package.json
```

## Instalação

Pré-requisitos: **Node.js 18 ou superior** (com npm) e **MySQL Server 8.0 ou superior**. O MySQL Workbench é opcional, mas facilita rodar o SQL e consultar as tabelas.

1. Confira o que já está instalado (PowerShell ou terminal):

   ```
   node -v
   npm -v
   mysql --version
   ```

   No Windows, o comando `mysql` pode não estar no PATH mesmo com o MySQL instalado. Nesse caso use o MySQL Workbench no passo 4.

2. Instale as dependências do projeto, dentro da pasta do projeto:

   ```
   npm install
   ```

3. Crie o arquivo `.env` a partir do modelo e preencha com os seus valores (veja a próxima seção):

   ```
   copy .env.example .env        (Windows)
   cp .env.example .env          (Linux e macOS)
   ```

4. Crie o banco e as tabelas. No **MySQL Workbench**: abra a conexão, menu *File > Open SQL Script*, escolha `database/schema.sql` e clique no raio (Execute). Ou pelo terminal:

   ```
   mysql -u root -p < database/schema.sql
   ```

   O script pode ser executado mais de uma vez sem apagar dados.

5. Crie o primeiro gerente (pede nome, e-mail e senha de 8 a 72 caracteres):

   ```
   npm run criar-gerente
   ```

## Variáveis de ambiente

O arquivo `.env` guarda as credenciais e **não vai para o GitHub** (está no `.gitignore`). Nunca coloque senhas no código-fonte.

| Variável | Para que serve | Exemplo |
| --- | --- | --- |
| `DB_HOST` | Endereço do MySQL | `localhost` |
| `DB_PORT` | Porta do MySQL | `3306` |
| `DB_NAME` | Nome do banco | `hospital_experiencia` |
| `DB_USER` | Usuário do MySQL | `root` |
| `DB_PASSWORD` | Senha do MySQL | `sua_senha` |
| `PORT` | Porta do site | `3000` |
| `NODE_ENV` | `development` ou `production` | `development` |
| `JWT_SECRET` | Texto longo e aleatório que assina o login (mínimo 24 caracteres) | veja abaixo |
| `COOKIE_SECURE` | `true` somente quando o site estiver em HTTPS | `false` |
| `TV_TOKEN` | Opcional. Se preenchido, a TV Wall só abre com `/tv.html?token=VALOR` | vazio |
| `TRUST_PROXY` | Opcional. Número de proxies à frente do servidor (para o limite de tentativas ver o IP real) | `1` |

Para gerar o `JWT_SECRET`:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Atualizar um banco criado em versão anterior

Se você já criou o banco com uma versão anterior, não precisa apagar nada: ao iniciar, o servidor atualiza sozinho (move a pergunta de recomendação para a 3ª posição, libera perguntas além de 5, prepara os setores ativáveis e a gravação em tempo real). Você também pode rodar manualmente:

```
npm run migrar
```

O comando pode ser repetido sem risco. Os textos de perguntas editados e as avaliações já enviadas são mantidos.

## Execução

```
npm start
```

No terminal deve aparecer:

```
Banco de dados conectado com sucesso. (banco: hospital_experiencia, MySQL 8.x)
Servidor rodando em http://localhost:3000 ...
```

- Pesquisa: http://localhost:3000
- Área restrita: http://localhost:3000/admin
- TV Wall: http://localhost:3000/tv.html
- Teste de conexão com o banco: http://localhost:3000/api/saude

**QR Code por setor** (um QR por setor, apontando para `/?setor=<código>`):

| Código | Setor | Código | Setor |
| --- | --- | --- | --- |
| `rec` | Recepção | `ic` | Internação Clínica |
| `pa` | Pronto Atendimento | `ip` | Internação Pediátrica |
| `rx` | Raio-X | `sm` | Internação Saúde Mental |
| `endo` | Endoscopia e Colonoscopia | `ob` | Atendimento com Obstetrícia |
| `cc` | Centro Cirúrgico | `tr` | Atendimento com Traumato |

O QR Code da pesquisa de satisfação não deve ser confundido com o QR Code de notificação de eventos adversos que o hospital já usa nos setores. Se os dois forem usados, identifique cada um claramente.

## Banco de dados

Banco `hospital_experiencia`, definido em `database/schema.sql`.

| Tabela | Finalidade |
| --- | --- |
| `setores` | Pontos de entrada da pesquisa. A coluna `origem` diz se o setor vem do site oficial, da pesquisa impressa, do protótipo ou se foi `cadastrado` pelo gerente. A coluna `ativo` esconde o setor da pesquisa sem apagar o histórico. |
| `usuarios` | Contas da equipe: perfil (`gerente`, `admin`, `visualizador`) e setor. Uma chave única garante 1 administrador ativo por setor. |
| `perguntas` | Quantas o setor precisar (o painel limita em 30), na ordem escolhida. Cada setor tem exatamente 1 do tipo `nps` (garantido pelo banco). |
| `avaliacoes` | Uma linha por avaliação, anônima. Guarda turno, perfil de quem respondeu, tipo de atendimento, telefone (opcional) e situação do contato. |
| `respostas` | Uma linha por pergunta respondida, com o texto da pergunta da época. |

Relacionamentos: `perguntas.setor_id`, `avaliacoes.setor_id` e `usuarios.setor_id` apontam para `setores`; `respostas.avaliacao_id` aponta para `avaliacoes`; `respostas.pergunta_id` aponta para `perguntas`.

Para recomeçar do zero, no início do `schema.sql` há um bloco `DROP TABLE` comentado (apaga tudo).

## API

Todas as respostas são JSON, exceto a exportação em Excel. Pedidos que alteram dados exigem o cabeçalho `X-Requested-With: fhdod` (proteção contra CSRF).

**Públicas**

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/saude` | Teste de conexão com o banco |
| GET | `/api/perguntas` | Setores e perguntas ativas |
| POST | `/api/avaliacoes/iniciar` | Começa uma avaliação (rascunho) e devolve um token |
| PUT | `/api/avaliacoes/:token/resposta` | Grava ou troca uma resposta na hora |
| POST | `/api/avaliacoes/:token/concluir` | Conclui: dia, turno, tipo de atendimento e telefone opcional |
| POST | `/api/avaliacoes` | Envia uma avaliação completa de uma vez |
| POST | `/api/login` | Entrar (limite de 10 tentativas a cada 15 minutos) |
| POST | `/api/logout` | Sair |
| GET | `/api/me` | Dados de quem está logado |
| GET | `/api/admin/andamento` | (login) Avaliações em andamento e abandonadas, no alcance do perfil |
| GET | `/api/tv` | Indicadores agregados da TV Wall |

**Área restrita (exige login; o alcance depende do perfil)**

| Método | Rota | Perfis |
| --- | --- | --- |
| GET | `/api/admin/avaliacoes` | Todos |
| GET | `/api/admin/export.xlsx` | Todos |
| PATCH | `/api/admin/avaliacoes/:id/contato` | Gerente, administrador |
| GET, PUT | `/api/admin/perguntas/:setor` | Gerente, administrador (salva a lista inteira: novas, ordem, exclusões) |
| GET | `/api/admin/setores` | Todos os perfis (lista com ativos e desativados) |
| POST, PATCH | `/api/admin/setores`, `/api/admin/setores/:id` | Somente o gerente (criar, renomear, mover, ativar e desativar) |
| GET | `/api/admin/resultado-perguntas` | Todos, dentro do alcance (nota, NPS e opções por pergunta) |
| GET, POST | `/api/admin/usuarios` | Gerente, administrador |
| PATCH | `/api/admin/usuarios/:id` | Gerente, administrador |

## Segurança e LGPD

- Senhas com hash `bcrypt`; nunca guardadas em texto.
- Login por cookie `httpOnly` e `SameSite=Strict`, válido por 8 horas. O perfil é conferido no banco a cada requisição, então desativar uma conta vale na hora.
- Consultas SQL parametrizadas, validação de todos os dados recebidos e política de segurança de conteúdo (`helmet`).
- Limite de tentativas de login e de envios de avaliação por endereço.
- Exportação em Excel protegida contra injeção de fórmulas.
- A avaliação é **anônima**. O telefone é opcional, só é aceito quando a nota está abaixo da média e há autorização expressa, e fica visível apenas para o gerente e o administrador do setor. Nunca aparece para o visualizador, na TV Wall nem no Excel. O telefone pode ser apagado depois do contato.
- Não há campo de texto livre do paciente, para evitar dados de saúde no sistema.

Para uso oficial, a finalidade, o prazo de guarda do telefone e a base legal devem ser definidos junto ao responsável pela LGPD do hospital.

## Testes

Testes automatizados da API (Node 18+, sem bibliotecas extras). **Use um banco de teste:** os testes criam avaliações e contas.

Com o servidor ligado e um gerente já criado:

```
PowerShell:
$env:TEST_GERENTE_EMAIL="gerente@exemplo.com"; $env:TEST_GERENTE_SENHA="sua-senha"; $env:BASE_URL="http://localhost:3000"; npm test

Linux e macOS:
BASE_URL=http://localhost:3000 TEST_GERENTE_EMAIL=gerente@exemplo.com TEST_GERENTE_SENHA=sua-senha npm test
```

Os 23 testes cobrem: conexão, perguntas, proteção CSRF, login, registro de avaliação, gravação em tempo real (rascunho), painel ao vivo, página do QR Code, setores novos, perguntas além de 5 (adicionar, reordenar, excluir), regras do telefone, validações, os três perfis (inclusive 1 administrador por setor), edição de perguntas, contatos, Excel, TV Wall e regras de segurança da equipe.

Também foi feito um teste de interface com navegador simulado (jsdom) cobrindo a pesquisa e as telas de gerente, administrador, visualizador e TV Wall. Esse teste não faz parte do repositório.

Verificação feita neste protótipo: API (16 de 16) e interface contra **MySQL 8.0.46**.

## Solução de problemas

| Mensagem | Significado e o que fazer |
| --- | --- |
| `ECONNREFUSED` | O MySQL não está rodando ou `DB_HOST` e `DB_PORT` estão errados. Inicie o serviço do MySQL. |
| `ER_ACCESS_DENIED_ERROR` | Usuário ou senha do MySQL incorretos. Confira `DB_USER` e `DB_PASSWORD` no `.env`. |
| `ER_BAD_DB_ERROR` | O banco não existe. Rode `database/schema.sql` e confira `DB_NAME`. |
| `ER_NO_SUCH_TABLE` | Faltam as tabelas. Rode `database/schema.sql`. |
| `FALHA: a porta 3000 já está em uso` | O servidor já está rodando em outro terminal. Feche-o ou mude `PORT` no `.env`. |
| `FALHA: defina JWT_SECRET no arquivo .env ...` | `JWT_SECRET` está vazio, curto demais ou igual ao exemplo. Gere um novo (comando na seção de variáveis de ambiente) e reinicie. |
| `Muitas tentativas de login` | O limite de 10 tentativas em 15 minutos foi atingido. Aguarde ou reinicie o servidor em desenvolvimento. |

## Limitações conhecidas

- A proteção contra envios falsos na pesquisa é um campo escondido e um tempo mínimo no navegador, somada ao limite de envios por endereço. Para proteção forte, o ideal é um captcha validado no servidor.
- O painel carrega as 5.000 avaliações mais recentes. Com volume maior, os totais devem ser calculados no banco.
- A escala de recomendação vai de 1 a 10 e o NPS oficial usa 0 a 10, então a comparação direta com o formulário em papel pode ter pequenas diferenças.
- O servidor não faz HTTPS sozinho. Em produção, publique atrás de um proxy com HTTPS e use `COOKIE_SECURE=true` e `TRUST_PROXY`.
- Não há recuperação de senha por e-mail: o gerente (ou o administrador, para visualizadores) define uma nova senha na aba Equipe.
- Ainda não há documentação online da API (OpenAPI/Swagger) nem a pasta `docs/` pedida na disciplina.

## Créditos

- Geração do QR Code: biblioteca `qrcode-generator` 1.4.4, de Kazuhiko Arase, licença MIT (arquivo `public/js/vendor/qrcode.js`, com o aviso de licença mantido). "QR Code" é marca registrada da DENSO WAVE INCORPORATED.

## Fontes institucionais

- Fundação Hospitalar Dr. Oswaldo Diesel, site oficial: https://fhdod.com.br/
- Contato (endereço, telefone (51) 3546-1236 e e-mail sac@fhdod.com.br): https://fhdod.com.br/contato
- A lista de setores combina serviços do site oficial, itens da pesquisa de satisfação impressa do hospital (FM-NEG-0.083, versão 02) e setores definidos para o protótipo; a origem de cada um está na coluna `origem` da tabela `setores`.
