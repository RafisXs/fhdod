# Preparação para uso institucional

Este documento separa as melhorias técnicas entregues das decisões e verificações que precisam ocorrer no hospital. Não declara homologação institucional nem conformidade jurídica.

## Melhorias técnicas de 10/11/2026

| Frente | Entrega |
| --- | --- |
| Completude dos dados | O painel percorre páginas de 500 registros por cursor, sem corte nas 5.000 avaliações. A consulta de compatibilidade retorna a base completa. |
| Resultado por pergunta | Agregação de contagens, médias, satisfação e NPS no MySQL, sem corte em 200.000 respostas. Alternativas também são agregadas no banco. |
| Excel | Escrita em streaming, lendo lotes de 500 avaliações e acumulando o resumo por setor; removido o corte em 20.000 registros. |
| Configuração de produção | Inicialização recusada com cookie inseguro, JWT curto ou de exemplo, usuário SQL root, banco/senha ausentes ou parâmetros inválidos de porta/proxy. |
| Privilégios do banco | Migrações automáticas ficam desabilitadas por padrão em produção; a operação pode usar conta sem permissões DDL. |
| Operação | Endpoint de processo `/api/vivo`, endpoint com acesso ao banco `/api/saude`, comando de monitoramento e encerramento por sinal com até 30 segundos de espera. |
| Diagnóstico | Identificador aleatório por requisição em `X-Request-Id`; falhas internas são registradas sem corpos, URLs, tokens ou mensagens SQL. Produção não devolve dicas internas do banco ao cliente. |
| Automação | Workflow de testes para push/PR, MySQL descartável, Chrome, auditoria npm e capturas de teste; configuração Dependabot para npm e Actions. |
| Evidências | Testes de configuração, API, segurança, volume e navegador em banco temporário. |

O frontend ainda calcula parte dos indicadores sobre a base carregada no navegador. A paginação elimina o corte de registros, mas não torna o consumo de memória do navegador constante. Para volumes muito maiores, continua recomendada a migração dos demais gráficos e contatos para agregação/paginação integral no servidor. O Excel mantém os limites naturais do formato XLSX por aba e o desempenho depende do banco, rede e volume. As leituras por páginas não prometem um snapshot transacional único durante alterações simultâneas.

## Implantação controlada

1. Definir domínio, hospedagem, responsável técnico, responsáveis pelos contatos e ambiente separado de homologação.
2. Usar Node.js 24 na execução homologada e MySQL 8. Instalar o conteúdo do repositório em `/opt/fhdod` conforme [o guia operacional](implantacao.md).
3. Preparar o `.env` de operação fora do Git, com `NODE_ENV=production`, `COOKIE_SECURE=true`, `HOST=127.0.0.1`, `AUTO_MIGRATE=false`, um `JWT_SECRET` aleatório de pelo menos 48 caracteres e conta SQL exclusiva diferente de root. Configurar `TRUST_PROXY` conforme o número real de proxies.
4. Criar/migrar o schema usando uma conta de manutenção, em janela planejada e após backup. Depois, iniciar o serviço com a conta de operação. A conta de operação precisa de `SELECT`, `INSERT`, `UPDATE` e `DELETE` no banco da aplicação; não precisa de `CREATE`, `ALTER` ou `DROP` quando a migração automática está desativada. A criação e os grants das contas devem ser feitos pela administração MySQL no destino.
5. Configurar Nginx/HTTPS e firewall. Validar certificado, redirecionamento, cookie Secure e bloqueio de acesso externo direto à porta Node/MySQL.
6. Reiniciar o serviço após atualizar o código: processos antigos podem continuar usando caminhos ou módulos carregados da versão anterior.
7. Executar o monitor e os fluxos funcionais de homologação. Só depois registrar a aprovação de produção.

Não copiar o `.env` de desenvolvimento ou o banco de testes para produção. O processo de CI usa apenas credenciais descartáveis de um MySQL temporário e não requer segredos do hospital.

## Monitoramento e incidentes

```sh
npm run monitorar -- https://DOMINIO-DO-HOSPITAL
```

Também pode ser usado `MONITOR_URL`, sem query string, credenciais ou token. Saída JSON e código de saída: `0` quando processo e banco respondem; `1` em falha. Integrar esse comando ou os endpoints ao monitor da TI, com frequência, destinatários e canal de alerta definidos pelo hospital. O comando não envia e-mail nem mensagens por conta própria. Um único teste positivo não comprova disponibilidade contínua.

Ao diagnosticar erro HTTP, usar `X-Request-Id` para localizar o evento correspondente nos logs. Limitar o acesso aos logs e não habilitar gravação de corpos de requisição. Definir um procedimento para contenção, recuperação, registro e encaminhamento de incidentes ao responsável por privacidade.

## Critérios de aceite antes da liberação

- [ ] Direção/gestão aprova finalidade, questionário, escala 1–10 atual e interpretação dos indicadores.
- [ ] Responsável por privacidade aprova base legal, aviso, canal de atendimento, retenção, exclusão e acesso aos dados.
- [ ] TI configura domínio, HTTPS, contas e privilégios SQL, supervisão do processo e monitoramento com alertas.
- [ ] Backup automático protegido, cópia externa e restauração exercitada no destino; RPO/RTO e responsáveis registrados.
- [ ] Revisão independente de segurança e decisão sobre MFA dos gestores; 2FA ainda não foi implementado nesta rodada.
- [ ] Homologação de acessibilidade, leitores de tela, câmeras de celular e QR Codes impressos.
- [ ] Piloto com usuários reais autorizados e teste de carga representativo do volume e infraestrutura esperados.
- [ ] Versão identificada por commit, testes aprovados, plano de rollback e aprovação formal de entrada em produção.

## Referências técnicas da implementação

- [GitHub Actions: sintaxe e serviços de teste](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
- [Node.js: encerramento do servidor HTTP](https://nodejs.org/api/http.html#serverclosecallback).
- [Guia de implantação e restauração deste projeto](implantacao.md).
- [Pendências institucionais e evolução](../development/pendencias.md).
