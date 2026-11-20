(() => {
'use strict';
const $ = s => document.querySelector(s);
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const state = {settings:{},products:[],promos:[],category:'Todos',cart:loadCart()};
function loadCart(){
 try {
   const saved=JSON.parse(localStorage.getItem('sabores_fran_cart_v5')||'null');
   if(Array.isArray(saved))return saved.filter(x=>x&&typeof x.id==='string'&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=30).slice(0,50);
   const previous=JSON.parse(localStorage.getItem('sabores_fran_cart')||'{}');
   return Object.entries(previous||{}).map(([id,quantity])=>({id,quantity:Number(quantity),selections:[]})).filter(x=>Number.isInteger(x.quantity)&&x.quantity>0).slice(0,50);
 }catch{return [];}
}
function saveCart(){try{localStorage.setItem('sabores_fran_cart_v5',JSON.stringify(state.cart));}catch{}}
let toastTimer;
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),4000);}
function safeImage(url){return url && (/^https:\/\//i.test(url)||/^\/(uploads|assets)\//.test(url))?url:'';}
function imgHtml(p,css=''){const im=safeImage(p.image);return im ? `<img class="${css}" src="${escape(im)}" alt="${escape(p.name)}" loading="lazy">` : `<span class="image-fallback" aria-label="Imagem não disponível">🍽️</span>`;}
function optionSummary(groups){return (groups||[]).map(g=>`${g.groupName}: ${g.choices.map(c=>c.name).join(', ')}`).join(' · ');}
function priceSelection(product,raw,strict=false){
 const groups=product.optionGroups||[], selected=new Map((raw||[]).map(x=>[x.groupId,x.choiceIds]));let extra=0;const details=[];
 for(const group of groups){
   const ids=selected.get(group.id)||[];
   if((group.required&&!ids.length)||(ids.length>(group.type==='single'?1:group.maxChoices))||ids.some(id=>!group.choices.some(c=>c.id===id))){if(strict)return null;continue;}
   if(!ids.length)continue;
   const choices=ids.map(id=>group.choices.find(c=>c.id===id));
   extra+=choices.reduce((n,c)=>n+Number(c.extraPrice||0),0);details.push({groupId:group.id,groupName:group.name,choices});
 }
 if(strict&&selected.size>groups.length)return null;
 return {price:Math.round((Number(product.price)+extra)*100)/100,details};
}
function keyFor(id,selections){return id+':'+JSON.stringify((selections||[]).filter(s=>s.choiceIds?.length).map(s=>[s.groupId,[...s.choiceIds].sort()]));}
function items(){return state.cart.map((entry,index)=>{
 const product=state.products.find(p=>p.id===entry.id),calculated=product&&priceSelection(product,entry.selections,true);
 return product&&calculated?{product,quantity:entry.quantity,selections:entry.selections||[],price:calculated.price,details:calculated.details,index}:null;
 }).filter(Boolean);}
function subtotal(){return Math.round(items().reduce((sum,x)=>sum+x.price*x.quantity,0)*100)/100;}
function count(){return items().reduce((sum,x)=>sum+x.quantity,0);}
function setCart(index,quantity){
 const entry=state.cart[index];if(!entry)return;
 if(quantity<1)state.cart.splice(index,1);else entry.quantity=Math.min(30,quantity);
 saveCart();renderCart();
}
function addConfigured(product,selections,quantity){
 const id=product.id,key=keyFor(id,selections);const found=state.cart.find(x=>keyFor(x.id,x.selections)===key);
 if(found)found.quantity=Math.min(30,found.quantity+quantity);
 else if(state.cart.length<50)state.cart.push({id,quantity,selections});
 else {toast('O carrinho já possui 50 itens diferentes.');return;}
 saveCart();renderCart();toast('Produto adicionado ao carrinho!');
}
function renderCart(){
 $('#cartCount').textContent=count();$('#cartSubtotal').textContent=money(subtotal());
 const arr=items();$('#cartItems').innerHTML=arr.length?arr.map(x=>`<div class="cart-row"><div class="cart-row-photo fallback">${x.product.image?`<img src="${escape(safeImage(x.product.image))}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:'🍽️'}</div><div class="cart-row-content"><h4>${escape(x.product.name)}</h4>${x.details.length?`<small class="cart-option-summary">${escape(optionSummary(x.details))}</small>`:''}<p>${money(x.price*x.quantity)} <small>(${money(x.price)} / un.)</small></p><div class="quantity-control"><button type="button" data-minus="${x.index}" aria-label="Diminuir ${escape(x.product.name)}">−</button><span>${x.quantity}</span><button type="button" data-plus="${x.index}" aria-label="Aumentar ${escape(x.product.name)}">+</button></div><button type="button" data-remove="${x.index}" class="remove-item">Remover</button></div></div>`).join(''):`<div class="cart-empty"><span>🛒</span><h3>Seu carrinho está vazio</h3><p>Escolha um item delicioso do cardápio.</p><button class="btn btn-fire" id="shopNow" type="button">Ver cardápio →</button></div>`;
 $('#checkoutBtn').disabled=!arr.length;
}
let customizingProduct=null;
function openConfigurator(product){
 customizingProduct=product;
 $('#configTitle').textContent=product.name;
 $('#configDescription').textContent=product.description||'Personalize do seu jeito.';
 $('#configQuantity').value='1';
 $('#configGroups').innerHTML=(product.optionGroups||[]).map((group,i)=>`<fieldset class="config-group"><legend>${escape(group.name)} ${group.required?'<span class="required-asterisk">*</span>':'<small>(opcional)</small>'}</legend><p>${group.type==='single'?'Escolha uma opção':`Escolha até ${group.maxChoices} opções`}</p>${group.choices.map((choice,j)=>`<label class="config-choice"><input type="${group.type==='single'?'radio':'checkbox'}" name="custom-${i}" data-group="${i}" data-choice="${j}" ${group.required&&group.type==='single'&&j===0?'checked':''}><span>${escape(choice.name)}</span><strong>${Number(choice.extraPrice)>0?`+ ${money(choice.extraPrice)}`:'Incluso'}</strong></label>`).join('')}</fieldset>`).join('');
 $('#configOverlay').hidden=false;document.body.classList.add('modal-open');refreshConfigPrice();
}
function selectionsFromConfig(){
 if(!customizingProduct)return [];
 return customizingProduct.optionGroups.map((g,i)=>({groupId:g.id,choiceIds:[...document.querySelectorAll(`#configGroups [data-group="${i}"]:checked`)].map(input=>g.choices[Number(input.dataset.choice)].id)}));
}
function refreshConfigPrice(){
 if(!customizingProduct)return;
 const q=Math.max(1,Math.min(30,Number($('#configQuantity').value)||1));
 const calc=priceSelection(customizingProduct,selectionsFromConfig());
 $('#configTotal').textContent=money((calc?.price||customizingProduct.price)*q);
}
function closeConfigurator(){customizingProduct=null;$('#configOverlay').hidden=true;document.body.classList.remove('modal-open');}
function finishConfigurator(e){e.preventDefault();if(!customizingProduct)return;
 const selections=selectionsFromConfig(),calc=priceSelection(customizingProduct,selections,true);
 if(!calc){toast('Preencha as opções obrigatórias e respeite os limites de escolha.');return;}
 addConfigured(customizingProduct,selections,Math.max(1,Math.min(30,Number($('#configQuantity').value)||1)));
 closeConfigurator();
}
function openCart(){renderCart();$('#drawerOverlay').hidden=false;$('#cartDrawer').classList.add('open');$('#cartDrawer').setAttribute('aria-hidden','false');document.body.classList.add('modal-open');$('#closeCart').focus();}
function closeCart(){ $('#cartDrawer').classList.remove('open');$('#cartDrawer').setAttribute('aria-hidden','true');$('#drawerOverlay').hidden=true;document.body.classList.remove('modal-open');}
function renderMenu(){
 const cats=['Todos',...new Set(state.products.map(p=>p.category||'Outros'))];
 if(!cats.includes(state.category))state.category='Todos';
 $('#categoryTabs').innerHTML=cats.map(c=>`<button data-category="${escape(c)}" class="${state.category===c?'active':''}" type="button">${escape(c)}</button>`).join('');
 const chosen=state.products.filter(p=>state.category==='Todos'||p.category===state.category);
 $('#productGrid').innerHTML=chosen.length?chosen.map(p=>`<article class="product-card"><div class="product-image">${imgHtml(p)}${p.featured?'<span class="product-tag">EM DESTAQUE ★</span>':''}</div><div class="product-body"><div class="product-meta">${escape(p.category)}</div><h3>${escape(p.name)}</h3><p>${escape(p.description)}</p>${p.optionGroups?.length?`<div class="product-options-hint">⚙ Personalizável: ${escape(p.optionGroups.map(g=>g.name).join(', '))}</div>`:''}<div class="product-bottom"><strong class="product-price">${money(p.price)}</strong><button type="button" class="product-add" data-add="${escape(p.id)}" aria-label="Adicionar ${escape(p.name)} ao carrinho">+</button></div></div></article>`).join(''):'<div class="empty-state"><span class="empty-emoji">🍔</span><h3>Nenhum item por aqui</h3><p>Volte em breve para conferir nossas delícias.</p></div>';
}
function renderPromos(){const promos=state.promos;$('#promocoes').hidden=!promos.length;if(promos.length)$('#promoGrid').innerHTML=promos.map(p=>`<article class="promo-card">${p.image?`<img src="${escape(safeImage(p.image))}" alt="${escape(p.title)}" loading="lazy">`:''}${p.badge?`<span class="promo-badge">${escape(p.badge)}</span>`:''}<h3>${escape(p.title)}</h3><p>${escape(p.text)}</p><a href="#cardapio" class="promo-link">Escolher meu lanche ↗</a></article>`).join('');}
function videoEmbed(url){
 if(!url)return '';
 try{
  const u=new URL(url,location.origin);let code='';const host=u.hostname.replace(/^www\./,'').toLowerCase();
  if(host==='youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com'){
    if(u.pathname==='/watch')code=u.searchParams.get('v')||'';
    else if(/^\/(shorts|embed)\//.test(u.pathname))code=u.pathname.split('/')[2]||'';
  }else if(host==='youtu.be')code=u.pathname.replace('/','');
  if(/^[A-Za-z0-9_-]{11}$/.test(code))return `<iframe src="https://www.youtube-nocookie.com/embed/${code}" title="Vídeo da Sabores da Fran" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>`;
  if((u.protocol==='https:'||u.origin===location.origin)&&(/\.(mp4|webm)(\?|$)/i.test(u.pathname)||/^\/uploads\/.*\.(mp4|webm)$/i.test(u.pathname)))return `<video controls preload="metadata" playsinline src="${escape(u.href)}"></video>`;
 }catch{}return '';
}
function renderSettings(){const s=state.settings;
 const title=String(s.heroTitle||'Sabor que conquista.').trim().split(/\s+/);$('#heroTitle').innerHTML=`${escape(title.slice(0,2).join(' '))} <em>${escape(title.slice(2).join(' '))}</em>`;
 $('#heroSubtitle').textContent=s.heroSubtitle||'';$('#announcement').textContent=s.announcement||'SABORES DA FRAN';$('#storyTagline').textContent=s.tagline||'';
 if(s.logoUrl)for(const target of ['#headerLogo','#heroLogo','#storyLogo','#footerLogo'])$(target).src=s.logoUrl;
 $('#demoWarning').hidden=!s.demoMode;$('#hoursText').textContent=s.openingHours||'Consulte pelo WhatsApp';
 $('#addressInfo').hidden=!s.address;if(s.address)$('#addressText').textContent=s.address;
 $('#instagramLink').hidden=!/^https:\/\//.test(s.instagram||'');if(s.instagram)$('#instagramLink').href=s.instagram;
 const lat=Number(s.mapLat??-6.5395278),lng=Number(s.mapLng??-49.8771111);
 if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){
   const coords=`${lat.toFixed(7)},${lng.toFixed(7)}`;
   const maps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
   $('#mapLink').href=maps;$('#mapLink').hidden=false;$('#locationRoute').href=maps;
   $('#locationMap').src=`https://maps.google.com/maps?q=${encodeURIComponent(coords)}&z=16&output=embed`;
 }else{
   const has=/^https:\/\//.test(s.mapUrl||'');$('#mapLink').hidden=!has;
   if(has){$('#mapLink').href=s.mapUrl;$('#locationRoute').href=s.mapUrl;}
 }
 const videos=[
   {title:s.videoTitle||'Conheça a nossa cozinha',description:s.videoDescription||'',html:videoEmbed(s.videoUrl)},
   {title:s.videoTitle2||'Mais um vídeo da casa',description:s.videoDescription2||'',html:videoEmbed(s.videoUrl2)}
 ].filter(v=>v.html);
 $('#videoSection').hidden=!videos.length;
 if(videos.length){$('#videoGallery').innerHTML=videos.map(v=>`<article class="video-card"><div class="video-copy"><h3>${escape(v.title)}</h3>${v.description?`<p>${escape(v.description)}</p>`:''}</div><div class="video-frame">${v.html}</div></article>`).join('');}
}
function checkoutDetails(){const type=$('input[name="type"]:checked')?.value||'pickup';const fee=type==='delivery'?state.settings.deliveryFee:0;const sub=subtotal();$('#deliveryFields').hidden=type!=='delivery';$('#customerAddress').required=type==='delivery';$('#customerReference').required=type==='delivery';
 $('#checkoutItemsCount').textContent=`${count()} ${count()===1?'item':'itens'}`;$('#checkoutTotal').textContent=money(sub);$('#checkoutPriceDetails').innerHTML=`<div><span>Subtotal</span><b>${money(sub)}</b></div>${type==='delivery'?`<div><span>Taxa de entrega</span><b>${fee===null||fee===undefined?'A confirmar':money(fee)}</b></div>`:''}<div><span>${type==='delivery'&&(fee===null||fee===undefined)?'Total parcial':'Total estimado'}</span><b>${money(sub+(typeof fee==='number'?fee:0))}</b></div>`;
}
function openCheckout(){if(!count()){toast('Adicione produtos antes de continuar.');return;}closeCart();$('#checkoutOverlay').hidden=false;document.body.classList.add('modal-open');checkoutDetails();$('#customerName').focus();}
function closeCheckout(){$('#checkoutOverlay').hidden=true;document.body.classList.remove('modal-open');}
async function sendOrder(e){e.preventDefault();if(!count())return;
 const phone=$('#customerPhone').value.replace(/\D/g,'');if(phone.length<10||phone.length>15){toast('Informe um número de WhatsApp válido com DDD.');$('#customerPhone').focus();return;}
 const btn=$('#submitOrder');btn.disabled=true;btn.textContent='Preparando seu pedido...';
 const data=Object.fromEntries(new FormData(e.target).entries());data.notifyOptIn=$('#notifyOptIn').checked;data.items=items().map(x=>({id:x.product.id,quantity:x.quantity,selections:x.selections}));
 try{
  const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const json=await response.json();if(!response.ok)throw new Error(json.error||'Não foi possível gerar seu pedido.');
  state.cart=[];saveCart();renderCart();toast(`Pedido ${json.orderId} pronto! Finalize o envio no WhatsApp.`);
  window.location.assign(json.whatsappUrl);
 }catch(err){toast(err.message);}finally{btn.disabled=false;btn.innerHTML='Abrir WhatsApp com meu pedido <span>↗</span>';}
}
async function init(){
 $('#year').textContent=new Date().getFullYear();
 try{const response=await fetch('/api/site');if(!response.ok)throw new Error('Não foi possível carregar o cardápio.');const data=await response.json();state.settings=data.settings||{};state.products=data.products||[];state.promos=data.promos||[];
 const ids=new Set(state.products.map(p=>p.id));state.cart=state.cart.filter(x=>ids.has(x.id)&&priceSelection(state.products.find(p=>p.id===x.id),x.selections||[],true));saveCart();renderSettings();renderMenu();renderPromos();renderCart();
 }catch(err){toast(err.message);$('#productGrid').innerHTML='<div class="empty-state">Cardápio indisponível no momento. Tente novamente mais tarde.</div>';}
}
 $('#categoryTabs').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;state.category=button.dataset.category;renderMenu();});
 $('#productGrid').addEventListener('click',e=>{const button=e.target.closest('[data-add]');if(!button)return;const product=state.products.find(p=>p.id===button.dataset.add);if(!product)return;if(product.optionGroups?.length)openConfigurator(product);else addConfigured(product,[],1);});
 $('#cartItems').addEventListener('click',e=>{const inc=e.target.closest('[data-plus]');const dec=e.target.closest('[data-minus]');const rem=e.target.closest('[data-remove]');if(inc)setCart(Number(inc.dataset.plus),state.cart[Number(inc.dataset.plus)].quantity+1);if(dec)setCart(Number(dec.dataset.minus),state.cart[Number(dec.dataset.minus)].quantity-1);if(rem)setCart(Number(rem.dataset.remove),0);if(e.target.closest('#shopNow')){closeCart();location.hash='cardapio';}});
 $('#configGroups').addEventListener('change',refreshConfigPrice);$('#configQuantity').addEventListener('input',refreshConfigPrice);$('#configForm').addEventListener('submit',finishConfigurator);$('#closeConfig').addEventListener('click',closeConfigurator);$('#configOverlay').addEventListener('click',e=>{if(e.target.id==='configOverlay')closeConfigurator();});
 $('#openCart').addEventListener('click',openCart);$('#closeCart').addEventListener('click',closeCart);$('#drawerOverlay').addEventListener('click',closeCart);
 $('#checkoutBtn').addEventListener('click',openCheckout);$('#closeCheckout').addEventListener('click',closeCheckout);$('#checkoutOverlay').addEventListener('click',e=>{if(e.target.id==='checkoutOverlay')closeCheckout();});
 document.querySelectorAll('input[name="type"]').forEach(input=>input.addEventListener('change',checkoutDetails));$('#checkoutForm').addEventListener('submit',sendOrder);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#configOverlay').hidden)closeConfigurator();else if(!$('#checkoutOverlay').hidden)closeCheckout();else if($('#cartDrawer').classList.contains('open'))closeCart();}});
 $('#mobileMenuBtn').addEventListener('click',()=>{const n=$('#mobileNav');n.classList.toggle('open');$('#mobileMenuBtn').setAttribute('aria-expanded',n.classList.contains('open'));});$('#mobileNav').addEventListener('click',e=>{if(e.target.closest('a')){$('#mobileNav').classList.remove('open');$('#mobileMenuBtn').setAttribute('aria-expanded','false');}});
 document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&e.target.closest('.product-image,.cart-row-photo')){const wrap=e.target.parentElement;e.target.remove();if(!wrap.querySelector('.image-fallback')){const span=document.createElement('span');span.className='image-fallback';span.textContent='🍔';wrap.appendChild(span);}}},true);
 init();
})();
