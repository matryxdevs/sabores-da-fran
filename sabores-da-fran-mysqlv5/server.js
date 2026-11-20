'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./lib/database');
const finance = require('./lib/finance');
const whatsapp = require('./lib/whatsapp');
const {normalizeGroups} = require('./lib/options');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(PUBLIC, 'uploads');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
if (!ADMIN_EMAIL || ADMIN_PASSWORD.length < 12 || SESSION_SECRET.length < 32) {
  console.error('CONFIGURAÇÃO: defina ADMIN_EMAIL, ADMIN_PASSWORD (12+ caracteres) e SESSION_SECRET (32+ caracteres) nas variáveis de ambiente.');
  process.exit(1);
}
fs.mkdirSync(UPLOADS, { recursive:true });
const defaults = () => ({
  settings: {
    businessName: 'Sabores da Fran',
    heroTitle: 'Sabor que pega fogo.',
    tagline: 'Hambúrguer de respeito, feito para matar a sua fome de verdade.',
    heroSubtitle: 'Uma explosão de sabor em cada mordida. Escolha seus favoritos e peça direto pelo WhatsApp.',
    announcement: 'FEITO COM CAPRICHO • PEDIDOS PELO WHATSAPP • RETIRADA OU ENTREGA',
    whatsappNumber: (process.env.WHATSAPP_NUMBER || '').replace(/\D/g,''),
    instagram:'', address:'', mapUrl:'https://www.google.com/maps/search/?api=1&query=-6.5395278%2C-49.8771111', mapLat:-6.5395278, mapLng:-49.8771111, openingHours:'Confira os horários no WhatsApp',
    deliveryFee:null, videoUrl:'', videoTitle:'O sabor que faz a diferença',
    videoDescription:'Conheça um pouco mais da Sabores da Fran.',
    videoUrl2:'', videoTitle2:'Mais sabor em vídeo', videoDescription2:'Assista também a outro vídeo da Sabores da Fran.',
    logoUrl:'/assets/logo.png', demoMode:true
  },
  products: [
    { id:'demo1', name:'Fran Clássico', category:'Hambúrgueres', description:'Pão macio, hambúrguer suculento, queijo derretido, alface e tomate.', price:24.90, image:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&q=85', featured:true, available:true, sort:1 },
    { id:'demo2', name:'Fran Bacon', category:'Hambúrgueres', description:'Carne artesanal, queijo cremoso, bacon crocante e molho especial.', price:32.90, image:'https://images.unsplash.com/photo-1550547660-d9450f859349?w=900&q=85', featured:true, available:true, sort:2 },
    { id:'demo3', name:'Fran Duplo', category:'Hambúrgueres', description:'Duas carnes suculentas, queijo em dobro e molho da casa.', price:37.90, image:'https://images.unsplash.com/photo-1553979459-d2229ba7433a?w=900&q=85', featured:false, available:true, sort:3 },
    { id:'demo4', name:'Fran Chicken', category:'Hambúrgueres', description:'Frango crocante, queijo, salada fresquinha e molho especial.', price:28.90, image:'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=900&q=85', featured:false, available:true, sort:4 },
    { id:'demo5', name:'Batata Crocante', category:'Acompanhamentos', description:'Batatinhas douradas, sequinhas e temperadas no ponto certo.', price:17.90, image:'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=900&q=85', featured:false, available:true, sort:5 },
    { id:'demo6', name:'Refrigerante Lata', category:'Bebidas', description:'Bebida gelada para acompanhar seu lanche favorito.', price:7, image:'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=900&q=85', featured:false, available:true, sort:6 },
    { id:'demo7', name:'Pizza da Fran (exemplo)', category:'Pizzas', description:'Produto demonstrativo para testar tamanhos, sabores e bordas antes de publicar o cardápio real.', price:40, image:'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=900&q=85', featured:false, available:true, sort:7, optionGroups:[
      {id:'demo-grp-sabor',name:'Sabor',type:'single',required:true,maxChoices:1,choices:[{id:'demo-sabor-queijo',name:'Queijo',extraPrice:0},{id:'demo-sabor-calabresa',name:'Calabresa',extraPrice:3}]},
      {id:'demo-grp-tamanho',name:'Tamanho',type:'single',required:true,maxChoices:1,choices:[{id:'demo-tamanho-medio',name:'Média',extraPrice:0},{id:'demo-tamanho-grande',name:'Grande',extraPrice:12}]},
      {id:'demo-grp-borda',name:'Borda',type:'single',required:false,maxChoices:1,choices:[{id:'demo-borda-sem',name:'Sem borda',extraPrice:0},{id:'demo-borda-cheddar',name:'Cheddar',extraPrice:7}]},
    ]}
  ],
  promos: [{id:'promo1',badge:'DESTAQUE',title:'A sua fome merece mais.',text:'Escolha seu hambúrguer favorito, adicione ao carrinho e peça pelo WhatsApp.',image:'',active:true}]
});
const send = (res,code,payload,extra={}) => {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(payload));};
const error=(res,code,message)=>send(res,code,{error:message});
const safeString=(v,max=300)=>String(v??'').trim().slice(0,max);
const cleanNumber=v=>String(v??'').replace(/\D/g,'');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v).replace(/\u00a0/g,' ');
const id=()=>crypto.randomUUID();
const parseCookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.includes('=')).map(s=>{const n=s.indexOf('=');return [s.slice(0,n),s.slice(n+1)];}));
const hmac=data=>crypto.createHmac('sha256',SESSION_SECRET).update(data).digest('base64url');
function authToken(){const body=Buffer.from(JSON.stringify({e:ADMIN_EMAIL,exp:Date.now()+12*60*60*1000})).toString('base64url');return body+'.'+hmac(body);}
function validToken(token){try{const [body,sig]=String(token||'').split('.');if(!body||!sig)return false;const a=Buffer.from(hmac(body)),b=Buffer.from(sig);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;const x=JSON.parse(Buffer.from(body,'base64url').toString());return x.e===ADMIN_EMAIL&&Number.isFinite(x.exp)&&Date.now()<x.exp;}catch{return false;}}
const isAdmin=req=>validToken(parseCookies(req).fran_session);
function cookieFor(req,value,maxAge=43200){const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';return `fran_session=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;}
function constantTimePass(a,b){const salt=Buffer.from('fran-admin-password-auth-v1');return crypto.timingSafeEqual(crypto.scryptSync(String(a),salt,32),crypto.scryptSync(String(b),salt,32));}
async function readJson(req,max=750000){return new Promise((resolve,reject)=>{let size=0,rejected=false;const chunks=[];req.on('data',chunk=>{if(rejected)return;size+=chunk.length;if(size>max){rejected=true;reject(Object.assign(new Error('Solicitação muito grande.'),{code:413}));return;}chunks.push(chunk);});req.on('end',()=>{if(rejected)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}catch{reject(Object.assign(new Error('JSON inválido.'),{code:400}));}});req.on('error',reject);});}
const validImage=u=>u===''||/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(u)||/^https:\/\/[a-z\d.-]+\/[^\s<>"']{1,800}$/i.test(u)||u==='/assets/logo.png';
function cleanProduct(input,old={}){
  const name=safeString(input.name,90),price=Number(input.price),image=safeString(input.image,900);
  if(!name)throw new Error('Informe o nome do produto.');
  if(!Number.isFinite(price)||price<0||price>100000)throw new Error('Preço inválido.');
  if(!validImage(image))throw new Error('URL da imagem inválida.');
  return {id:old.id||id(),name,category:safeString(input.category,50)||'Outros',description:safeString(input.description,450),price:Math.round(price*100)/100,image,featured:Boolean(input.featured),available:input.available!==false,sort:Number.isFinite(Number(input.sort))?Math.max(0,Math.min(9999,Math.round(Number(input.sort)))):0,optionGroups:normalizeGroups(input.optionGroups??old.optionGroups??[])};
}
function cleanPromo(input,old={}){const image=safeString(input.image,900),title=safeString(input.title,100);if(!validImage(image))throw new Error('Imagem inválida.');if(!title)throw new Error('Informe o título da propaganda.');return {id:old.id||id(),badge:safeString(input.badge,35),title,text:safeString(input.text,250),image,active:input.active!==false};}
async function cleanSettings(input){const s=await db.getSettings(),result={...s};for(const [key,max] of Object.entries({businessName:80,heroTitle:100,tagline:200,heroSubtitle:260,announcement:150,instagram:300,address:350,mapUrl:500,openingHours:200,videoUrl:700,videoTitle:120,videoDescription:250,videoUrl2:700,videoTitle2:120,videoDescription2:250,logoUrl:900}))if(Object.hasOwn(input,key))result[key]=safeString(input[key],max);
  if(Object.hasOwn(input,'whatsappNumber')){result.whatsappNumber=cleanNumber(input.whatsappNumber);if(result.whatsappNumber&&!/^\d{10,15}$/.test(result.whatsappNumber))throw new Error('WhatsApp inválido. Use DDI + DDD + número.');}
  for(const [key,min,max] of [['mapLat',-90,90],['mapLng',-180,180]]){if(Object.hasOwn(input,key)){const n=Number(input[key]);if(!Number.isFinite(n)||n<min||n>max||input[key]==='')throw new Error(`Coordenada ${key} inválida.`);result[key]=Math.round(n*10000000)/10000000;}}
  if(Object.hasOwn(input,'demoMode'))result.demoMode=Boolean(input.demoMode);
  if(Object.hasOwn(input,'deliveryFee')){const fee=input.deliveryFee;if(fee===''||fee===null||fee===undefined)result.deliveryFee=null;else{const n=Number(fee);if(!Number.isFinite(n)||n<0||n>10000)throw new Error('Taxa de entrega inválida.');result.deliveryFee=Math.round(n*100)/100;}}
  if(result.logoUrl&&!validImage(result.logoUrl))throw new Error('Imagem da logo inválida.');
  for(const k of ['instagram','mapUrl'])if(result[k]&&!/^https:\/\//i.test(result[k]))throw new Error(`O campo ${k} precisa usar HTTPS.`);
  if(result.videoUrl&&!/^https?:\/\//i.test(result.videoUrl)&&!/^\/uploads\/[a-f0-9-]+\.(mp4|webm)$/.test(result.videoUrl))throw new Error('URL do vídeo 1 inválida.');
  if(result.videoUrl2&&!/^https?:\/\//i.test(result.videoUrl2)&&!/^\/uploads\/[a-f0-9-]+\.(mp4|webm)$/.test(result.videoUrl2))throw new Error('URL do vídeo 2 inválida.');
  return result;
}
const isSafeAdminWrite=req=>req.headers['x-fran-admin']==='1';
const loginAttempts=new Map();
const getIp=req=>req.socket.remoteAddress||'unknown';
function safeAssetPath(relative){let decoded;try{decoded=decodeURIComponent(relative);}catch{return null;}if(decoded.includes('\0')||decoded.includes('\\'))return null;const full=path.resolve(PUBLIC,'.'+decoded);return full.startsWith(PUBLIC+path.sep)?full:null;}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm'};
function serveStatic(req,res,route){const uploadName=/^\/uploads\/([a-f0-9-]+\.(?:png|jpg|webp|mp4|webm))$/.exec(route)?.[1];const target=uploadName?path.join(UPLOADS,uploadName):safeAssetPath(route==='/'?'/index.html':route==='/admin'?'/admin.html':route);
  if(!target||!fs.existsSync(target)||!fs.statSync(target).isFile()||!mime[path.extname(target).toLowerCase()])return error(res,404,'Página não encontrada.');
  const st=fs.statSync(target);res.writeHead(200,{'Content-Type':mime[path.extname(target).toLowerCase()],'Content-Length':st.size,'Cache-Control':route.startsWith('/uploads/')||route.startsWith('/assets/')?'public,max-age=86400':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(target).pipe(res);
}
async function makeOrder(input){const customer=safeString(input.name,90),phone=cleanNumber(input.phone),type=input.type==='delivery'?'delivery':input.type==='pickup'?'pickup':'',address=safeString(input.address,350),reference=safeString(input.reference,150),payment=safeString(input.payment,50)||'A combinar',note=safeString(input.note,350);
  if(customer.length<2)throw Object.assign(new Error('Informe seu nome.'),{validation:true});
  if(!/^\d{10,15}$/.test(phone))throw Object.assign(new Error('Informe WhatsApp válido com DDD.'),{validation:true});
  if(!type)throw Object.assign(new Error('Escolha retirada ou entrega.'),{validation:true});
  if(type==='delivery'&&(!address||!reference))throw Object.assign(new Error('Informe endereço completo e ponto de referência.'),{validation:true});
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>50)throw Object.assign(new Error('Adicione produtos ao carrinho.'),{validation:true});
  const setting=await db.getSettings();
  if(!/^\d{10,15}$/.test(cleanNumber(setting.whatsappNumber)))throw Object.assign(new Error('O WhatsApp do estabelecimento ainda não foi configurado.'),{validation:true});
  const record=await db.createOrder({customer,phone,type,address,reference,payment,note,notifyOptIn:input.notifyOptIn===true},input.items);
  const {id:orderId,items,subtotal,fee,total,settings}=record;
  const itemLines=items.flatMap(p=>[`• ${p.quantity}x ${p.name} — ${money(p.total)}`, ...p.options.map(g=>`   ↳ ${g.groupName}: ${g.choices.map(c=>`${c.name}${c.extraPrice?` (+${money(c.extraPrice)})`:''}`).join(', ')}`)]);
  const lines=[`🍽️ *PEDIDO - ${settings.businessName.toUpperCase()}*`,`🧾 *Pedido ${orderId}*`,'','*ITENS DO PEDIDO:*',...itemLines,'',`*Subtotal:* ${money(subtotal)}`,...(type==='delivery'?[`*Taxa de entrega:* ${fee===null?'a confirmar':money(fee)}`]:[]),`*${total===null?'Total parcial':'TOTAL'}:* ${money(total===null?subtotal:total)}`,'',`👤 *Nome:* ${customer}`,`📱 *WhatsApp:* ${phone}`,`📦 *Modalidade:* ${type==='delivery'?'Entrega':'Retirada no local'}`,...(type==='delivery'?[`📍 *Endereço:* ${address}`,`🗺️ *Referência:* ${reference}`]:[]),`💳 *Pagamento:* ${payment}`,...(note?[`📝 *Observações:* ${note}`]:[]),'','Olá! Gostaria de confirmar este pedido. Obrigado!'];
  return {orderId,whatsappUrl:`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`};
}
function financeDate(v){const s=safeString(v,10);if(!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw new Error('Data inválida. Use AAAA-MM-DD.');return s;}
function parsePurchase(body){
 const date=financeDate(body.date),description=safeString(body.description,250),supplier=safeString(body.supplier,120),category=safeString(body.category,70)||'Mercadorias',notes=safeString(body.notes,300);
 const quantity=Number(body.quantity),unitCost=Number(body.unitCost);
 if(!description)throw new Error('Informe o nome da mercadoria.');
 if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000||!Number.isFinite(unitCost)||unitCost<0||unitCost>10000000)throw new Error('Quantidade ou custo unitário inválido.');
 const roundedQty=Math.round(quantity*1000)/1000,roundedCost=Math.round(unitCost*100)/100;
 return {date,description,supplier,category,notes,quantity:roundedQty,unitCost:roundedCost,total:Math.round(roundedQty*roundedCost*100)/100};
}
function parseExpense(body){
 const date=financeDate(body.date),description=safeString(body.description,250),category=safeString(body.category,70)||'Operacional',notes=safeString(body.notes,300),amount=Number(body.amount);
 if(!description)throw new Error('Informe a descrição da despesa.');
 if(!Number.isFinite(amount)||amount<0||amount>10000000)throw new Error('Valor inválido.');
 return {date,description,category,notes,amount:Math.round(amount*100)/100};
}
const positiveId=s=>/^\d{1,15}$/.test(s)&&Number(s)>0;
async function notifyOrder(info){
 const result=await whatsapp.sendStatus(info);
 try{await db.logNotification(info.id,info.previousStatus,info.status,result);}catch(e){console.error('[FRAN] Falha no log WhatsApp:',e.message);}
 return result;
}
function storeUpload(body){const input=String(body.dataUrl||''),match=input.match(/^data:(image\/png|image\/jpeg|image\/webp|video\/mp4|video\/webm);base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new Error('Formato inválido. Use JPG, PNG, WEBP, MP4 ou WEBM.');const type=match[1],bytes=Buffer.from(match[2],'base64'),video=type.startsWith('video/'),max=video?28*1024*1024:5*1024*1024;if(!bytes.length||bytes.length>max)throw new Error(video?'Vídeo excede 28 MB.':'Imagem excede 5 MB.');const starts=prefix=>bytes.subarray(0,prefix.length).equals(Buffer.from(prefix));const signatures={'image/png':starts([137,80,78,71,13,10,26,10]),'image/jpeg':starts([255,216,255]),'image/webp':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','video/mp4':bytes.toString('ascii',4,8)==='ftyp','video/webm':starts([26,69,223,163])};if(!signatures[type])throw new Error('O conteúdo não corresponde ao formato informado.');const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[type],url=`/uploads/${id()}.${ext}`;fs.writeFileSync(path.join(UPLOADS,path.basename(url)),bytes,{flag:'wx'});return {url,bytes:bytes.length};}

const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com https: data:; media-src 'self' https: blob:; frame-src https://www.youtube-nocookie.com https://maps.google.com https://www.google.com; connect-src 'self'; form-action 'self'; base-uri 'self'; object-src 'none'");
  const parsedUrl=new URL(req.url||'/','http://localhost'),route=parsedUrl.pathname,method=req.method;
  try{
    if(route==='/api/health'&&method==='GET'){
      try {await db.pool.query('SELECT 1');return send(res,200,{status:'ok',database:'connected',version:'5.0.0'});}
      catch(e){return send(res,503,{status:'error',database:'unavailable',diagnosticCode:e.code||'DB_ERROR'});}
    }
    if(route==='/api/site'&&method==='GET')return send(res,200,await db.getSite());
    if(route==='/api/orders'&&method==='POST'){
      try{return send(res,201,await makeOrder(await readJson(req)));}
      catch(e){if(e.validation)return error(res,422,e.message);throw e;}
    }
    if(route==='/api/admin/login'&&method==='POST'){
      const ip=getIp(req),now=Date.now(),state=loginAttempts.get(ip)||{n:0,reset:now+15*60*1000};
      if(now>state.reset){state.n=0;state.reset=now+15*60*1000;}
      if(state.n>=8)return error(res,429,'Muitas tentativas. Tente novamente em 15 minutos.');
      const body=await readJson(req,10000);
      const ok=safeString(body.email,250).toLowerCase()===ADMIN_EMAIL&&constantTimePass(body.password||'',ADMIN_PASSWORD);
      if(!ok){state.n++;loginAttempts.set(ip,state);return error(res,401,'E-mail ou senha incorretos.');}
      loginAttempts.delete(ip);return send(res,200,{ok:true},{'Set-Cookie':cookieFor(req,authToken())});
    }
    if(route==='/api/admin/me'&&method==='GET')return send(res,200,{authenticated:isAdmin(req)});
    if(route.startsWith('/api/admin/')){
      if(!isAdmin(req))return error(res,401,'Sessão expirada. Acesse o painel novamente.');
      if(!['GET','HEAD'].includes(method)&&!isSafeAdminWrite(req))return error(res,403,'Requisição não autorizada.');
      if(route==='/api/admin/logout'&&method==='POST')return send(res,200,{ok:true},{'Set-Cookie':cookieFor(req,'',0)});
      if(route==='/api/admin/data'&&method==='GET')return send(res,200,await db.getAdminData());
      if(route==='/api/admin/crm'&&method==='GET'){
        const month=parsedUrl.searchParams.get('month')||new Date(Date.now()-3*60*60*1000).toISOString().slice(0,7);
        if(!finance.monthOk(month))return error(res,422,'Mês inválido (AAAA-MM).');
        const [report,customers]=await Promise.all([finance.report(month),finance.customers()]);
        return send(res,200,{report,customers,whatsappConfigured:whatsapp.config().enabled});
      }
      if(route==='/api/admin/crm/export.xlsx'&&method==='GET'){
        const month=parsedUrl.searchParams.get('month')||new Date(Date.now()-3*60*60*1000).toISOString().slice(0,7);
        if(!finance.monthOk(month))return error(res,422,'Mês inválido (AAAA-MM).');
        const [{exportMonth},report,customers]=await Promise.all([Promise.resolve().then(()=>require('./lib/export-report')),finance.report(month),finance.customers()]);
        const bytes=Buffer.from(await exportMonth(report,customers));
        res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="fran-crm-${month}.xlsx"`,'Content-Length':bytes.length,'Cache-Control':'no-store'});return res.end(bytes);
      }
      if(route==='/api/admin/crm/purchases'&&method==='POST'){
        try{const data=parsePurchase(await readJson(req,20000));const id=await finance.addPurchase(data);return send(res,201,{id});}catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      if(route==='/api/admin/crm/expenses'&&method==='POST'){
        try{const data=parseExpense(await readJson(req,20000));const id=await finance.addExpense(data);return send(res,201,{id});}catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      const financeMatch=route.match(/^\/api\/admin\/crm\/(purchases|expenses)\/(\d{1,15})$/);
      if(financeMatch&&['PUT','DELETE'].includes(method)){
        const [,entity,recordId]=financeMatch;
        if(!positiveId(recordId))return error(res,422,'Identificador inválido.');
        if(method==='DELETE'){const ok=entity==='purchases'?await finance.removePurchase(recordId):await finance.removeExpense(recordId);return ok?send(res,200,{ok:true}):error(res,404,'Registro não encontrado.');}
        try{const body=await readJson(req,20000);const data=entity==='purchases'?parsePurchase(body):parseExpense(body);
          const ok=entity==='purchases'?await finance.updatePurchase(recordId,data):await finance.updateExpense(recordId,data);
          return ok?send(res,200,{ok:true}):error(res,404,'Registro não encontrado.');
        }catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      if(route==='/api/admin/settings'&&method==='PUT'){
        try{const settings=await cleanSettings(await readJson(req));await db.setSettings(settings);return send(res,200,{settings});}
        catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      if(route==='/api/admin/upload'&&method==='POST'){
        try{return send(res,201,storeUpload(await readJson(req,39*1024*1024)));}
        catch(e){return error(res,e.code||422,e.message);}
      }
      if(route==='/api/admin/products'&&method==='POST'){
        try{const p=cleanProduct(await readJson(req));await db.insertProduct(p);return send(res,201,{product:p});}
        catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      if(route.startsWith('/api/admin/products/')&&['PUT','DELETE'].includes(method)){
        const key=route.slice('/api/admin/products/'.length);
        if(method==='DELETE')return await db.removeProduct(key)?send(res,200,{ok:true}):error(res,404,'Produto não encontrado.');
        const old=(await db.getProducts()).find(x=>x.id===key);if(!old)return error(res,404,'Produto não encontrado.');
        try{const p=cleanProduct(await readJson(req),old);await db.updateProduct(p);return send(res,200,{product:p});}
        catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      if(route==='/api/admin/promos'&&method==='POST'){
        try{const p=cleanPromo(await readJson(req));await db.insertPromo(p);return send(res,201,{promo:p});}
        catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      if(route.startsWith('/api/admin/promos/')&&['PUT','DELETE'].includes(method)){
        const key=route.slice('/api/admin/promos/'.length);
        if(method==='DELETE')return await db.removePromo(key)?send(res,200,{ok:true}):error(res,404,'Propaganda não encontrada.');
        const old=(await db.getPromos()).find(x=>x.id===key);if(!old)return error(res,404,'Propaganda não encontrada.');
        try{const p=cleanPromo(await readJson(req),old);await db.updatePromo(p);return send(res,200,{promo:p});}
        catch(e){if(e.code)throw e;return error(res,422,e.message);}
      }
      if(route.startsWith('/api/admin/orders/')&&method==='DELETE'){
        const found=await db.removeOrder(route.slice('/api/admin/orders/'.length));return found?send(res,200,{ok:true}):error(res,404,'Pedido não encontrado.');
      }
      const orderExtra=route.match(/^\/api\/admin\/orders\/(FR-\d{5,18})\/(payment|fee|notify)$/);
      if(orderExtra){
        const [,orderId,action]=orderExtra;
        if(action==='payment'&&method==='PATCH'){
          const body=await readJson(req,10000);
          if(typeof body.paid!=='boolean')return error(res,422,'Pagamento inválido.');
          try{const updated=await db.setOrderPayment(orderId,body.paid);return updated?send(res,200,{order:updated}):error(res,404,'Pedido não encontrado.');}
          catch(e){if(e.validation)return error(res,422,e.message);throw e;}
        }
        if(action==='fee'&&method==='PATCH'){
          const body=await readJson(req,10000),fee=Number(body.fee);
          if(body.fee===''||body.fee===null||!Number.isFinite(fee)||fee<0||fee>10000)return error(res,422,'Taxa de entrega inválida.');
          const ok=await db.setOrderFee(orderId,Math.round(fee*100)/100);
          return ok?send(res,200,{ok:true}):error(res,404,'Pedido não encontrado ou sem entrega.');
        }
        if(action==='notify'&&method==='POST'){
          const info=await db.getOrderNotificationTarget(orderId);if(!info)return error(res,404,'Pedido não encontrado.');
          const notification=await notifyOrder({...info,previousStatus:info.status});
          return send(res,200,{notification});
        }
      }
      if(route.startsWith('/api/admin/orders/')&&method==='PATCH'){
        const body=await readJson(req,10000),allowed=['Aguardando envio no WhatsApp','Recebido','Em preparo','Pronto','Entregue','Cancelado'];
        if(!allowed.includes(body.status))return error(res,422,'Status inválido.');
        const key=route.slice('/api/admin/orders/'.length);
        const changed=await db.changeOrderStatus(key,body.status);
        if(!changed)return error(res,404,'Pedido não encontrado.');
        if(!changed.changed)return send(res,200,{order:{id:key,status:body.status},notification:{status:'skipped',details:'O status não foi alterado.'}});
        const notification=await notifyOrder(changed);
        return send(res,200,{order:{id:key,status:body.status},notification});
      }
      return error(res,404,'Rota não encontrada.');
    }
    if(route.startsWith('/api/'))return error(res,404,'Rota não encontrada.');
    if(method==='GET'||method==='HEAD')return serveStatic(req,res,route);
    return error(res,405,'Método não permitido.');
  }catch(e){console.error(`[FRAN] ${e.code||'ERROR'}: ${e.message}`);return error(res,Number.isInteger(e.code)?e.code:500,Number.isInteger(e.code)?e.message:'Erro interno. Tente novamente.');}
});
server.requestTimeout=120000;
db.initDatabase(defaults()).then(()=>{
  server.listen(PORT,HOST,()=>console.log(`🍽️ Sabores da Fran | MySQL conectado | http://localhost:${PORT} | Painel: /admin`));
}).catch(e=>{console.error(`\n[FRAN] Banco MySQL indisponível: ${e.code||'DB_ERROR'}\n${db.diagnostic(e)}\n`);process.exitCode=1;db.pool.end().catch(()=>{});});
