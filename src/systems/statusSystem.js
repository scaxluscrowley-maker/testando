import { roundHalfUp } from "../util/format.js";

const DEBUFF_HINTS = [
  "DOT_", "BLEED", "POISON", "BURN", "LOCK", "DOWN", "VULN", "EXPOSE"
];

function isDebuffId(id){
  if(!id) return false;
  const u = String(id).toUpperCase();
  return DEBUFF_HINTS.some(h => u.includes(h));
}

export function makeStatus(id, duration, data={}, opts=null){
  const s = { id, duration, data };
  if(opts && typeof opts === "object" && opts.delay != null) s.delay = Math.max(0, opts.delay|0);
  return s;
}

export function hasStatus(actor, id){
  return actor.statuses.some(s => s.id === id && (s.delay == null || s.delay <= 0));
}

export function getStatus(actor, id){
  return actor.statuses.find(s => s.id === id && (s.delay == null || s.delay <= 0)) ?? null;
}

export function addStatus(actor, status, log, label, vfx){
  // regras de stack simples: se já existe, reseta duração (para DOT) ou acumula campos se necessário
  const existing = actor.statuses.find(s => s.id === status.id);
  if(existing){
    existing.duration = status.duration;
    existing.data = { ...existing.data, ...status.data };
    log?.push(`${label}: status renovado ${status.id} (${status.duration})`, "info");
    vfx?.emit(isDebuffId(status.id) ? "debuff" : "buff", { target: actor.isBoss ? "boss" : "player" });
    return;
  }
  actor.statuses.push(status);
  log?.push(`${label}: status aplicado ${status.id} (${status.duration})`, "info");
  vfx?.emit(isDebuffId(status.id) ? "debuff" : "buff", { target: actor.isBoss ? "boss" : "player" });
}

export function removeStatus(actor, id){
  const i = actor.statuses.findIndex(s => s.id === id);
  if(i>=0) actor.statuses.splice(i, 1);
}

export function removeNegativeStatuses(actor){
  const negative = new Set(["BLEED","BURN","POISON","ATQ_DOWN","DEF_DOWN","SILENCE","SILENCE_BOSS"]);
  actor.statuses = actor.statuses.filter(s => !negative.has(s.id));
}

export function endRoundTick(actor, ctx){
  // DOTs + regen + efeitos por rodada
  const { log, whoLabel, vfx, runStats } = ctx;

  let dotTotal = 0;
  for(const s of actor.statuses){
    if(s.delay != null && s.delay > 0) continue;
    if(s.id === "BLEED"){
      dotTotal += actor.maxHp * 0.03;
    }else if(s.id === "BURN" || s.id === "POISON"){
      dotTotal += actor.maxHp * 0.02;
    }else if(s.id === "YAMACH_LEAK"){
      dotTotal += 5;
    }else if(s.id === "VAL_REGEN"){
      // regen 50 (boss) no fim da rodada
      const heal = 50;
      actor.hp = Math.min(actor.maxHp, actor.hp + heal);
      log.push(`${whoLabel} regenera ${heal} HP.`, "info");
      vfx?.emit("float", { target: actor.isBoss ? "boss" : "player", text: `+${heal}`, kind:"heal" });
    }
  }
  if(dotTotal > 0){
    const dmg = roundHalfUp(dotTotal);
    actor.hp = Math.max(0, actor.hp - dmg);

    // estatísticas (DoT conta como dano causado/recebido)
    if(runStats){
      if(actor.isBoss) runStats.damageDealt += dmg;
      else if(actor.isPlayer) runStats.damageTaken += dmg;
    }

    log.push(`${whoLabel} sofre ${dmg} de DoT.`, "info");
    vfx?.emit("float", { target: actor.isBoss ? "boss" : "player", text: `-${dmg}`, kind:"dot" });
  }

  // decrementa durações
  for(const s of actor.statuses){
    if(s.delay != null && s.delay > 0) continue;
    if(s.duration == null) continue;
    s.duration -= 1;
  }
  // remove expirados
  const before = actor.statuses.length;
  actor.statuses = actor.statuses.filter(s => s.duration == null || s.duration > 0);
  const removed = before - actor.statuses.length;
  if(removed > 0){
    log.push(`${whoLabel}: ${removed} status expiraram.`, "info");
  }
}

export function modifyStatsByStatuses(actor, stats){
  // stats: {hp, mp, atq, def, eva, crit}
  let atqPct = 0, defPct = 0, evaPp = 0, critPp = 0;
  let healReceivedMult = 1;

  for(const s of actor.statuses){
    if(s.delay != null && s.delay > 0) continue;
    if(s.id === "BLEED") defPct -= 10;
    if(s.id === "BURN") atqPct -= 10;
    if(s.id === "POISON") healReceivedMult *= 0.5;

    if(s.id === "ATQ_UP" || s.id === "ATQ_UP_NEXT") atqPct += (s.data.pp ?? 0);
    if(s.id === "DEF_UP" || s.id === "DEF_UP_NEXT") defPct += (s.data.pp ?? 0);
    if(s.id === "ATQ_DOWN" || s.id === "ATQ_DOWN_NEXT") atqPct -= (s.data.pp ?? 0);
    if(s.id === "DEF_DOWN" || s.id === "DEF_DOWN_NEXT") defPct -= (s.data.pp ?? 0);

    if(s.id === "EVA_UP" || s.id === "EVA_UP_NEXT") evaPp += (s.data.pp ?? 0);
    if(s.id === "CRIT_UP" || s.id === "CRIT_UP_NEXT") critPp += (s.data.pp ?? 0);
    if(s.id === "BOSS_DMG_DOWN") actor.outgoingDmgMult *= (1 - (s.data.pp ?? 0)/100);
    if(s.id === "DEFEND") defPct += 50;
  }

  stats.atq *= (1 + atqPct/100);
  stats.def *= (1 + defPct/100);
  stats.eva += evaPp;
  stats.crit += critPp;

  return { healReceivedMult };
}
