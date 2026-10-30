# Plano de evolução e validações institucionais

Esta lista distingue entregas desta rodada de requisitos ainda pendentes. Não representa aprovação institucional ou declaração de conformidade.

| Item | Situação |
| --- | --- |
| Troca da própria senha para todos os perfis | Implementada com senha atual, validação e revogação de sessões anteriores. |
| Troca de senha provisória no primeiro acesso | Implementada para novas contas e redefinições; contas antigas preservadas na migração. |
| Bloqueio persistente por conta | Implementado: cinco falhas, 15 minutos, além do limite por IP. |
| Auditoria de contas, perguntas, setores e telefones | Implementada com leitura restrita ao gerente; não é armazenamento imutável contra administrador SQL. |
| Guia de implantação | Entregue com modelos de proxy, serviço, backup diário e procedimento de restauração. Implantação e exercício de recuperação no destino pendentes da TI. |
| 2FA por aplicativo autenticador para gerente | Pendente: incluir cadastro confirmado, proteção do segredo, códigos de recuperação, revogação e processo de recuperação de conta. |
| Aviso de privacidade e aceite na pesquisa | Caixa compacta e desmarcada no início. Após concordar, cada resposta é salva em tempo real; a primeira gravação registra versão/horário do aceite. Texto e canal de atendimento ainda sujeitos à aprovação do encarregado do hospital. Autorização opcional do telefone permanece separada. |
| Retenção de telefones e atendimento a exclusão | Pendente de prazo, marco inicial, política de backups e fluxo aprovado; não foi aplicada eliminação automática. “90 dias após atendimento” é proposta, não política vigente. |
| Escala 0–10, setores e textos oficiais | Pendente de homologação com formulário FM-NEG-0.083 e responsáveis do hospital. Escala atual preservada em 1–10. |
| E-mail de avaliação baixa e queda semanal | Pendente de SMTP, destinatários e regras; evitar incluir telefone ou conteúdo sensível no e-mail. |
| Metas por setor e comparação na TV | Pendente de metas e regras aprovadas; comparação de períodos existente no painel permanece. |
| Relatório mensal em PDF por setor | Pendente. Impressão do painel e exportação Excel permanecem disponíveis. |
| Comentário livre e marcação de tratamento | Pendente de tratamento de dados sensíveis, controles de acesso e revisão de conteúdo. |
| Perguntas condicionais e cópia de modelos | Pendente. Inclusão atual utiliza modelos básicos editáveis, sem lógica condicional. |
| Agregação completa no MySQL | Pendente: permanecem limites de carregamento descritos no README. |
| CAPTCHA ou limite por QR Code | Pendente. Permanecem limites por endereço e validações existentes. |
| Quiosque, fonte grande e leitor de tela | Pendentes de implementação/avaliação. Navegação por teclado dos seletores não substitui teste completo de acessibilidade. |
| Documentação de requisitos, arquitetura e Git/Kanban | Guia operacional e esta lista entregues; documentos completos e endereço real do Kanban pendentes. |
| CI no GitHub e teste de carga | Pendentes. Testes locais de API, segurança e interface disponíveis. |

Para priorização, cada item deve receber responsável, critérios de aceite e data acordada. Evitar habilitar serviços externos, envio de mensagens ou descarte de dados antes de definir os parâmetros e as responsabilidades.
