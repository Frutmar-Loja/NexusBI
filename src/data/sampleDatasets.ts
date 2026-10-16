export interface SampleDatasetInfo {
  id: string;
  name: string;
  category: string;
  archetypeTag: string;
  description: string;
  rowsCount: number;
  fileName: string;
  generateRows: () => Record<string, any>[];
  generateRawGrid?: () => any[][];
}

function generateSampleCPF(index: number): string {
  const n = (100000000 + (index * 7919) % 800000000).toString().padStart(9, '0');
  let d1 = 0;
  for (let i = 0; i < 9; i++) d1 += parseInt(n[i], 10) * (10 - i);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  let d2 = 0;
  for (let i = 0; i < 9; i++) d2 += parseInt(n[i], 10) * (11 - i);
  d2 += d1 * 2;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  const raw = `${n}${d1}${d2}`;
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
}

function generateSampleCNPJ(index: number): string {
  const base = (10000000 + (index * 4391) % 80000000).toString().padStart(8, '0');
  const branch = '0001';
  const n = `${base}${branch}`;
  let sum = 0;
  let pos = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(n[i], 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  const n2 = `${n}${d1}`;
  sum = 0;
  pos = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(n2[i], 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  const raw = `${n}${d1}${d2}`;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
}

export const SAMPLE_DATASETS: SampleDatasetInfo[] = [
  {
    id: 'vendas_comerciais_1100',
    name: 'Gestão Comercial & Financeira (1.100 Pedidos Auditados)',
    category: 'Comercial & Vendas',
    archetypeTag: 'Vendas / Comercial',
    description: '1.100 pedidos auditados: R$ 270.943,90 bruto, R$ 258.328,02 líquido, R$ 213.416,80 realizado, 125 cancelados (11,4%), ticket médio de R$ 247,30 e categorias reconciliadas a 100%.',
    rowsCount: 1100,
    fileName: 'NexusBI_Teste_Gestao_Comercial_Financeira.xlsx',
    generateRows: () => {
      const records: Record<string, any>[] = [];

      const categories = ['Tecnologia & Informática', 'Móveis Corporativos', 'Serviços & Licenças'];
      const channels = ['E-commerce B2B', 'Venda Direta', 'Representante Comercial', 'Inside Sales'];
      const reps = ['Carlos Silveira', 'Mariana Costa', 'Roberto Lima', 'Fernanda Souza', 'Julio Cesar'];
      const ufs = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'GO', 'PE', 'DF'];

      const TARGET_GROSS_CENTS = 27094390; // 270.943,90
      const TARGET_DISCOUNT_CENTS = 1261588; // 12.615,88
      const TARGET_REALIZED_CENTS = 21341680; // 213.416,80
      const TARGET_PENDING_CENTS = 4491122; // 44.911,22

      const COMPLETED_COUNT = 863;
      const PENDING_COUNT = 112;
      const CANCELED_COUNT = 125;

      let realizedAccum = 0;
      let pendingAccum = 0;
      let discountAccum = 0;

      const startDate = new Date(2024, 0, 5);

      // 1. Generate Completed (863 rows, net = 213.416,80)
      for (let i = 1; i <= COMPLETED_COUNT; i++) {
        let lineNetCents = 0;
        if (i === COMPLETED_COUNT) {
          lineNetCents = TARGET_REALIZED_CENTS - realizedAccum;
        } else {
          const base = 24730;
          const variation = ((i * 13) % 18000) - 9000;
          lineNetCents = base + variation;
        }
        realizedAccum += lineNetCents;

        let lineDiscountCents = 0;
        if (i % 3 === 0) {
          lineDiscountCents = Math.round(lineNetCents * 0.05);
        }
        discountAccum += lineDiscountCents;

        const dayOffset = (i * 7) % 360;
        const orderDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

        records.push({
          index: i,
          orderId: `PED-2024-${String(10000 + i).padStart(5, '0')}`,
          clientId: `CLI-${String(100 + (i % 280)).padStart(4, '0')}`,
          cat: categories[i % categories.length],
          channel: channels[i % channels.length],
          rep: reps[i % reps.length],
          uf: ufs[i % ufs.length],
          orderDate: orderDate.toISOString().split('T')[0],
          status: 'Faturado Concluído',
          lineNetCents,
          lineDiscountCents,
          lineGrossCents: lineNetCents + lineDiscountCents
        });
      }

      // 2. Generate Pending (112 rows, net = 44.911,22)
      for (let p = 1; p <= PENDING_COUNT; p++) {
        const i = COMPLETED_COUNT + p;
        let lineNetCents = 0;
        if (p === PENDING_COUNT) {
          lineNetCents = TARGET_PENDING_CENTS - pendingAccum;
        } else {
          const base = 40100;
          const variation = ((p * 17) % 20000) - 10000;
          lineNetCents = base + variation;
        }
        pendingAccum += lineNetCents;

        let lineDiscountCents = 0;
        if (p % 4 === 0) {
          lineDiscountCents = Math.round(lineNetCents * 0.04);
        }
        discountAccum += lineDiscountCents;

        const dayOffset = (i * 7) % 360;
        const orderDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

        records.push({
          index: i,
          orderId: `PED-2024-${String(10000 + i).padStart(5, '0')}`,
          clientId: `CLI-${String(100 + (i % 280)).padStart(4, '0')}`,
          cat: categories[i % categories.length],
          channel: channels[i % channels.length],
          rep: reps[i % reps.length],
          uf: ufs[i % ufs.length],
          orderDate: orderDate.toISOString().split('T')[0],
          status: 'Pendente',
          lineNetCents,
          lineDiscountCents,
          lineGrossCents: lineNetCents + lineDiscountCents
        });
      }

      // 3. Generate Canceled (125 rows, lineNet = 0 recognized)
      for (let c = 1; c <= CANCELED_COUNT; c++) {
        const i = COMPLETED_COUNT + PENDING_COUNT + c;
        const dayOffset = (i * 7) % 360;
        const orderDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

        records.push({
          index: i,
          orderId: `PED-2024-${String(10000 + i).padStart(5, '0')}`,
          clientId: `CLI-${String(100 + (i % 280)).padStart(4, '0')}`,
          cat: categories[i % categories.length],
          channel: channels[i % channels.length],
          rep: reps[i % reps.length],
          uf: ufs[i % ufs.length],
          orderDate: orderDate.toISOString().split('T')[0],
          status: 'Cancelado',
          lineNetCents: 0,
          lineDiscountCents: 0,
          lineGrossCents: 0
        });
      }

      // Exact discount adjustment to match TARGET_DISCOUNT_CENTS and TARGET_GROSS_CENTS
      const currentDiscounts = records.reduce((acc, r) => acc + r.lineDiscountCents, 0);
      const diffDiscount = TARGET_DISCOUNT_CENTS - currentDiscounts;
      records[0].lineDiscountCents += diffDiscount;
      records[0].lineGrossCents = records[0].lineNetCents + records[0].lineDiscountCents;

      return records.map(r => {
        const gross = r.lineGrossCents / 100;
        const discount = r.lineDiscountCents / 100;
        const net = r.lineNetCents / 100;
        const qty = (r.index % 4) + 1;
        const unitPrice = gross > 0 ? Math.round((gross / qty) * 100) / 100 : 150.00;
        const cost = Math.round(net * 0.65 * 100) / 100;

        return {
          'ID Pedido': r.orderId,
          'ID Cliente': r.clientId,
          'SKU': `SKU-PROD-${(r.index % 25) + 100}`,
          'Produto': `Produto Corporativo ${(r.index % 25) + 1}`,
          'Categoria': r.cat,
          'Data Pedido': r.orderDate,
          'Preço Unitário (R$)': unitPrice,
          'Quantidade': qty,
          'Valor Bruto (R$)': gross,
          'Desconto (R$)': discount,
          'Valor Líquido (R$)': net,
          'Custo Produtos (R$)': cost,
          'Status Pedido': r.status,
          'Canal Venda': r.channel,
          'Vendedor': r.rep,
          'Estado UF': r.uf
        };
      });
    }
  },
  {
    id: 'planilha_executiva_notas',
    name: 'Planilha com Resumos, Notas & Rodapé',
    category: 'Detecção Inteligente',
    archetypeTag: 'Resumos + Notas',
    description: 'Exemplo real com Título institucional, Metas pré-tabela, Observação de auditoria, tabela iniciando na Linha 6 e Totais no rodapé.',
    rowsCount: 130,
    fileName: 'relatorio_consolidado_com_observacoes.xlsx',
    generateRows: () => {
      const regions = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'];
      const ufs = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'DF', 'GO'];
      const categories = ['Software Enterprise', 'Hardware Servidores', 'Consultoria Cloud', 'Segurança Cibernética'];
      const rows: Record<string, any>[] = [];
      const startDate = new Date(2024, 0, 15);
      for (let i = 1; i <= 130; i++) {
        const d = new Date(startDate.getTime() + i * 2.5 * 24 * 60 * 60 * 1000);
        const val = Math.round(12000 + Math.random() * 48000);
        const margem = Math.round(val * (0.2 + Math.random() * 0.25));
        rows.push({
          'Data': d.toISOString().split('T')[0],
          'Cliente': `Cliente Corporativo ${['Alpha', 'Beta', 'Gama', 'Delta', 'Ômega'][i % 5]} #${i}`,
          'CNPJ Cliente': generateSampleCNPJ(i),
          'UF': ufs[i % ufs.length],
          'Região': regions[i % regions.length],
          'Categoria': categories[i % categories.length],
          'Valor Faturado': val,
          'Margem Bruta': margem,
          'Status Pedido': i % 12 === 0 ? 'Pendente' : 'Faturado Concluído'
        });
      }
      return rows;
    },
    generateRawGrid: () => {
      const grid: any[][] = [];
      // Row 0: Title
      grid.push(['RELATÓRIO CONSOLIDADO DE PERFORMANCE E FATURAMENTO 2024-2025']);
      // Row 1: Company Meta
      grid.push(['Empresa: Nexus Logística & Distribuição S.A. | CNPJ: 18.234.567/0001-89 | Unidade Matriz']);
      // Row 2: Pre-table summaries (KPI pairs)
      grid.push(['Meta Global:', 'R$ 3.800.000', 'Responsável:', 'Diretoria de Operações', 'Período:', 'Exercício 2024']);
      // Row 3: Pre-table observation
      grid.push(['Observação: Valores consolidados brutos sem incidência de impostos retroativos. Dados auditados pela controladoria interna.']);
      // Row 4: Empty separator
      grid.push([]);
      // Row 5: Actual Table Header with CNPJ and UF!
      grid.push(['Data', 'Cliente', 'CNPJ Cliente', 'UF', 'Região', 'Categoria', 'Valor Faturado', 'Margem Bruta', 'Status Pedido']);

      // Rows 6 to 135: Data rows
      const regions = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'];
      const ufs = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'DF', 'GO'];
      const categories = ['Software Enterprise', 'Hardware Servidores', 'Consultoria Cloud', 'Segurança Cibernética'];
      const startDate = new Date(2024, 0, 15);
      let totalFaturado = 0;
      let totalMargem = 0;

      for (let i = 1; i <= 130; i++) {
        const d = new Date(startDate.getTime() + i * 2.5 * 24 * 60 * 60 * 1000);
        const val = Math.round(12000 + Math.random() * 48000);
        const margem = Math.round(val * (0.2 + Math.random() * 0.25));
        totalFaturado += val;
        totalMargem += margem;

        grid.push([
          d.toISOString().split('T')[0],
          `Cliente Corporativo ${['Alpha', 'Beta', 'Gama', 'Delta', 'Ômega'][i % 5]} #${i}`,
          generateSampleCNPJ(i),
          ufs[i % ufs.length],
          regions[i % regions.length],
          categories[i % categories.length],
          val,
          margem,
          i % 12 === 0 ? 'Pendente' : 'Faturado Concluído'
        ]);
      }

      // Trailing Footer Rows:
      grid.push(['TOTAL GERAL:', `R$ ${totalFaturado.toLocaleString('pt-BR')}`, '', '', '', '', totalFaturado, totalMargem, '']);
      grid.push(['* Notas de rodapé: Valores sujeitos a conciliação bancária até o 5º dia útil. Elaborado por: Controladoria Nexus.']);
      grid.push(['Assinado digitalmente por Diretoria Financeira e Conselho de Administração.']);

      return grid;
    }
  },
  {
    id: 'base_clientes',
    name: 'Base de Clientes & CRM Brasil',
    category: 'Clientes & CRM',
    archetypeTag: 'Clientes / CRM',
    description: '160 contas de clientes com CPF/CNPJ, Nome, Email, Segmento B2B/B2C, Estado UF, Cidade, Status, NPS Score e Data de Cadastro.',
    rowsCount: 160,
    fileName: 'base_clientes_crm_brasil.xlsx',
    generateRows: () => {
      const ufs = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'DF', 'GO'];
      const segments = ['Enterprise', 'Médio Porte', 'Pequeno Porte', 'Startup', 'Pessoa Física'];
      const statuses = ['Cliente Ativo', 'Cliente Ativo', 'Em Negociação', 'Churn / Inativo', 'Onboarding'];
      const channels = ['Indicação', 'Inbound Orgânico', 'Google Ads', 'LinkedIn B2B', 'Parcerias'];
      const cities: Record<string, string[]> = {
        SP: ['São Paulo', 'Campinas', 'São Bernardo', 'Ribeirão Preto'],
        RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis'],
        MG: ['Belo Horizonte', 'Uberlândia', 'Juiz de Fora'],
        RS: ['Porto Alegre', 'Caxias do Sul', 'Pelotas'],
        PR: ['Curitiba', 'Londrina', 'Maringá'],
        SC: ['Florianópolis', 'Joinville', 'Blumenau'],
        BA: ['Salvador', 'Feira de Santana'],
        PE: ['Recife', 'Olinda'],
        DF: ['Brasília'],
        GO: ['Goiânia', 'Anápolis']
      };

      const rows: Record<string, any>[] = [];
      const startDate = new Date(2024, 0, 10);

      for (let i = 1; i <= 160; i++) {
        const dateOffset = Math.floor(Math.random() * 380);
        const date = new Date(startDate.getTime() + dateOffset * 24 * 60 * 60 * 1000);
        const uf = ufs[Math.floor(Math.random() * ufs.length)];
        const cityList = cities[uf] || ['Capital'];
        const city = cityList[Math.floor(Math.random() * cityList.length)];
        const segment = segments[Math.floor(Math.random() * segments.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const channel = channels[Math.floor(Math.random() * channels.length)];

        const npsScore = status === 'Churn / Inativo' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 3) + 8;
        const totalPurchases = Math.floor(Math.random() * 15) + 1;
        const customerValue = segment === 'Enterprise' ? Math.round(15000 + Math.random() * 45000) : Math.round(1200 + Math.random() * 6800);
        const docFormatted = segment === 'Pessoa Física' ? generateSampleCPF(i) : generateSampleCNPJ(i);

        const situacaoCadastral = status === 'Cliente Ativo'
          ? 'Ativo Regular'
          : status === 'Onboarding'
          ? 'Em Implantação'
          : status === 'Em Negociação'
          ? 'Em Análise'
          : 'Bloqueado / Irregular';

        const pendencia = status === 'Churn / Inativo'
          ? 'Inadimplência Financeira'
          : status === 'Em Negociação'
          ? 'Doc / Contrato Pendente'
          : i % 8 === 0
          ? 'Atualização Cadastral'
          : 'Sem Pendências';

        rows.push({
          'ID Cliente': `CLI-${10000 + i}`,
          'CPF / CNPJ': docFormatted,
          'Nome do Cliente': `Cliente ${['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira'][i % 8]} #${i}`,
          'Email': `contato.cliente${i}@empresa.com.br`,
          'Data Cadastro': date.toISOString().split('T')[0],
          'Estado UF': uf,
          'Cidade': city,
          'Segmento': segment,
          'Situação Cadastral': situacaoCadastral,
          'Pendência': pendencia,
          'Status': status,
          'Canal Origem': channel,
          'NPS Score': npsScore,
          'Total Compras': totalPurchases,
          'LTV Acumulado': customerValue
        });
      }
      return rows;
    }
  },
  {
    id: 'estoque_produtos',
    name: 'Catálogo & Gestão de Estoque',
    category: 'Produtos & Estoque',
    archetypeTag: 'Estoque / Produtos',
    description: '140 produtos com SKU, Categoria, Estoque Atual, Estoque Mínimo, Preço de Venda, Custo, Fornecedor e Status de Ruptura.',
    rowsCount: 140,
    fileName: 'gestao_estoque_produtos.xlsx',
    generateRows: () => {
      const categories = ['Informática', 'Acessórios Tech', 'Cabos & Conectores', 'Periféricos Gamer', 'Áudio & Vídeo', 'Segurança'];
      const suppliers = ['TechDist Brasil', 'MegaSupply SP', 'Global Imports', 'Alfa Componentes', 'Nordeste Eletrônicos'];

      const rows: Record<string, any>[] = [];
      const startDate = new Date(2024, 2, 1);

      for (let i = 1; i <= 140; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];

        let cost = 45;
        if (category === 'Informática') cost = 320;
        if (category === 'Periféricos Gamer') cost = 160;
        if (category === 'Áudio & Vídeo') cost = 110;
        cost = Math.round(cost * (0.8 + Math.random() * 0.5));
        const price = Math.round(cost * (1.45 + Math.random() * 0.4));

        const minStock = Math.floor(Math.random() * 20) + 10;
        // ~10% will be in stockout/critical to generate genuine operational insights
        const isCritical = Math.random() < 0.12;
        const currentStock = isCritical ? Math.floor(Math.random() * 5) : Math.floor(Math.random() * 120) + 15;

        let statusEstoque = 'Estoque Normal';
        if (currentStock === 0) statusEstoque = 'Ruptura (Zerado)';
        else if (currentStock < minStock) statusEstoque = 'Estoque Baixo';

        const valorTotalEstoque = currentStock * cost;

        const dateOffset = Math.floor(Math.random() * 300);
        const date = new Date(startDate.getTime() + dateOffset * 24 * 60 * 60 * 1000);

        rows.push({
          'SKU Código': `SKU-${category.slice(0, 3).toUpperCase()}-${100 + i}`,
          'Nome do Produto': `Item ${category} Modelo #${i}`,
          'Categoria Produto': category,
          'Fornecedor': supplier,
          'Estoque Atual': currentStock,
          'Estoque Mínimo': minStock,
          'Custo Unitário': cost,
          'Preço Venda': price,
          'Valor em Estoque': valorTotalEstoque,
          'Status do Estoque': statusEstoque,
          'Última Atualização': date.toISOString().split('T')[0]
        });
      }
      return rows;
    }
  },
  {
    id: 'vendas_b2b',
    name: 'Vendas Corporativas & Margem 2024-2025',
    category: 'Comercial & Finanças',
    archetypeTag: 'Comercial / Vendas',
    description: '180 negociações B2B com faturamento, custo, margem de lucro, regiões do Brasil, representantes e canais.',
    rowsCount: 180,
    fileName: 'vendas_corporativas_brasil.xlsx',
    generateRows: () => {
      const regions = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'];
      const categories = ['Software Enterprise', 'Cloud & Infra', 'Segurança Cibernética', 'Consultoria AI', 'Hardware Datacenter'];
      const channels = ['Venda Direta', 'Parceiros / Canais', 'Inside Sales', 'Inbound Enterprise'];
      const statuses = ['Concluído', 'Em Faturamento', 'Entregue'];
      const sellers = ['Camila Silveira', 'Rodrigo Martins', 'Beatriz Lima', 'Eduardo Souza', 'Mariana Costa', 'Gabriel Alves'];

      const rows: Record<string, any>[] = [];
      const startDate = new Date(2024, 0, 15);

      for (let i = 1; i <= 180; i++) {
        const dateOffset = Math.floor(Math.random() * 410);
        const date = new Date(startDate.getTime() + dateOffset * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const category = categories[Math.floor(Math.random() * categories.length)];
        const region = regions[Math.floor(Math.random() * regions.length)];
        const channel = channels[Math.floor(Math.random() * channels.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const seller = sellers[Math.floor(Math.random() * sellers.length)];

        let baseRev = 28000;
        if (category === 'Software Enterprise') baseRev = 75000;
        if (category === 'Hardware Datacenter') baseRev = 120000;
        if (category === 'Consultoria AI') baseRev = 45000;
        if (category === 'Segurança Cibernética') baseRev = 38000;

        const revenue = Math.round(baseRev * (0.65 + Math.random() * 0.9));
        const costMultiplier = category === 'Hardware Datacenter' ? 0.68 : (category === 'Cloud & Infra' ? 0.45 : 0.32);
        const cost = Math.round(revenue * (costMultiplier + (Math.random() * 0.1 - 0.05)));
        const profit = revenue - cost;
        const margin = Math.round((profit / revenue) * 100);
        const quantity = Math.floor(Math.random() * 12) + 1;

        rows.push({
          'ID Pedido': `PED-${202400 + i}`,
          'Data': dateStr,
          'Cliente': `Empresa ${['Alpha', 'Nexus', 'Horizon', 'Vanguard', 'Apex', 'Solaris', 'Omni', 'Titan'][i % 8]} ${i}`,
          'Região': region,
          'Categoria Produto': category,
          'Canal de Venda': channel,
          'Representante': seller,
          'Receita': revenue,
          'Custo': cost,
          'Lucro': profit,
          'Margem %': margin,
          'Quantidade': quantity,
          'Status': status
        });
      }
      return rows;
    }
  },
  {
    id: 'chamados_suporte',
    name: 'Operações de Suporte & Chamados Helpdesk',
    category: 'Operações & Atendimento',
    archetypeTag: 'Operações / Suporte',
    description: '150 chamados de suporte técnico com ID, Tempo de Resolução (horas), Status, Prioridade, Canal e Atendente.',
    rowsCount: 150,
    fileName: 'chamados_suporte_helpdesk.xlsx',
    generateRows: () => {
      const priorities = ['Alta', 'Média', 'Baixa', 'Crítica'];
      const statuses = ['Resolvido', 'Resolvido', 'Em Andamento', 'Aguardando Cliente'];
      const channels = ['Chat Online', 'Portal Web', 'Email', 'Telefone'];
      const attendants = ['Lucas Rocha', 'Juliana Mendes', 'Felipe Santos', 'Renata Prado', 'André Faria'];

      const rows: Record<string, any>[] = [];
      const startDate = new Date(2024, 3, 1);

      for (let i = 1; i <= 150; i++) {
        const dateOffset = Math.floor(Math.random() * 320);
        const date = new Date(startDate.getTime() + dateOffset * 24 * 60 * 60 * 1000);
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const channel = channels[Math.floor(Math.random() * channels.length)];
        const attendant = attendants[Math.floor(Math.random() * attendants.length)];

        let slaHours = 24;
        if (priority === 'Crítica') slaHours = 4;
        if (priority === 'Alta') slaHours = 8;
        if (priority === 'Baixa') slaHours = 48;

        const resolutionTimeHours = Math.round((slaHours * (0.4 + Math.random() * 0.9)) * 10) / 10;
        const slaMet = resolutionTimeHours <= slaHours;

        rows.push({
          'Ticket ID': `TK-${9000 + i}`,
          'Data Abertura': date.toISOString().split('T')[0],
          'Cliente': `Empresa Parceira #${i}`,
          'Prioridade': priority,
          'Canal Suporte': channel,
          'Atendente': attendant,
          'Tempo Resolução Horas': resolutionTimeHours,
          'SLA Horas Meta': slaHours,
          'SLA Atingido': slaMet ? 'Dentro do Prazo' : 'Fora do SLA',
          'Status Chamado': status,
          'Nota Satisfação': Math.floor(Math.random() * 2) + 4 // 4 to 5 stars
        });
      }
      return rows;
    }
  },
  {
    id: 'saas_metrics',
    name: 'SaaS Analytics & MRR por Cohort',
    category: 'Tecnologia & Métricas',
    archetypeTag: 'SaaS / Receita',
    description: 'Assinaturas ativas, MRR mensal, CAC, Lifetime Value (LTV) e planos (Starter, Pro, Enterprise).',
    rowsCount: 150,
    fileName: 'saas_mrr_cohort.xlsx',
    generateRows: () => {
      const plans = ['Starter', 'Professional', 'Enterprise', 'Scale'];
      const countries = ['Brasil', 'Estados Unidos', 'Portugal', 'México', 'Reino Unido', 'Colômbia'];
      const leadSources = ['Orgânico SEO', 'Google Ads', 'LinkedIn B2B', 'Indicação', 'Webinar'];

      const rows: Record<string, any>[] = [];
      const startDate = new Date(2024, 2, 1);

      for (let i = 1; i <= 150; i++) {
        const dateOffset = Math.floor(Math.random() * 360);
        const date = new Date(startDate.getTime() + dateOffset * 24 * 60 * 60 * 1000);
        const plan = plans[Math.floor(Math.random() * plans.length)];
        const country = countries[Math.floor(Math.random() * countries.length)];
        const source = leadSources[Math.floor(Math.random() * leadSources.length)];

        let mrr = 290;
        let cac = 850;
        if (plan === 'Professional') { mrr = 890; cac = 1600; }
        if (plan === 'Scale') { mrr = 2400; cac = 3200; }
        if (plan === 'Enterprise') { mrr = 6800; cac = 7500; }

        mrr = Math.round(mrr * (0.9 + Math.random() * 0.2));
        cac = Math.round(cac * (0.85 + Math.random() * 0.3));
        const ltv = Math.round(mrr * (18 + Math.floor(Math.random() * 12)));
        const users = plan === 'Enterprise' ? Math.floor(Math.random() * 80) + 20 : Math.floor(Math.random() * 15) + 3;

        rows.push({
          'Conta ID': `ACC-${1000 + i}`,
          'Data Ativação': date.toISOString().split('T')[0],
          'Nome da Conta': `TechCorp ${i}`,
          'Plano': plan,
          'País': country,
          'Canal Aquisição': source,
          'MRR': mrr,
          'CAC': cac,
          'LTV Estimado': ltv,
          'Usuários Ativos': users,
          'Score de Saúde': Math.floor(Math.random() * 40) + 60
        });
      }
      return rows;
    }
  }
];
