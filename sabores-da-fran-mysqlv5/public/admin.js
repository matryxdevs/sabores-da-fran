(() => {
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const dateText=s=>new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const ADMIN_HEADERS={'X-Fran-Admin':'1'};
const tabs={overview:'Visão geral',products:'Cardápio',promos:'Propagandas',settings:'Personalizar site',orders:'Pedidos',crm:'CRM e financeiro'};
let db={settings:{},products:[],promos:[],orders:[]};let crm={report:null,customers:[],whatsappConfigured:false};let editorKind='', editorId='', editorOptionGroups=[];let toastTimer;
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3800);}
async function api(path,options={}){
 const res=await fetch(path,{credentials:'same-origin',...options,headers:{...ADMIN_HEADERS,...(options.headers||{})}});
 let data;try{data=await res.json();}catch{data={};}
 if(!res.ok){if(res.status===401&&path!=='/api/admin/login')showLogin();throw new Error(data.error||'Falha na solicitação.');}
 return data;
}
const jsonOptions=(method,obj)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
function showLogin(){$('#adminLogin').hidden=false;$('#adminShell').hidden=true;}
async function showAdmin(){$('#adminLogin').hidden=true;$('#adminShell').hidden=false;await refresh();}
async function refresh(){const data=await api('/api/admin/data');db=data;renderAll();if(!$('#tab-crm').hidden)await loadCrm();}
function navigate(tab){if(!tabs[tab])return;document.querySelectorAll('.admin-tab').forEach(el=>el.hidden=el.id!==`tab-${tab}`);document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));$('#adminPageTitle').textContent=tabs[tab];if(tab==='settings')renderSettings();if(tab==='crm')loadCrm().catch(e=>toast(e.message));window.scrollTo({top:0,behavior:'smooth'});}
function renderAll(){renderOverview();renderProducts();renderPromos();renderOrders();renderSettings();}
function renderOverview(){const o=db.orders||[];const s=db.settings||{};
 $('#statProducts').textContent=db.products.length;$('#statOrders').textContent=o.length;$('#statPending').textContent=o.filter(x=>!['Entregue','Cancelado'].includes(x.status)).length;$('#statPromos').textContent=db.promos.filter(x=>x.active).length;$('#sideOrderCount').textContent=o.filter(x=>!['Entregue','Cancelado'].includes(x.status)).length;
 const list=[{done:/^\d{10,15}$/.test(s.whatsappNumber||''),label:'Configurar WhatsApp de recebimento'},{done:!!s.address,label:'Informar endereço do estabelecimento'},{done:!s.demoMode,label:'Substituir produtos demonstrativos'},{done:!!s.videoUrl,label:'Inserir vídeo de apresentação'},{done:!!s.videoUrl2,label:'Inserir o segundo vídeo da página'}];
 $('#setupChecklist').innerHTML=list.map(x=>`<div class="setup-item ${x.done?'done':''}"><span>${x.done?'✓':'○'}</span>${esc(x.label)}</div>`).join('');
 $('#recentOrders').innerHTML=o.length?o.slice(0,4).map(x=>`<div class="recent-order"><div><b>${esc(x.id)}</b><small>${esc(x.customer)} • ${dateText(x.createdAt)}</small></div><strong>${money(x.subtotal)}</strong></div>`).join(''):'<p style="font-size:13px;color:#a28e80">Nenhum pedido iniciado até agora.</p>';
}
function renderProducts(){const products=[...db.products].sort((a,b)=>a.sort-b.sort);
 $('#productsTable').innerHTML=products.length?products.map(p=>`<tr><td><div class="product-cell"><img class="product-thumb" src="${esc(p.image||'/assets/logo.png')}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.description).slice(0,55)}</small></div></div></td><td>${esc(p.category)}</td><td><b>${money(p.price)}</b></td><td><span class="pill ${p.available?'':'off'}">${p.available?'Disponível':'Oculto'}</span></td><td><div class="table-actions"><button data-edit-product="${esc(p.id)}">Editar</button><button class="danger" data-delete-product="${esc(p.id)}">Excluir</button></div></td></tr>`).join(''):'<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>';
}
function renderPromos(){$('#adminPromos').innerHTML=db.promos.length?db.promos.map(p=>`<article class="admin-promo-card"><div class="admin-promo-banner"><span>${esc(p.badge)}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div><div class="admin-promo-actions"><span class="pill ${p.active?'':'off'}">${p.active?'Ativa':'Desativada'}</span><div class="table-actions"><button data-edit-promo="${esc(p.id)}">Editar</button><button class="danger" data-delete-promo="${esc(p.id)}">Excluir</button></div></div></article>`).join(''):'<div class="admin-panel">Nenhuma propaganda cadastrada.</div>';}
const statuses=['Aguardando envio no WhatsApp','Recebido','Em preparo','Pronto','Entregue','Cancelado'];
function renderOrders(){const orders=db.orders||[];
 $('#ordersTable').innerHTML=orders.length?orders.map(o=>`<tr><td><b>${esc(o.id)}</b><br/><small>${dateText(o.createdAt)}</small></td><td><b>${esc(o.customer)}</b><br/><small>${esc(o.phone)}</small></td><td>${o.type==='delivery'?'🛵 Entrega':'🏪 Retirada'}</td><td><b>${o.total===null?'A confirmar':money(o.total)}</b></td><td><select class="status-select" data-order-paid="${esc(o.id)}" aria-label="Pagamento de ${esc(o.id)}"><option value="unpaid" ${!o.paid?'selected':''}>Pendente</option><option value="paid" ${o.paid?'selected':''}>✓ Pago</option></select></td><td><select class="status-select" data-order-status="${esc(o.id)}">${statuses.map(st=>`<option ${o.status===st?'selected':''}>${esc(st)}</option>`).join('')}</select><small class="notice-state">${o.notificationStatus==='accepted'?'✓ Aceito pela API':o.notificationStatus==='failed'?'⚠ Falha no aviso':o.notificationStatus==='skipped'?'○ Não enviado':o.notifyOptIn?'Avisos autorizados':'Sem autorização de avisos'}</small></td><td><div class="table-actions"><button data-order-detail="${esc(o.id)}">Detalhes</button></div></td></tr>`).join(''):'<tr><td colspan="7">Nenhum pedido iniciado no site.</td></tr>';
}
async function loadCrm(){const month=$('#crmMonth').value;if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return;
 const data=await api('/api/admin/crm?month='+encodeURIComponent(month));crm=data;$('#crmExport').href='/api/admin/crm/export.xlsx?month='+encodeURIComponent(month);renderCrm();}
function renderCrm(){const r=crm.report;if(!r)return;
 const items={crmRevenue:money(r.revenue),crmInventory:money(r.inventory),crmOperations:money(r.operations),crmResult:money(r.result),crmROI:r.returnOnSpend===null?'—':r.returnOnSpend.toLocaleString('pt-BR')+'%',crmMargin:r.margin===null?'—':r.margin.toLocaleString('pt-BR')+'%'};
 Object.entries(items).forEach(([id,val])=>$('#'+id).textContent=val);
 $('#crmResult').classList.toggle('negative',r.result<0);$('#crmPaidOrders').textContent=r.paidOrders+' pedido(s) pago(s)';
 $('#crmSubtitle').textContent=`${r.month} • Gasto total: ${money(r.spending)} • Ticket médio: ${money(r.averageTicket)} • ${crm.whatsappConfigured?'Notificações API configuradas':'API WhatsApp ainda não configurada'}`;
 const max=Math.max(r.revenue,r.spending,1);
 $('#crmBars').innerHTML=[['Recebimentos',r.revenue,'revenue'],['Gastos totais',r.spending,'spend']].map(([label,value,cls])=>`<div class="crm-bar-row"><span>${label}</span><div class="crm-bar-track"><div class="crm-bar ${cls}" style="width:${(value/max*100).toFixed(2)}%"></div></div><b>${money(value)}</b></div>`).join('');
 $('#crmPurchases').innerHTML=r.purchases.length?r.purchases.map(x=>`<tr><td><b>${esc(x.description)}</b><small>${esc(x.date)} • ${esc(x.category)}</small></td><td>${esc(x.supplier||'—')}</td><td>${x.quantity.toLocaleString('pt-BR')} × ${money(x.unitCost)}</td><td><b>${money(x.total)}</b></td><td><div class="table-actions"><button data-crm-edit="purchase:${x.id}">Editar</button><button class="danger" data-crm-delete="purchase:${x.id}">Excluir</button></div></td></tr>`).join(''):'<tr><td colspan="5">Nenhuma compra registrada neste mês.</td></tr>';
 $('#crmExpenses').innerHTML=r.expenses.length?r.expenses.map(x=>`<tr><td><b>${esc(x.description)}</b><small>${esc(x.date)}</small></td><td>${esc(x.category)}</td><td><b>${money(x.amount)}</b></td><td><div class="table-actions"><button data-crm-edit="expense:${x.id}">Editar</button><button class="danger" data-crm-delete="expense:${x.id}">Excluir</button></div></td></tr>`).join(''):'<tr><td colspan="4">Nenhuma despesa registrada neste mês.</td></tr>';
 renderCustomers();
}
function renderCustomers(){const query=($('#crmSearch').value||'').toLowerCase().trim();const all=crm.customers||[];
 const list=all.filter(c=>`${c.name} ${c.phone}`.toLowerCase().includes(query));
 $('#crmCustomers').innerHTML=list.length?list.map(c=>`<tr><td><b>${esc(c.name)}</b><small>${esc(c.phone)}</small></td><td>${c.orders}</td><td>${c.paidOrders}</td><td><b>${money(c.totalSpent)}</b></td><td><b>${esc(c.lastOrder)}</b><small>${esc(c.lastStatus)}</small></td><td><a class="crm-contact" href="https://wa.me/${esc(c.phone.length===11?'55'+c.phone:c.phone.length===10?'55'+c.phone:c.phone)}" target="_blank" rel="noopener noreferrer">Conversar ↗</a></td></tr>`).join(''):'<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>';
}
function openFinanceEditor(kind,id=''){
 editorKind=kind;editorId=id;const list=kind==='purchase'?crm.report?.purchases:crm.report?.expenses;const current=(list||[]).find(x=>String(x.id)===String(id))||{};
 const date=new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
 $('#editorTitle').textContent=(id?'Editar ':'Registrar ')+(kind==='purchase'?'compra de mercadoria':'despesa operacional');
 $('#editorFields').innerHTML=kind==='purchase'?`${inputField({name:'date',label:'Data *',type:'date',value:current.date||date,required:true})}${inputField({name:'description',label:'Mercadoria / insumo *',value:current.description,required:true,placeholder:'Ex.: pão brioche, carne, embalagem'})}${inputField({name:'supplier',label:'Fornecedor',value:current.supplier,placeholder:'Nome do fornecedor'})}${inputField({name:'category',label:'Categoria',value:current.category||'Mercadorias',required:true})}${inputField({name:'quantity',label:'Quantidade *',type:'number',value:current.quantity??1,required:true})}${inputField({name:'unitCost',label:'Custo unitário (R$) *',type:'number',value:current.unitCost??'',required:true})}${inputField({name:'notes',label:'Observações',rows:2,value:current.notes})}`:`${inputField({name:'date',label:'Data *',type:'date',value:current.date||date,required:true})}${inputField({name:'description',label:'Descrição *',value:current.description,required:true,placeholder:'Ex.: energia, aluguel'})}${inputField({name:'category',label:'Categoria',value:current.category||'Operacional',required:true})}${inputField({name:'amount',label:'Valor pago (R$) *',type:'number',value:current.amount??'',required:true})}${inputField({name:'notes',label:'Observações',rows:2,value:current.notes})}`;
 $('#editorOverlay').hidden=false;document.body.classList.add('modal-open');$('#editorFields input')?.focus();
}
async function deleteFinance(kind,id){if(!confirm('Excluir este lançamento financeiro? Esta ação não pode ser desfeita.'))return;
 try{const resource=kind==='purchase'?'purchases':'expenses';await api(`/api/admin/crm/${resource}/${id}`,{method:'DELETE'});await loadCrm();toast('Registro excluído.');}catch(e){toast(e.message);}}
function renderSettings(){const s=db.settings||{};const names={businessName:'settingBusiness',heroTitle:'settingHeroTitle',heroSubtitle:'settingHeroSubtitle',tagline:'settingTagline',announcement:'settingAnnouncement',whatsappNumber:'settingWhatsapp',address:'settingAddress',openingHours:'settingHours',instagram:'settingInstagram',mapUrl:'settingMap',mapLat:'settingLat',mapLng:'settingLng',videoTitle:'settingVideoTitle',videoDescription:'settingVideoDescription',videoUrl:'settingVideoUrl',videoTitle2:'settingVideoTitle2',videoDescription2:'settingVideoDescription2',videoUrl2:'settingVideoUrl2',logoUrl:'settingLogoUrl'};
 for(const [key,el] of Object.entries(names))$('#'+el).value=s[key]??'';
 $('#settingFee').value=s.deliveryFee===null||s.deliveryFee===undefined?'':s.deliveryFee;$('#settingDemoMode').checked=!!s.demoMode;
}
function inputField({name,label,value='',type='text',required=false,placeholder='',rows=0}){
 const field=rows?`<textarea id="edit-${name}" name="${name}" rows="${rows}" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(value)}</textarea>`:`<input id="edit-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} placeholder="${esc(placeholder)}" ${type==='number'?'min="0" step="0.01"':''}>`;
 return `<div class="field"><label for="edit-${name}">${esc(label)}</label>${field}</div>`;
}
function optionId(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;}
function optionGroup(name='Novo grupo',type='single',required=true){return {id:optionId(),name,type,required,maxChoices:1,choices:[{id:optionId(),name:'Opção 1',extraPrice:0},{id:optionId(),name:'Opção 2',extraPrice:0}]};}
function renderOptionEditor(){
 const wrapper=$('#optionEditor');if(!wrapper)return;
 wrapper.innerHTML=`<div class="admin-options-header"><h3>Personalizações do produto</h3><div class="table-actions"><button type="button" class="option-small-btn" data-options-example>Exemplo: sabor + tamanho + borda</button><button type="button" class="option-small-btn" data-option-add-group>+ Grupo</button></div></div><p class="admin-options-help">Crie grupos como Tamanho, Sabores, Bordas ou Adicionais. O valor extra de cada escolha será somado ao preço-base por unidade. Marque como obrigatório se o cliente precisar escolher.</p>${editorOptionGroups.map((g,i)=>`<div class="option-builder-group"><div class="option-builder-head"><h4>Grupo ${i+1}</h4><button class="option-remove" type="button" data-option-remove-group="${i}">Excluir grupo</button></div><div class="option-builder-fields"><div class="field"><label>Nome do grupo</label><input data-opt-group-name="${i}" value="${esc(g.name)}" maxlength="65" placeholder="Ex.: Tamanho"/></div><div class="field"><label>Tipo de escolha</label><select data-opt-group-type="${i}"><option value="single" ${g.type==='single'?'selected':''}>Apenas uma</option><option value="multiple" ${g.type==='multiple'?'selected':''}>Várias opções</option></select></div>${g.type==='multiple'?`<div class="field"><label>Máximo de opções</label><input data-opt-group-max="${i}" type="number" min="1" max="12" value="${g.maxChoices||1}"/></div>`:''}</div><label class="toggle-line"><input type="checkbox" data-opt-group-required="${i}" ${g.required?'checked':''}/><span>Escolha obrigatória</span></label><div class="option-builder-choices"><strong>Opções e preços adicionais</strong>${g.choices.map((c,j)=>`<div class="option-builder-choice"><div class="field"><label>Nome</label><input data-opt-choice-name="${i}:${j}" value="${esc(c.name)}" maxlength="65" placeholder="Ex.: Grande"/></div><div class="field"><label>Adicional (R$)</label><input data-opt-choice-price="${i}:${j}" type="number" min="0" max="5000" step="0.01" value="${Number(c.extraPrice)}"/></div><button class="option-remove" type="button" data-option-remove-choice="${i}:${j}" aria-label="Excluir opção">×</button></div>`).join('')}</div><button type="button" class="option-small-btn" data-option-add-choice="${i}">+ Adicionar opção</button></div>`).join('')}`;
}
function sampleOptions(){
 const flavor=optionGroup('Sabor','single',true);
 flavor.choices=[{id:optionId(),name:'Tradicional',extraPrice:0},{id:optionId(),name:'Frango',extraPrice:2},{id:optionId(),name:'Calabresa',extraPrice:3}];
 const size=optionGroup('Tamanho','single',true);
 size.choices=[{id:optionId(),name:'Pequeno',extraPrice:0},{id:optionId(),name:'Médio',extraPrice:5},{id:optionId(),name:'Grande',extraPrice:10}];
 const border=optionGroup('Borda','single',false);
 border.choices=[{id:optionId(),name:'Sem borda',extraPrice:0},{id:optionId(),name:'Borda de cheddar',extraPrice:6},{id:optionId(),name:'Borda de catupiry',extraPrice:7}];
 return [flavor,size,border];
}
function openEditor(kind,id=''){
 editorKind=kind;editorId=id;let current;
 if(kind==='purchase'||kind==='expense'){openFinanceEditor(kind,id);return;}
 if(kind==='product'){current=db.products.find(x=>x.id===id)||{};editorOptionGroups=structuredClone(current.optionGroups||[]);$('#editorTitle').textContent=id?'Editar produto':'Novo produto';
 $('#editorFields').innerHTML=`${inputField({name:'name',label:'Nome do produto *',value:current.name,required:true,placeholder:'Ex.: X-Bacon da Fran'})}${inputField({name:'category',label:'Categoria *',value:current.category||'Hambúrgueres',required:true,placeholder:'Hambúrgueres, Bebidas, Acompanhamentos...'})}${inputField({name:'price',label:'Preço (R$) *',type:'number',value:current.price??'',required:true})}${inputField({name:'description',label:'Descrição',rows:3,value:current.description,placeholder:'Ingredientes e detalhes do lanche'})}${inputField({name:'image',label:'URL da imagem',value:current.image,placeholder:'https://... ou use o botão de envio'})}<label class="upload-label">📷 Enviar foto do produto <input type="file" id="editFileUpload" accept="image/png,image/jpeg,image/webp"></label>${current.image?`<img class="image-preview" src="${esc(current.image)}" alt="Prévia da imagem">`:''}${inputField({name:'sort',label:'Ordem de exibição',type:'number',value:current.sort??db.products.length+1})}<label class="toggle-line"><input type="checkbox" name="available" ${current.available!==false?'checked':''}/><span>Disponível no cardápio</span></label><label class="toggle-line"><input type="checkbox" name="featured" ${current.featured?'checked':''}/><span>Mostrar selo de destaque</span></label><div class="admin-options-block" id="optionEditor"></div>`;
  renderOptionEditor();
 }else{current=db.promos.find(x=>x.id===id)||{};$('#editorTitle').textContent=id?'Editar propaganda':'Nova propaganda';
 $('#editorFields').innerHTML=`${inputField({name:'title',label:'Título da propaganda *',value:current.title,required:true,placeholder:'Ex.: Sextou com sabor!'})}${inputField({name:'badge',label:'Etiqueta',value:current.badge||'DESTAQUE',placeholder:'PROMOÇÃO, NOVO...'})}${inputField({name:'text',label:'Descrição',rows:3,value:current.text,placeholder:'Texto do anúncio'})}${inputField({name:'image',label:'Imagem de fundo (opcional)',value:current.image,placeholder:'https://... ou envie uma imagem'})}<label class="upload-label">📷 Enviar imagem da propaganda <input type="file" id="editFileUpload" accept="image/png,image/jpeg,image/webp"></label>${current.image?`<img class="image-preview" src="${esc(current.image)}" alt="Prévia da imagem">`:''}<label class="toggle-line"><input type="checkbox" name="active" ${current.active!==false?'checked':''}/><span>Propaganda ativa</span></label>`;
 }
 $('#editorOverlay').hidden=false;document.body.classList.add('modal-open');$('#editorFields input:first-child')?.focus();
}
function closeEditor(){$('#editorOverlay').hidden=true;document.body.classList.remove('modal-open');editorKind='';editorId='';}
function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Falha ao ler arquivo.'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});}
async function upload(file){if(!file)return null;const video=file.type.startsWith('video/');const max=video?28*1024*1024:5*1024*1024;if(file.size>max)throw new Error(video?'Vídeo maior que 28 MB.':'Imagem maior que 5 MB.');
 const dataUrl=await readFile(file);const saved=await api('/api/admin/upload',jsonOptions('POST',{dataUrl}));return saved.url;
}
async function saveEditor(e){e.preventDefault();const btn=$('#saveEditor');btn.disabled=true;btn.textContent='Salvando...';
 try{
  const kindBeingSaved=editorKind;const form=new FormData(e.target);const obj=Object.fromEntries(form.entries());delete obj.available;delete obj.featured;delete obj.active;
  if(editorKind==='purchase'||editorKind==='expense'){const resource=editorKind==='purchase'?'purchases':'expenses';const url=`/api/admin/crm/${resource}${editorId?`/${editorId}`:''}`;await api(url,jsonOptions(editorId?'PUT':'POST',obj));closeEditor();await loadCrm();toast('Lançamento salvo!');return;}
  if(editorKind==='product'){obj.available=e.target.querySelector('[name="available"]').checked;obj.featured=e.target.querySelector('[name="featured"]').checked;obj.optionGroups=editorOptionGroups;}else obj.active=e.target.querySelector('[name="active"]').checked;
  const file=$('#editFileUpload')?.files?.[0];if(file)obj.image=await upload(file);
  const uri=`/api/admin/${editorKind==='product'?'products':'promos'}${editorId?`/${editorId}`:''}`;
  await api(uri,jsonOptions(editorId?'PUT':'POST',obj));closeEditor();await refresh();toast(kindBeingSaved==='product'?'Produto salvo!':'Propaganda salva!');
 }catch(err){toast(err.message);}finally{btn.disabled=false;btn.textContent='Salvar alterações ✓';}
}
async function deleteItem(kind,id){const product=kind==='product';const entry=(product?db.products:db.promos).find(x=>x.id===id);if(!entry)return;
 if(!confirm(`Excluir ${product?'o produto':'a propaganda'} “${entry.name||entry.title}”? Esta ação não pode ser desfeita.`))return;
 try{await api(`/api/admin/${product?'products':'promos'}/${id}`,{method:'DELETE'});await refresh();toast('Item excluído.');}catch(err){toast(err.message);}
}
async function saveSettings(e){e.preventDefault();const btn=$('#saveSettingsBtn');btn.disabled=true;btn.textContent='Salvando...';
 try{const form=new FormData(e.target);const obj=Object.fromEntries(form.entries());obj.demoMode=$('#settingDemoMode').checked;
  const video=$('#videoUploadInput').files[0];const video2=$('#videoUploadInput2').files[0];const logo=$('#logoUploadInput').files[0];
  if(video){obj.videoUrl=await upload(video);$('#videoUploadStatus').textContent=`Vídeo 1 enviado: ${video.name}`;}
  if(video2){obj.videoUrl2=await upload(video2);$('#videoUploadStatus2').textContent=`Vídeo 2 enviado: ${video2.name}`;}
  if(logo)obj.logoUrl=await upload(logo);
  await api('/api/admin/settings',jsonOptions('PUT',obj));await refresh();toast('Configurações atualizadas com sucesso!');
 }catch(err){toast(err.message);}finally{btn.disabled=false;btn.textContent='Salvar alterações ✓';}
}
function showOrder(id){const o=db.orders.find(x=>x.id===id);if(!o)return;
 $('#orderDetailTitle').textContent=`Pedido ${o.id}`;
 const info=(label,v)=>`<div class="detail-info"><b>${esc(label)}:</b> ${esc(v||'-')}</div>`;
 $('#orderDetailBody').innerHTML=`<div class="detail-body">${info('Data',dateText(o.createdAt))}${info('Cliente',o.customer)}${info('WhatsApp',o.phone)}${info('Modalidade',o.type==='delivery'?'Entrega':'Retirada no local')}${o.type==='delivery'?info('Endereço',o.address)+info('Referência',o.reference):''}${info('Pagamento',o.payment)}${info('Status',o.status)}${info('Pagamento',o.paid?'Pago':'Pendente')}${info('Avisos autorizados',o.notifyOptIn?'Sim':'Não')}${info('Última notificação',o.notificationStatus||'Nenhuma')}<h3 style="margin:20px 0 10px">Itens do pedido</h3>${o.items.map(p=>`<div class="detail-item"><span>${p.quantity}x ${esc(p.name)}${p.options?.length?`<small style="display:block;color:#95616d;line-height:1.5">${esc(p.options.map(g=>`${g.groupName}: ${g.choices.map(c=>c.name).join(', ')}`).join(' · '))}</small>`:''}</span><b>${money(p.total)}</b></div>`).join('')}<div class="detail-item"><span>Subtotal</span><b>${money(o.subtotal)}</b></div>${o.type==='delivery'?`<div class="detail-item"><span>Entrega</span><b>${o.fee===null?'A confirmar':money(o.fee)}</b></div>`:''}<div class="detail-total"><span>${o.total===null?'Total parcial':'Total'}</span><span>${money(o.total===null?o.subtotal:o.total)}</span></div>${o.note?`<div class="detail-note"><b>Observações:</b> ${esc(o.note)}</div>`:''}${o.type==='delivery'?`<div class="crm-fee"><label for="orderFeeInput">Taxa de entrega real (R$)</label><input type="number" id="orderFeeInput" min="0" step="0.01" value="${o.fee??''}" placeholder="Informe a taxa"/><button class="btn btn-soft" data-save-fee="${esc(o.id)}">Salvar taxa</button></div>`:''}${o.notifyOptIn?`<button class="btn btn-soft btn-block" data-resend="${esc(o.id)}" type="button" style="margin-top:12px">Reenviar aviso do status atual</button>`:''}<a href="https://wa.me/${esc(o.phone)}" target="_blank" rel="noopener noreferrer" class="btn btn-fire btn-block" style="margin-top:18px">Conversar com cliente ↗</a><button type="button" class="btn btn-soft btn-block" data-delete-order="${esc(o.id)}" style="margin-top:10px">Excluir registro do pedido</button></div>`;
 $('#orderDetailOverlay').hidden=false;document.body.classList.add('modal-open');
}
function closeOrderDetail(){$('#orderDetailOverlay').hidden=true;document.body.classList.remove('modal-open');}
async function init(){
 try{const result=await api('/api/admin/me');if(result.authenticated)await showAdmin();else showLogin();}catch{showLogin();}
}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const btn=$('#loginButton');btn.disabled=true;btn.textContent='Entrando...';try{await api('/api/admin/login',jsonOptions('POST',{email:$('#loginEmail').value,password:$('#loginPassword').value}));$('#loginPassword').value='';await showAdmin();toast('Bem-vindo ao painel!');}catch(err){toast(err.message);}finally{btn.disabled=false;btn.textContent='Entrar no painel →';}});
$('#logoutBtn').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'});}catch{}showLogin();});
$('#adminNav').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)navigate(b.dataset.tab);});
document.addEventListener('click',e=>{const b=e.target.closest('[data-go-tab]');if(b)navigate(b.dataset.goTab);});
$('#addProductBtn').addEventListener('click',()=>openEditor('product'));$('#addPromoBtn').addEventListener('click',()=>openEditor('promo'));
$('#productsTable').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-product]');const del=e.target.closest('[data-delete-product]');if(edit)openEditor('product',edit.dataset.editProduct);if(del)deleteItem('product',del.dataset.deleteProduct);});
$('#adminPromos').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-promo]');const del=e.target.closest('[data-delete-promo]');if(edit)openEditor('promo',edit.dataset.editPromo);if(del)deleteItem('promo',del.dataset.deletePromo);});
$('#editorFields').addEventListener('input',e=>{
 const el=e.target,groupName=el.dataset.optGroupName,choiceName=el.dataset.optChoiceName,choicePrice=el.dataset.optChoicePrice,groupMax=el.dataset.optGroupMax;
 if(groupName!==undefined)editorOptionGroups[Number(groupName)].name=el.value;
 if(choiceName){const [i,j]=choiceName.split(':').map(Number);editorOptionGroups[i].choices[j].name=el.value;}
 if(choicePrice){const [i,j]=choicePrice.split(':').map(Number);editorOptionGroups[i].choices[j].extraPrice=el.value;}
 if(groupMax!==undefined)editorOptionGroups[Number(groupMax)].maxChoices=Number(el.value);
});
$('#editorFields').addEventListener('change',e=>{
 const el=e.target,type=el.dataset.optGroupType,required=el.dataset.optGroupRequired;
 if(type!==undefined){const g=editorOptionGroups[Number(type)];g.type=el.value;g.maxChoices=el.value==='single'?1:Math.min(2,g.choices.length);renderOptionEditor();}
 if(required!==undefined)editorOptionGroups[Number(required)].required=el.checked;
});
$('#editorFields').addEventListener('click',e=>{
 const el=e.target.closest('[data-option-add-group],[data-options-example],[data-option-remove-group],[data-option-add-choice],[data-option-remove-choice]');if(!el)return;
 if(el.hasAttribute('data-options-example')){if(editorOptionGroups.length&&!confirm('Substituir os grupos atuais pelo exemplo de sabor, tamanho e borda?'))return;editorOptionGroups=sampleOptions();}
 else if(el.hasAttribute('data-option-add-group')){if(editorOptionGroups.length>=12){toast('Limite de 12 grupos por produto.');return;}editorOptionGroups.push(optionGroup());}
 else if(el.dataset.optionRemoveGroup!==undefined)editorOptionGroups.splice(Number(el.dataset.optionRemoveGroup),1);
 else if(el.dataset.optionAddChoice!==undefined){const g=editorOptionGroups[Number(el.dataset.optionAddChoice)];if(g.choices.length>=25){toast('Limite de 25 opções por grupo.');return;}g.choices.push({id:optionId(),name:`Opção ${g.choices.length+1}`,extraPrice:0});}
 else if(el.dataset.optionRemoveChoice){const [i,j]=el.dataset.optionRemoveChoice.split(':').map(Number),g=editorOptionGroups[i];if(g.choices.length===1){toast('O grupo precisa de pelo menos uma opção.');return;}g.choices.splice(j,1);g.maxChoices=Math.min(g.maxChoices,g.choices.length);}
 renderOptionEditor();
});
$('#editorForm').addEventListener('submit',saveEditor);$('#closeEditor').addEventListener('click',closeEditor);$('#editorOverlay').addEventListener('click',e=>{if(e.target.id==='editorOverlay')closeEditor();});
$('#settingsForm').addEventListener('submit',saveSettings);
$('#crmMonth').value=new Date(Date.now()-3*60*60*1000).toISOString().slice(0,7);
$('#crmMonth').addEventListener('change',()=>loadCrm().catch(e=>toast(e.message)));
$('#crmSearch').addEventListener('input',renderCustomers);
$('#addPurchaseBtn').addEventListener('click',()=>openFinanceEditor('purchase'));
$('#addExpenseBtn').addEventListener('click',()=>openFinanceEditor('expense'));
for(const table of ['#crmPurchases','#crmExpenses'])$(table).addEventListener('click',e=>{const ed=e.target.closest('[data-crm-edit]');const del=e.target.closest('[data-crm-delete]');if(ed){const [kind,id]=ed.dataset.crmEdit.split(':');openFinanceEditor(kind,id);}if(del){const [kind,id]=del.dataset.crmDelete.split(':');deleteFinance(kind,id);}});
$('#refreshOrders').addEventListener('click',async()=>{try{await refresh();toast('Pedidos atualizados.');}catch(err){toast(err.message);}});
$('#ordersTable').addEventListener('change',async e=>{const el=e.target;const paid=el.closest('[data-order-paid]');const status=el.closest('[data-order-status]');if(!paid&&!status)return;
 try{
   if(paid){await api(`/api/admin/orders/${paid.dataset.orderPaid}/payment`,jsonOptions('PATCH',{paid:paid.value==='paid'}));await refresh();toast('Pagamento atualizado no CRM.');return;}
   const result=await api(`/api/admin/orders/${status.dataset.orderStatus}`,jsonOptions('PATCH',{status:status.value}));await refresh();
   const n=result.notification||{};toast(n.status==='accepted'?'Status alterado. Mensagem aceita pela API Meta (entrega pendente).':n.status==='failed'?'Status salvo, mas o aviso falhou: '+n.details:'Status salvo. Aviso não enviado: '+(n.details||'não configurado.'));
 }catch(err){toast(err.message);await refresh();}});
$('#ordersTable').addEventListener('click',e=>{const b=e.target.closest('[data-order-detail]');if(b)showOrder(b.dataset.orderDetail);});
$('#orderDetailBody').addEventListener('click',async e=>{
 const fee=e.target.closest('[data-save-fee]');if(fee){try{await api(`/api/admin/orders/${fee.dataset.saveFee}/fee`,jsonOptions('PATCH',{fee:$('#orderFeeInput').value}));closeOrderDetail();await refresh();toast('Taxa de entrega atualizada.');}catch(err){toast(err.message);}return;}
 const retry=e.target.closest('[data-resend]');if(retry){try{retry.disabled=true;const result=await api(`/api/admin/orders/${retry.dataset.resend}/notify`,{method:'POST'});closeOrderDetail();await refresh();toast(result.notification.status==='accepted'?'Solicitação aceita pela Meta.':'Aviso não enviado: '+result.notification.details);}catch(err){toast(err.message);}return;}
 const b=e.target.closest('[data-delete-order]');if(!b)return;const id=b.dataset.deleteOrder;if(!confirm(`Excluir definitivamente o registro do pedido ${id}?`))return;try{await api('/api/admin/orders/'+id,{method:'DELETE'});closeOrderDetail();await refresh();toast('Pedido excluído.');}catch(err){toast(err.message);}});
$('#closeOrderDetail').addEventListener('click',closeOrderDetail);$('#orderDetailOverlay').addEventListener('click',e=>{if(e.target.id==='orderDetailOverlay')closeOrderDetail();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#editorOverlay').hidden)closeEditor();else if(!$('#orderDetailOverlay').hidden)closeOrderDetail();}});
init();
})();
