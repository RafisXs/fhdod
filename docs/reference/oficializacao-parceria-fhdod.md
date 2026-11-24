# Oficialização da parceria com a FHDOD

Este documento organiza os pontos que precisam ser decididos para oficializar a parceria. Ele é um checklist técnico e negocial, não uma minuta contratual nem parecer jurídico. O instrumento final deve ser preparado ou revisado pelos responsáveis jurídicos e de proteção de dados das partes.

## Correção principal da proposta

A isenção não deve ser descrita apenas como válida “enquanto a FHDOD for parceira”, porque essa expressão não define prazo, entregas, responsabilidades ou término. A redação recomendada para negociação é:

> Durante a vigência do termo de parceria e dentro do escopo nele definido, a FHDOD ficará isenta das cobranças de piloto, implantação padrão e assinatura mensal da plataforma. A isenção não abrange automaticamente hospedagem, domínio, certificados, equipamentos, deslocamentos, serviços de terceiros, integrações, customizações ou suporte extraordinário. Renovação, ampliação ou conversão para condição comercial dependerão de manifestação escrita das partes.

Essa redação ainda precisa ser adaptada aos dados das partes, ao modelo de hospedagem e às responsabilidades efetivamente assumidas.

## Instrumentos recomendados

1. **Termo de parceria ou cooperação tecnológica:** objeto, prazo, isenção, entregas, governança e encerramento.
2. **Anexo de escopo e níveis de serviço:** funcionalidades incluídas, ambientes, suporte, manutenção, disponibilidade e critérios de aceite.
3. **Anexo de proteção de dados:** papéis em cada tratamento, instruções, segurança, incidentes, subcontratados, retenção e eliminação.
4. **Termo de autorização de marca e estudo de caso:** separado e opcional, caso a FHDOD permita uso do nome, logotipo, depoimento ou resultados.
5. **Termo de aceite de implantação:** registra testes, pendências conhecidas, responsáveis e data de início da operação.

## Checklist de decisões

### Partes e representação

- Razão social, CNPJ, endereço e contatos oficiais de cada parte.
- Nome, cargo e comprovação de poderes dos signatários.
- Responsáveis administrativo, técnico, de segurança e de privacidade.
- Canais válidos para notificações e mudanças de escopo.

### Objeto, prazo e isenção

- Descrever que o objeto é a implantação e validação do sistema de avaliação do atendimento.
- Definir início, término e condição de renovação. Sugestão negocial: 12 meses, revisão no sexto mês e renovação escrita.
- Listar exatamente o que é isento: piloto, implantação padrão, licença de uso durante o prazo, atualizações corretivas e suporte remoto básico.
- Definir limites do suporte básico: canal, horário, quantidade estimada de horas, prioridade e prazo de resposta.
- Identificar custos fora da isenção e exigir orçamento prévio para qualquer cobrança.
- Proibir renovação paga automática ou cobrança retroativa pela fase isenta.

### Escopo e aceite

- Relacionar telas, perfis, setores, questionários, relatórios, QR Codes e exportações incluídos.
- Identificar o ambiente de homologação e o ambiente oficial.
- Definir critérios objetivos de aceite e prazo para correção de defeitos.
- Separar correção de defeito, manutenção evolutiva e customização.
- Registrar as pendências conhecidas: MFA, política de retenção, teste físico de QR, acessibilidade especializada e restauração no ambiente definitivo.

### Hospedagem e operação

- Decidir quem fornece servidor, domínio, HTTPS, banco, e-mail técnico, backup e monitoramento.
- Definir quem instala atualizações e em qual janela de manutenção.
- Registrar disponibilidade esperada, RPO, RTO, retenção de backup e procedimento de restauração.
- Definir processo de abertura, prioridade e escalonamento de incidentes.
- Manter inventário de contas administrativas e revogar acessos ao término.

### Proteção de dados e LGPD

- Mapear cada operação e definir os papéis conforme o poder de decisão real. A FHDOD tende a ser controladora dos dados da pesquisa; o desenvolvedor ou fornecedor só será operador nas operações que realizar em nome dela, por exemplo hospedagem ou suporte com acesso. Essa classificação deve ser confirmada pelos responsáveis das partes.
- A FHDOD deve definir finalidade, hipótese legal, texto do aviso, canal dos titulares, prazo de retenção e pessoas autorizadas.
- O fornecedor deve tratar dados apenas conforme instruções documentadas, limitar acessos e informar eventual subcontratação.
- Definir procedimento e prazo interno para comunicar incidentes, preservar evidências e cooperar com a avaliação do evento.
- Documentar exportação, correção, anonimização e eliminação, inclusive o tratamento de cópias de backup.
- Proibir uso de respostas, telefones ou indicadores identificáveis para treinamento, publicidade ou finalidade própria.
- Avaliar a necessidade de relatório de impacto e manter registro das operações de tratamento.

A LGPD diferencia controlador e operador pelo poder de decisão e exige que o operador siga as instruções do controlador. A ANPD considera o contrato entre esses agentes uma boa prática para delimitar atividades e responsabilidades. A lei também exige medidas técnicas e administrativas de segurança e estruturação dos sistemas conforme boas práticas.

### Propriedade intelectual, dados e marca

- Definir quem é titular do código-fonte anterior à parceria e das evoluções criadas durante ela.
- Conceder à FHDOD licença de uso compatível com a vigência e o modelo de implantação acordado.
- Reconhecer que os dados da pesquisa, questionários institucionais, identidade visual e conteúdos fornecidos pela FHDOD permanecem sob sua responsabilidade e titularidade aplicável.
- Definir se a instituição receberá código-fonte, documentação, cópia de segurança e instruções de continuidade.
- Exigir autorização separada para publicar nome, logotipo, imagens, depoimentos, métricas ou estudo de caso da FHDOD.
- Corrigir o estado `UNLICENSED` do repositório somente após definir o termo de uso e a titularidade; não aplicar licença pública por conta própria.

### Encerramento e continuidade

- Prever encerramento por término, acordo, descumprimento ou risco de segurança.
- Definir aviso prévio e período de transição.
- Entregar dados em formato utilizável e documentar sua importação ou leitura.
- Revogar contas, chaves, tokens e acessos de suporte.
- Estabelecer prazo e evidência de eliminação das cópias sob responsabilidade do fornecedor, respeitando obrigações de guarda.
- Definir se a FHDOD poderá continuar usando uma versão instalada e quem prestará manutenção.
- Registrar a situação de backups e logs no encerramento.

## Matriz inicial de responsabilidades

Esta matriz deve virar um anexo com nomes e prazos.

| Atividade | FHDOD | Responsável pelo produto | Decisão pendente |
| --- | --- | --- | --- |
| Aprovar questionário e indicadores | Responsável | Consultado | Nome do aprovador |
| Definir finalidade, hipótese legal e retenção | Responsável | Apoia tecnicamente | Parecer do responsável por privacidade |
| Fornecer domínio e identidade visual | Responsável | Implementa | Domínio oficial |
| Hospedagem e banco | A definir | A definir | Local, conta e custos |
| Implantar e corrigir defeitos | Acompanha e aceita | Responsável | Prazo de atendimento |
| Backup e restauração | A definir | A definir | RPO, RTO e teste periódico |
| Gerenciar usuários e permissões | Responsável | Apoia | Gestor titular e substituto |
| Monitorar e responder a incidentes | Compartilhado | Compartilhado | Fluxo e contatos 24 horas |
| Autorizar uso da marca e estudo de caso | Responsável | Solicita separadamente | Permitido ou vedado |
| Exportar e destinar dados no término | Decide e recebe | Executa o que estiver sob sua guarda | Formato e prazo |

## Pontos de melhoria antes da assinatura

### Prioridade crítica

- Aprovar a política de retenção e eliminação de telefones, avaliações, auditoria, logs e backups.
- Definir claramente controlador, operador e eventual suboperador por operação.
- Escolher hospedagem, domínio, HTTPS, responsáveis pelo backup e procedimento de incidente.
- Definir titularidade do código, licença concedida à FHDOD e continuidade após o término.
- Delimitar a isenção para que não existam custos implícitos ou obrigação ilimitada de suporte.

### Prioridade alta

- Executar restauração de backup no ambiente definitivo.
- Homologar QR Codes impressos, acessibilidade e fluxos com usuários autorizados.
- Definir SLA ou, se não houver SLA, registrar que o suporte será por melhor esforço dentro de limites acordados.
- Criar inventário de acessos e processo de entrada e saída de administradores.
- Definir procedimento para mudanças, versões, rollback e comunicação de indisponibilidade.

### Evolução recomendada

- Implementar MFA para perfis de gestão.
- Automatizar retenção após aprovação da regra institucional.
- Adicionar observabilidade e alertas externos sem registrar dados pessoais.
- Avaliar teste independente de segurança antes de ampliar o uso.
- Medir custo real de suporte e infraestrutura para revisar as condições comerciais futuras.

## Critérios para considerar a parceria oficializada

- Instrumento e anexos assinados por representantes autorizados.
- Escopo, prazo e isenção sem campos indefinidos.
- Papéis de dados, segurança, retenção e incidentes aprovados.
- Propriedade intelectual, licença, marca e estudo de caso decididos.
- Ambiente oficial configurado e termo de aceite assinado.
- Responsáveis e canais de comunicação registrados.
- Plano de encerramento, exportação e eliminação aprovado.

## Referências oficiais

- [Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- [Guia da ANPD sobre agentes de tratamento e encarregado](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/Segunda_Versao_do_Guia_de_Agentes_de_Tratamento_retificada.pdf/%40%40display-file/file).
- [Guia da ANPD sobre segurança da informação para agentes de pequeno porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/processo-guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf).
