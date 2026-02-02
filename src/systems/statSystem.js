import { clamp } from "../util/format.js";
import { GAME } from "../config/constants.js";
import { modifyStatsByStatuses, hasStatus } from "./statusSystem.js";

export function computePlayerStats(state){
  const cls = state.data.classesById[state.player.class_id];

  const base = {
    hp: cls.hp_base,
    mp: cls.mp_base,
    atq: cls.atq_base,
    def: cls.def_base,
    eva: cls.eva_pp,
    crit: cls.crit_pp,
  };

  // bônus permanentes da run (skills / evolução)
  const perm = state.player.permBonuses;
  base.hp += perm.hp;
  base.mp += perm.mp;
  base.atq += perm.atq;
  base.def += perm.def;
  base.eva += perm.eva;
  base.crit += perm.crit;

  // equipamentos
  const inv = state.inventory;
  for(const slot of ["weapon","armor","artifact"]){
    const id = inv.equipment[slot];
    if(!id) continue;
    const it = state.data.itemsById[id];
    if(!it) continue;
    base.hp += (it.stat_hp ?? 0);
    base.mp += (it.stat_mp ?? 0);
    base.atq += (it.stat_atq ?? 0);
    base.def += (it.stat_def ?? 0);
    base.eva += (it.stat_eva_pp ?? 0);
    base.crit += (it.stat_crit_pp ?? 0);
  }

  // passivos de artefatos
  const artId = inv.equipment.artifact;
  if(artId){
    const art = state.data.itemsById[artId];
    if(art?.name === "Ampulheta Curta"){
      // cooldown mod é tratado no skill system
    }
    if(art?.name === "Orbe do conhecimento"){
      base.mp += 5;
    }
    if(art?.name === "Emblema da Vingança"){
      // +30% ATQ enquanto HP atual < 40% do máximo
      // aplicado como status temporário aqui (em stats)
      // (evita precisar criar status)
      if(state.player.hp / Math.max(1, state.player.maxHp) < 0.4){
        base.atq *= 1.30;
      }
    }
    if(art?.name === "Colar da Sexta Força"){
      base.hp += 6; base.mp += 6; base.atq += 6; base.def += 6;
      base.eva += 6; base.crit += 6;
    }
  }

  // status
  const stats = { atq: base.atq, def: base.def, eva: base.eva, crit: base.crit };
  // outgoing mult é usado por bosses também; colocamos default aqui
  state.player.outgoingDmgMult = 1;
  const extra = modifyStatsByStatuses(state.player, stats);

  const maxHp = Math.max(1, Math.floor(base.hp));
  const maxMp = Math.max(0, Math.floor(base.mp));

  const eva = clamp(stats.eva, 0, GAME.EVA_CAP_PP);
  const crit = clamp(stats.crit, 0, GAME.CRIT_CAP_PP);

  return {
    maxHp, maxMp,
    atq: stats.atq,
    def: stats.def,
    eva,
    crit,
    healReceivedMult: extra.healReceivedMult,
  };
}

export function computeBossStats(state){
  const boss = state.battle.boss;
  const bd = state.data.bossesById[boss.boss_id];
  const base = {
    hp: bd.hp_base,
    atq: bd.atq_base,
    def: bd.def_base,
  };

  // bônus permanentes de fase / adaptações
  base.atq *= (1 + boss.permAtqPct/100);
  base.def *= (1 + boss.permDefPct/100);
  base.def += boss.permDefFlat;

  // status
  const stats = { atq: base.atq, def: base.def, eva: 0, crit: 0 };
  boss.outgoingDmgMult = 1;
  modifyStatsByStatuses(boss, stats);

  const maxHp = Math.max(1, Math.floor(base.hp));
  return {
    maxHp,
    atq: stats.atq,
    def: stats.def,
    healReceivedMult: 1,
  };
}
