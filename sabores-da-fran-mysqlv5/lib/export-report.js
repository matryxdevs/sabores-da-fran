'use strict';
const ExcelJS=require('exceljs');
const columns={
 Compras:[['Data','date',13],['Fornecedor','supplier',23],['Mercadoria','description',31],['Categoria','category',19],['Quantidade','quantity',15],['Custo unit.','unitCost',17],['Total','total',18],['Observações','notes',35]],
 Despesas:[['Data','date',13],['Categoria','category',22],['Descrição','description',35],['Valor','amount',18],['Observações','notes',35]],
 Vendas:[['Pedido','id',18],['Cliente','customer',26],['WhatsApp','phone',20],['Modalidade','type',16],['Status','status',19],['Pagamento','payment',19],['Valor pago','total',18],['Confirmado em','paidAt',23]],
 Clientes:[['Cliente','name',27],['WhatsApp','phone',22],['Pedidos','orders',14],['Pagos','paidOrders',13],['Total pago','totalSpent',19],['Último pedido','lastOrder',21],['Último status','lastStatus',24]]
};
const red='CD1731',ink='1A1A1D',pale='FFF2F4';
const financialFields=new Set(['unitCost','total','amount','totalSpent']);
function makeTable(wb,title,rows,cols){
 const sheet=wb.addWorksheet(title,{views:[{state:'frozen',ySplit:3}]});
 const end=String.fromCharCode(64+cols.length);
 sheet.mergeCells(`A1:${end}1`);sheet.getCell('A1').value=`HAMBURGUERIA DA FRAN — ${title.toUpperCase()}`;sheet.getCell('A1').font={size:15,bold:true,color:{argb:'FFFFFFFF'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+red}};sheet.getRow(1).height=28;
 sheet.mergeCells(`A2:${end}2`);sheet.getCell('A2').value='Relatório interno — valores em reais (BRL)';sheet.getCell('A2').font={size:10,color:{argb:'FF666666'}};
 sheet.columns=cols.map(c=>({key:c[1],width:c[2]}));
 const header=sheet.getRow(3);cols.forEach((c,i)=>{const x=header.getCell(i+1);x.value=c[0];x.font={bold:true,color:{argb:'FFFFFFFF'}};x.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+ink}}});header.height=22;
 rows.forEach((item,ri)=>{const row=sheet.getRow(ri+4);cols.forEach((c,i)=>{const key=c[1];let v=item[key]??'';if(key==='paidAt'&&v)v=new Date(v).toLocaleString('pt-BR',{timeZone:'America/Belem'});if(key==='type')v=v==='delivery'?'Entrega':'Retirada';const cell=row.getCell(i+1);cell.value=v;if(financialFields.has(key))cell.numFmt='"R$" #,##0.00';if(key==='quantity')cell.numFmt='0.000';if(ri%2===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+pale}}});});
 sheet.autoFilter=`A3:${end}${Math.max(4,rows.length+3)}`;
 return sheet;
}
async function exportMonth(report,customers){
 const wb=new ExcelJS.Workbook();wb.creator='Hamburgueria da Fran';wb.created=new Date();
 const ws=wb.addWorksheet('Resumo',{views:[{state:'frozen',ySplit:3}]});ws.columns=[{width:40},{width:26},{width:46}];
 ws.mergeCells('A1:C1');ws.getCell('A1').value='HAMBURGUERIA DA FRAN | CRM FINANCEIRO';ws.getCell('A1').font={bold:true,size:16,color:{argb:'FFFFFFFF'}};ws.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+red}};ws.getRow(1).height=31;
 ws.addRow(['Competência',report.month]);ws.addRow(['Indicador','Valor','Nota metodológica']);
 const data=[
 ['Vendas recebidas',report.revenue,'Somente pedidos marcados como Pagos'],
 ['Compras de mercadorias',report.inventory,'Desembolsos registrados no mês'],
 ['Despesas operacionais',report.operations,'Despesas lançadas manualmente'],
 ['Total gasto',report.spending,'Mercadorias + despesas'],
 ['Resultado estimado',report.result,'Receita paga menos desembolsos do mês'],
 ['Margem estimada (%)',report.margin??0,'Resultado / receitas pagas'],
 ['Retorno sobre gastos (%)',report.returnOnSpend??0,'Resultado / desembolsos'],
 ['Pedidos pagos',report.paidOrders,'Pedidos com recebimento confirmado'],
 ['Ticket médio',report.averageTicket,'Receita paga / pedidos pagos']
 ];
 data.forEach((r,i)=>{const line=ws.addRow(r);line.getCell(2).numFmt=i===5||i===6?'0.00"%"':i===7?'0':'"R$" #,##0.00';line.getCell(1).font={bold:true,color:{argb:'FF'+ink}};if(i===4)line.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+pale}})});
 ws.addRow([]);ws.addRow(['Importante','Resultado gerencial de caixa. Não é lucro contábil; compras não equivalem necessariamente ao custo das mercadorias vendidas.']);
 makeTable(wb,'Compras',report.purchases,columns.Compras);makeTable(wb,'Despesas',report.expenses,columns.Despesas);makeTable(wb,'Vendas',report.sales,columns.Vendas);makeTable(wb,'Clientes',customers,columns.Clientes);
 return wb.xlsx.writeBuffer();
}
module.exports={exportMonth};
