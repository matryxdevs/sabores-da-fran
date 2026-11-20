'use strict';
// API OFICIAL META. Apenas após opt-in e com modelo de utilidade aprovado.
const config = () => ({
 enabled: Boolean(process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID && process.env.WA_TEMPLATE_NAME),
 template:process.env.WA_TEMPLATE_NAME||'',
 language:process.env.WA_TEMPLATE_LANG||'pt_BR'
});
function toE164(value){const digits=String(value||'').replace(/\D/g,'');const full=(digits.length===10||digits.length===11)?`55${digits}`:digits;return /^\d{12,15}$/.test(full)?full:'';}
async function sendStatus({id,customer,phone,status,notifyOptIn}) {
 if(!notifyOptIn)return {status:'skipped',details:'Cliente não autorizou avisos automáticos.'};
 const {enabled,template,language}=config();
 if(!enabled)return {status:'skipped',details:'Configure WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID e WA_TEMPLATE_NAME na hospedagem.'};
 const recipient=toE164(phone);
 if(!recipient)return {status:'failed',details:'Telefone do cliente inválido para envio via API.'};
 const version=(process.env.WA_GRAPH_VERSION||'v27.0');
 if(!/^v\d+\.0$/.test(version))return {status:'failed',details:'WA_GRAPH_VERSION inválida.'};
 const request={messaging_product:'whatsapp',recipient_type:'individual',to:recipient,type:'template',
   template:{name:template,language:{code:language},components:[{type:'body',parameters:[
      {type:'text',text:String(customer).slice(0,80)},
      {type:'text',text:String(id).slice(0,30)},
      {type:'text',text:String(status).slice(0,50)}
   ]}]}};
 try{
  const res=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(process.env.WA_PHONE_NUMBER_ID)}/messages`,{
    method:'POST',headers:{'Authorization':`Bearer ${process.env.WA_ACCESS_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify(request),signal:AbortSignal.timeout(12000)});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)return {status:'failed',details:`Meta HTTP ${res.status}: ${String(body?.error?.message||'Verifique template, permissões e destinatário').slice(0,270)}`};
  return {status:'accepted',messageId:String(body?.messages?.[0]?.id||''),details:'Solicitação aceita pela API Meta; entrega não confirmada.'};
 }catch(err){return {status:'failed',details:`Conexão com Meta: ${String(err.message).slice(0,260)}`};}
}
module.exports={sendStatus,config};
