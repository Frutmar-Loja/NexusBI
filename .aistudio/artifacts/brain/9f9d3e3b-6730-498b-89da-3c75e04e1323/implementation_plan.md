# NexusBI - Inteligência Multi-Arquétipo & Insights Executivos

Ampliação do motor de auto-descoberta para reconhecer e adaptar dashboards a diversos tipos de planilhas (Bases de Clientes, Catálogo e Estoque de Produtos, Chamados/Operações, RH e Finanças), aperfeiçoamento dos gráficos existentes e criação do Painel de Insights Executivos automáticos.

### User Review & Critical Decisions

> [!IMPORTANT]
> O planejamento atende pontualmente às três decisões confirmadas pelo usuário:
> 1. Suporte inteligente a múltiplos tipos de planilha além de financeiro (Clientes/CRM, Estoque/Produtos, Chamados, RH).
> 2. Aperfeiçoamento profundo dos gráficos e visuais existentes (ao invés de dispersar em novos tipos).
> 3. Criação de um Painel de Insights Executivos com síntese automática dos destaques em texto claro.

- **Detecção de Arquétipo de Planilha**:
  - *Clientes & CRM*: Foco em volume de contas, distribuição geográfica (cidade/UF), segmentação (leads, ativos, churn), canais de aquisição e score.
  - *Produtos & Estoque*: Foco em contagem de SKUs, estoque total, produtos em ruptura/alerta crítico, preço médio e fornecedores líderes.
  - *Operações & Chamados*: Foco em volume de tickets, tempo médio de resolução, atingimento de SLA, prioridades e canais de suporte.
  - *RH & Pessoas*: Foco em headcount total, departamentos, tempo de casa, cargos e média salarial.
  - *Vendas & Finanças*: Mantém o tratamento de faturamento, custos, margens e lucro líquido.
- **Aprimoramento dos Visuais Existentes**:
  - Adaptação dinâmica de agregações (quando a planilha não tiver moeda, os visuais utilizam contagens ponderadas, taxas de conversão ou médias numéricas sem quebrar ou forçar exibição de R$).
  - Melhores tooltips, rótulos adaptativos e transições de filtro cruzado mais intuitivas.
- **Painel de Insights Executivos**:
  - Faixa expansível com destaques em linguagem natural:
    - *Visão Geral*: Arquétipo da planilha e escala do volume de dados.
    - *Líder de Concentração*: Segmento ou dimensão que domina o conjunto (ex: "Categoria Hardware representa 44% do volume").
    - *Tendência Temporal*: Direção e aceleração observadas.
    - *Atenção / Discrepâncias*: Alerta acionável para anomalias ou baixos desempenhos identificados.

---

### 1. Overview & Core Concept

- **O que muda**: O NexusBI agora não assume que toda planilha é um livro contábil com faturamento e lucro. Ao carregar um arquivo, o motor avalia o conjunto de colunas e classifica a planilha em um dos 5 arquétipos principais (`crm_clients`, `inventory_products`, `operations_support`, `hr_people`, `financial_sales` ou `generic_analytics`).
- **Comportamento Contextual**:
  - Os KPIs mudam automaticamente para métricas nativas do domínio (ex: em uma planilha de Clientes, calcula "Total de Clientes", "Novos no Período", "Estados Atendidos", "Score Médio").
  - Em uma planilha de Estoque, calcula "Itens em Estoque", "SKUs Distintos", "Estoque Crítico/Ruptura", "Preço Médio".
  - O painel exibe um resumo executivo em linguagem natural no topo do dashboard, gerando valor imediato antes mesmo de o usuário navegar pelos gráficos.

---

### 2. User Experience & Visual Design

#### Fluxo de Usuário
1. **Upload & Reconhecimento do Arquétipo**:
   - Ao carregar uma planilha, uma tag discreta no topo informa o arquétipo detectado (ex: `· Arquétipo: Base de Clientes / CRM` ou `· Arquétipo: Gestão de Estoque`).
   - Disponibilização de novos datasets de demonstração correspondentes (ex: *Base de Clientes & CRM* e *Controle de Estoque & Ruptura*).
2. **Painel de Insights Executivos (Refero / Linear Style)**:
   - Superfície em ardósia escura `#0F1422` com borda sutil de 1px e ícone de síntese analítica.
   - 3 a 4 cartões de texto condensado estruturados:
     - **Destaque Principal**: A dimensão de maior impacto.
     - **Comportamento Temporal**: Crescimento recente ou ritmo de registros.
     - **Pontos de Atenção**: Ocorrências atípicas, estoques baixos ou quedas de índice.
     - **Oportunidade / Ação**: Sugestão de foco com base nos filtros ativos.
3. **Refinamento dos Gráficos Existentes**:
   - `TrendChart`: Suporta tanto soma ponderada quanto contagem cronológica de registros (ideal para cadastros de clientes ou chamados abertos).
   - `BarBreakdownChart`: Rótulos contextuais mais claros ("clientes", "unidades", "itens" ou "R$").
   - `DonutChart`: Distribuição contextual com percentual e contagem real.
   - `MatrixGrid`: Cruzamento ajustado para densidade dimensional sem células nulas confusas.

---

### 3. Key Product Decisions & Trade-Offs

- **Classificação Semântica Heurística Baseada em Colunas**:
  - *Decisão*: Identificar arquétipos analisando nomes de colunas, tipos de dados e padrões de valores (ex: colunas como `email`, `cliente`, `cpf`, `cidade` disparam arquétipo CRM; `sku`, `estoque`, `fornecedor` disparam Estoque).
  - *Por quê*: Rápido, 100% determinístico e totalmente processado no cliente sem latência de API.
- **Motor de Geração de Insights Heurístico e Contextual**:
  - *Decisão*: Algoritmo que calcula máximos, concentrações percentuais, taxas de crescimento e anomalias para montar narrativas executivas concisas.
  - *Por quê*: Executa em < 10ms, funciona offline e responde instantaneamente a qualquer clique de filtro cruzado.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-ARCHETYPE ENGINE ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [ Uploaded Spreadsheet ] ──▶ [ SheetJS Parser ]                            │
│                                      │                                      │
│                                      ▼                                      │
│                           [ Archetype Classifier ]                          │
│                           • CRM & Clientes (email, cliente, estado, status) │
│                           • Estoque & Produtos (sku, estoque, preco, fornec)│
│                           • Operações & Suporte (chamado, sla, prioridade)  │
│                           • RH & Pessoas (colaborador, cargo, setor, salario│
│                           • Financeiro & Vendas (receita, custo, lucro)     │
│                                      │                                      │
│                                      ▼                                      │
│                           ┌───────────────────────────────┐                 │
│                           │    Contextual AutoAnalysis    │                 │
│                           │  • Domain-specific KPIs       │                 │
│                           │  • Metric / Count adaptation  │                 │
│                           └───────────────┬───────────────┘                 │
│                                           │                                 │
│         ┌─────────────────────────────────┼────────────────────────────────┐
│         ▼                                 ▼                                ▼
│  [ Executive Insights ]          [ Enhanced Visuals ]             [ Data Table ]   │
│  • Primary Driver                • Trend Timeline                 • Outliers & Tags│
│  • Trend Dynamics                • Ranked Breakdown               • Domain format  │
│  • Risk / Anomaly Alert          • Donut & Heat Matrix            • Dynamic paging │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Verification Plan

1. **Validação de Arquétipos**: Testar detecção com bases de Clientes, Estoque e Vendas, confirmando que os KPIs e rótulos se adaptam corretamente sem forçar símbolos de moeda onde não existem.
2. **Painel de Insights**: Verificar se os textos de destaques mudam dinamicamente ao clicar em filtros cruzados.
3. **Aprimoramento dos Gráficos**: Validar consistência do `TrendChart`, `BarBreakdownChart` e `DonutChart` em dados sem valores financeiros.
4. **Compilação e Linter**: Executar `compile_applet` e `lint_applet` garantindo zero erros de tipagem.
