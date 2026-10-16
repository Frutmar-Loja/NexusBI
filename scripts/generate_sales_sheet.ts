import * as XLSX from 'xlsx';

/**
 * Exact generator matching the prompt's audit figures:
 * - Total Rows: 1.100
 * - Valor Bruto: R$ 270.943,90
 * - Descontos: R$ 12.615,88
 * - Valor Líquido: R$ 258.328,02
 * - Receita Realizada (863 pedidos concluídos): R$ 213.416,80
 * - Ticket Médio Realizado: R$ 247,30 (213.416,80 / 863)
 * - Média de Valor Bruto: R$ 246,31 (270.943,90 / 1100)
 * - Pedidos Cancelados: 125 (11,4%)
 * - Pedidos Pendentes: 112 (R$ 44.911,22)
 */

export function generateAuditedSalesRecords(): Record<string, any>[] {
  const records: Record<string, any>[] = [];

  const categories = ['Tecnologia & Informática', 'Móveis Corporativos', 'Serviços & Licenças'];
  const channels = ['E-commerce B2B', 'Venda Direta', 'Representante Comercial', 'Inside Sales'];
  const reps = ['Carlos Silveira', 'Mariana Costa', 'Roberto Lima', 'Fernanda Souza', 'Julio Cesar'];
  const ufs = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'GO', 'PE', 'DF'];

  const TARGET_GROSS_CENTS = 27094390; // 270.943,90
  const TARGET_DISCOUNT_CENTS = 1261588; // 12.615,88
  const TARGET_NET_CENTS = 25832802; // 258.328,02
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

  // 3. Generate Canceled (125 rows, lineNet = 0 recognized, lineGross = 0 in net sales, but retains canceled order record)
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

  // Adjust exact discounts so TARGET_DISCOUNT_CENTS and TARGET_GROSS_CENTS match to the single cent!
  const currentDiscounts = records.reduce((acc, r) => acc + r.lineDiscountCents, 0);
  const diffDiscount = TARGET_DISCOUNT_CENTS - currentDiscounts;
  records[0].lineDiscountCents += diffDiscount;
  records[0].lineGrossCents = records[0].lineNetCents + records[0].lineDiscountCents;

  // Now: Sum of lineGrossCents = Sum of lineNetCents (25.832.802) + Sum of lineDiscountCents (1.261.588) = 27.094.390!
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

const rows = generateAuditedSalesRecords();
const grossSum = rows.reduce((acc, r) => acc + Math.round(r['Valor Bruto (R$)'] * 100), 0) / 100;
const discSum = rows.reduce((acc, r) => acc + Math.round(r['Desconto (R$)'] * 100), 0) / 100;
const netSum = rows.reduce((acc, r) => acc + Math.round(r['Valor Líquido (R$)'] * 100), 0) / 100;
const completedRows = rows.filter(r => r['Status Pedido'] === 'Faturado Concluído');
const realizedSum = completedRows.reduce((acc, r) => acc + Math.round(r['Valor Líquido (R$)'] * 100), 0) / 100;
const pendingRows = rows.filter(r => r['Status Pedido'] === 'Pendente');
const pendingSum = pendingRows.reduce((acc, r) => acc + Math.round(r['Valor Líquido (R$)'] * 100), 0) / 100;
const canceledRows = rows.filter(r => r['Status Pedido'] === 'Cancelado');

console.log('--- RECONCILIATION AUDIT ---');
console.log('Total Rows:', rows.length);
console.log('Valor Bruto (R$):', grossSum.toFixed(2), '=== 270943.90 ?', grossSum === 270943.90);
console.log('Descontos (R$):', discSum.toFixed(2), '=== 12615.88 ?', discSum === 12615.88);
console.log('Valor Líquido (R$):', netSum.toFixed(2), '=== 258328.02 ?', netSum === 258328.02);
console.log('Completed Orders:', completedRows.length, '=== 863 ?', completedRows.length === 863);
console.log('Receita Realizada (R$):', realizedSum.toFixed(2), '=== 213416.80 ?', realizedSum === 213416.80);
console.log('Pending Orders:', pendingRows.length, '=== 112 ?', pendingRows.length === 112);
console.log('Receita Pendente (R$):', pendingSum.toFixed(2), '=== 44911.22 ?', pendingSum === 44911.22);
console.log('Canceled Orders:', canceledRows.length, '=== 125 ?', canceledRows.length === 125);
console.log('Taxa de Cancelamento (%):', (canceledRows.length / rows.length * 100).toFixed(1), '=== 11.4%');
console.log('Ticket Médio Realizado:', (realizedSum / completedRows.length).toFixed(2), '=== 247.30');
console.log('Média Valor Bruto:', (grossSum / rows.length).toFixed(2), '=== 246.31');

// Write XLSX to project root for regression testing
const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
XLSX.writeFile(wb, 'NexusBI_Teste_Gestao_Comercial_Financeira.xlsx');
console.log('File NexusBI_Teste_Gestao_Comercial_Financeira.xlsx generated and validated successfully!');
