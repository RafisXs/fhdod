# Avaliação do Atendimento - FHDOD

Revisão de lançamento: [docs/reports/2026-10-30-revisao.md](../reports/2026-10-30-revisao.md), com evidências, correções e pendências de homologação.

Na aba **Setores**, use **Imprimir QR Code geral** para abrir a escolha de setor. A impressão em lote inclui o geral e os setores ativos, com um cartaz A4 por página. O endereço deve ser a origem pública (por exemplo, `https://avaliacao.seuhospital.com.br`), sem caminhos ou parâmetros; na ausência de configuração, usa-se o domínio atual. O QR continua disponível em SVG e PNG.

Na tela **Alterar minha senha**, é possível mostrar/ocultar os campos, conferir as regras e corrigir erros antes de enviar. A troca mantém a validação no servidor e a revogação das sessões anteriores.

Para verificar sintaxe: `npm run lint`. Para API, segurança e interface em banco temporário isolado: `npm run test:painel` (requer MySQL e Chrome no caminho definido em `tests/e2e/painel.test.cjs`). No PowerShell com bloqueio de scripts, use `npm.cmd`. O navegador dessa suíte usa `--no-sandbox` apenas para testes locais; não use esse perfil para navegação comum. O comando `npm run test:seguranca` isolado exige servidor e credenciais de teste configurados; nunca aponte os testes ao banco operacional.

Vistoria de 05/11/2026: **29 testes de API, 10 verificações de segurança e os fluxos de navegador aprovados; zero vulnerabilidades conhecidas na auditoria npm após as correções.** Consulte [o relatório da vistoria](../reports/2026-11-05-vistoria.md) para alterações, evidências e limitações de volume e implantação. As contagens datadas abaixo descrevem rodadas anteriores.

Sistema web para coletar a avaliação do atendimento por setor (pesquisa de satisfação com NPS) e acompanhar os resultados em um painel com perfis de acesso, TV Wall e exportação em Excel.

> Sistema de avaliação do atendimento da Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD), Três Coroas - RS.

Guia operacional: [implantação, HTTPS, serviço e backup](../guides/implantacao.md). Plano de evolução e validações institucionais: [pendências](../development/pendencias.md). A entrega técnica desta rodada não substitui homologação da TI, da gestão e do encarregado de privacidade.

Evidências da rodada: [relatório de testes de segurança](../reports/2026-10-29-seguranca.md).


## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Perfis de acesso](#perfis-de-acesso)
3. [Tecnologias](#tecnologias)
4. [Estrutura do repositório](#estrutura-do-repositório)
5. [Instalação](#instalação)
6. [Variáveis de ambiente](#variáveis-de-ambiente)
7. [Atualizar um banco criado em versão anterior](#atualizar-um-banco-criado-em-versão-anterior)
8. [Execução](#execução)
9. [Banco de dados](#banco-de-dados)
10. [API](#api)
11. [Segurança e LGPD](#segurança-e-lgpd)
12. [Testes](#testes)
13. [Solução de problemas](#solução-de-problemas)
14. [Limitações conhecidas](#limitações-conhecidas)
15. [Créditos](#créditos)
16. [Fontes institucionais](#fontes-institucionais)
17. [Indicadores e interpretação dos dados](#indicadores-e-interpretação-dos-dados)
18. [Melhorias implementadas no painel](#melhorias-implementadas-no-painel)
19. [Conferência dos cálculos e qualidade dos dados](#conferência-dos-cálculos-e-qualidade-dos-dados)

## Funcionalidades

**Pesquisa (pacientes e familiares, sem login) - `/`**

- Escolha do setor e perguntas **sem limite fixo de 5** (até 30 por setor). O padrão de cada setor é: duas de nota (5 níveis), a **recomendação de 1 a 10 com carinhas na 3ª posição**, uma de pontos positivos e uma de pontos a melhorar. Cada setor tem exatamente uma pergunta de recomendação, que não pode ser excluída.
- **Gravação em tempo real:** após o aceite inicial, cada resposta é salva como rascunho, permitindo acompanhamento no painel ao vivo. O envio final reenvia as respostas como garantia e conclui a avaliação. Somente avaliações concluídas entram nos indicadores.
- Passo final: dia do atendimento, turno (Dia ou Noite), paciente ou familiar e tipo de atendimento (SUS, Plano de Saúde ou Particular).
- Quando a nota fica abaixo da média, aparece um campo **opcional** de telefone, com autorização expressa de contato, para a gestão do setor ligar e entender o que houve.
- Link direto por setor, para gerar QR Code: `/?setor=rx`.
- Layout para celular, navegação por teclado e foco visível.
- **Privacidade (LGPD):** uma caixa compacta antes da primeira pergunta resume a finalidade e permite ler o [Aviso de Privacidade](../../src/public/privacidade.html). O aceite começa desmarcado e libera o início da pesquisa. O telefone continua opcional, com autorização separada. O aviso permanece acessível no rodapé; a última etapa apenas relembra o aceite, sem exigir nova marcação.
- **Evidência no servidor:** a primeira resposta salva registra a versão do aviso e a data/hora UTC do aceite (`privacidade_versao`, `privacidade_aceita_em`). A API exige aceite booleano explícito e a versão atual para iniciar, enviar ou concluir avaliações. Registros anteriores permanecem com campos nulos, sem atribuir aceite retroativo. A versão atual é definida em `src/server/lib/privacidade.js` e informada por `/api/perguntas`.

**Área restrita (equipe) - `/admin`**

- Resultados: indicadores, gráficos, ranking por setor, filtros (período, setor, turno, tipo de atendimento), comparação com o período anterior, impressão e exportação em Excel.
- Contatos: respondentes que autorizaram o acompanhamento, com situação (pendente, contatado, resolvido), observações e botões **Ligar** e **WhatsApp**. A ligação utiliza `tel:` e depende de um aplicativo compatível no dispositivo. O WhatsApp abre uma conversa com o número informado, em nova aba, sem enviar mensagem automaticamente. Abrir um canal não altera a situação do contato; a equipe deve registrar e salvar o acompanhamento.
- **Ao vivo:** no topo de Resultados, um painel mostra quem está respondendo agora e quem não terminou, com as respostas já dadas (nota, recomendação, pontos positivos e a melhorar). Cada resposta aparece quando o paciente avança, e o painel se atualiza sozinho a cada 8 segundos. Esses rascunhos não entram nos indicadores, que contam só as avaliações enviadas. Quando alguém termina, os indicadores se atualizam sozinhos. Respeita o setor de cada perfil e nunca mostra telefone.
- Perguntas: **adicionar, excluir, reordenar (subir e descer)**, editar texto, tipo e opções, e ativar ou desativar. A pergunta de recomendação (1 a 10) é protegida: dá para mudar o texto e a posição, não excluir. Perguntas excluídas não apagam as respostas já dadas.
- **Setores (só o gerente):** criar setor novo (nasce com 5 perguntas padrão e o seu link da pesquisa para virar QR Code), renomear, mudar a ordem, ativar e desativar. Setor desativado some da pesquisa e da TV, mas o histórico fica. Não há exclusão definitiva.
- **QR Code pelo painel:** na aba Setores, cada setor tem o botão **QR Code**, que abre um cartaz A4 pronto para imprimir (ou salvar em PDF), com o logo, o nome do setor e o QR Code, e permite baixar o QR em PNG ou SVG. Há também o botão para imprimir os cartazes de todos os setores ativos de uma vez. O QR é gerado no próprio navegador (biblioteca local, sem site externo). Informe antes o **endereço do site publicado** (campo na aba Setores, guardado neste navegador): um QR com `localhost` só funciona no seu computador.
- **Resultado por pergunta:** em Resultados, nota média, NPS e opções mais escolhidas de cada pergunta, inclusive as novas.
- Equipe: criação e desativação de contas, conforme o perfil.
- **Alterar minha senha:** disponível para todos os perfis, com confirmação da senha atual e definição de senha diferente. Novas contas e senhas redefinidas exigem troca antes de acessar os demais recursos. Após a troca, as sessões anteriores são invalidadas e o navegador recebe uma sessão atualizada.
- **Proteção por conta:** cinco falhas consecutivas de senha bloqueiam novas autenticações por 15 minutos. O contador é persistido no MySQL, além do limite de tentativas por IP. A senha correta não libera uma conta ainda bloqueada. O bloqueio não encerra automaticamente sessões já autenticadas.
- **Auditoria (gerente):** consulta paginada dos eventos de autenticação, senhas, perguntas, contas, setores e contatos. Registra quem recebeu telefones na consulta autorizada e quem os apagou, sem gravar os números, as senhas ou as observações no log. O registro representa a disponibilização ao navegador, e não prova de leitura humana ou envio de mensagem.

**TV Wall - `/tv.html`**

- Painel para **televisão de 32 polegadas** (Full HD 1920x1080 ou HD 1366x768), vista de longe: números grandes, cores de status (verde, amarelo, vermelho), relógio, sem barra de rolagem. Atualiza a cada 30 segundos. Nunca mostra telefone, nome ou resposta individual.
- Dica: abra em tela cheia (F11) no navegador da TV.

**Painel da equipe em monitor de computador**

- A partir de 1100 px de largura o painel usa o espaço do monitor: indicadores numa linha, gráficos lado a lado e tabela por setor em largura total. No celular e no tablet continua em coluna única.
- **Tela de login para computador (`/admin`):** a partir de 1000 px ficam duas colunas (apresentação dos perfis + formulário), campo de e-mail já selecionado, aviso de Caps Lock ligado, opção "Mostrar senha" e botão que bloqueia cliques repetidos. No celular o formulário vem primeiro e ocupa a largura toda.

## Perfis de acesso

| Recurso | Gerente | Administrador de setor | Visualizador |
| --- | --- | --- | --- |
| Alcance dos dados | Todos os setores | Somente o seu setor | O seu setor (ou todos, se criado sem setor) |
| Ver resultados e exportar Excel | Sim | Sim | Sim |
| Ver telefones e registrar contato | Sim | Sim (do seu setor) | **Nunca** |
| Alterar a própria senha | Sim | Sim | Sim |
| Consultar auditoria | Sim | Não | Não |
| Adicionar, excluir, reordenar e editar perguntas | Todos os setores | Somente o seu setor | Não |
| Criar, renomear, ordenar e desativar setores | **Sim (só ele)** | Não | Não |
| Equipe | Cria e gerencia todas as contas, **sendo o único que cria administradores** (1 por setor) e outros gerentes | Cria e gerencia apenas visualizadores do seu setor; não cria admins nem muda perfis | Não |
| Atalho da TV Wall no painel | Sim | Não | Não |

Regras:

- Cada setor pode ter **no máximo 1 administrador ativo** (garantido pelo banco de dados). Para trocar, desative o atual e crie ou ative outro.
- Precisa existir pelo menos um gerente ativo, e ninguém desativa ou rebaixa a própria conta.
- O primeiro gerente é criado pelo terminal (`npm run criar-gerente`). Não existe cadastro público.
- Senhas devem ter pelo menos 8 caracteres e até 72 bytes UTF-8; letras acentuadas e outros caracteres podem ocupar mais de um byte. A senha provisória deve ser substituída por outra diferente. Contas antigas são preservadas na migração sem presumir que todas utilizam senha provisória; novas contas e redefinições recebem a exigência automaticamente.

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

Consulte a estrutura atual no [README](../../README.md) e no [guia de organização](../development/estrutura.md). Os caminhos deste manual são relativos à raiz do repositório.

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

5. Crie o primeiro gerente (pede nome, e-mail e senha provisória com pelo menos 8 caracteres e até 72 bytes UTF-8):

   ```
   npm run criar-gerente
   ```

## Variáveis de ambiente

O arquivo `.env` guarda as credenciais e **não vai para o GitHub** (está no `.gitignore`). Nunca coloque senhas no código-fonte.

O módulo `src/server/config.js` procura primeiro `app/.env` e depois o `.env` da pasta principal. Para uma mesma variável, o valor de `app/.env` tem prioridade sobre o arquivo da pasta principal; variáveis já definidas no ambiente do processo são preservadas. Isso permite iniciar o servidor e os comandos de manutenção sem depender da pasta atual do terminal. Evite manter valores contraditórios nos dois arquivos.

| Variável | Para que serve | Exemplo |
| --- | --- | --- |
| `DB_HOST` | Endereço do MySQL | `localhost` |
| `DB_PORT` | Porta do MySQL | `3306` |
| `DB_NAME` | Nome do banco | `hospital_experiencia` |
| `DB_USER` | Usuário do MySQL | `root` |
| `DB_PASSWORD` | Senha do MySQL | `sua_senha` |
| `PORT` | Porta do site | `3000` |
| `HOST` | Interface de escuta; atrás de proxy na mesma máquina, restringir a loopback | `127.0.0.1` em produção; padrão `0.0.0.0` |
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

A migração também revisa os enunciados que ainda correspondem exatamente aos textos padrão antigos. Perguntas com textos personalizados não são substituídas. O texto histórico em `respostas.pergunta_texto` permanece inalterado, mesmo quando o enunciado atual muda. A migração não cria o banco inicial: uma instalação nova ainda exige a execução de `database/schema.sql`.

A migração de segurança acrescenta `trocar_senha`, `versao_sessao`, `tentativas_falhas` e `bloqueado_ate` em `usuarios`, além da tabela `auditoria`. Não apaga avaliações nem redefine senhas existentes. A inicialização encerra com erro se o banco estiver indisponível, permitindo a supervisão pelo gerenciador de serviço. Fazer backup antes de atualizar; ver [guia de implantação](../guides/implantacao.md).

## Execução

```
npm start
```

No PowerShell do Windows, utilize `npm.cmd start` se a política de execução bloquear `npm.ps1`. Não é necessário alterar a política do sistema. Os comandos `start`, `dev`, `migrar`, `criar-gerente`, `test` e `test:painel` também podem ser executados na pasta principal, que os encaminha para `app/`. Para instalar as dependências a partir dessa pasta, execute `npm.cmd --prefix app install`.

Os endereços abaixo exemplificam a porta padrão `3000`. A porta efetiva é a definida em `PORT`; na configuração local verificada em 29/10/2026, a aplicação utilizava `http://localhost:3002`, com administração em `http://localhost:3002/admin`. Consulte a mensagem de inicialização para confirmar o endereço da sua instalação. Após mudanças de CSS ou JavaScript, atualize o navegador com **Ctrl + F5**.

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
| `setores` | Pontos de entrada da pesquisa. A coluna `origem` diz se o setor vem do site oficial, da pesquisa impressa, da configuração inicial ou se foi `cadastrado` pelo gerente. A coluna `ativo` esconde o setor da pesquisa sem apagar o histórico. |
| `usuarios` | Contas da equipe: perfil (`gerente`, `admin`, `visualizador`) e setor. Uma chave única garante 1 administrador ativo por setor. |
| `perguntas` | Quantas o setor precisar (o painel limita em 30), na ordem escolhida. Cada setor tem exatamente 1 do tipo `nps` (garantido pelo banco). |
| `avaliacoes` | Uma linha por avaliação, anônima. Guarda turno, perfil de quem respondeu, tipo de atendimento, telefone (opcional) e situação do contato. |
| `respostas` | Uma linha por pergunta respondida, com o texto da pergunta da época. |
| `auditoria` | Eventos com horário UTC, ID do responsável, ação, recurso, identificador e metadados limitados definidos pelo servidor; sem senhas ou números de telefone. |

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
| POST | `/api/senha` | Exige login, senha atual e nova senha; permite concluir a troca obrigatória e revoga sessões anteriores. |
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
| GET | `/api/admin/auditoria?antes=<id>` | Somente gerente; até 100 eventos por página, em ordem decrescente de ID. |

`POST /api/senha` recebe `{ "senha_atual": "...", "nova_senha": "..." }`. `GET /api/me` e o login incluem `trocar_senha`. Enquanto essa marca estiver ativa, o servidor permite consulta ao perfil, troca de senha e logout; os recursos administrativos retornam HTTP 403 com código `TROCAR_SENHA`. Não basta ocultar as abas na interface: a restrição é aplicada no servidor.

## Segurança e LGPD

- Senhas com hash `bcrypt`; nunca guardadas em texto.
- Login por cookie `httpOnly` e `SameSite=Strict`, válido por 8 horas. O perfil é conferido no banco a cada requisição, então desativar uma conta vale na hora.
- Cookies incluem versão de sessão validada no banco. Troca/redefinição de senha e alterações de conta invalidam versões anteriores. Senhas e sua confirmação não são gravadas no log de auditoria.
- Atualizações auditadas são gravadas na mesma transação que seu evento. Uma falha na auditoria reverte a atualização correspondente; a leitura de telefones também não é enviada se seu evento não puder ser gravado. Administradores do banco ainda podem modificar a tabela: não se trata de log criptograficamente imutável.
- Consultas SQL parametrizadas, validação de todos os dados recebidos e política de segurança de conteúdo (`helmet`).
- Limite de tentativas de login e de envios de avaliação por endereço.
- Exportação em Excel protegida contra injeção de fórmulas.
- A avaliação é **anônima**. O telefone é opcional, só é aceito quando a nota está abaixo da média e há autorização expressa, e fica visível apenas para o gerente e o administrador do setor. Nunca aparece para o visualizador, na TV Wall nem no Excel. O telefone pode ser apagado depois do contato.
- Não há campo de texto livre do paciente, para evitar dados de saúde no sistema.

Para uso oficial, a finalidade, o prazo de guarda do telefone e a base legal devem ser definidos junto ao responsável pela LGPD do hospital.

Há aviso e mecanismo de aceite na pesquisa, mas o texto ainda depende de homologação institucional. Não há 2FA ou expurgo automático de telefones. Esses itens estão explicitamente registrados em [pendências](../development/pendencias.md), junto com a política de retenção, atendimento à exclusão e aprovação da escala e dos textos pela instituição. A caixa de aceite, isoladamente, não comprova conformidade integral com a LGPD.

Ao revisar o aviso, preservar a versão anterior no histórico do repositório e atribuir uma nova versão tanto ao texto publicado quanto a `VERSAO_PRIVACIDADE`. O prazo efetivo de retenção, o canal definitivo do encarregado e os procedimentos de atendimento aos direitos devem ser homologados pelo hospital; o aviso atual não inventa prazo de exclusão automática ou nome de encarregado.

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

Para validar o painel em navegador real no Windows, com o Google Chrome instalado, execute `npm.cmd run test:painel`. Esse comando cria um banco temporário exclusivo, executa os testes da API e verifica filtros, gráficos, contatos e edição de perguntas no navegador, sem inserir dados de teste no banco da aplicação. O usuário MySQL configurado precisa ter permissão para criar e remover esse banco temporário. As capturas de tela são gravadas em `verification/screenshots/`.

A suíte também executa `tests/security/seguranca.test.js` no banco temporário. Verifica restrição de primeiro acesso, senha atual, repetição e limite UTF-8, revogação de sessões, bloqueio e expiração, redefinição de senha, permissões da auditoria e ausência de senhas no log. Uma falha simulada no banco verifica o rollback da alteração auditada e o bloqueio da disponibilização de telefones. A simulação cria e remove um trigger apenas no banco temporário, exigindo privilégio `TRIGGER`. O arquivo recusa execução fora de um banco `fhdod_verify_<identificador>`.

Com o aceite de privacidade, a suíte da API passa a conter **24 testes**, incluindo rejeição de aceite ausente, falso, textual ou de versão antiga. O navegador verifica também a recusa sem criação de avaliação, o registro do aceite na primeira resposta e a conclusão da pesquisa sem telefone. O teste de privacidade não representa homologação jurídica do texto.

Verificação registrada em 29/10/2026: **23 testes da API aprovados**, além das verificações de interface em Chrome real, contra **MySQL 8.0.46**. A verificação inclui filtros por pergunta, revisão repetível dos enunciados padrão sem substituir personalizações, gráficos, contatos, menus de seleção e criação, reordenação, exclusão e salvamento de perguntas. Também verifica a largura da página em tela móvel e a ausência de exceções JavaScript durante os fluxos exercitados.

Na rodada de segurança, também passaram **10 verificações na suíte de segurança** (incluindo o cenário principal e seus subtestes), além dos fluxos de auditoria, troca pessoal de senha e primeiro acesso obrigatório em navegador real. Os modelos de implantação não foram instalados em infraestrutura externa e o procedimento de backup/restauração deve ser exercitado no ambiente de destino pela TI.

O teste de navegador utiliza Node.js com `WebSocket` global e Chrome no caminho `C:/Program Files/Google/Chrome/Application/chrome.exe`. As portas HTTP e de depuração são escolhidas automaticamente entre portas livres. O ambiente usado foi Node.js 24.14.1 no Windows. O requisito geral Node.js 18+ da aplicação não garante a execução desse teste de navegador sem ajustes. O teste cria um banco `fhdod_verify_<identificador>` e tenta removê-lo ao finalizar; se o processo for interrompido abruptamente, pode restar um banco temporário. Não aponte a suíte `npm test` manualmente para o banco de uso do hospital: ela grava dados.

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
| `npm.ps1` bloqueado no PowerShell | Use `npm.cmd` nos comandos, por exemplo `npm.cmd start`. |
| Estilos ou menus antigos após uma atualização | Recarregue com **Ctrl + F5**. Confirme que os arquivos `js/select.js` e `css/dashboard.css` estão sendo servidos pela instalação atual. |

## Limitações conhecidas

- A proteção contra envios falsos na pesquisa é um campo escondido e um tempo mínimo no navegador, somada ao limite de envios por endereço. Para proteção forte, o ideal é um captcha validado no servidor.
- O painel carrega as 5.000 avaliações mais recentes. Com volume maior, os totais devem ser calculados no banco.
- A escala de recomendação vai de 1 a 10 e o NPS oficial usa 0 a 10, então a comparação direta com o formulário em papel pode ter pequenas diferenças.
- O servidor não faz HTTPS sozinho. Em produção, publique atrás de um proxy com HTTPS e use `COOKIE_SECURE=true` e `TRUST_PROXY`.
- Não há recuperação de senha por e-mail: o gerente (ou o administrador, para visualizadores) define uma nova senha na aba Equipe.
- Todos os perfis podem trocar a própria senha. Recuperação sem conhecimento da senha atual continua dependendo da gestão; para o gerente, o procedimento de contingência usa `npm run criar-gerente` após validação da identidade e autorização.
- A pasta `docs/` contém o guia de implantação, modelos e pendências. Documentação online OpenAPI/Swagger, CI e teste de carga ainda não foram entregues.

## Créditos

- Geração do QR Code: biblioteca `qrcode-generator` 1.4.4, de Kazuhiko Arase, licença MIT (arquivo `src/public/js/vendor/qrcode.js`, com o aviso de licença mantido). "QR Code" é marca registrada da DENSO WAVE INCORPORATED.

## Fontes institucionais

- Fundação Hospitalar Dr. Oswaldo Diesel, site oficial: https://fhdod.com.br/
- Contato (endereço, telefone (51) 3546-1236 e e-mail sac@fhdod.com.br): https://fhdod.com.br/contato
- A lista de setores combina serviços do site oficial, itens da pesquisa de satisfação impressa do hospital (FM-NEG-0.083, versão 02) e setores definidos para a pesquisa; a origem de cada um está na coluna `origem` da tabela `setores`.

## Indicadores e interpretação dos dados

### Base de cálculo e filtros

Os indicadores de Resultados utilizam apenas avaliações com `status = 'concluida'`, dentro do alcance do perfil conectado e dos filtros selecionados. Respostas de avaliações em rascunho aparecem na seção de acompanhamento ao vivo, mas não entram nos totais, médias, NPS ou percentuais de satisfação.

| Filtro | Aplicação |
| --- | --- |
| Período | Últimos 7, 30 ou 90 dias, ou todo o período disponível. Utiliza `criado_em`, a data de criação do registro da avaliação. |
| Setor | Restringe os registros ao setor selecionado. A autorização do usuário continua sendo aplicada no servidor. |
| Turno | Utiliza o turno de atendimento informado pelo respondente: Dia ou Noite. |
| Tipo de atendimento | Utiliza SUS, Plano de Saúde ou Particular, conforme informado no formulário. |

O filtro de período **não utiliza `data_atendimento`** e também não representa necessariamente o instante da conclusão: no fluxo de rascunho, `criado_em` é registrado quando a avaliação começa. Os intervalos são móveis: últimos 30 dias correspondem a uma janela de 30 × 24 horas contada a partir do momento do cálculo. O gráfico diário agrupa essa janela por datas e pode exibir 31 rótulos de dias, porque o primeiro e o último dia podem estar parcialmente incluídos.

Os horários são armazenados e consultados em UTC. No painel, as datas dos agrupamentos diários e semanais são apresentadas conforme o fuso do navegador. Para a mesma apresentação em estações diferentes, configure os dispositivos para o fuso utilizado pelo hospital, por exemplo `America/Sao_Paulo`. Cálculos feitos no navegador e no servidor podem variar no limite exato do intervalo devido ao horário de cada cálculo.

### Cartões de indicadores

| Cartão | Definição | Fórmula ou regra |
| --- | --- | --- |
| Avaliações | Quantidade de avaliações concluídas no recorte. Não é necessariamente quantidade de pacientes distintos. | Contagem dos registros selecionados. |
| Nota média | Média das notas médias individuais das avaliações que possuem respostas de satisfação. | Soma das médias individuais ÷ quantidade de avaliações com média válida. |
| NPS | Saldo entre as proporções de promotores e detratores da recomendação. Varia de −100 a +100. | `100 × (promotores − detratores) ÷ avaliações`. |
| Satisfeitos | Percentual de respostas às perguntas de satisfação com notas 4 ou 5. | `100 × respostas com nota ≥ 4 ÷ total de respostas de satisfação`. |
| Abaixo da média | Avaliações que atendem ao critério de atenção definido no sistema. | Média individual de satisfação menor que 3 **ou** recomendação de até 6. Basta uma condição. |
| Contatos pendentes | Avaliações do recorte com telefone disponível e acompanhamento pendente. | Telefone preenchido e `contato_status = 'pendente'`. |

**Nota média.** Cada pergunta de satisfação usa notas de 1 a 5. A média individual é calculada a partir das respostas desse tipo e armazenada com duas casas decimais. O painel calcula a média dessas médias e exibe uma casa decimal. Perguntas de recomendação, aspectos positivos e oportunidades de melhoria não entram nessa média. Avaliações sem perguntas de satisfação respondidas não entram no denominador da nota média.

Cada avaliação tem o mesmo peso na nota média geral, mesmo que setores ou versões do formulário tenham quantidades diferentes de perguntas. Por isso, a média das médias pode diferir da média de todas as notas individuais reunidas. Já o indicador Satisfeitos considera cada resposta de satisfação: formulários com mais perguntas desse tipo contribuem com mais respostas para seu denominador.

**NPS.** Na escala implementada, notas de 1 a 6 representam detratores, 7 ou 8 representam neutros e 9 ou 10 representam promotores. Os neutros entram no total de avaliações, mas não são somados a nenhum dos dois grupos subtraídos. O resultado é arredondado para um número inteiro e não deve ser lido como percentual de satisfação. Um NPS negativo indica mais detratores do que promotores entre os registros selecionados.

A metodologia convencional utiliza escala de **0 a 10**, enquanto esta aplicação utiliza **1 a 10**. A fórmula do saldo é a mesma, mas o questionário atual é uma adaptação e não deve ser apresentado como uma implementação integral da escala convencional sem essa ressalva. Referência metodológica: [Bain — Measuring Your Net Promoter Score](https://www.netpromotersystem.com/about/measuring-your-net-promoter-score/).

**Satisfeitos.** O rótulo atual se refere a respostas, não a pessoas. Por exemplo, uma mesma avaliação com duas perguntas pode ter uma resposta satisfeita e outra insatisfeita. Assim, 58% de respostas satisfeitas não significa necessariamente que 58% dos respondentes foram classificados como satisfeitos. Notas 1, 2 e 3 permanecem no denominador, mas não no numerador.

**Abaixo da média.** O nome exibido não significa uma comparação com a média geral observada. O sistema utiliza os limites fixos descritos na tabela. Uma avaliação com nota média 4,0 e recomendação 3 entra nesse grupo pela recomendação. Uma avaliação com média 3,5 e recomendação 8 não entra, mesmo que a média geral do painel seja 4,2. Uma avaliação que atende às duas condições é contada apenas uma vez.

**Contatos pendentes.** O telefone é opcional e depende de autorização. Por isso, a quantidade de contatos pode ser menor que a quantidade de avaliações que exigem atenção. O cartão respeita os filtros de Resultados; o contador da aba Contatos considera os registros carregados para o usuário, e a própria aba possui filtros de situação e setor. Esses contadores podem diferir sem erro de cálculo.

### Comparação com o período anterior

Para uma janela atual de N dias, a comparação utiliza os N dias imediatamente anteriores, com os mesmos filtros de setor, turno e tipo de atendimento. Exemplo: últimos 30 dias comparados com o intervalo entre 60 e 30 dias atrás.

As diferenças mostradas são absolutas: quantidade de avaliações, pontos de nota média, pontos do NPS e pontos percentuais de satisfação. Uma passagem de 50% para 60% representa **+10 pontos percentuais**, não aumento relativo de 10%. Valores muito próximos podem ser exibidos como iguais devido à precisão de apresentação.

Se o indicador anterior não puder ser calculado, aparece **“sem dados no período anterior”**. Na contagem de avaliações, a implementação também usa essa mensagem quando a contagem anterior é zero. Isso não representa falha na conexão. Em Todo o período, a comparação não é calculada.

### Gráficos e tabelas

| Visualização | Como interpretar |
| --- | --- |
| Avaliações ao longo do tempo | Quantidade de avaliações por dia nas janelas de 7 e 30 dias; por semana nas janelas de 90 dias e Todo o período. As semanas começam na segunda-feira. O eixo vertical mostra contagem, não qualidade do atendimento. |
| Recomendação de 1 a 10 | Cada barra mostra quantas avaliações atribuíram aquela nota de recomendação. A soma das contagens corresponde ao total de avaliações selecionadas. |
| Faixa de detratores, neutros e promotores | Mostra a proporção de cada grupo no total, com percentuais arredondados. Por arredondamento, os valores exibidos podem somar 99% ou 101%. |
| Perfil dos respondentes | Distribuição por tipo de atendimento, turno e paciente ou familiar. Cada percentual usa o total de avaliações selecionadas como denominador. |
| Aspectos positivos | Quantidade de avaliações que mencionaram cada alternativa positiva, dividida pelo total de avaliações do recorte para obter o percentual. |
| Oportunidades de melhoria | Mesma regra dos aspectos positivos, para alternativas de melhoria. Respostas reconhecidas como “Nada” ou “Nenhum” são tratadas separadamente. |
| Resultado por setor | Recalcula quantidade, média, NPS, satisfação e avaliações que exigem atenção dentro de cada setor. Ordena os setores da menor para a maior nota média; setores sem nota ficam ao final. O aviso Atenção aparece quando a média do setor é inferior a 3. |
| Resultado por pergunta | Apresenta a pergunta e seu tipo, quantidade de respostas e resultado próprio: média e satisfação nas perguntas de escala; média de recomendação e NPS nas perguntas de recomendação; alternativas mais escolhidas nas perguntas de múltipla escolha. |

Nas barras horizontais de perfil, aspectos positivos e melhorias, a maior contagem do grupo define a largura máxima. **Barra cheia não significa necessariamente 100% dos respondentes.** Leia a contagem e o percentual escritos ao lado da barra. A barra de nota média de um setor, por sua vez, usa a escala máxima de 5 pontos.

Perguntas de múltipla escolha permitem marcar várias alternativas; portanto, os percentuais das alternativas podem somar mais de 100%. No resumo de aspectos positivos e melhorias, uma mesma alternativa repetida em diferentes perguntas da mesma avaliação é contada apenas uma vez por avaliação. Perguntas opcionais sem escolhas não acrescentam menções, mas a avaliação continua no denominador do percentual do resumo. “Nada a melhorar” é exibido separadamente; o reconhecimento usa textos que começam por “Nada” ou “Nenhum”.

O resultado por pergunta respeita período, setor, turno e tipo de atendimento. O agrupamento considera setor, tipo e texto histórico da pergunta: versões com enunciados diferentes podem aparecer separadamente, inclusive após a revisão dos textos padrão. Perguntas excluídas permanecem nesse histórico quando ainda existem respostas no recorte. Nas perguntas de múltipla escolha, são exibidas até seis alternativas mais frequentes por grupo.

### Acompanhamento ao vivo e TV Wall

O acompanhamento ao vivo consulta rascunhos atualizados nos últimos sete dias que já tenham pelo menos uma resposta. Considera “respondendo agora” os registros atualizados nos últimos 30 minutos; após esse prazo, apresenta a situação de não conclusão. A consulta retorna até 200 rascunhos e a interface exibe até 12 linhas. Trata-se de uma indicação de atividade recente, sem identificação nominal do paciente, e não de garantia de que o navegador continua aberto.

A consulta é repetida a cada oito segundos enquanto a aba de Resultados está ativa e o documento está visível. Uma mudança na quantidade de avaliações concluídas provoca o recarregamento dos indicadores. O botão Atualizar permite solicitar nova consulta manualmente.

A TV Wall consulta dados agregados a cada 30 segundos. Seus indicadores principais usam uma janela de 30 dias, o cartão Hoje corresponde às últimas 24 horas e o gráfico apresenta 14 dias. Esses intervalos não são todos iguais. As cores são critérios visuais definidos na aplicação, não certificações de qualidade: para nota média, verde a partir de 4, intermediário de 3 até menos de 4 e atenção abaixo de 3; para NPS, verde a partir de 50, intermediário de 0 até menos de 50 e atenção abaixo de 0; para satisfação, verde a partir de 80%, intermediário de 60% até menos de 80% e atenção abaixo de 60%.

Na TV, os agrupamentos diários da API são feitos em UTC, enquanto os rótulos dos dias são montados no navegador. Isso pode causar diferenças próximas à meia-noite em relação ao gráfico diário do painel administrativo. Os totais da TV incluem avaliações de setores posteriormente desativados, mas sua lista por setor apresenta apenas os setores ativos; por isso, a soma das linhas visíveis pode ser menor que o total geral.

### Exemplo conferido em 29/10/2026

O exemplo abaixo documenta uma fotografia dos registros disponíveis durante a conferência; não é uma meta nem um valor fixo do sistema. Os números mudam com novos envios, filtros e passagem do tempo.

| Dado conferido | Registros e cálculo | Exibição |
| --- | --- | --- |
| Avaliações concluídas | 6 registros no recorte de 30 dias. | 6 |
| Nota média | Média das médias individuais = 3,666667. Nesse conjunto havia 12 respostas de satisfação, com soma 44. | 3,7/5 |
| Satisfação | 7 respostas com nota 4 ou 5, entre 12 respostas de satisfação: `7 ÷ 12 × 100`. | 58% |
| NPS | 1 promotor, 2 neutros e 3 detratores: `(1 − 3) ÷ 6 × 100`. | −33 |
| Avaliações que exigem atenção | 3 registros com média inferior a 3 ou recomendação de até 6: `3 ÷ 6 × 100`. | 3 (50%) |
| Contatos pendentes | 2 registros com telefone disponível e situação pendente. | 2 |
| Distribuição da recomendação | Nota 2: 1; nota 3: 2; nota 7: 2; nota 10: 1. | Detratores 50%, neutros 33%, promotores 17%. |
| Evolução diária, no fuso de São Paulo | 23/10/2026: 4 avaliações; 29/10/2026: 2 avaliações. | Total 6. |
| Período anterior | Nenhuma avaliação no intervalo anterior de 30 dias. | Sem dados no período anterior. |

## Melhorias implementadas no painel

- Ajuste do dimensionamento e espaçamento das barras do histograma de recomendação e do gráfico temporal, com contagens, escala e total do período.
- Aplicação dos filtros de turno e tipo de atendimento também ao resultado por pergunta, em conjunto com período e setor.
- Proteção contra respostas atrasadas de consultas substituírem resultados de uma tela ou filtro mais recente, incluindo carregamento de perguntas e dados do painel.
- Revisão do acompanhamento de novas conclusões e apresentação de falhas na atualização ao vivo.
- Deduplicação de alternativas repetidas dentro de uma mesma avaliação nos resumos de aspectos positivos e melhorias.
- Padronização visual dos controles, com espaçamento, foco visível e adaptação a telas menores.
- Menus de seleção personalizados em todos os campos de seleção simples do painel: tipografia legível, alternativas com espaçamento, destaque da escolha, indicação de abertura e suporte a teclado, busca por digitação, Escape e Tab. Os elementos `select` originais continuam armazenando valores e disparando os eventos utilizados pelos formulários existentes.
- Novo controle de inclusão de perguntas com modelos iniciais editáveis, alternativas sugeridas para múltipla escolha e indicação do limite de 30 perguntas.
- Validação dos enunciados e das alternativas antes do envio; alternativas devem ter de 2 a 10 valores distintos, cada um com até 40 caracteres. Enunciados devem ter de 5 a 160 caracteres.
- Bloqueio dos campos durante o salvamento e avisos ao tentar descartar alterações de perguntas ainda não salvas.
- Botões Ligar e WhatsApp nos contatos autorizados, com normalização do número e prefixo brasileiro nos números locais de 10 ou 11 dígitos.
- Revisão formal dos enunciados padrão e de textos do painel, com preservação dos textos históricos das respostas.
- Identificação institucional padronizada nas páginas, cartazes de QR Code e exportações em Excel.
- Carregamento centralizado de configuração e comandos de execução disponíveis também na pasta principal. A arquitetura do projeto permanece baseada em Express, MySQL e páginas estáticas com JavaScript puro.

## Conferência dos cálculos e qualidade dos dados

A conferência registrada em 29/10/2026 utilizou consultas de leitura ao banco e comparação com as funções do painel. A nota média e a recomendação armazenadas em cada avaliação foram confrontadas com as respostas individuais; a marcação de atenção foi comparada à regra de média inferior a 3 ou recomendação de até 6. **Não foram encontradas divergências nesses campos nos registros concluídos consultados.** Também foram verificadas contagens, distribuição das notas, satisfação, contatos pendentes e agrupamento diário do exemplo documentado acima.

Essa verificação confirma a consistência entre os registros disponíveis e os cálculos implementados. Ela não comprova, por si só, que cada envio corresponde a um atendimento real ou a um paciente distinto. A pesquisa pública não faz identificação individual ou vínculo com prontuário. Diferenciar registros operacionais de registros inseridos manualmente em testes depende do controle de uso da instalação.

Ao interpretar ou comparar resultados, considere:

- **Tamanho da amostra:** seis avaliações descrevem seis registros recebidos e não demonstram, isoladamente, a experiência de todos os pacientes do hospital. Sempre apresente os percentuais acompanhados da quantidade de avaliações.
- **Mesmo recorte:** use o mesmo período, setor, turno e tipo de atendimento ao comparar tela, Excel e consultas ao banco. Considere o fuso e o instante da consulta.
- **Mudanças de formulário:** quantidade de perguntas e enunciados podem mudar. Isso altera a composição das respostas e os pesos do indicador de satisfação, mesmo sem erro matemático.
- **Limites de carregamento:** o painel usa até 5.000 avaliações mais recentes dentro do alcance do usuário; a exportação usa até 20.000 registros após os filtros; o resultado por pergunta consulta até 200.000 linhas de respostas. Ao atingir esses limites, as bases podem divergir e os totais não devem ser considerados completos sem revisão das consultas.
- **Diferenças entre indicadores:** nota média, satisfação, NPS e atenção medem aspectos distintos e possuem denominadores ou regras diferentes. Não devem ser tratados como medidas equivalentes.
- **Arredondamento:** médias e percentuais exibidos têm precisão menor que os valores usados nos cálculos. Não recalcule o NPS subtraindo apenas percentuais já arredondados quando houver acesso às contagens originais.

Os principais pontos do código para auditoria são `src/public/js/admin.js` (filtros, indicadores e gráficos), `src/server/lib/avaliacoes.js` (resumo e leitura das respostas), `src/server/lib/util.js` (limites e perguntas padrão), `src/server/routes/admin.js` (resultado por pergunta e Excel) e `src/server/routes/public.js` (indicadores agregados da TV).
