'use strict';

const moneyRound = n => Math.round((n + Number.EPSILON) * 100) / 100;
const validId = value => typeof value === 'string' && /^[\w-]{1,60}$/.test(value);
const failure = message => { const err = new Error(message); err.validation = true; return err; };
const text = (value, max) => String(value ?? '').trim().slice(0, max);

function normalizeGroups(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 12) throw failure('Limite de 12 grupos de opções por produto.');
  const seenGroups = new Set();
  return value.map(group => {
    if (!group || typeof group !== 'object' || !validId(group.id) || seenGroups.has(group.id)) throw failure('Identificador de grupo de opções inválido ou repetido.');
    seenGroups.add(group.id);
    const name = text(group.name, 65);
    if (!name) throw failure('Informe o nome de cada grupo de opções.');
    const type = group.type === 'multiple' ? 'multiple' : group.type === 'single' ? 'single' : null;
    if (!type) throw failure(`Tipo de escolha inválido no grupo ${name}.`);
    const required = group.required === true;
    if (!Array.isArray(group.choices) || !group.choices.length || group.choices.length > 25) throw failure(`Cadastre de 1 a 25 opções no grupo ${name}.`);
    const maxChoices = type === 'single' ? 1 : Number(group.maxChoices ?? 3);
    if (!Number.isInteger(maxChoices) || maxChoices < 1 || maxChoices > group.choices.length || maxChoices > 12) throw failure(`Limite de escolhas inválido no grupo ${name}.`);
    const seenChoices = new Set();
    const choices = group.choices.map(choice => {
      if (!choice || !validId(choice.id) || seenChoices.has(choice.id)) throw failure(`Identificador de opção inválido ou repetido em ${name}.`);
      seenChoices.add(choice.id);
      const label = text(choice.name, 65);
      if (!label) throw failure(`Preencha o nome das opções do grupo ${name}.`);
      const extraPrice = Number(choice.extraPrice);
      if (choice.extraPrice === '' || choice.extraPrice === null || !Number.isFinite(extraPrice) || extraPrice < 0 || extraPrice > 5000) throw failure(`Preço adicional inválido para ${label}.`);
      return {id:choice.id, name:label, extraPrice:moneyRound(extraPrice)};
    });
    return {id:group.id, name, type, required, maxChoices, choices};
  });
}

function selectedOptions(groups, raw) {
  if (raw === undefined || raw === null) raw = [];
  if (!Array.isArray(raw) || raw.length > groups.length) throw failure('As opções selecionadas são inválidas.');
  const selected = new Map();
  for (const row of raw) {
    if (!row || !validId(row.groupId) || selected.has(row.groupId) || !Array.isArray(row.choiceIds)) throw failure('Opções de produto repetidas ou inválidas.');
    selected.set(row.groupId, row.choiceIds);
  }
  for (const id of selected.keys()) if (!groups.some(group => group.id === id)) throw failure('Uma das opções escolhidas não existe mais neste produto.');
  let extraPrice = 0;
  const details = [];
  for (const group of groups) {
    const ids = selected.get(group.id) || [];
    if (group.required && !ids.length) throw failure(`Escolha uma opção de ${group.name}.`);
    if (ids.length > (group.type === 'single' ? 1 : group.maxChoices)) throw failure(`Muitas opções selecionadas em ${group.name}.`);
    if (new Set(ids).size !== ids.length) throw failure(`Opções repetidas em ${group.name}.`);
    if (!ids.length) continue;
    const chosen = ids.map(id => {
      const option = group.choices.find(choice => choice.id === id);
      if (!option) throw failure(`Uma opção de ${group.name} não está mais disponível.`);
      extraPrice = moneyRound(extraPrice + option.extraPrice);
      return {id:option.id,name:option.name,extraPrice:option.extraPrice};
    });
    details.push({groupId:group.id, groupName:group.name, choices:chosen});
  }
  return {extraPrice, details};
}
module.exports = {normalizeGroups, selectedOptions, moneyRound};
