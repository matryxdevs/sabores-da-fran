'use strict';
const assert=require('node:assert/strict');const path=require('node:path');
process.env.DB_HOST='mock';process.env.DB_NAME='mock';process.env.DB_USER='mock';
process.env.PORT='31023';process.env.ADMIN_EMAIL='admin@teste.com';process.env.ADMIN_PASSWORD='uma-senha-com-mais-12';process.env.SESSION_SECRET='0'.repeat(48);
const root=path.resolve(__dirname,'..');let notifyCalls=0;let status='Recebido';let purchase;
const mockDB={
 pool:{query:async()=>[[{ok:1}]]},initDatabase:async()=>{},
 getAdminData:async()=>({settings:{},products:[],promos:[],orders:[]}),
 getSite:async()=>({settings:{mapLat:-6.5395278,mapLng:-49.8771111},products:[],promos:[]}),
 changeOrderStatus:async(id,newStatus)=>{if(newStatus===status)return {changed:false,id,status};const previousStatus=status;status=newStatus;return {changed:true,id,previousStatus,status,notifyOptIn:true,customer:'Cliente teste',phone:'94999999999'};},
 logNotification:async()=>{},
 setOrderPayment:async(id,paid)=>({id,paid}),setOrderFee:async()=>true,
 getOrderNotificationTarget:async(id)=>({id,status,notifyOptIn:true,phone:'94999999999',customer:'Cliente teste'}),
 removeOrder:async()=>true
};
const mockFin={monthOk:x=>/^20\d\d-\d\d$/.test(x),report:async m=>({month:m,purchases:[],expenses:[],sales:[],revenue:0,inventory:0,operations:0,spending:0,result:0,paidOrders:0,margin:null,returnOnSpend:null,averageTicket:0}),customers:async()=>[],addPurchase:async p=>(purchase=p,1)};
const mockWA={config:()=>({enabled:true}),sendStatus:async()=>{notifyCalls++;return {status:'accepted',messageId:'wamid.fake',details:'accepted'}}};
for(const [name,m] of [['lib/database.js',mockDB],['lib/finance.js',mockFin],['lib/whatsapp.js',mockWA]]){
 const full=path.join(root,name);require.cache[full]={id:full,filename:full,loaded:true,exports:m};
}
require('../server.js');
(async()=>{
 const base='http://127.0.0.1:31023';
 // Port open after init resolves
 await new Promise(r=>setTimeout(r,50));
 const health=await fetch(base+'/api/health');assert.equal((await health.json()).version,'5.0.0');
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const post=(route,method,body)=>fetch(base+route,{method,headers:{cookie,'x-fran-admin':'1','Content-Type':'application/json'},body:JSON.stringify(body)});
 const changed=await post('/api/admin/orders/FR-00001','PATCH',{status:'Em preparo'});assert.equal(changed.status,200);let result=await changed.json();assert.equal(result.notification.status,'accepted');assert.equal(notifyCalls,1);
 const again=await post('/api/admin/orders/FR-00001','PATCH',{status:'Em preparo'});assert.equal((await again.json()).notification.status,'skipped');assert.equal(notifyCalls,1);
 const cr=await fetch(base+'/api/admin/crm?month=2026-11',{headers:{cookie}});assert.equal(cr.status,200);assert.equal((await cr.json()).report.month,'2026-11');
 const buy=await post('/api/admin/crm/purchases','POST',{date:'2026-11-20',description:'Carne',quantity:2,unitCost:17.55,supplier:'A',category:'Mercadorias'});assert.equal(buy.status,201);assert.equal(purchase.total,35.1);
 const pay=await post('/api/admin/orders/FR-00001/payment','PATCH',{paid:true});assert.equal(pay.status,200);
 console.log('PASS: login, autenticação, status WhatsApp, sem disparo duplicado, CRM, compras e pagamentos');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
