'use strict';
const assert = require('node:assert/strict');
const {normalizeGroups,selectedOptions,moneyRound}=require('../lib/options');
const groups=normalizeGroups([
 {id:'size',name:'Tamanho',type:'single',required:true,maxChoices:1,choices:[
  {id:'small',name:'Pequeno',extraPrice:0},{id:'large',name:'Grande',extraPrice:10}]},
 {id:'edge',name:'Borda',type:'single',required:false,maxChoices:1,choices:[
  {id:'none',name:'Sem borda',extraPrice:0},{id:'cheddar',name:'Cheddar',extraPrice:6.5}]},
 {id:'extras',name:'Adicionais',type:'multiple',required:false,maxChoices:2,choices:[
  {id:'bacon',name:'Bacon',extraPrice:4.25},{id:'egg',name:'Ovo',extraPrice:2},{id:'onion',name:'Cebola',extraPrice:1}]}]);
const selected=[
 {groupId:'size',choiceIds:['large']},
 {groupId:'edge',choiceIds:['cheddar']},
 {groupId:'extras',choiceIds:['bacon','egg']}];
const result=selectedOptions(groups,selected);
assert.equal(result.extraPrice,22.75);
assert.equal(moneyRound((24.9+result.extraPrice)*3),142.95);
assert.equal(result.details.length,3);
assert.equal(result.details[1].choices[0].name,'Cheddar');
const missing=[{groupId:'edge',choiceIds:['none']}];
assert.throws(()=>selectedOptions(groups,missing),/Escolha uma opção de Tamanho/);
assert.throws(()=>selectedOptions(groups,[{groupId:'size',choiceIds:['large','small']}]),/Muitas opções/);
assert.throws(()=>selectedOptions(groups,[{groupId:'size',choiceIds:['hacked']}]),/não está mais disponível/);
assert.throws(()=>selectedOptions(groups,[{groupId:'size',choiceIds:['large']},{groupId:'extras',choiceIds:['bacon','egg','onion']}]),/Muitas opções/);
assert.throws(()=>normalizeGroups([{...groups[0],choices:[{id:'small',name:'P',extraPrice:-1}]}]),/Preço adicional inválido/);
assert.throws(()=>normalizeGroups([{...groups[0],choices:[{id:'small',name:'P',extraPrice:5001}]}]),/Preço adicional inválido/);
console.log('PASS: escolha obrigatória, seleção única/múltipla, preços extras, limites, valores reprocessados e total com quantidade');
