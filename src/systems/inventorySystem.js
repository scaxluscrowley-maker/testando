import { GAME } from "../config/constants.js";

export class InventorySystem{
  constructor(){
    this.equipment = { weapon:null, armor:null, artifact:null };
    this.consumables = []; // array de item_id (únicos)
  }

  equip(item){
    const slot = item.slot; // weapon/armor/artifact
    const prev = this.equipment[slot];
    this.equipment[slot] = item.item_id;
    return prev;
  }

  addConsumable(item){
    const id = item.item_id;
    if(this.consumables.includes(id)) return { ok:false, reason:"duplicate" };
    if(this.consumables.length >= GAME.MAX_CONSUMABLES){
      const removed = this.consumables.shift();
      this.consumables.push(id);
      return { ok:true, replaced: removed };
    }
    this.consumables.push(id);
    return { ok:true, replaced:null };
  }

  removeConsumable(itemId){
    const i = this.consumables.indexOf(itemId);
    if(i === -1) return false;
    this.consumables.splice(i, 1);
    return true;
  }

  destroyRandomConsumable(rng){
    if(this.consumables.length === 0) return null;
    const idx = Math.floor(rng.next()*this.consumables.length);
    const id = this.consumables[idx];
    this.consumables.splice(idx, 1);
    return id;
  }

  destroyRandomEquipment(rng){
    const slots = Object.keys(this.equipment).filter(s => this.equipment[s]);
    if(slots.length === 0) return null;
    const slot = slots[Math.floor(rng.next()*slots.length)];
    const id = this.equipment[slot];
    this.equipment[slot] = null;
    return { slot, id };
  }
}
