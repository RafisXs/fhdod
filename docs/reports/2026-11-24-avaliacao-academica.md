# Avaliação acadêmica — 24/11/2026

Este relatório reúne as evidências do projeto segundo os cinco critérios informados para a avaliação. Ele não substitui a demonstração, a confirmação do briefing pelo cliente ou a validação comercial das hipóteses.

## Resultado por critério

| Critério | Evidência principal | Situação |
| --- | --- | --- |
| Fidelidade ao briefing | Matriz entre dor, funcionalidade e critério de aceite; pesquisa, painel, contatos, TV e QR exercitados no navegador | Atendido tecnicamente; confirmação final do cliente pendente |
| Decisão arquitetural | Documento registra contexto, escolha do MySQL 8, Node.js/Express, monólito modular, alternativas e consequências | Atendido |
| Qualidade e testes | Sintaxe, unidade, API, segurança, integração/volume e navegador; CI com MySQL e Chrome | Atendido na validação local |
| UX/UI | Pesquisa responsiva, painel desktop/móvel, foco, rótulos, estados ARIA e mensagens de erro | Atendido; homologação especializada de acessibilidade pendente |
| Viabilidade mercadológica | Segmentos, proposta de valor, concorrência por categoria, preços hipotéticos, custos, projeção, aquisição e escala | Atendido como plano acadêmico; hipóteses aguardam entrevistas |

## Evidência técnica executada

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Aprovado |
| `npm run test:unit` | 5 de 5 aprovados |
| API na suíte completa | 30 de 30 aprovados |
| Segurança | 10 de 10 aprovados |
| Integração e volume | 7 de 7 aprovados |
| Navegador | Pesquisa, painel, contas, perguntas, privacidade, TV, QR e impressão aprovados |
| Volume descartável | 20.001 avaliações e 220.011 respostas |

## Documentos para apresentação

1. [Briefing e requisitos](../reference/briefing-e-requisitos.md).
2. [Decisões arquiteturais](../reference/decisoes-arquiteturais.md).
3. [Plano de negócio](../reference/plano-de-negocio.md).
4. [Manual do sistema](../reference/manual-detalhado.md).
5. [Preparação para produção](../guides/entrada-em-producao.md).

## Limites declarados

- Os valores comerciais são hipóteses acadêmicas e precisam ser validados com clientes.
- O texto original do briefing deve ser comparado com a matriz antes da entrega.
- Acessibilidade com leitores de tela, QR impresso, domínio, backup e restauração precisam de homologação no destino.
- A versão atual utiliza uma instância por instituição e não possui faturamento ou multiempresa.
