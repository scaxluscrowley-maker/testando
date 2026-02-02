import { roundHalfUp, clamp } from "../util/format.js";
import { computePlayerStats, computeBossStats } from "./statSystem.js";
import { emitSkillVfx, emitBossBasicVfx } from "./vfxPresets.js";
import { addStatus, makeStatus, hasStatus, getStatus, removeStatus, endRoundTick, removeNegativeStatuses } from "./statusSystem.js";
import { effectiveCooldownForSkill, isMagicSkill, isOffensiveSkill } from "./skillSystem.js";
import { GAME } from "../config/constants.js";

function applyHealing(target, amount, log, label, vfx, runStats=null){
  const healMult = target.healReceivedMult ?? 1;
  const final = roundHalfUp(amount * healMult);
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + final);
  const healed = target.hp - before;

  if(runStats && target?.isPlayer){
    runStats.healDone += healed;
  }

  log.push(`${label} cura ${healed} HP.`, "ok");
  if(healed > 0){
    vfx?.emit("heal", { target: target.isBoss ? "boss" : "player" });
    vfx?.emit("float", { target: target.isBoss ? "boss" : "player", text: `+${healed}`, kind:"heal" });
  }
}

function applyMpGain(target, amount, log, label, vfx){
  const final = roundHalfUp(amount);
  const before = target.mp;
  target.mp = Math.min(target.maxMp, target.mp + final);
  const gained = target.mp - before;
  log.push(`${label} recupera ${gained} MP.`, "ok");
  if(gained > 0) vfx?.emit("buff", { target: target.isBoss ? "boss" : "player" });
}

function applyDamage({ attackerLabel, defenderLabel, attacker, defender, rawDamage, isTrue=false, log, vfx=null, isCrit=false, reflectable=true, source="dano direto", runStats=null }){
  // imunidade a próximo dano direto (boss)
  if(defender.isBoss && hasStatus(defender, "IMMUNE_NEXT_DIRECT") && reflectable){
    removeStatus(defender, "IMMUNE_NEXT_DIRECT");
    log.push(`${defenderLabel} bloqueia o dano (IMUNE).`, "info");
    vfx?.emit("buff", { target: defender.isBoss ? "boss" : "player" });
    return { final: 0, blocked:true };
  }

  // Smoke grenade: player tem escudo que anula dano direto do boss
  if(defender.isPlayer && attacker.isBoss && hasStatus(defender, "BOSS_DAMAGE_NULL")){
    // só anula se for dano direto; ainda permite debuffs (tratados fora)
    removeStatus(defender, "BOSS_DAMAGE_NULL");
    log.push(`${defenderLabel} anula o dano direto do boss (Granada de Fumaça).`, "info");
    vfx?.emit("buff", { target: defender.isBoss ? "boss" : "player" });
    return { final: 0, blocked:true };
  }

  let final = roundHalfUp(Math.max(0, rawDamage));
  // fluxo de dano->MP por 3 turnos
  if(defender.isPlayer && hasStatus(defender, "DMG_TO_MP") && final > 0){
    const mpAbsorb = Math.min(defender.mp, final);
    defender.mp -= mpAbsorb;
    final -= mpAbsorb;
    log.push(`${defenderLabel} absorve ${mpAbsorb} dano no MP.`, "info");
  }

  if(final > 0){
    defender.hp = Math.max(0, defender.hp - final);

    // estatísticas da run
    if(runStats){
      if(attacker?.isPlayer && defender?.isBoss) runStats.damageDealt += final;
      else if(attacker?.isBoss && defender?.isPlayer) runStats.damageTaken += final;
    }

    log.push(`${attackerLabel} causa ${final} em ${defenderLabel}.`, "info");
    const intensity = Math.min(3, 1 + final / 35);
    vfx?.emit(isCrit ? "crit" : "hit", { target: defender.isBoss ? "boss" : "player", intensity });
    // Floating combat text
    const tgt = defender.isBoss ? "boss" : "player";
    const txt = `-${final}` + (isTrue ? "!" : "");
    vfx?.emit("float", { target: tgt, text: txt, kind: isCrit ? "crit" : "dmg" });
  }else{
    log.push(`${attackerLabel} não causou dano em ${defenderLabel}.`, "info");
  }
  return { final, blocked:false };
}

function rollPlayerHit(state){
  // boss não esquiva; player esquiva (EVA)
  const eva = state.player.eva;
  if(eva <= 0) return true;
  // EVA evita danos e habilidades (exceto DoT já aplicado)
  return !state.rng.chance(eva);
}

function rollCrit(state){
  const c = state.player.crit;
  if(c <= 0) return false;
  return state.rng.chance(c);
}


function consumeFreeNextActive(player){
  const s = getStatus(player, "FREE_NEXT_ACTIVE");
  if(s){
    removeStatus(player, "FREE_NEXT_ACTIVE");
    return true;
  }
  return false;
}

function consumeIgnoreDefNextHit(player){
  const s = getStatus(player, "IGNORE_DEF_NEXT_HIT");
  if(s){
    removeStatus(player, "IGNORE_DEF_NEXT_HIT");
    return true;
  }
  return false;
}

function consumeDoubleNextActive(player){
  const s = getStatus(player, "DOUBLE_NEXT_ACTIVE");
  if(s){
    removeStatus(player, "DOUBLE_NEXT_ACTIVE");
    return true;
  }
  return false;
}

function applyRhythmIfExists(state, attackStats){
  // Pedra do Ritmo: +4 ATQ flat só para a ação, consome no próximo ataque ofensivo
  if(!state.player.rhythmReady) return;
  attackStats.atq += 4;
  state.player.rhythmReady = false;
  state.log.push("Ritmo consumido: +4 ATQ (só nesta ação).", "info");
}

function maybeGrantRhythm(state, usedSkill){
  const artId = state.inventory.equipment.artifact;
  const art = artId ? state.data.itemsById[artId] : null;
  if(!art || art.name !== "Pedra do Ritmo") return;
  // 1x por turno global (rodada)
  if(state.battle.rhythmGrantedThisRound) return;
  state.battle.rhythmGrantedThisRound = true;
  state.player.rhythmReady = true; // válido até consumir no próximo ataque ofensivo
  state.log.push("Pedra do Ritmo: Ritmo ativado (próximo ataque ofensivo consome).", "info");
}

function applySkillCooldown(state, skill){
  const eff = effectiveCooldownForSkill(state, skill.cooldown_turns ?? 0);
  if(eff > 0) state.player.cooldowns[skill.skill_id] = eff;
}

function decCooldowns(cdMap){
  for(const k of Object.keys(cdMap)){
    cdMap[k] -= 1;
    if(cdMap[k] <= 0) delete cdMap[k];
  }
}

function playerCanUseSkill(state, skill){
  if(state.player.lockedSkills.has(skill.skill_id)) return { ok:false, reason:"locked" };
  const cd = state.player.cooldowns[skill.skill_id] ?? 0;
  if(cd > 0) return { ok:false, reason:`cd:${cd}` };
  // silence
  if(hasStatus(state.player, "SILENCE") && String(skill.kind||"") === "Ativa"){
    // silencie bloqueia habilidades (ativas e suporte?) no GDD é "habilidades" em geral.
  }
  if(hasStatus(state.player, "SILENCE")){
    return { ok:false, reason:"silence" };
  }
  return { ok:true };
}

function mpCostForSkill(state, skill){
  let cost = skill.mp_cost ?? 0;
  // debuff: feitiços custam +25% Mana (só mágico)
  if(hasStatus(state.player, "SPELL_COST_UP") && String(skill.effect_text||"").includes("Dano mágico")){
    cost = cost * 1.25;
  }
  return roundHalfUp(cost);
}

function applyPlayerSkillEffect(state, skill){
  const log = state.log;
  const p = state.player;
  const b = state.battle.boss;

  // identifica se ofensiva
  const offensive = isOffensiveSkill(skill);
  // VFX único por habilidade (player)
  emitSkillVfx(state, skill, { source:"player", target: offensive ? "boss" : "player", phase: state.battle.boss.phase });



  // consome efeito de 2x dano na próxima ativa
  let damageMult = 1;
  if(offensive){
    if(consumeDoubleNextActive(p)){
      damageMult *= 2;
      log.push("Buff consumido: próxima habilidade ativa com 2x dano.", "info");
    }
  }

  // cálculo de stats atualizados
  state.recomputeStats();

  // copia stats pra esta ação (para aplicar ritmo)
  const pStats = { atq: p.atq, def: p.def, eva: p.eva, crit: p.crit };

  if(offensive) applyRhythmIfExists(state, pStats);

  // aplica por texto (24 casos)
  const t = String(skill.effect_text||"");

  // ---- Suportes / buffs
  if(t === "Remove 1 debuff aleatório do jogador."){
    const debuffs = p.statuses.filter(s => ["BLEED","BURN","POISON","ATQ_DOWN","DEF_DOWN","SILENCE"].includes(s.id));
    if(debuffs.length === 0){ log.push("Nenhum debuff para remover.", "info"); return; }
    const pick = state.rng.pick(debuffs);
    p.statuses = p.statuses.filter(s => s !== pick);
    log.push(`Debuff removido: ${pick.id}`, "ok");
    return;
  }
  if(t === "Restaura 20% do MP máximo do jogador."){
    applyMpGain(p, p.maxMp * 0.20, log, "Jogador", state.vfx);
    return;
  }
  if(t === "Ganha 30% de ATQ Total por 2 turnos."){
    addStatus(p, makeStatus("ATQ_UP", 3, { pp: 30 }), log, "Jogador", state.vfx);
    return;
  }
  if(t === "Aumenta a DEF total em 40% por 3 turnos."){
    addStatus(p, makeStatus("DEF_UP", 4, { pp: 40 }), log, "Jogador", state.vfx);
    return;
  }
  if(t === "No próximo turno ganha 15% de chance de crítico, 15% de ATQ Total e 15% de Evasão."){
    addStatus(p, makeStatus("ATQ_UP_NEXT", 1, { pp: 15 }, { delay: 1 }), log, "Jogador", state.vfx);
    addStatus(p, makeStatus("CRIT_UP_NEXT", 1, { pp: 15 }, { delay: 1 }), log, "Jogador", state.vfx);
    addStatus(p, makeStatus("EVA_UP_NEXT", 1, { pp: 15 }, { delay: 1 }), log, "Jogador", state.vfx);
    log.push("Bônus preparado: ativa no próximo turno.", "info");
    return;
  }
  if(t === "A próxima habilidade ativa causa 2x dano (consome o efeito após usar a habilidade ativa)."){
    addStatus(p, makeStatus("DOUBLE_NEXT_ACTIVE", null, {}), log, "Jogador", state.vfx);
    return;
  }
  if(t === "Por 3 turnos, 100% do dano recebido no turno vai para o MP. Excedente de dano passa para o HP."){
    addStatus(p, makeStatus("DMG_TO_MP", 4, {}), log, "Jogador", state.vfx);
    return;
  }

  // ---- Permanentes (run)
  if(t === "Ganha +10 de ATQ permanente e perde -15 de vida permanente."){
    p.permBonuses.atq += 10;
    p.permBonuses.hp -= 15;
    log.push("Bônus permanente aplicado: ATQ +10, HP máx -15.", "ok");
    state.recomputeStats(false);
    return;
  }
  if(t === "O jogador leva 20 de dano para ganhar 3% de crítico e evasão permanentes."){
    p.hp = Math.max(0, p.hp - 20);
    p.permBonuses.crit += 3;
    p.permBonuses.eva += 3;
    log.push("Bônus permanente: CRIT +3pp, EVA +3pp (custo 20 HP).", "ok");
    state.recomputeStats(false);
    return;
  }

  // ---- ofensivas físicas/mágicas
  function doAttack(rawDamage, { canCrit=true, applyDot=null, dotChancePp=0, applyDebuff=null, debuffChancePp=0, lifestealPct=0, ignoreDefIfPoison=false, guaranteedCritIfBleed=false }={}){
    // boss não esquiva
    let dmg = rawDamage;
    // ignora DEF no próximo dano direto
    if(consumeIgnoreDefNextHit(p)){
      dmg += b.def;
      log.push("Elixir do Caçador: ignorou DEF do boss.", "info");
    }
    // ignore DEF se boss envenenado (skill específica)
    if(ignoreDefIfPoison && hasStatus(b, "POISON")){
      dmg = rawDamage + b.def; // "ignora DEF": re-adiciona o que seria subtraído
    }

    // crit
    let isCrit = false;
    if(canCrit && p.canCrit && (guaranteedCritIfBleed && hasStatus(b, "BLEED"))){
      isCrit = true;
    }else if(canCrit && p.canCrit){
      isCrit = rollCrit(state);
    }
    if(isCrit) dmg *= 2;

    dmg *= damageMult;

    // aplica mult de dano do jogador (debuff/buff)
    dmg *= (p.outgoingDmgMult ?? 1);

    const dealt = applyDamage({ attackerLabel:"Jogador", defenderLabel:b.boss_name, attacker:p, defender:b, rawDamage:dmg, log, vfx: state.vfx, isCrit, reflectable:true , runStats: state.run.stats });
    if(dealt.final > 0 && lifestealPct > 0){
      applyHealing(p, dealt.final * lifestealPct, log, "Jogador", state.vfx, state.run.stats);
    }
    if(dealt.final > 0){
      if(applyDot && dotChancePp > 0 && state.rng.chance(dotChancePp)){
        addStatus(b, makeStatus(applyDot, 3, {}), log, b.boss_name, state.vfx);
      }
      if(applyDebuff && debuffChancePp > 0 && state.rng.chance(debuffChancePp)){
        addStatus(b, makeStatus(applyDebuff.id, applyDebuff.duration, applyDebuff.data), log, b.boss_name, state.vfx);
      }
    }
  }

  // suporte ofensivo que se auto aplica sangramento
  if(t === "Ganha 50% de ATQ total no próximo turno e também aplica em si mesmo o status de sangramento."){
    addStatus(p, makeStatus("ATQ_UP_NEXT", 1, { pp: 50 }, { delay: 1 }), log, "Jogador", state.vfx);
    addStatus(p, makeStatus("BLEED", 3, {}), log, "Jogador", state.vfx);
    log.push("Bônus preparado: ATQ +50% no próximo turno (custo: sangramento).", "info");
    return;
  }

  if(t === "Perde metade da vida atual para ganhar 100% de ATQ no próximo turno."){
    p.hp = Math.max(1, Math.floor(p.hp/2));
    addStatus(p, makeStatus("ATQ_UP_NEXT", 1, { pp: 100 }, { delay: 1 }), log, "Jogador", state.vfx);
    log.push("Bônus preparado: ATQ +100% no próximo turno.", "info");
    return;
  }

  // física (multiplos)
  if(t.startsWith("Dano físico = (ATQ_Total x 1.1)")){
    const raw = (pStats.atq * 1.1) - b.def;
    doAttack(raw, { canCrit:true, applyDot:"POISON", dotChancePp:40 });
    return;
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.2)")){
    const raw = (pStats.atq * 1.2) - b.def;
    // reduz DEF do boss em 25% por 2 turnos
    doAttack(raw, { canCrit:true, applyDebuff:{ id:"DEF_DOWN", duration:2, data:{ pp:25 } }, debuffChancePp:100 });
    return;
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.4)")){
    const raw = (pStats.atq * 1.4) - b.def;
    doAttack(raw, { canCrit:true, applyDot:"BLEED", dotChancePp:40 });
    return;
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.5)")){
    const raw = (pStats.atq * 1.5) - b.def;
    doAttack(raw, { canCrit:true, applyDot:"BURN", dotChancePp:10 });
    return;
  }
  if(t === "Dano físico = (ATQ_Total x 2.0) - DEF do alvo. 30% de chance de causar sangramento no BOSS."){
    const raw = (pStats.atq * 2.0) - b.def;
    doAttack(raw, { canCrit:true, applyDot:"BLEED", dotChancePp:30 });
    return;
  }
  if(t === "Dano físico = (ATQ_Total x 2.0) - DEF do alvo, Se o BOSS estiver envenenado, ignora a DEF total."){
    const raw = (pStats.atq * 2.0) - b.def;
    doAttack(raw, { canCrit:true, ignoreDefIfPoison:true });
    return;
  }
  if(t === "Dano físico = (ATQ_Total x 2.5) - DEF do alvo. Se o BOSS estiver sangrando, causa dano crítico garantido."){
    const raw = (pStats.atq * 2.5) - b.def;
    doAttack(raw, { canCrit:true, guaranteedCritIfBleed:true });
    return;
  }
  if(t === "Dano físico = (ATQ_Total x 3.5) - DEF do alvo."){
    const raw = (pStats.atq * 3.5) - b.def;
    doAttack(raw, { canCrit:true });
    return;
  }
  if(t === "Cura 30% do dano físico causado."){
    // lifesteal como skill de ataque básico x1.0
    const raw = (pStats.atq * 1.0) - b.def;
    doAttack(raw, { canCrit:true, lifestealPct:0.30 });
    return;
  }

  // mágicas
  if(t === "Dano mágico = (50 + 25% do MP máximo) - DEF do alvo."){
    const raw = (50 + p.maxMp * 0.25) - b.def;
    doAttack(raw, { canCrit:true });
    return;
  }
  if(t === "Dano mágico = (30 + 20% do MP máximo) - DEF do alvo. Tem uma chance de 70% de aplicar queimadura."){
    const raw = (30 + p.maxMp * 0.20) - b.def;
    doAttack(raw, { canCrit:true, applyDot:"BURN", dotChancePp:70 });
    return;
  }
  if(t === "Dano mágico = 0.8 x MP máximo - DEF do alvo."){
    const raw = (p.maxMp * 0.8) - b.def;
    doAttack(raw, { canCrit:true });
    return;
  }
  if(t === "Dano mágico = Mana atual x 2.2 (MP vai a 0 após usar) - DEF do alvo."){
    const raw = (p.mp * 2.2) - b.def;
    p.mp = 0;
    doAttack(raw, { canCrit:true });
    return;
  }

  log.push(`Skill sem handler: ${skill.skill_name}`, "err");
}

function applyBossSkillEffect(state, skill){
  const log = state.log;
  const p = state.player;
  const b = state.battle.boss;

  const t = String(skill.effect_text||"");

  // EVA do jogador evita danos e habilidades (exceto DoT já existente)
  const hit = rollPlayerHit(state);
  if(!hit){
    log.push(`${b.boss_name} errou (evasão).`, "info");
    return { dealtDamage:0 };
  }

  // helper damage
  function bossHit(mult){
    const raw = (b.atq * mult) - p.def;
    const dmg = raw * (b.outgoingDmgMult ?? 1);
    const dealt = applyDamage({ attackerLabel:b.boss_name, defenderLabel:"Jogador", attacker:b, defender:p, rawDamage:dmg, log, vfx: state.vfx, reflectable:true , runStats: state.run.stats });
    return dealt.final;
  }

  // efeitos simples
  if(t === "Silence: Jogador não pode usar habilidades no próximo turno"){
    addStatus(p, makeStatus("SILENCE", 1, {}, { delay: 1 }), log, "Jogador", state.vfx);
    log.push("Silêncio aplicado: valerá no próximo turno do jogador.", "info");
    return { dealtDamage:0 };
  }
  if(t === "ATQ e DEF do jogador -30% por 2 turnos"){
    addStatus(p, makeStatus("ATQ_DOWN", 2, { pp: 30 }), log, "Jogador", state.vfx);
    addStatus(p, makeStatus("DEF_DOWN", 2, { pp: 30 }), log, "Jogador", state.vfx);
    return { dealtDamage:0 };
  }
  if(t === "Por 3 turnos, feitiços custam +25% Mana"){
    addStatus(p, makeStatus("SPELL_COST_UP", 3, {}), log, "Jogador", state.vfx);
    return { dealtDamage:0 };
  }
  if(t === "Reduz a Mana atual do jogador em 60%"){
    const before = p.mp;
    p.mp = Math.floor(p.mp * 0.40);
    log.push(`MP reduzido: ${before} -> ${p.mp}.`, "info");
    return { dealtDamage:0 };
  }
  if(t === "Destrói 1 consumível aleatório do jogador"){
    const id = state.inventory.destroyRandomConsumable(state.rng);
    if(id) log.push(`Consumível destruído: ${id}`, "err");
    else log.push("Nenhum consumível para destruir.", "info");
    return { dealtDamage:0 };
  }
  if(t === "Destrói 1 equipamento aleatório do jogador"){
    const r = state.inventory.destroyRandomEquipment(state.rng);
    if(r){
      log.push(`Equipamento destruído (${r.slot}): ${r.id}`, "err");
      state.recomputeStats(false);
    }else{
      log.push("Nenhum equipamento para destruir.", "info");
    }
    return { dealtDamage:0 };
  }
  if(t === "Cura 80% do HP do BOSS"){
    const heal = b.maxHp * 0.80;
    const before = b.hp;
    b.hp = Math.min(b.maxHp, b.hp + roundHalfUp(heal));
    log.push(`${b.boss_name} cura ${b.hp - before} HP.`, "info");
    return { dealtDamage:0 };
  }
  if(t === "Dano verdadeiro = 15% da vida máxima do jogador (ignora DEF)"){
    const raw = p.maxHp * 0.15;
    const dealt = applyDamage({ attackerLabel:b.boss_name, defenderLabel:"Jogador", attacker:b, defender:p, rawDamage:raw, isTrue:true, log, vfx: state.vfx, reflectable:true , runStats: state.run.stats });
    return { dealtDamage: dealt.final };
  }
  if(t === "HP do jogador fica 1 (não causa morte direta). Após usar, o boss perde o próximo turno"){
    p.hp = Math.max(1, p.hp);
    p.hp = 1;
    b.skipNextTurn = true;
    log.push("Modo Seguro ativado: HP do jogador = 1. Boss perderá o próximo turno.", "err");
    return { dealtDamage:0 };
  }
  if(t === "Reflete o próximo dano direto do jogador: o jogador recebe (dano final causado x 1.5) como dano verdadeiro"){
    b.reflectNext = true;
    b.reflectExpiresAtEndOfNextBossTurn = true;
    log.push("Espelho de Execução: refletindo o próximo dano direto do jogador.", "info");
    return { dealtDamage:0 };
  }
  if(t === "Imune ao próximo dano direto do jogador (consome o efeito ao bloquear o primeiro hit)"){
    addStatus(b, makeStatus("IMMUNE_NEXT_DIRECT", null, {}), log, b.boss_name, state.vfx);
    return { dealtDamage:0 };
  }
  if(t === "Jogador não pode inserir códigos por 2 turnos do boss."){
    addStatus(p, makeStatus("TERMINAL_LOCK", 2, {}), log, "Jogador", state.vfx);
    return { dealtDamage:0 };
  }
  if(t === "Bloqueia uma habilidade aleatória do jogador até o fim da batalha"){
    const skills = state.playerSkillsVisible.filter(s => !state.player.lockedSkills.has(s.skill_id));
    if(skills.length === 0){
      log.push("Nenhuma habilidade para bloquear.", "info");
      return { dealtDamage:0 };
    }
    const pick = state.rng.pick(skills);
    state.player.lockedSkills.add(pick.skill_id);
    log.push(`Habilidade bloqueada: ${pick.skill_name}`, "err");
    return { dealtDamage:0 };
  }
  if(t === "Causa Game-over"){
    state.battle.forceGameOver = true;
    log.push("Protocolo do Fim: GAME OVER.", "err");
    return { dealtDamage:0 };
  }

  // buffs permanentes do boss
  if(t === "ATQ +15% Permanente"){
    b.permAtqPct += 15;
    log.push(`${b.boss_name} ATQ +15% permanente.`, "info");
    return { dealtDamage:0 };
  }
  if(t === "DEF +20% (permanente)"){
    b.permDefPct += 20;
    log.push(`${b.boss_name} DEF +20% permanente.`, "info");
    return { dealtDamage:0 };
  }
  if(t === "ATQ +20% (permanente)"){
    b.permAtqPct += 20;
    log.push(`${b.boss_name} ATQ +20% permanente.`, "info");
    return { dealtDamage:0 };
  }
  if(t === "DEF + 15% (permanente)"){
    b.permDefPct += 15;
    log.push(`${b.boss_name} DEF +15% permanente.`, "info");
    return { dealtDamage:0 };
  }

  // danos físicos
  if(t.startsWith("Dano físico = (ATQ_Total x 1.0)")){
    const dealt = bossHit(1.0);
    // remove maior entre 15 MP ou 10% MP atual
    const remove = Math.max(15, roundHalfUp(p.mp * 0.10));
    const before = p.mp;
    p.mp = Math.max(0, p.mp - remove);
    log.push(`MP drenado: ${before} -> ${p.mp}.`, "info");
    return { dealtDamage:dealt };
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.1)")){
    const dealt = bossHit(1.1);
    // 50%: DEF -30% por 2 turnos
    if(dealt > 0 && state.rng.chance(50)){
      addStatus(p, makeStatus("DEF_DOWN", 2, { pp:30 }), log, "Jogador", state.vfx);
    }
    return { dealtDamage:dealt };
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.2)")){
    const dealt = bossHit(1.2);
    // remove buff aleatório
    const buffs = p.statuses.filter(s => ["ATQ_UP","DEF_UP","EVA_UP","CRIT_UP","DEFEND","DOUBLE_NEXT_ACTIVE","DMG_TO_MP"].includes(s.id));
    if(buffs.length>0){
      const pick = state.rng.pick(buffs);
      p.statuses = p.statuses.filter(s => s !== pick);
      log.push(`Buff removido: ${pick.id}`, "err");
    }
    return { dealtDamage:dealt };
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.4)")){
    const dealt = bossHit(1.4);
    if(dealt > 0){
      // cura boss 50% do dano causado
      const before = b.hp;
      b.hp = Math.min(b.maxHp, b.hp + roundHalfUp(dealt * 0.5));
      log.push(`${b.boss_name} drena e cura ${b.hp - before} HP.`, "info");
    }
    return { dealtDamage:dealt };
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.5)")){
    const dealt = bossHit(1.5);
    if(dealt > 0 && state.rng.chance(20)){
      addStatus(p, makeStatus("BURN", 3, {}), log, "Jogador", state.vfx);
    }
    return { dealtDamage:dealt };
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.6)")){
    const dealt = bossHit(1.6);
    return { dealtDamage:dealt };
  }
  if(t.startsWith("Dano físico = (ATQ_Total x 1.7)")){
    const dealt = bossHit(1.7);
    return { dealtDamage:dealt };
  }

  log.push(`Skill do boss sem handler: ${skill.skill_name}`, "err");
  return { dealtDamage:0 };
}

export function initBattle(state, bossId){
  const bd = state.data.bossesById[bossId];
  const boss = {
    isBoss: true,
    boss_id: bossId,
    boss_name: bd.boss_name,
    phase: 1,
    statuses: [],
    hp: 1, maxHp: 1,
    atq: 1, def: 0,
    outgoingDmgMult: 1,
    permAtqPct: 0,
    permDefPct: 0,
    permDefFlat: 0,
    cooldowns: {}, // by skill_name
    uses: {},      // by skill_name
    skipNextTurn: false,
    reflectNext: false,
    reflectExpiresAtEndOfNextBossTurn: false,
    phase2Turns: 0,
    domainTurns: 0,
    domainDefBonus: 0,
    damageStreak: 0,
    triggered: {},
  };

  state.battle = {
    boss,
    bossMaxHp: bd.hp_base,
    bossThresholdPct: bd.phase2_threshold_hp_pct,
    turnBattle: 1,
    rhythmGrantedThisRound: false,
    playerDidDamageThisRound: false,
    forceGameOver: false,
    bossTurnSkippedThisRound: false,
  };

  state.recomputeStats(true);

  // skills pool
  state.bossSkillsAll = state.data.skillsBoss.filter(s => s.boss_name === bd.boss_name);
  state.bossPool = state.bossSkillsAll.filter(s => (s.weight_phase1 || s.weight_phase2) && String(s.phase) !== "Transição" && String(s.phase) !== "Fase 2");
  // separa transições e adaptações
  state.bossTransition = state.bossSkillsAll.filter(s => String(s.phase) === "Transição");
  state.bossAdaptations = state.bossSkillsAll.filter(s => String(s.phase) === "Fase 2" && !(s.weight_phase2 > 0));
}

export function playerActionAttack(state){
  const log = state.log;
  const p = state.player;
  const b = state.battle.boss;

  state.recomputeStats();
  state.vfx?.emit("speech", { target:"player", text:"Ataque Básico" });
  emitSkillVfx(state, { skill_name:"Ataque Básico", class_name: state.player.class_name, skill_id:"BASIC_ATK" }, { source:"player", target:"boss", phase: state.battle?.boss?.phase || 1 });

  // aplicar ritmo se existir
  const stats = { atq: p.atq };
  applyRhythmIfExists(state, stats);

  // ataque básico = x1.0
  let raw = stats.atq - b.def;
  // crit
  const isCrit = rollCrit(state);
  if(isCrit) raw *= 2;
  raw *= (p.outgoingDmgMult ?? 1);

  // boss reflect
  const dealt = applyDamage({ attackerLabel:"Jogador", defenderLabel:b.boss_name, attacker:p, defender:b, rawDamage:raw, log, vfx: state.vfx, isCrit, reflectable:true , runStats: state.run.stats });

  if(dealt.final > 0){
    state.battle.playerDidDamageThisRound = true;
    b.damageStreak += 1;
  }else{
    b.damageStreak = 0;
  }

  // aplica reflect do boss (após dano final)
  if(b.reflectNext && dealt.final > 0){
    b.reflectNext = false;
    const ref = dealt.final * 1.5;
    applyDamage({ attackerLabel:b.boss_name, defenderLabel:"Jogador", attacker:b, defender:p, rawDamage:ref, isTrue:true, log, vfx: state.vfx, reflectable:false, source:"reflexo" , runStats: state.run.stats });
    log.push("Dano refletido (verdadeiro).", "err");
  }

  // após ataque, ritmo por usar habilidade? (só após usar habilidade, não ataque)
  state.player.lastAction = { type:"attack", skillId:null, isSpell:false };
}

export function playerActionDefend(state){
  const log = state.log;
  state.vfx?.emit("speech", { target:"player", text:"Defender" });
  emitSkillVfx(state, { skill_name:"Defender", class_name: state.player.class_name, skill_id:"BASIC_DEF" }, { source:"player", target:"player", phase: state.battle?.boss?.phase || 1 });
  addStatus(state.player, makeStatus("DEFEND", 1, {}), log, "Jogador", state.vfx);
  // aplica imediatamente para o ataque do boss nesse round
  state.recomputeStats();
  state.player.lastAction = { type:"defend", skillId:null, isSpell:false };
}

export function playerActionSkill(state, skill){
  const log = state.log;

  const can = playerCanUseSkill(state, skill);
  if(!can.ok){
    log.push(`Não pode usar: ${skill.skill_name} (${can.reason})`, "err");
    return false;
  }

  // custo MP (pode usar com 0; alguns skills já tratam no handler)
const baseCost = mpCostForSkill(state, skill);
const hasFree = hasStatus(state.player, "FREE_NEXT_ACTIVE");
const cost = hasFree ? 0 : baseCost;

if(cost > 0){
  if(state.player.mp < cost){
    log.push(`MP insuficiente (${state.player.mp}/${cost}).`, "err");
    return false;
  }
  state.player.mp -= cost;
}

// consome "Foco" apenas se realmente zerou um custo > 0
if(hasFree && baseCost > 0){
  removeStatus(state.player, "FREE_NEXT_ACTIVE");
  log.push("Foco consumido: habilidade ativa com custo 0 MP.", "info");
}

  // flag de crit apenas para ofensivas
  state.player.canCrit = (skill.can_crit ?? 0) === 1;

  // Callout RPG (nome da habilidade)
  state.vfx?.emit("speech", { target:"player", text: skill.skill_name });
  emitSkillVfx(state, skill, { source:"player", target:"boss", phase: state.battle?.boss?.phase || 1 });
  applyPlayerSkillEffect(state, skill);

  applySkillCooldown(state, skill);

  // Pedra do Ritmo: após usar habilidade, ganha Ritmo (1x por rodada)
  maybeGrantRhythm(state, skill);

  state.player.lastAction = { type:"skill", skillId:skill.skill_id, isSpell: String(skill.effect_text||"").includes("Dano mágico") };
  return true;
}

export function playerUseConsumable(state, itemId){
  const log = state.log;
  const p = state.player;
  const b = state.battle.boss;

  // terminal lock impede usar consumíveis
  if(hasStatus(p, "TERMINAL_LOCK")){
    log.push("Terminal bloqueado: não pode usar consumíveis.", "err");
    return false;
  }

  const it = state.data.itemsById[itemId];
  if(!it || !it.is_consumable){
    log.push("Consumível inválido.", "err");
    return false;
  }
  if(!it.usable_in_combat){
    log.push("Este consumível não pode ser usado em combate.", "err");
    return false;
  }

  // remove do inventário (uso único)
  state.inventory.removeConsumable(itemId);

  // Callout RPG (nome do consumível)
  state.vfx?.emit("speech", { target:"player", text: it.name });

  // aplica efeito (por efeito_text)
  const t = String(it.effect_text||"").trim().replace(/\s+/g, " ");

  // garante stats atualizados para cálculos % e caps
  state.recomputeStats();

  // 1) Cura fixa
  let mm = t.match(/^Cura\s+(\d+)\s+de\s+HP/i);
  if(mm){
    applyHealing(p, parseInt(mm[1],10), log, "Jogador", state.vfx, state.run.stats);
    return true;
  }

  
// 1b) Cura total (HP máximo)
if(t.toLowerCase() === "cura o hp até o máximo.".toLowerCase()){
  const dhp = Math.max(0, p.maxHp - p.hp);
  p.hp = p.maxHp;
  if(dhp>0) state.vfx?.emit("float", { target:"player", text:`+${dhp}`, kind:"heal" });
  state.vfx?.emit("heal", { target:"player" });
  log.push("HP restaurado ao máximo.", "ok");
  return true;
}

// 2) Restaura MP fixo
  mm = t.match(/^Restaura\s+(\d+)\s+de\s+MP/i);
  if(mm){
    const amount = parseInt(mm[1],10);
    const before = p.mp;
    p.mp = Math.min(p.maxMp, p.mp + amount);
    const gained = Math.max(0, p.mp - before);
    if(gained > 0){
      state.vfx?.emit("float", { target:"player", text:`+${gained} MP`, kind:"mana" });
      state.vfx?.emit("buff", { target:"player" });
      log.push(`MP +${gained}.`, "ok");
    }else{
      log.push("MP já está no máximo.", "info");
    }
    return true;
  }

  // 3) Restauração total
  if(t.toLowerCase() === "cura o hp até o máximo e restaura o mp máximo".toLowerCase()){
    const dhp = Math.max(0, p.maxHp - p.hp);
    const dmp = Math.max(0, p.maxMp - p.mp);
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    if(dhp>0) { state.vfx?.emit("float", { target:"player", text:`+${dhp}`, kind:"heal" }); state.run.stats.healDone += dhp; }
    if(dmp>0) state.vfx?.emit("float", { target:"player", text:`+${dmp} MP`, kind:"mana" });
    state.vfx?.emit("heal", { target:"player" });
    log.push("Restauração total: HP e MP no máximo.", "ok");
    return true;
  }

  // 4) Restauração parcial (50% dos valores atuais)
  if(t.toLowerCase() === "restaura em 50% o hp e mp atuais".toLowerCase()){
    const addHp = roundHalfUp(p.hp * 0.5);
    const addMp = roundHalfUp(p.mp * 0.5);
    const beforeHp = p.hp, beforeMp = p.mp;
    p.hp = Math.min(p.maxHp, p.hp + addHp);
    p.mp = Math.min(p.maxMp, p.mp + addMp);
    const dhp = Math.max(0, p.hp - beforeHp);
    const dmp = Math.max(0, p.mp - beforeMp);
    if(dhp>0) { state.vfx?.emit("float", { target:"player", text:`+${dhp}`, kind:"heal" }); state.run.stats.healDone += dhp; }
    if(dmp>0) state.vfx?.emit("float", { target:"player", text:`+${dmp} MP`, kind:"mana" });
    state.vfx?.emit("heal", { target:"player" });
    log.push("Restauração parcial aplicada.", "ok");
    return true;
  }

  
// 4b) Restauração parcial (50% dos valores MÁXIMOS)
if(t.toLowerCase() === "restaura 50% do hp e mp máximos.".toLowerCase()){
  const addHp = roundHalfUp(p.maxHp * 0.50);
  const addMp = roundHalfUp(p.maxMp * 0.50);
  const beforeHp = p.hp, beforeMp = p.mp;
  p.hp = Math.min(p.maxHp, p.hp + addHp);
  p.mp = Math.min(p.maxMp, p.mp + addMp);
  const dhp = Math.max(0, p.hp - beforeHp);
  const dmp = Math.max(0, p.mp - beforeMp);
  if(dhp>0) state.vfx?.emit("float", { target:"player", text:`+${dhp}`, kind:"heal" });
  if(dmp>0) state.vfx?.emit("float", { target:"player", text:`+${dmp} MP`, kind:"mana" });
  state.vfx?.emit("heal", { target:"player" });
  log.push("Restauração parcial aplicada (base no máximo).", "ok");
  return true;
}


if(t.toLowerCase() === "a próxima habilidade ativa custa 0 mp.".toLowerCase()){
  addStatus(p, makeStatus("FREE_NEXT_ACTIVE", null, {}), log, "Jogador", state.vfx);
  log.push("Foco preparado: próxima habilidade ativa custa 0 MP.", "ok");
  return true;
}


if(t.toLowerCase() === "ganha 60% de atq total por 1 turno.".toLowerCase()){
  addStatus(p, makeStatus("ATQ_UP", 2, { pp:60 }), log, "Jogador", state.vfx);
  return true;
}
if(t.toLowerCase() === "aumenta a def total em 80% por 1 turno.".toLowerCase()){
  addStatus(p, makeStatus("DEF_UP", 2, { pp:80 }), log, "Jogador", state.vfx);
  return true;
}
if(t.toLowerCase() === "eva% +60 por 1 turno.".toLowerCase()){
  addStatus(p, makeStatus("EVA_UP", 2, { pp:60 }), log, "Jogador", state.vfx);
  return true;
}
if(t.toLowerCase() === "crit% +40 por 1 turno.".toLowerCase()){
  addStatus(p, makeStatus("CRIT_UP", 2, { pp:40 }), log, "Jogador", state.vfx);
  return true;
}

// 5) Buffs / Debuffs
  if(t.toLowerCase() === "aumenta a def em 30% por 3 turnos".toLowerCase()){
    addStatus(p, makeStatus("DEF_UP", 3, { pp:30 }), log, "Jogador", state.vfx);
    return true;
  }

  if(t.toLowerCase() === "leva 45 de dano e ganha 40% de atq total e def total por 3 turnos".toLowerCase()){
    p.hp = Math.max(0, p.hp - 45);
    state.vfx?.emit("float", { target:"player", text:`-45`, kind:"dmg" });
    addStatus(p, makeStatus("ATQ_UP", 3, { pp:40 }), log, "Jogador", state.vfx);
    addStatus(p, makeStatus("DEF_UP", 3, { pp:40 }), log, "Jogador", state.vfx);
    return true;
  }

  if(t.toLowerCase() === "jogador e boss levam 15% de dano de suas respectivas vida máximas".toLowerCase()){
    const d1 = roundHalfUp(p.maxHp*0.15);
    const d2 = roundHalfUp(b.maxHp*0.15);
    p.hp = Math.max(0, p.hp - d1);
    b.hp = Math.max(0, b.hp - d2);
    state.vfx?.emit("float", { target:"player", text:`-${d1}`, kind:"dmg" });
    state.vfx?.emit("float", { target:"boss", text:`-${d2}`, kind:"dmg" });
    log.push(`Auto-detonação: jogador -${d1}, boss -${d2}.`, "err");
    return true;
  }

  if(t.toLowerCase() === "diminui em -50% a def total do player e do boss por 1 turno".toLowerCase()){
    addStatus(p, makeStatus("DEF_DOWN", 1, { pp:50 }), log, "Jogador", state.vfx);
    addStatus(b, makeStatus("DEF_DOWN", 1, { pp:50 }), log, b.boss_name, state.vfx);
    return true;
  }

  // EVA_UP via texto ou via stat_eva_pp (ex: Óleo Escorregadio)
  mm = t.match(/^você ganha eva% \+(\d+) por (\d+) turno/i);
  if(mm){
    addStatus(p, makeStatus("EVA_UP", parseInt(mm[2],10), { pp: parseInt(mm[1],10) }), log, "Jogador", state.vfx);
    return true;
  }
  if(it.stat_eva_pp){
    // fallback: assume 2 turnos se não estiver explícito
    addStatus(p, makeStatus("EVA_UP", 2, { pp: it.stat_eva_pp }), log, "Jogador", state.vfx);
    return true;
  }

  if(t.toLowerCase() === "boss causa -15% dano por 2 turnos".toLowerCase()){
    addStatus(b, makeStatus("BOSS_DMG_DOWN", 2, { pp:15 }), log, b.boss_name, state.vfx);
    return true;
  }

  // Granada de Fumaça (anula próximo dano direto)
  if(t.toLowerCase().startsWith("anula a próxima ação do boss")){
    addStatus(p, makeStatus("BOSS_DAMAGE_NULL", 2, {}), log, "Jogador", state.vfx);
    return true;
  }

  if(t.toLowerCase() === "aumenta o crítico e a evasão em 20% por 2 turnos".toLowerCase()){
    addStatus(p, makeStatus("CRIT_UP", 2, { pp:20 }), log, "Jogador", state.vfx);
    addStatus(p, makeStatus("EVA_UP", 2, { pp:20 }), log, "Jogador", state.vfx);
    return true;
  }

  
if(t.toLowerCase() === "aplica sangramento, veneno e queimadura no boss por 3 turnos. jogador sofre 40 de dano.".toLowerCase()){
  // custo
  p.hp = Math.max(0, p.hp - 40);
  state.vfx?.emit("float", { target:"player", text:`-40`, kind:"dmg" });
  // aplica dots no boss
  addStatus(b, makeStatus("BLEED", 3, {}), log, b.boss_name, state.vfx);
  addStatus(b, makeStatus("POISON", 3, {}), log, b.boss_name, state.vfx);
  addStatus(b, makeStatus("BURN", 3, {}), log, b.boss_name, state.vfx);
  log.push("Soro da Ruína aplicado: DoTs no boss.", "ok");
  return true;
}


if(t.toLowerCase() === "ignora a def do boss no próximo dano direto.".toLowerCase()){
  addStatus(p, makeStatus("IGNORE_DEF_NEXT_HIT", null, {}), log, "Jogador", state.vfx);
  log.push("Elixir do Caçador: próximo dano direto ignora DEF.", "ok");
  return true;
}


if(t.toLowerCase() === "anula o próximo dano direto do boss.".toLowerCase()){
  addStatus(p, makeStatus("BOSS_DAMAGE_NULL", 2, {}), log, "Jogador", state.vfx);
  log.push("Escudo de Fase: próximo dano direto do boss será anulado.", "ok");
  return true;
}


if(t.toLowerCase() === "silencia o boss por 1 turno (boss não pode usar habilidades).".toLowerCase()){
  addStatus(b, makeStatus("SILENCE_BOSS", 1, {}), log, b.boss_name, state.vfx);
  log.push("Boss silenciado: não usará habilidades neste turno.", "ok");
  return true;
}


if(t.toLowerCase() === "atq do boss -25% por 2 turnos e jogador ganha +25% de atq por 2 turnos.".toLowerCase()){
  addStatus(b, makeStatus("ATQ_DOWN", 2, { pp:25 }), log, b.boss_name, state.vfx);
  // para o jogador, aplicamos +1 na duração para garantir 2 turnos do jogador (preferência A)
  addStatus(p, makeStatus("ATQ_UP", 3, { pp:25 }), log, "Jogador", state.vfx);
  log.push("Roubo de Força aplicado.", "ok");
  return true;
}

// 6) Purga / remoções
  if(t.toLowerCase().startsWith("remove 1 buff aleatório do boss")){
    const buffIds = new Set(["ATQ_UP","DEF_UP","EVA_UP","CRIT_UP","BOSS_DMG_DOWN","DEFEND"]);
    const buffs = b.statuses.filter(s => buffIds.has(s.id));
    if(buffs.length === 0){
      log.push("Boss não possui buffs para remover.", "info");
      return true;
    }
    const pick = buffs[Math.floor(state.rng.next() * buffs.length)];
    removeStatus(b, pick.id);
    log.push(`Buff removido do boss: ${pick.id}.`, "ok");
    state.vfx?.emit("debuff", { target:"boss" });
    return true;
  }

  if(t.toLowerCase() === "remove envenenado".toLowerCase()){
    removeStatus(p, "POISON");
    log.push("Envenenado removido.", "ok");
    state.vfx?.emit("buff", { target:"player" });
    return true;
  }

  if(t.toLowerCase() === "remove sangrando".toLowerCase()){
    removeStatus(p, "BLEED");
    log.push("Sangramento removido.", "ok");
    state.vfx?.emit("buff", { target:"player" });
    return true;
  }

  // 7) Buff aleatório
  if(t.toLowerCase() === "ganha um buff aleatório".toLowerCase()){
    const options = [
      () => addStatus(p, makeStatus("ATQ_UP", 2, { pp:20 }), log, "Jogador", state.vfx),
      () => addStatus(p, makeStatus("DEF_UP", 2, { pp:20 }), log, "Jogador", state.vfx),
      () => addStatus(p, makeStatus("EVA_UP", 2, { pp:20 }), log, "Jogador", state.vfx),
      () => addStatus(p, makeStatus("CRIT_UP", 2, { pp:20 }), log, "Jogador", state.vfx),
    ];
    const fn = options[Math.floor(state.rng.next() * options.length)];
    fn();
    log.push("Poção do Destino: buff aleatório recebido.", "ok");
    return true;
  }

  log.push(`Consumível sem handler: ${it.name} (${it.effect_text})`, "err");
  return true;
}

function bossChooseSkill(state){
  const b = state.battle.boss;
  const phase = b.phase;
  const pool = state.bossPool;

  const available = [];
  for(const s of pool){
    // fase
    const sp = String(s.phase||"");
    if(sp === "Ambas" || (sp === "Fase 2" && phase === 2) || (sp === "Fase 1" && phase === 1) || sp === "Ambas"){
      // ok
    }else{
      // em geral pool já exclui transição/fase2 adaptações, mas mantém "Ambas"
    }

    // cd e uses
    const key = s.skill_name;
    const cd = b.cooldowns[key] ?? 0;
    if(cd > 0) continue;
    const maxUses = s.max_uses_per_battle ?? null;
    const used = b.uses[key] ?? 0;
    if(maxUses != null && used >= maxUses) continue;

    const w = (phase === 1 ? (s.weight_phase1 ?? 0) : (s.weight_phase2 ?? 0));
    if(w > 0) available.push({ w, v:s });
  }

  const chosen = state.rng.weightedPick(available);
  return chosen;
}

function bossApplyCooldown(state, skill){
  const b = state.battle.boss;
  const cd = skill.cooldown_turns ?? 0;
  if(cd > 0) b.cooldowns[skill.skill_name] = cd;
  b.uses[skill.skill_name] = (b.uses[skill.skill_name] ?? 0) + 1;
}

function bossDecrementCooldowns(b){
  for(const k of Object.keys(b.cooldowns)){
    b.cooldowns[k] -= 1;
    if(b.cooldowns[k] <= 0) delete b.cooldowns[k];
  }
}

function applyBossAdaptations(state){
  const b = state.battle.boss;
  const log = state.log;

  // Yamach: após 3 turnos seguidos recebendo dano na fase 2 -> DEF +15% permanente (1x)
  if(b.boss_name === "Yamach" && b.phase === 2 && !b.triggered.yam_def15 && b.damageStreak >= 3){
    b.permDefPct += 15;
    b.triggered.yam_def15 = true;
    log.push("Adaptação: Escamas Condutivas (DEF +15% permanente).", "info");
  }

  // Infimius: após Domínio, +15% ATQ aos 10 turnos pós-fase2; bloquear habilidade aos 12
  if(b.boss_name === "Infimius" && b.phase === 2){
    if(!b.triggered.inf_atq15 && b.phase2Turns >= 10){
      b.permAtqPct += 15;
      b.triggered.inf_atq15 = true;
      log.push("Adaptação: Escalada de Privilégio (ATQ +15% permanente).", "info");
    }
    if(!b.triggered.inf_blockSkill && b.phase2Turns >= 12){
      b.triggered.inf_blockSkill = true;
      // bloqueia uma habilidade aleatória até fim da batalha
      const skills = state.playerSkillsVisible.filter(s => !state.player.lockedSkills.has(s.skill_id));
      if(skills.length){
        const pick = state.rng.pick(skills);
        state.player.lockedSkills.add(pick.skill_id);
        log.push(`Adaptação: Bloqueio de Função (bloqueou ${pick.skill_name}).`, "err");
      }
    }
    // Auto-Reparação: HP <=25% em fase2, 1x
    if(!b.triggered.inf_autorepair && b.hp <= b.maxHp*0.25){
      b.triggered.inf_autorepair = true;
      const before = b.hp;
      b.hp = Math.min(b.maxHp, b.hp + Math.floor(b.maxHp*0.80));
      log.push(`Adaptação: Auto-Reparação (+${b.hp-before} HP).`, "info");
    }
  }

  // Valtherion: escudo, overclock, auditoria, protocolo do fim
  if(b.boss_name === "Valtherion" && b.phase === 2){
    if(!b.triggered.val_def20 && b.phase2Turns >= 7){
      b.permDefPct += 20;
      b.triggered.val_def20 = true;
      log.push("Adaptação: Escudo de Kernel (DEF +20% permanente).", "info");
    }
    if(!b.triggered.val_atq20 && b.phase2Turns >= 14){
      b.permAtqPct += 20;
      b.triggered.val_atq20 = true;
      log.push("Adaptação: Overclock (ATQ +20% permanente).", "info");
    }
    // Auditoria: após 8 turnos fase2 e repetição (2x mesma magia ou 2x ataque)
    if(!b.triggered.val_audit && b.phase2Turns >= 8){
      const la = state.player.lastAction;
      if(la && state.player.repeatCount >= 2){
        b.triggered.val_audit = true;
        addStatus(b, makeStatus("IMMUNE_NEXT_DIRECT", null, {}), log, b.boss_name, state.vfx);
        log.push("Adaptação: Auditoria de Memória (imune ao próximo dano direto).", "info");
      }
    }
  }
}

function applyBossTransition(state){
  const b = state.battle.boss;
  const log = state.log;

  // limpeza de debuffs do boss
  removeNegativeStatuses(b);

  // frase de impacto (RPG) + efeito gigante é tratado no UI quando a fase muda
  if(b.boss_name === "Valtherion") state.vfx?.emit("speech", { target:"boss", text:"O INFERNO DESPERTA!" });
  else if(b.boss_name === "Yamach") state.vfx?.emit("speech", { target:"boss", text:"SOBRECARGA TOTAL!" });
  else if(b.boss_name === "Infimius") state.vfx?.emit("speech", { target:"boss", text:"PROTOCOLO ABISSAL!" });
  else state.vfx?.emit("speech", { target:"boss", text:"FASE 2!" });


  if(b.boss_name === "Yamach"){
    // Sobrecarga Dracônica: ATQ/DEF +20% permanente, jogador -5 HP por turno
    b.permAtqPct += 20;
    b.permDefPct += 20;
    addStatus(state.player, makeStatus("YAMACH_LEAK", null, {}), log, "Jogador", state.vfx);
    log.push("TRANSIÇÃO: Sobrecarga Dracônica (ATQ/DEF +20%).", "info");
  }

  if(b.boss_name === "Infimius"){
    // Domínio: DEF +10 e a cada 3 turnos +2 até +20
    b.permDefFlat += 10;
    b.domainTurns = 0;
    b.domainDefBonus = 0;
    log.push("TRANSIÇÃO: Domínio (DEF +10; cresce a cada 3 turnos).", "info");
  }

  if(b.boss_name === "Valtherion"){
    // Modo Raiz: ATQ/DEF +10% e regen 50/turno
    b.permAtqPct += 10;
    b.permDefPct += 10;
    addStatus(b, makeStatus("VAL_REGEN", null, {}), log, b.boss_name, state.vfx);
    log.push("TRANSIÇÃO: Modo Raiz (ATQ/DEF +10%; regen 50/turno).", "info");
  }
}

export function bossTurn(state){
  const log = state.log;
  const p = state.player;
  const b = state.battle.boss;

  // game over hard
  if(b.boss_name === "Valtherion" && b.phase === 2 && state.battle.turnBattle >= 101){
    state.battle.forceGameOver = true;
    log.push("Protocolo do Fim: turno 101 alcançado.", "err");
    return;
  }

  // adaptações passivas
  applyBossAdaptations(state);

  // skip (por efeito)
  if(b.skipNextTurn){
    b.skipNextTurn = false;
    log.push(`${b.boss_name} perdeu o turno.`, "info");
    return;
  }

  const chosen = bossChooseSkill(state);
  if(!chosen){
    // ataque básico (fallback)
    log.push(`${b.boss_name} usa ataque básico.`, "info");
    state.vfx?.emit("speech", { target:"boss", text:"Ataque Básico" });
    emitBossBasicVfx(state, b.boss_name, b.phase);
    // EVA pode evitar
    const hit = rollPlayerHit(state);
    if(!hit){
      log.push("Jogador esquivou do ataque básico.", "ok");
    }else{
      const raw = b.atq - p.def;
      applyDamage({ attackerLabel:b.boss_name, defenderLabel:"Jogador", attacker:b, defender:p, rawDamage:raw * (b.outgoingDmgMult ?? 1), log, vfx: state.vfx, reflectable:true , runStats: state.run.stats });
    }
    return;
  }

  log.push(`${b.boss_name} usa ${chosen.skill_name}.`, "info");
  state.vfx?.emit("speech", { target:"boss", text: chosen.skill_name });
  emitSkillVfx(state, chosen, { source:"boss", target:"player", bossName: b.boss_name, phase: b.phase });
  bossApplyCooldown(state, chosen);
  applyBossSkillEffect(state, chosen);
}

export function endRound(state){
  const log = state.log;
  const p = state.player;
  const b = state.battle.boss;

  // domain growth (Infimius)
  if(b.boss_name === "Infimius" && b.phase === 2){
    b.domainTurns += 1;
    if(b.domainTurns % 3 === 0 && b.domainDefBonus < 20){
      b.domainDefBonus += 2;
      b.permDefFlat += 2;
      log.push(`Domínio: DEF +2 (acumulado ${b.domainDefBonus}/20).`, "info");
    }
  }

  // endRound ticks
  endRoundTick(p, { log, whoLabel:"Jogador", vfx: state.vfx, runStats: state.run.stats });
  endRoundTick(b, { log, whoLabel:b.boss_name, vfx: state.vfx, runStats: state.run.stats });

  // decrement cooldowns
  decCooldowns(state.player.cooldowns);
  bossDecrementCooldowns(b);

  // reset per-round flags
  state.battle.rhythmGrantedThisRound = false;
  state.battle.playerDidDamageThisRound = false;

  // contador de fase2
  if(b.phase === 2) b.phase2Turns += 1;

  // contador global da batalha
  state.battle.turnBattle += 1;

  // atualiza stats derivados
  state.recomputeStats();
}

export function checkPhaseTransition(state){
  const b = state.battle.boss;
  const bd = state.data.bossesById[b.boss_id];
  const threshold = (bd.phase2_threshold_hp_pct ?? 0.7) * b.maxHp;
  if(b.phase === 1 && b.hp > 0 && b.hp <= threshold){
    b.phase = 2;
    // transformação é imediata e consome turno do boss desta rodada
    state.battle.bossTurnSkippedThisRound = true;
    applyBossTransition(state);
    return true;
  }
  return false;
}