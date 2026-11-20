'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const load=Module._load;
process.env.DB_HOST='mock';process.env.DB_USER='mock';process.env.DB_NAME='mock';
const group={id:'s',name:'Tamanho',type:'single',required:true,maxChoices:1,choices:[
 {id:'p',name:'Padrão',extraPrice:0},{id:'g',name:'Grande',extraPrice:8.5}]};
let rolledBack=false,committed=false;
const executed=[];
const conn={
 async beginTransaction(){},async commit(){committed=true;},async rollback(){rolledBack=true;},release(){},
 async query(sql){
  if(sql.includes('LEFT JOIN product_option_groups'))return [[{id:'pizza-test',name:'Pizza da Fran',category:'Pizzas',description:'',price:'35.00',image:'',available:1,featured:1,sort_order:1,option_groups_json:JSON.stringify([group])}]];
  if(sql.includes('FROM site_settings'))return [[{payload:JSON.stringify({businessName:'Sabores da Fran',deliveryFee:0,whatsappNumber:'5594999999999'})}]];
  throw Error('Unexpected SELECT '+sql);
 },
 async execute(sql,values){executed.push({sql,values});if(sql.includes('INSERT INTO orders'))return [{insertId:7}];if(sql.includes('INSERT INTO order_items'))return [{insertId:90}];return [{insertId:1}];}
};
const pool={getConnection:async()=>conn};
Module._load=function(request,parent,isMain){if(request==='mysql2/promise')return {createPool:()=>pool};return load.call(this,request,parent,isMain);};
const db=require('../lib/database');
(async()=>{
 const input={id:'pizza-test',quantity:2,selections:[{groupId:'s',choiceIds:['g']}]};
 const result=await db.createOrder({customer:'Teste',phone:'94999999999',type:'pickup',address:'',reference:'',payment:'Pix',note:'',notifyOptIn:true},[input]);
 assert.equal(result.subtotal,87);assert.equal(result.total,87);assert.equal(result.items[0].price,43.5);
 assert.equal(result.items[0].total,87);assert.equal(result.items[0].options[0].choices[0].name,'Grande');
 const orderItem=executed.find(x=>x.sql.includes('INSERT INTO order_items'));
 assert.equal(orderItem.values[4],2);assert.equal(orderItem.values[5],87);
 assert.ok(executed.some(x=>x.sql.includes('INSERT INTO order_item_customizations')));
 assert.ok(committed);assert.equal(rolledBack,false);
 await assert.rejects(db.createOrder({customer:'Teste',phone:'94999999999',type:'pickup'},[{id:'pizza-test',quantity:1,selections:[{groupId:'s',choiceIds:['falso']}]}]),/não está mais disponível/);
 assert.ok(rolledBack);
 console.log('PASS: preço validado pelo servidor, quantidade 2, opções salvas, total correto e rejeição de ID falso');
})().catch(e=>{console.error(e);process.exitCode=1});
