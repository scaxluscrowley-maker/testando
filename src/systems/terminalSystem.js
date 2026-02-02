import { GAME } from "../config/constants.js";
import { normalizeCode, codeToB64 } from "../util/crypto_b64.js";

export class TerminalSystem{
  constructor({ codesB64, itemsById, inventory, log }){
    this.codesB64 = codesB64;     // { base64(code_norm): item_id }
    this.itemsById = itemsById;   // { item_id: item }
    this.inventory = inventory;
    this.log = log;

    this.prepTriesLeft = GAME.MAX_TRIES_PER_BOSS;              // 7
    this.battleTriesLeft = GAME.MAX_BATTLE_CONSUMABLE_CODES;   // 3
    this.usedB64ThisBoss = new Set();                          // sem repetir (prep + combate)
  }

  resetForNewBoss(){
    this.prepTriesLeft = GAME.MAX_TRIES_PER_BOSS;
    this.battleTriesLeft = GAME.MAX_BATTLE_CONSUMABLE_CODES;
    this.usedB64ThisBoss.clear();
  }

  resetBattleSlots(){
    this.battleTriesLeft = GAME.MAX_BATTLE_CONSUMABLE_CODES;
  }

  _consumePrep(){
    this.prepTriesLeft -= 1;
    return this.prepTriesLeft;
  }

  _consumeBattle(){
    this.battleTriesLeft -= 1;
    return this.battleTriesLeft;
  }

  _validateAndResolve(rawInput, mode){
const raw = String(rawInput ?? "").trim();

// consumo de tentativas / slots acontece mesmo para entrada inválida ou repetida
if(mode === "prep"){
  if(this.prepTriesLeft <= 0) return { ok:false, reason:"no_tries" };
  this._consumePrep();
}else{
  if(this.battleTriesLeft <= 0) return { ok:false, reason:"no_tries" };
  this._consumeBattle();
}

if(!raw) return { ok:false, reason:"empty" };

// 1) tenta interpretar entrada como BASE64 direto (preferência do projeto)
//    mantém case (base64 é case-sensitive), só remove espaços internos
let b64 = raw.replace(/\s+/g, "");
let itemId = this.codesB64[b64];

// 2) fallback de compatibilidade: entrada como "código bruto" (ex: 28e) -> converte para base64 e busca
if(!itemId){
  const norm = normalizeCode(rawInput);
  b64 = codeToB64(norm);
  itemId = this.codesB64[b64];
}

if(this.usedB64ThisBoss.has(b64)){
  return { ok:false, reason:"repeat_boss" };
}
this.usedB64ThisBoss.add(b64);

if(!itemId) return { ok:false, reason:"invalid" };

const item = this.itemsById[itemId];
if(!item) return { ok:false, reason:"missing_item" };

return { ok:true, item };


    return { ok:true, item };
  }

  submit(rawInput){
    // Pré-luta: aceita qualquer categoria (equipamentos, evolução, consumíveis)
    const r = this._validateAndResolve(rawInput, "prep");

    if(!r.ok){
      const left = this.prepTriesLeft;
      const max = GAME.MAX_TRIES_PER_BOSS;
      const msg =
        r.reason === "no_tries" ? "Tentativas do Terminal esgotadas (pré-luta)." :
        r.reason === "empty" ? `Entrada vazia. Tentativas: ${left}/${max}` :
        r.reason === "repeat_boss" ? `Código repetido (boss atual). Tentativas: ${left}/${max}` :
        r.reason === "invalid" ? `Código inválido. Tentativas: ${left}/${max}` :
        `Falha no terminal: ${r.reason}.`;
      this.log.push(msg, "err");
      return r;
    }

    const item = r.item;

    if(item.slot === "evolution"){
      this.log.push(`Evolução carregada: ${item.name}. (será aplicada ao iniciar a batalha)`, "ok");
      return { ok:true, kind:"evolution", itemId: item.item_id, item };
    }

    if(item.slot === "weapon" || item.slot === "armor" || item.slot === "artifact"){
      const prev = this.inventory.equip(item);
      if(prev && prev !== item.item_id){
        this.log.push(`Equipado: ${item.name} (substituiu ${prev}).`, "ok");
      }else{
        this.log.push(`Equipado: ${item.name}.`, "ok");
      }
      return { ok:true, kind:"equip", slot:item.slot, itemId: item.item_id, item, prev };
    }

    // Consumível
    const add = this.inventory.addConsumable(item);
    if(!add.ok){
      this.log.push(`Consumível já no inventário: ${item.name}.`, "err");
      return { ok:false, reason:"duplicate_consumable" };
    }
    if(add.replaced){
      this.log.push(`Consumível adicionado: ${item.name} (substituiu ${add.replaced}).`, "ok");
    }else{
      this.log.push(`Consumível adicionado: ${item.name}.`, "ok");
    }
    return { ok:true, kind:"consumable", itemId: item.item_id, item, replaced:add.replaced };
  }

  submitConsumable(rawInput){
    // Durante a luta: aceita SOMENTE consumíveis (e ainda não pode repetir código do boss)
    const r = this._validateAndResolve(rawInput, "battle");

    if(!r.ok){
      const left = this.battleTriesLeft;
      const max = GAME.MAX_BATTLE_CONSUMABLE_CODES;
      const msg =
        r.reason === "no_tries" ? "Slots do Terminal esgotados (combate)." :
        r.reason === "empty" ? `Entrada vazia. Slots: ${left}/${max}` :
        r.reason === "repeat_boss" ? `Código repetido (boss atual). Slots: ${left}/${max}` :
        r.reason === "invalid" ? `Código inválido. Slots: ${left}/${max}` :
        `Falha no terminal: ${r.reason}.`;
      this.log.push(msg, "err");
      return r;
    }

    const item = r.item;

    if(!item.is_consumable && item.slot !== "consumable"){
      this.log.push(`Código válido, mas em combate o Terminal aceita apenas CONSUMÍVEIS.`, "err");
      return { ok:false, reason:"not_consumable" };
    }

    const add = this.inventory.addConsumable(item);
    if(!add.ok){
      this.log.push(`Consumível já no inventário: ${item.name}.`, "err");
      return { ok:false, reason:"duplicate_consumable" };
    }
    if(add.replaced){
      this.log.push(`Consumível adicionado: ${item.name} (substituiu ${add.replaced}).`, "ok");
    }else{
      this.log.push(`Consumível adicionado: ${item.name}.`, "ok");
    }
    return { ok:true, kind:"consumable", itemId: item.item_id, item, replaced:add.replaced };
  }
}
