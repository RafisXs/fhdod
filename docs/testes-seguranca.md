# Relatório de validação da rodada de segurança

Data: 29/10/2026. Ambiente local: Windows, Node.js 24.14.1, MySQL 8.0.46 e Google Chrome em modo headless.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Suíte da API após inclusão do aceite de privacidade | 24 testes aprovados, incluindo rejeição de aceite ausente, falso, textual ou de versão antiga. |
| Suíte de segurança | 10 verificações aprovadas, contando o cenário principal e seus nove subtestes. |
| Restrição da senha provisória | Login e perfil permitidos; acesso aos dados administrativos bloqueado até a troca. |
| Validação da nova senha | Senha atual incorreta, repetição da senha e excesso de bytes UTF-8 rejeitados. |
| Revogação de sessões | Cookie anterior rejeitado após alteração pessoal ou redefinição pela gestão. |
| Bloqueio persistente | Cinco falhas registradas no banco; autenticação com senha correta recusada durante o bloqueio; login após expiração limpa o contador. |
| Auditoria | Eventos de contas, senhas, perguntas, setores e contatos identificados; consulta vedada ao visualizador. |
| Falha da auditoria | Trigger de teste provoca erro: renomeação revertida e disponibilização de telefones interrompida. Trigger criado e removido apenas no banco temporário. |
| Navegador real | Fluxos anteriores do painel preservados; aba Auditoria, troca pessoal e primeiro acesso obrigatório verificados. |
| Aceite de privacidade | Caixa compacta e desmarcada no início; nenhuma avaliação criada antes da concordância; primeira resposta salva no banco como rascunho, com versão/horário do aceite; conclusão funciona sem telefone. |
| Migração em cópia do banco antigo | Contas e hashes existentes preservados; contas antigas não marcadas automaticamente como provisórias; migração repetida sem redefinir senhas. |
| Recuperação por terminal | Criação e redefinição de gerente testadas na cópia isolada, com troca obrigatória e incremento da versão de sessão. |
| Backup local antes da atualização | Dump comprimido e checksum gerados fora do repositório; descompressão e importação em banco temporário bem-sucedidas; contas conferidas. |

## Reprodução

```powershell
npm.cmd run test:painel
```

Consultar requisitos e portas no README. Essa suíte cria banco temporário próprio, executa a API, reinicia a instância de teste para isolar os limites por IP, executa a suíte de segurança e realiza os fluxos no navegador. Não executar `tests/seguranca.test.js` diretamente contra um banco operacional; o arquivo recusa nomes fora do padrão de banco temporário.

A conferência de migração e a restauração do backup local foram executadas separadamente da suíte. Não representam um exercício completo de recuperação de desastre do ambiente de destino.

## Limites e verificações ainda necessárias

Os modelos Linux de Nginx, systemd e backup não foram instalados ou exercitados no servidor de produção. Renovação de certificado, firewall, execução agendada, cópia externa, alertas, RPO/RTO e restauração no destino permanecem sob validação da TI. Testes locais não demonstram resistência a carga, acessibilidade integral, 2FA ou conformidade jurídica. O plano dessas entregas está em [pendências](pendencias.md).
