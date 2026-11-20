'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const originalLoad=Module._load;
process.env.DB_HOST='test-server';process.env.DB_USER='test-user';process.env.DB_NAME='test-db';
const fakePool={
  async execute(sql){
   if(sql.includes('FROM purchases WHERE'))return [[{id:1,purchase_date:new Date('2026-11-01T00:00:00Z'),supplier:'Fornecedor',description:'Carne',category:'Mercadorias',quantity:'2.000',unit_cost:'20.00',total_cost:'40.00',notes:''}]];
   if(sql.includes('FROM operating_expenses WHERE'))return [[{id:2,expense_date:new Date('2026-11-03T00:00:00Z'),description:'Energia',category:'Operacional',amount:'10.00',notes:''}]];
   if(sql.includes('JOIN order_payments'))return [[{id:3,customer:'Teste',phone:'94999999999',order_type:'pickup',status:'Entregue',payment:'Pix',total:'80.00',paid_at:new Date('2026-11-06T17:00:00Z')}]];
   return [{insertId:1,affectedRows:1}];
  },
  async query(sql){
   if(sql.includes('JOIN orders l'))return [[{phone:'94999999999',order_count:2,paid_orders:1,total_paid:80,last_order:3,last_status:'Entregue',customer:'Teste'}]];
   return [[]];
  }
};
Module._load=function(request,parent,isMain){
 if(request==='mysql2/promise')return {createPool:()=>fakePool};
 return originalLoad.call(this,request,parent,isMain);
};
(async()=>{
 const fin=require('../lib/finance');
 const report=await fin.report('2026-11');
 assert.equal(report.inventory,40);assert.equal(report.operations,10);assert.equal(report.revenue,80);
 assert.equal(report.result,30);assert.equal(report.returnOnSpend,60);assert.equal(report.margin,37.5);
 assert.equal(report.sales[0].id,'FR-00003');assert.equal((await fin.customers())[0].paidOrders,1);
 const wa=require('../lib/whatsapp');
 assert.equal((await wa.sendStatus({id:'FR-00003',customer:'Teste',phone:'94999999999',status:'Pronto',notifyOptIn:false})).status,'skipped');
 assert.equal((await wa.sendStatus({id:'FR-00003',customer:'Teste',phone:'94999999999',status:'Pronto',notifyOptIn:true})).status,'skipped');
 process.env.WA_ACCESS_TOKEN='test-token';process.env.WA_PHONE_NUMBER_ID='100001';process.env.WA_TEMPLATE_NAME='status_pedido_fran';
 const oldFetch=globalThis.fetch;let captured;
 globalThis.fetch=async(url,opts)=>{captured={url,opts};return {ok:true,json:async()=>({messages:[{id:'wamid.test'}]})};};
 const notify=await wa.sendStatus({id:'FR-00003',customer:'Teste',phone:'94999999999',status:'Pronto',notifyOptIn:true});
 assert.equal(notify.status,'accepted');assert.equal(notify.messageId,'wamid.test');
 const body=JSON.parse(captured.opts.body);assert.equal(body.to,'5594999999999');assert.equal(body.template.components[0].parameters.length,3);
 globalThis.fetch=oldFetch;
 console.log('PASS: cálculos do CRM, agrupamento dos clientes, autorização, envio via API Meta e parâmetros de template');
})().catch(e=>{console.error(e);process.exit(1)});
