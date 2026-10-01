# Avaliação do Atendimento - FHDOD

Sistema web de avaliação de atendimento para a **Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD)**, em Três Coroas - RS. Pacientes e familiares avaliam o atendimento por setor, em menos de 1 minuto e de forma anônima. A equipe do hospital acompanha os resultados em um painel com login.

> Projeto desenvolvido na disciplina de Criação de Sites (Curso Técnico em Informática - Projeto Integrador), a partir da pesquisa de satisfação e NPS impressa do hospital (FM-NEG-0.083, versão 02).

- **Autores:** `[Nome 1]` e `[Nome 2]`
- **Documentação online da API:** `[colar o link aqui]`
- **Quadro Kanban:** `[colar o link aqui]`
- **Site publicado:** `[colar o link aqui]`

---

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Tecnologias](#tecnologias)
3. [Estrutura do repositório](#estrutura-do-repositório)
4. [Pré-requisitos](#pré-requisitos)
5. [Instalação](#instalação)
6. [Variáveis de ambiente](#variáveis-de-ambiente)
7. [Execução](#execução)
8. [Banco de dados e segurança](#banco-de-dados-e-segurança)
9. [Documentação da API](#documentação-da-api)
10. [Testes](#testes)
11. [Publicação (deploy)](#publicação-deploy)
12. [LGPD e privacidade](#lgpd-e-privacidade)
13. [Contribuição e versionamento](#contribuição-e-versionamento)
14. [Limitações conhecidas](#limitações-conhecidas)
15. [Contato](#contato)

---

## Funcionalidades

**Para pacientes e familiares (sem login)**

- Escolha do setor: Recepção, Pronto Atendimento, Raio-X, Endoscopia e Colonoscopia, Centro Cirúrgico, Internação Clínica, Internação Pediátrica, Internação Saúde Mental, Obstetrícia e Traumato.
- Até 5 perguntas por setor: duas sobre o atendimento, uma sobre o que foi bom, uma sobre o que pode melhorar e, por último, a recomendação de 1 a 10 com carinhas.
- Passo final com dia do atendimento, turno (Dia ou Noite), paciente ou familiar e tipo de atendimento (SUS, Plano de Saúde ou Particular).
- Link direto por setor (para QR Code): `index.html?setor=rx`.
- Layout responsivo, pensado para celular, com navegação por teclado e foco visível.

**Para a equipe (com login)**

- Login com e-mail e senha (Supabase Auth). Não há cadastro pelo site: as contas são criadas pelo administrador.
- Painel com filtros (período, setor, turno e tipo de atendimento), cartões de resumo com comparação com o período anterior, gráficos, ranking por setor, exportação em CSV e impressão.
- Logout automático após 15 minutos sem uso.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Frontend | HTML, CSS e JavaScript puros (arquivo único, sem build) |
| Backend e API | Supabase (PostgREST gerado automaticamente a partir das tabelas) |
| Autenticação | Supabase Auth (e-mail e senha) |
| Banco de dados | PostgreSQL (Supabase) com Row Level Security |
| Biblioteca | `@supabase/supabase-js` v2, carregada por CDN (jsDelivr) |

## Estrutura do repositório

Organização sugerida (renomeie o arquivo `avaliacao-fhdod-supabase.html` para `index.html`):

```
.
├── index.html                 # Site completo (pacientes e painel da equipe)
├── supabase/
│   └── schema.sql             # Tabelas, índices, função e políticas de segurança
├── docs/
│   ├── requisitos.md          # Especificação de requisitos
│   ├── arquitetura-backend.md # Arquitetura, segurança e escalabilidade
│   ├── padroes-git.md         # Branches, commits e Pull Requests
│   └── plano-e-relatorio-de-testes.md
└── README.md
```

## Pré-requisitos

- Navegador atualizado (Chrome, Edge ou Firefox).
- Conta gratuita no [Supabase](https://supabase.com) com permissão para criar projetos (em organização própria ou como Administrator).
- Visual Studio Code com a extensão **Live Server** (opcional, para rodar localmente).
- Git.

## Instalação

1. Clone o repositório:

   ```bash
   git clone <URL-DO-REPOSITORIO>
   cd <PASTA-DO-PROJETO>
   ```

2. Crie um projeto no Supabase (**New project**) e guarde a senha do banco.
3. No Supabase, abra **SQL Editor > New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**. O script pode ser executado mais de uma vez.
4. Autorize os funcionários que poderão ver o painel, rodando no SQL Editor (troque pelos e-mails reais):

   ```sql
   insert into public.equipe_autorizada (email) values
     ('funcionario1@exemplo.com.br'),
     ('funcionario2@exemplo.com.br')
   on conflict do nothing;
   ```

5. Em **Authentication > Users > Add user > Create new user**, crie a conta de cada funcionário (e-mail e senha) e marque **Auto Confirm User**. O e-mail precisa ser o mesmo da lista do passo anterior.
6. Em **Authentication > Sign In / Providers**, desative **Allow new users to sign up**, para que ninguém crie conta pela API.
7. Configure as chaves no `index.html` (próxima seção).

## Variáveis de ambiente

O projeto é um site estático, sem servidor próprio, então não usa arquivo `.env`. As duas configurações ficam no início do `<script>` do `index.html`:

| Variável | Onde obter | Exemplo |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase > Project Settings > API > Project URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_KEY` | Supabase > Project Settings > API > chave `anon` ou `publishable` | `sb_publishable_...` |

```js
var SUPABASE_URL="https://abcdefgh.supabase.co";
var SUPABASE_KEY="sb_publishable_xxxxxxxxxxxx";
```

> **Atenção:** a chave `anon`/`publishable` é pública por projeto e pode ficar no frontend, porque a proteção dos dados é feita pelas políticas RLS do banco. **Nunca** coloque no repositório ou no site a chave `service_role` ou `secret`, nem a senha do banco.

## Execução

**Localmente**

1. Abra a pasta no VS Code.
2. Clique com o botão direito no `index.html` e escolha **Open with Live Server** (ou abra o arquivo no navegador).
3. Acesse a Área da equipe pelo link no rodapé da página.

**Link direto por setor (QR Code):** `index.html?setor=<codigo>`

| Código | Setor | Código | Setor |
| --- | --- | --- | --- |
| `rec` | Recepção | `ic` | Internação Clínica |
| `pa` | Pronto Atendimento | `ip` | Internação Pediátrica |
| `rx` | Raio-X | `sm` | Internação Saúde Mental |
| `endo` | Endoscopia e Colonoscopia | `ob` | Obstetrícia |
| `cc` | Centro Cirúrgico | `tr` | Traumato |

## Banco de dados e segurança

Tabelas (definidas em `supabase/schema.sql`):

- **`avaliacoes`**: uma linha por avaliação enviada, sem nome nem dados de saúde.
- **`equipe_autorizada`**: e-mails de funcionários que podem ler as avaliações. Não tem política RLS de propósito: ninguém acessa a lista pelo site.

Regras de acesso (RLS):

| Ação | Quem pode |
| --- | --- |
| Enviar avaliação (`insert`) | Qualquer pessoa (`anon`) |
| Ler avaliações (`select`) | Somente usuários logados **e** presentes em `equipe_autorizada` |
| Alterar ou apagar avaliações | Ninguém pelo site |

Campos de `avaliacoes`:

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | uuid | Gerado automaticamente |
| `criado_em` | timestamptz | Padrão: agora |
| `setor` | text | Um dos 10 códigos de setor |
| `nota1`, `nota2` | smallint | 1 a 5 |
| `positivos`, `negativos` | text[] | Até 8 itens cada |
| `nps` | smallint | 1 a 10 |
| `data_atendimento` | date | Não pode ser futura |
| `turno` | text | `Dia` ou `Noite` |
| `respondente` | text | `Paciente` ou `Familiar` |
| `tipo_atendimento` | text | `SUS`, `Plano de Saúde` ou `Particular` |

## Documentação da API

A API REST é gerada automaticamente pelo Supabase (PostgREST) a partir das tabelas. Endpoints usados pelo site:

| Método | Rota | Uso | Acesso |
| --- | --- | --- | --- |
| `POST` | `/rest/v1/avaliacoes` | Enviar avaliação | Público (`anon`) |
| `GET` | `/rest/v1/avaliacoes?select=...` | Listar avaliações para o painel | Equipe autorizada |
| `POST` | `/auth/v1/token?grant_type=password` | Login | Público |
| `POST` | `/auth/v1/logout` | Logout | Usuário logado |

Todas as requisições levam o cabeçalho `apikey` com a chave pública do projeto. A documentação interativa (OpenAPI/Swagger) do projeto fica em: `[colar o link aqui]`. O Supabase gera a especificação OpenAPI da API em **Project Settings > API**.

## Testes

Ainda não há testes automatizados. A validação é feita por roteiro manual, e o plano completo fica em `docs/plano-e-relatorio-de-testes.md`.

| # | Teste | Resultado esperado |
| --- | --- | --- |
| 1 | Responder as 5 perguntas e o passo final | Mensagem de agradecimento e linha nova em `avaliacoes` |
| 2 | Tentar enviar sem preencher dia, turno, perfil ou tipo | Botão **Enviar avaliação** continua desabilitado |
| 3 | Abrir `?setor=rx` | Abre direto nas perguntas do Raio-X |
| 4 | Login com e-mail e senha corretos de conta autorizada | Painel com dados |
| 5 | Login com senha errada | Mensagem de erro, sem entrar |
| 6 | Login com conta que **não** está em `equipe_autorizada` | Painel vazio com aviso |
| 7 | Ler `avaliacoes` sem login (chamada direta à API) | Lista vazia (bloqueado pelo RLS) |
| 8 | Filtros do painel | Números e gráficos mudam conforme o filtro |
| 9 | Exportar CSV | Arquivo baixado com as linhas do filtro atual |
| 10 | Ficar 15 minutos sem usar o painel | Logout automático |

## Publicação (deploy)

Como é um site estático, pode ser hospedado em Netlify, Vercel, GitHub Pages ou no servidor do hospital: basta publicar o `index.html`. Depois de publicar, em **Authentication > URL Configuration** do Supabase, informe o endereço do site.

## LGPD e privacidade

- A avaliação é **anônima**: o sistema não pede nome, CPF, prontuário nem informações de saúde.
- O banco só aceita os valores previstos (setores, notas, turno etc.), sem campo de texto livre.
- Só funcionários autorizados leem os resultados.
- Para uso oficial no hospital, o projeto do Supabase deve pertencer a uma conta institucional, e a finalidade e o prazo de guarda dos dados devem ser definidos com o responsável pela LGPD do hospital.

## Contribuição e versionamento

Os padrões de branches, commits (Conventional Commits) e Pull Requests ficam em `docs/padroes-git.md`. Exemplo de mensagem de commit:

```
feat(painel): adiciona comparação com o período anterior
```

O acompanhamento das tarefas está no quadro Kanban: `[colar o link aqui]`.

## Limitações conhecidas

- A proteção contra envios falsos é feita só no navegador (campo escondido e tempo mínimo). Para proteção forte, é preciso adicionar um captcha validado no servidor.
- O painel carrega as 5.000 avaliações mais recentes. Com mais volume, o cálculo deve passar para o banco.
- Não há testes automatizados.
- A escala de recomendação vai de 1 a 10, e o NPS oficial usa 0 a 10, então a comparação direta com o formulário em papel pode ter pequenas diferenças.

## Contato

Fundação Hospitalar Dr. Oswaldo Diesel - Rua Doze de Maio, 555, Centro, Três Coroas - RS, CEP 95660-000.
Telefone: (51) 3546-1236 | E-mail: sac@fhdod.com.br
