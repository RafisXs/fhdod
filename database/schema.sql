-- =====================================================================
-- Avaliação do Atendimento - FHDOD
-- Banco: MySQL 8.0+   |   Execute no MySQL Workbench (raio ⚡) ou:
--   mysql -u root -p < database/schema.sql
-- Pode ser executado mais de uma vez sem apagar dados.
-- =====================================================================

-- Garante que acentos (ex.: "Plano de Saúde") sejam gravados certos em qualquer cliente MySQL
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS hospital_experiencia
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hospital_experiencia;

-- Para recomeçar do zero (APAGA TUDO), tire o "-- " das linhas abaixo:
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS respostas, avaliacoes, perguntas, usuarios, setores;
-- SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1) SETORES: pontos de entrada da pesquisa (um QR Code por setor)
--    origem: de onde veio o nome do setor
--      site_oficial      = serviço apresentado no site oficial da FHDOD
--      pesquisa_impressa = consta na pesquisa de satisfação impressa do hospital
--      prototipo         = setor da configuração inicial
--      cadastrado        = setor criado depois pelo gerente, no painel
--    ativo: 0 = some da pesquisa e da TV, mas o histórico de avaliações é mantido
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS setores (
  id     VARCHAR(10)  NOT NULL,
  nome   VARCHAR(60)  NOT NULL,
  ordem  TINYINT      NOT NULL,
  origem ENUM('site_oficial','pesquisa_impressa','prototipo','cadastrado') NOT NULL,
  ativo  TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2) USUARIOS: três perfis
--    gerente      = mexe em tudo (todos os setores, todas as perguntas, equipe)
--    admin        = administrador de UM setor (perguntas, contatos e resultados
--                   do setor; cria visualizadores do próprio setor).
--                   Cada setor tem no máximo 1 administrador ATIVO.
--    visualizador = somente leitura dos resultados (nunca vê telefones);
--                   setor_id vazio = vê todos os setores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id         INT          NOT NULL AUTO_INCREMENT,
  nome       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  senha_hash VARCHAR(100) NOT NULL,
  papel      ENUM('gerente','admin','visualizador') NOT NULL,
  setor_id   VARCHAR(10)  NULL,
  ativo      TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Coluna calculada que garante "1 administrador ativo por setor":
  -- só tem valor para admins ativos, e o índice abaixo não deixa repetir.
  admin_setor VARCHAR(10) GENERATED ALWAYS AS (IF(papel = 'admin' AND ativo = 1, setor_id, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_email (email),
  UNIQUE KEY uk_um_admin_por_setor (admin_setor),
  CONSTRAINT fk_usuarios_setor FOREIGN KEY (setor_id) REFERENCES setores (id),
  CONSTRAINT ck_usuarios_papel CHECK (
    (papel = 'gerente' AND setor_id IS NULL) OR
    (papel = 'admin'   AND setor_id IS NOT NULL) OR
    (papel = 'visualizador'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3) PERGUNTAS: quantas o setor precisar (o painel limita em 30 por setor), na ordem escolhida
--    tipos: escala (5 níveis) | positivos | negativos (escolha de várias opções) | nps
--    nps = recomendação de 1 a 10 com carinhas: cada setor tem exatamente UMA, que não
--    pode ser desativada nem excluída (só o texto e a posição mudam). Por padrão fica na 3ª posição.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perguntas (
  id       INT          NOT NULL AUTO_INCREMENT,
  setor_id VARCHAR(10)  NOT NULL,
  ordem    SMALLINT     NOT NULL,
  texto    VARCHAR(160) NOT NULL,
  tipo     ENUM('escala','positivos','negativos','nps') NOT NULL,
  opcoes   JSON         NULL,
  ativa    TINYINT(1)   NOT NULL DEFAULT 1,
  nps_setor VARCHAR(10) GENERATED ALWAYS AS (IF(tipo = 'nps', setor_id, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_perguntas_setor_ordem (setor_id, ordem),
  UNIQUE KEY uk_perguntas_um_nps (nps_setor),
  CONSTRAINT fk_perguntas_setor FOREIGN KEY (setor_id) REFERENCES setores (id),
  CONSTRAINT ck_perguntas_ordem CHECK (ordem BETWEEN 1 AND 1000),
  CONSTRAINT ck_perguntas_nps_ativa CHECK (tipo <> 'nps' OR ativa = 1)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4) AVALIACOES: uma linha por avaliação (anônima)
--    status: 'rascunho' = o paciente está respondendo (cada resposta é gravada na hora)
--            'concluida' = enviada. Os painéis e a TV contam só as concluídas.
--    token: identifica o rascunho no navegador do paciente (some do uso depois de concluir)
--    telefone: opcional, só quando a nota é abaixo da média e há autorização
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes (
  id                   BIGINT       NOT NULL AUTO_INCREMENT,
  criado_em            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  setor_id             VARCHAR(10)  NOT NULL,
  status               ENUM('rascunho','concluida') NOT NULL DEFAULT 'concluida',
  token                CHAR(32)     NULL,
  nps                  TINYINT      NULL,
  nota_media           DECIMAL(3,2) NULL,
  abaixo_media         TINYINT(1)   NOT NULL DEFAULT 0,
  data_atendimento     DATE         NULL,
  turno                ENUM('Dia','Noite') NULL,
  respondente          ENUM('Paciente','Familiar') NULL,
  tipo_atendimento     ENUM('SUS','Plano de Saúde','Particular') NULL,
  telefone             VARCHAR(11)  NULL,
  consentimento_contato TINYINT(1)  NOT NULL DEFAULT 0,
  contato_status       ENUM('pendente','contatado','resolvido') NOT NULL DEFAULT 'pendente',
  contato_obs          VARCHAR(500) NULL,
  contato_em           DATETIME     NULL,
  contato_por          INT          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_avaliacoes_token (token),
  KEY ix_avaliacoes_status_criado (status, criado_em),
  KEY ix_avaliacoes_criado (criado_em),
  KEY ix_avaliacoes_setor_criado (setor_id, criado_em),
  CONSTRAINT fk_avaliacoes_setor FOREIGN KEY (setor_id) REFERENCES setores (id),
  CONSTRAINT fk_avaliacoes_contato_por FOREIGN KEY (contato_por) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT ck_avaliacoes_nps CHECK (nps BETWEEN 1 AND 10),
  CONSTRAINT ck_avaliacoes_tel CHECK (telefone IS NULL OR consentimento_contato = 1),
  CONSTRAINT ck_avaliacoes_concluida CHECK (status = 'rascunho' OR (nps IS NOT NULL AND data_atendimento IS NOT NULL
    AND turno IS NOT NULL AND respondente IS NOT NULL AND tipo_atendimento IS NOT NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5) RESPOSTAS: uma linha por pergunta respondida. Guarda o texto da
--    pergunta da época, para o histórico não mudar quando ela for editada.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS respostas (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  avaliacao_id   BIGINT       NOT NULL,
  pergunta_id    INT          NULL,
  pergunta_texto VARCHAR(160) NOT NULL,
  tipo           ENUM('escala','positivos','negativos','nps') NOT NULL,
  valor_num      TINYINT      NULL,
  valores        JSON         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_respostas_avaliacao_pergunta (avaliacao_id, pergunta_id),
  KEY ix_respostas_avaliacao (avaliacao_id),
  CONSTRAINT fk_respostas_avaliacao FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes (id) ON DELETE CASCADE,
  CONSTRAINT fk_respostas_pergunta  FOREIGN KEY (pergunta_id)  REFERENCES perguntas (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================================
-- DADOS INICIAIS
-- =====================================================================
INSERT IGNORE INTO setores (id, nome, ordem, origem) VALUES
  ('rec',  'Recepção',                  1, 'prototipo'),
  ('pa',   'Pronto Atendimento',        2, 'site_oficial'),
  ('rx',   'Raio-X',                    3, 'pesquisa_impressa'),
  ('endo', 'Endoscopia e Colonoscopia', 4, 'site_oficial'),
  ('cc',   'Centro Cirúrgico',          5, 'site_oficial'),
  ('ic',   'Internação Clínica',        6, 'site_oficial'),
  ('ip',   'Internação Pediátrica',     7, 'pesquisa_impressa'),
  ('sm',   'Internação Saúde Mental',   8, 'site_oficial'),
  ('ob',   'Atendimento com Obstetrícia', 9, 'pesquisa_impressa'),
  ('tr',   'Atendimento com Traumato', 10, 'pesquisa_impressa');

-- Perguntas 1 e 2 de cada setor (escala de satisfação)
INSERT IGNORE INTO perguntas (setor_id, ordem, texto, tipo) VALUES
  ('rec', 1, 'Como você avalia o atendimento prestado pela recepção?', 'escala'),
  ('rec', 2, 'Como você avalia a clareza das informações recebidas?', 'escala'),
  ('pa', 1, 'Como você avalia o tempo de espera para o atendimento?', 'escala'),
  ('pa', 2, 'Como você avalia o atendimento prestado pelas equipes médica e de enfermagem?', 'escala'),
  ('rx', 1, 'Como você avalia o atendimento prestado no setor de radiologia?', 'escala'),
  ('rx', 2, 'Como você avalia o tempo de espera para o atendimento?', 'escala'),
  ('endo', 1, 'Como você avalia o atendimento prestado pela equipe?', 'escala'),
  ('endo', 2, 'Como você avalia a clareza das orientações sobre o preparo e a realização do exame?', 'escala'),
  ('cc', 1, 'Como você avalia o atendimento prestado pela equipe?', 'escala'),
  ('cc', 2, 'Como você avalia a clareza das orientações recebidas antes do procedimento?', 'escala'),
  ('ic', 1, 'Como você avalia o atendimento prestado pela equipe de enfermagem?', 'escala'),
  ('ic', 2, 'Como você avalia o serviço de nutrição oferecido durante a internação?', 'escala'),
  ('ip', 1, 'Como você avalia o atendimento prestado pela equipe de enfermagem?', 'escala'),
  ('ip', 2, 'Como você avalia o conforto do ambiente para a criança e seu acompanhante?', 'escala'),
  ('sm', 1, 'Como você avalia o acolhimento realizado pela equipe multiprofissional?', 'escala'),
  ('sm', 2, 'Como você avalia o respeito e a atenção recebidos durante o atendimento?', 'escala'),
  ('ob', 1, 'Como você avalia o atendimento prestado pela equipe?', 'escala'),
  ('ob', 2, 'Como você avalia a clareza das orientações recebidas?', 'escala'),
  ('tr', 1, 'Como você avalia o atendimento médico recebido?', 'escala'),
  ('tr', 2, 'Como você avalia o tempo de espera para o atendimento?', 'escala');

-- Perguntas 3, 4 e 5 (iguais em todos os setores; depois podem ser editadas):
--   3 = recomendação de 1 a 10 | 4 = pontos positivos | 5 = pontos a melhorar
INSERT IGNORE INTO perguntas (setor_id, ordem, texto, tipo, opcoes)
SELECT id, 4, 'Quais aspectos do atendimento você considera positivos?', 'positivos',
       JSON_ARRAY('Equipe atenciosa','Rapidez','Informações claras','Ambiente limpo','Conforto','Respeito')
FROM setores;

INSERT IGNORE INTO perguntas (setor_id, ordem, texto, tipo, opcoes)
SELECT id, 5, 'Quais aspectos do atendimento precisam ser aprimorados?', 'negativos',
       JSON_ARRAY('Demora','Falta de informação','Atendimento frio','Limpeza','Estrutura e conforto','Nada a melhorar')
FROM setores;

INSERT IGNORE INTO perguntas (setor_id, ordem, texto, tipo, opcoes)
SELECT id, 3, 'Em uma escala de 1 a 10, qual é a probabilidade de você recomendar este hospital a um familiar ou amigo?', 'nps', NULL
FROM setores;

-- Internação Clínica tem a opção extra "Alimentação" (só se ainda não existir)
UPDATE perguntas
   SET opcoes = JSON_ARRAY_APPEND(opcoes, '$', 'Alimentação')
 WHERE setor_id = 'ic' AND tipo = 'positivos'
   AND JSON_SEARCH(opcoes, 'one', 'Alimentação') IS NULL;

-- O primeiro gerente é criado pelo terminal, com senha protegida:
--   npm run criar-gerente
