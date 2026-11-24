# Briefing e rastreabilidade dos requisitos

Este documento transforma a necessidade relatada pela Fundação Hospitalar Dr. Oswaldo Diesel em requisitos verificáveis. Como o texto original do briefing não faz parte do repositório, a matriz abaixo foi reconstruída a partir das funcionalidades aprovadas e deve ser confirmada com o cliente e o professor antes da entrega final.

## Problema e objetivo

O hospital precisa substituir ou complementar pesquisas de satisfação dispersas por um processo digital simples para pacientes e familiares. A gestão precisa acompanhar os resultados por setor, identificar atendimentos que exigem atenção, agir sobre contatos autorizados e apresentar indicadores sem expor dados pessoais.

O objetivo do produto é coletar avaliações com pouco atrito, transformar respostas em indicadores acionáveis e permitir que cada perfil da equipe acesse apenas as informações necessárias ao seu trabalho.

## Públicos envolvidos

| Público | Necessidade principal |
| --- | --- |
| Paciente ou familiar | Responder rapidamente, pelo celular, sem criar conta e com informação clara sobre privacidade. |
| Gestor hospitalar | Comparar resultados, acompanhar tendências, configurar setores e administrar a equipe. |
| Administrador de setor | Ver e tratar os resultados do próprio setor. |
| Visualizador | Consultar indicadores autorizados sem acessar telefones ou alterar dados. |
| Ouvidoria e responsável por privacidade | Manter um canal institucional e controlar finalidade, acesso e retenção dos dados. |
| TI | Implantar, monitorar, fazer backup e recuperar a aplicação com segurança. |

## Matriz de rastreabilidade

| Dor ou requisito | Solução entregue | Evidência e critério de aceite | Situação |
| --- | --- | --- | --- |
| Pesquisa em papel ou coleta fragmentada | Pesquisa web responsiva acessada por link ou QR Code | Usuário escolhe o setor e conclui a avaliação pelo celular | Atendido e testado no navegador |
| Questionários diferentes por setor | Cadastro, edição, ordenação, ativação e remoção de perguntas | Gerente ou administrador altera apenas o escopo permitido; NPS obrigatório é preservado | Atendido e testado pela API e navegador |
| Perda de respostas durante o preenchimento | Rascunho criado na primeira resposta e atualizado a cada etapa | Resposta salva permanece disponível mesmo antes da conclusão | Atendido e testado |
| Indicadores misturando respostas incompletas | Separação entre rascunho e avaliação concluída | Painel e TV contabilizam somente avaliações concluídas | Atendido e testado |
| Dificuldade para identificar problemas | Nota média, NPS, satisfação, aspectos positivos e oportunidades de melhoria | Filtros por período, setor, turno e tipo de atendimento | Atendido; consulta de resultados coberta por regressão |
| Necessidade de retorno ao paciente | Telefone opcional apenas em avaliação abaixo da média e com autorização específica | Sem consentimento o telefone é recusado; visualizador e TV não recebem o número | Atendido e testado |
| Acesso excessivo a dados | Perfis gerente, administrador e visualizador, com escopo por setor | Testes impedem leitura e alteração fora do perfil | Atendido e testado |
| Acompanhamento da operação | Painel ao vivo de rascunhos em andamento e avaliações abandonadas | Atualização periódica sem incluir telefone | Atendido e testado |
| Apresentação institucional | TV de indicadores agregados e cartazes de QR Code | TV não apresenta dados pessoais; cartazes geram SVG, PNG e PDF A4 | Atendido; leitura física ainda requer homologação |
| Uso dos dados em reuniões | Exportação Excel e impressão | Exportação percorre toda a base autorizada e gera resumo por setor | Atendido e testado com 20.001 avaliações |
| Responsabilização das alterações | Auditoria de acessos sensíveis e mudanças administrativas | Log identifica responsável e ação sem copiar senha ou telefone | Atendido e testado |
| Privacidade e transparência | Aceite inicial, aviso de privacidade e consentimento separado para contato | Versão e instante do aceite ficam registrados | Implementado; texto e retenção aguardam aprovação institucional |
| Continuidade operacional | Monitoramento, encerramento controlado, backup e roteiro de restauração | Endpoints de processo e banco, serviço systemd e modelo de backup | Entregue como código e guia; exercício no destino pendente |

## Requisitos não funcionais

- Segurança: senhas com hash, cookie `HttpOnly` e `SameSite`, bloqueio por tentativas, limites por IP, cabeçalhos de segurança e validação de entrada.
- Integridade: transações e restrições no banco impedem estados inválidos e preservam o histórico das perguntas.
- Desempenho: paginação por cursor, agregação SQL e exportação em streaming; o navegador ainda precisa de homologação em volumes maiores.
- Usabilidade: controles grandes, navegação responsiva, mensagens diretas e fluxo público sem cadastro.
- Acessibilidade: semântica, foco, rótulos e estados ARIA presentes; auditoria especializada com leitores de tela permanece pendente.
- Operação: configuração por ambiente, health checks, logs sem corpos sensíveis e documentação de implantação.

## Fora do escopo atual

- Prontuário eletrônico, diagnóstico, agendamento ou qualquer decisão clínica.
- Aplicativo móvel nativo.
- Envio automático de WhatsApp, SMS ou e-mail ao paciente.
- Multiempresa em uma única instalação; cada hospital utiliza uma instância isolada nesta versão.
- MFA, autenticação corporativa e hospedagem gerenciada pelo produto.

## Validação final do briefing

Antes da apresentação, o responsável pelo projeto deve confirmar com o cliente: setores e perguntas oficiais, interpretação do NPS, responsáveis pelos contatos, texto de privacidade, prazo de retenção, identidade visual e domínio definitivo. Essa validação evita apresentar hipóteses como decisões já aprovadas.
