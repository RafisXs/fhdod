# Implantação e operação — FHDOD

Este guia descreve uma implantação de referência em Linux com systemd, Nginx, Node.js e MySQL 8. A aplicação mantém a arquitetura atual. Os arquivos em `docs/deploy/` são modelos: ajustar domínio, caminhos, certificados e usuários antes de instalar. Nenhuma infraestrutura externa foi configurada automaticamente.

## Responsabilidades e critérios de liberação

| Responsável | Atribuições e evidências |
| --- | --- |
| TI / infraestrutura | Domínio e DNS, certificado e renovação, sistema operacional, firewall, serviço, monitoração, backups e restauração. |
| Gestão do hospital | Aprovar setores, perguntas, metas, permissões e responsáveis pelo atendimento aos contatos. |
| Encarregado / privacidade | Aprovar aviso de privacidade, texto e finalidade do consentimento, prazo de retenção, acesso à auditoria e procedimento de exclusão. |
| Responsável pela aplicação | Implantar versão identificada por commit, executar testes e migrações em homologação, registrar mudanças e incidentes. |

A liberação institucional depende desses responsáveis. Esta rodada implementa senha pessoal, bloqueio de tentativas e auditoria; não implementa 2FA, descarte automático de telefones ou todo o programa de privacidade. A lista completa está em [pendências](../development/pendencias.md). A escala atual de recomendação continua sendo 1–10, pendente de alinhamento com o formulário FM-NEG-0.083 (0–10).

## Preparação e instalação

1. Criar homologação isolada, com banco e domínio próprios. Executar `npm ci`, importar `database/schema.sql` somente na instalação inicial e executar `npm run test:painel` em máquina Windows preparada para a suíte de navegador; ela cria seu próprio banco temporário. Homologar também no ambiente Linux de destino. O teste de navegador local não substitui validação de HTTPS e restauração no destino.
2. Instalar uma versão suportada do Node.js compatível com o projeto, MySQL e Nginx. Criar usuário de sistema `fhdod`, sem privilégios administrativos, e instalar a aplicação em `/opt/fhdod` (conteúdo do repositório, com `src/server/`, `src/public/`, `scripts/`, `database/` e `package.json`). O modelo systemd inicia `/opt/fhdod/src/server/index.js`.
3. Manter MySQL acessível apenas pela rede necessária. Utilizar conta exclusiva para a aplicação. Nunca executar o servidor Node como root nem usar a conta root do MySQL na operação normal.
4. Fazer backup antes de atualizar. Durante a implantação, executar `npm ci --omit=dev`, `npm run migrar` e reiniciar o serviço em janela planejada. As migrações alteram tabelas: algumas instruções DDL não são revertidas por uma transação MySQL. O retorno a uma versão anterior pode exigir restauração do banco, não apenas do código.
5. A inicialização também verifica/aplica migrações. A conta configurada precisa de permissões compatíveis, incluindo consultas ao esquema, `CREATE`/`ALTER` e as permissões de leitura/escrita utilizadas. O desenho atual ainda não separa automaticamente credenciais de migração das de execução. Documentar essa exceção e restringir o acesso à rede e ao arquivo de configuração.
6. Criar o primeiro gerente com `npm run criar-gerente`. O comando cria/redefine uma senha provisória; o gerente deve substituí-la na interface no primeiro acesso. O procedimento de recuperação é administrativo: verificar a identidade do solicitante antes de executar o comando e registrar a autorização.

## Configuração protegida

Criar `/etc/fhdod/app.env`, com proprietário e permissões que permitam leitura apenas ao serviço e à administração responsável. Esse arquivo é carregado pelo systemd, sem entrar no Git. Usar valores reais somente nesse arquivo:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=hospital_experiencia
DB_USER=fhdod_app
DB_PASSWORD=SUBSTITUIR_NO_SERVIDOR
JWT_SECRET=SUBSTITUIR_POR_SEGREDO_ALEATORIO
COOKIE_SECURE=true
TRUST_PROXY=1
TV_TOKEN=SUBSTITUIR_POR_TOKEN_ALEATORIO
```

Gerar segredos com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. `TRUST_PROXY=1` pressupõe exatamente um proxy confiável entre o cliente e a aplicação. A porta Node deve permanecer inacessível externamente; sem essa restrição, cabeçalhos de origem podem ser forjados. Se houver balanceador ou CDN adicional, revisar essa configuração e os cabeçalhos no destino.

Não inserir senhas em comandos, histórico do terminal, links de suporte ou documentação. O token da TV aparece na URL; limitar o acesso aos registros do proxy e não compartilhar esse link fora da instituição.

## HTTPS e serviço com reinício automático

Usar os modelos [Nginx](../deploy/nginx.conf) e [systemd](../deploy/fhdod.service). Emitir certificado válido para o domínio real usando o processo aprovado pela TI, configurar renovação automática e alertas de expiração, e somente então habilitar a configuração TLS. O modelo espera certificados nos caminhos indicados; não cria certificados.

```sh
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl daemon-reload
sudo systemctl enable --now fhdod
sudo systemctl status fhdod
sudo journalctl -u fhdod --since today
```

O serviço reinicia em falhas de processo. A aplicação agora encerra a inicialização quando não consegue conectar ao banco; o systemd tentará reiniciar e a TI deverá investigar falhas persistentes. Não interpretar serviço “ativo” como prova suficiente de funcionamento: monitorar `/api/saude`, HTTPS e um fluxo autenticado. Um monitor de saúde deve avisar a equipe, não apenas registrar falhas.

Validar redirecionamento HTTP → HTTPS, certificado e cadeia de confiança, cookie de login com `Secure`, `HttpOnly` e `SameSite=Strict`, bloqueio da porta 3000 pela rede externa e acesso ao MySQL restrito. Não há autenticação adicional na pesquisa pública. O proxy não deve registrar corpos de requisição: eles podem conter senhas e telefones.

## Backup diário e restauração

Definir com o hospital os objetivos de perda aceitável (RPO), tempo de recuperação (RTO), retenção e quem recebe alertas. Um backup diário admite perda de até aproximadamente 24 horas desde a última cópia; necessidades menores exigem estratégia adicional, por exemplo logs binários e recuperação até um instante específico.

O modelo [backup-mysql.sh](../deploy/backup-mysql.sh) executa `mysqldump` consistente para tabelas InnoDB, comprime a saída, gera SHA-256 e só publica o arquivo final após sucesso. Não executar alterações DDL durante o dump. Instalar fora do diretório público, por exemplo `/usr/local/sbin/fhdod-backup`, com conta e permissões definidas pela TI. A conta de backup deve ter os privilégios exigidos pelo MySQL e pelas opções utilizadas, testados no servidor de destino.

Armazenar credenciais em `/etc/fhdod/backup.cnf`, protegido por permissões restritas:

```ini
[client]
host=127.0.0.1
user=fhdod_backup
password=SUBSTITUIR_NO_SERVIDOR
```

Agendar diariamente às 02:00 no fuso configurado no servidor, com cron ou ferramenta equivalente. Exemplo de crontab:

```cron
0 2 * * * /usr/local/sbin/fhdod-backup >> /var/log/fhdod-backup.log 2>&1
```

Configurar um monitor externo ao script que detecte código de saída não zero, ausência de cópia recente ou falha no envio para outro local. O agendamento sozinho não gera alertas. O modelo não implementa criptografia, cópia externa ou remoção por retenção: a TI deve configurar essas etapas e testar cada uma. Cópias contêm dados pessoais e trilha de auditoria; proteger acesso e criptografar a mídia/armazenamento, guardar cópia fora do servidor e documentar a política de eliminação, inclusive de backups antigos.

Executar restauração em servidor MySQL **isolado**, sem conectar a aplicação operacional. O dump do modelo não inclui `CREATE DATABASE` ou `USE`; criar explicitamente o banco de restauração e selecionar esse destino:

```sh
set -euo pipefail
sha256sum -c hospital_experiencia-AAAAMMDDTHHMMSSZ.sql.gz.sha256
gzip -t hospital_experiencia-AAAAMMDDTHHMMSSZ.sql.gz
mysql --defaults-extra-file=/etc/fhdod/restore.cnf -e 'CREATE DATABASE fhdod_restauracao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
gzip -dc hospital_experiencia-AAAAMMDDTHHMMSSZ.sql.gz | mysql --defaults-extra-file=/etc/fhdod/restore.cnf fhdod_restauracao
```

O arquivo `restore.cnf` deve apontar para o servidor de recuperação, com credenciais próprias. Usar shell com `set -o pipefail` para detectar falha em qualquer etapa do pipeline. Não executar esses comandos contra o host/banco de produção. Validar tabelas, contagens de avaliações e respostas, relações, auditoria, indicadores, autenticação e um envio em ambiente de homologação. Medir tempo de recuperação e registrar data, identificador/checksum do backup, responsável e resultado. Realizar exercício antes da liberação, periodicamente (por exemplo, mensalmente, conforme decisão da TI) e após mudanças relevantes. A existência de um arquivo `.gz` não comprova recuperabilidade.

## Contas e auditoria na operação

- O bloqueio é por conta: cinco falhas consecutivas de senha bloqueiam novas autenticações por 15 minutos; o limite adicional por IP continua ativo. A mensagem de login não confirma se a conta existe. Uma nova tentativa durante o bloqueio não prolonga o prazo. Após expirar, um login válido limpa o contador; uma nova falha inicia outro ciclo.
- Senhas pessoais exigem senha atual e nova senha diferente, com pelo menos oito caracteres e até 72 bytes UTF-8. Novas contas e redefinições recebem a marca de troca obrigatória. Contas existentes na migração não são marcadas automaticamente, pois não há informação que distinga senhas pessoais de provisórias antigas.
- A versão de sessão invalida cookies anteriores após troca/redefinição de senha ou alteração de conta. Uma troca pessoal emite uma sessão atualizada para o navegador que realizou a operação.
- O bloqueio de login não derruba por si só sessões já autenticadas. Em suspeita de comprometimento, a gestão deve desativar a conta ou redefinir a senha para revogar sessões. Isso deve fazer parte do procedimento de incidente.
- Auditoria é consultável pelo gerente em `/api/admin/auditoria` e na aba Auditoria, com páginas de 100 registros. Há registros de autenticação, senhas, alterações de perguntas, contas e setores, atualização/apagamento de contatos e disponibilização de telefones ao navegador autorizado.
- A leitura atual envia telefones na consulta de avaliações da equipe autorizada; por isso, o evento é `telefone.disponibilizado`, com os identificadores dos registros, mesmo que a pessoa não abra a aba Contatos. O evento comprova disponibilização ao navegador, não leitura humana nem envio de WhatsApp.
- Alterações auditadas e seus eventos são gravados na mesma transação. Se a gravação do evento falhar, a alteração correspondente é revertida. Na leitura de telefones, se o evento falhar, a resposta não é enviada.
- A tabela não armazena senhas, hashes, telefones, textos de observações ou corpos de pedidos. O nome exibido é o nome atual da conta; o identificador do responsável permanece no evento.
- A trilha não é imutável contra administradores do banco. Não há cadeia criptográfica ou cópia externa automática. Restringir acesso SQL, monitorar a integridade e definir exportação/retenção com os responsáveis. Não tratar a implementação como certificação de conformidade.

## Referências técnicas

- [Nginx: configuração de HTTPS](https://nginx.org/en/docs/http/configuring_https_servers.html).
- [Nginx: proxy HTTP e cabeçalhos](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
- [systemd: serviços e política de reinício](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html).
- [MySQL 8.0: mysqldump, consistência e privilégios](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html).
