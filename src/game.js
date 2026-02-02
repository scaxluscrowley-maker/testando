import { loadJSON } from "./util/data.js";
import { GAME } from "./config/constants.js";
import { LogSystem } from "./systems/logSystem.js";
import { RNG } from "./systems/rng.js";
import { InventorySystem } from "./systems/inventorySystem.js";
import { TerminalSystem } from "./systems/terminalSystem.js";
import { getPlayerSkillsForClass } from "./systems/skillSystem.js";
import { computePlayerStats, computeBossStats } from "./systems/statSystem.js";
import { initBattle, playerActionAttack, playerActionDefend, playerActionSkill, playerUseConsumable, bossTurn, endRound, checkPhaseTransition } from "./systems/combatSystem.js";
import { MenuScreen } from "./ui/screens/MenuScreen.js";
import { ClassSelectScreen } from "./ui/screens/ClassSelectScreen.js";
import { PrepScreen } from "./ui/screens/PrepScreen.js";
import { PostBattleScreen } from "./ui/screens/PostBattleScreen.js";
import { RunSummaryScreen } from "./ui/screens/RunSummaryScreen.js";
import { createBattleView } from "./ui/battleView.js";
import { nowMs } from "./util/format.js";


const wait = (ms) => new Promise(res => setTimeout(res, ms));

const SPEED_PRESETS = {
  // Combate mais legível: pausas maiores e ritmo consistente com as animações CSS
  normal:   { label:"Normal",     mult: 1.00, pace: { afterPlayer: 420, afterBoss: 520, endRound: 420, phase: 950 } },
  slow:     { label:"Lento",      mult: 1.00, pace: { afterPlayer: 560, afterBoss: 680, endRound: 560, phase: 1250 } },
  cinematic:{ label:"Cinemático", mult: 1.00, pace: { afterPlayer: 760, afterBoss: 920, endRound: 760, phase: 1650 } },
};



function getSpeedPreset(speed){
  return SPEED_PRESETS[speed] || SPEED_PRESETS.normal;
}

function loadSpeedSetting(){
  try{
    const v = localStorage.getItem("mc_combat_speed");
    if(v && SPEED_PRESETS[v]) return v;
  }catch(e){}
  return "normal";
}

function saveSpeedSetting(speed){
  try{ localStorage.setItem("mc_combat_speed", speed); }catch(e){}
}

const app = document.getElementById("app");

function mapById(list, key){
  const m = {};
  for(const it of list) m[it[key]] = it;
  return m;
}

async function boot(){
  const log = new LogSystem();
  const rng = new RNG();

  log.push("BOOT: carregando dados...", "info");

  const [classes, bosses, items, skillsPlayer, skillsBoss, codesB64, assetManifest] = await Promise.all([
    loadJSON("./src/data/classes.json"),
    loadJSON("./src/data/bosses.json"),
    loadJSON("./src/data/items.json"),
    loadJSON("./src/data/skills_player.json"),
    loadJSON("./src/data/skills_boss.json"),
    loadJSON("./src/data/codes_b64.json"),
    // opcional (se não existir, continua sem assets custom)
    loadJSON("./src/data/asset_manifest.json").catch(() => null),
  ]);

  const data = {
    classes,
    bosses,
    items,
    skillsPlayer,
    skillsBoss,
    codesB64,
    assetManifest,
    classesById: mapById(classes, "class_id"),
    bossesById: mapById(bosses, "boss_id"),
    itemsById: mapById(items, "item_id"),
    bossOrder: bosses,
  };

  const ui = { battleView: null };

  const state = {
    consts: { MAX_TRIES_PER_BOSS: GAME.MAX_TRIES_PER_BOSS, MAX_BATTLE_CONSUMABLE_CODES: GAME.MAX_BATTLE_CONSUMABLE_CODES, MAX_CONSUMABLES: GAME.MAX_CONSUMABLES },
settings: { combatSpeed: loadSpeedSetting() },
ui: { busy:false, turnToken:0 },
    data,
    log,
    rng,
    vfx: { queue: [], emit(type, payload){ this.queue.push({ type, ...payload }); } },
    screen: "menu",
    inventory: new InventorySystem(),
    terminal: null,
    run: null,
    player: null,
    battle: null,
    bossSkillsAll: [],
    bossPool: [],
    bossTransition: [],
    bossAdaptations: [],
    playerSkillsAll: [],
    playerSkillsVisible: [],
    render: () => render(state),
    recomputeStats: (refreshMax=false) => recomputeStats(state, refreshMax),
    actPlayer: async (kind, payload) => actPlayer(state, kind, payload),
    setCombatSpeed: (speed) => { state.settings.combatSpeed = speed; saveSpeedSetting(speed); document.body.dataset.speed = speed; },
    submitPrepCode: (raw) => {
      if(state.screen !== "prep") return;
      const r = state.terminal.submit(raw);
      if(r?.ok && r.kind === "evolution"){
        state.run.evolutionPendingItemId = r.itemId;
      }
      state.render();
    },

    useTerminalCode: (raw) => {
  if(state.screen !== "battle") return null;
  const r = state.terminal.submitConsumable(raw);

  // feedback de terminal (sem log visível)
  const left = state.terminal.battleTriesLeft;
  const max = state.consts.MAX_BATTLE_CONSUMABLE_CODES;
  let msg = "";
  let kind = "ok";
  if(!r || !r.ok){
    kind = "err";
    const reason = r?.reason || "invalid";
    msg =
      reason === "no_tries" ? "Slots do Terminal esgotados." :
      reason === "empty" ? "Digite um código." :
      reason === "repeat_boss" ? `Código repetido (boss atual). Slots: ${left}/${max}` :
      reason === "invalid" ? `Código inválido. Slots: ${left}/${max}` :
      reason === "not_consumable" ? `Em combate, apenas CONSUMÍVEIS. Slots: ${left}/${max}` :
      reason === "duplicate_consumable" ? `Consumível repetido no inventário. Slots: ${left}/${max}` :
      `Falha no terminal: ${reason}. Slots: ${left}/${max}`;
  }else{
    kind = "ok";
    msg = `Consumível adicionado: ${r.item?.name || "OK"}. Slots: ${left}/${max}`;
  }
  state.ui.terminalFeedback = { msg, kind, at: nowMs() };

  state.render();
  return r;
},
  };

  function newRun(){
    return {
      bossIndex: 0,
      evolved: false,
      evolutionPendingItemId: null,
      startMs: nowMs(),
      bossStartMs: nowMs(),
      fragments: {
        "Yamach": ["XV", "0110", "SHIFT"],
        "Infimius": ["XXIV", "1001", "INVERT"],
        "Valtherion": ["MERGE", "0101", "COMPILE"],
      },
      stats: {
        victory: false,
        totalMs: 0,
        damageDealt: 0,
        damageTaken: 0,
        healDone: 0,
        bossesDefeated: 0,
        bossTimeMs: { "Yamach":0, "Infimius":0, "Valtherion":0 },
      }
    };
  }

  function newPlayer(classId){
    const cls = data.classesById[classId];
    return {
      isPlayer: true,
      class_id: cls.class_id,
      class_name: cls.class_name,
      statuses: [],
      lockedSkills: new Set(),
      cooldowns: {},
      permBonuses: { hp:0, mp:0, atq:0, def:0, eva:0, crit:0 },
      hp: 1, mp: 1, maxHp:1, maxMp:1,
      atq:1, def:0, eva:0, crit:0,
      outgoingDmgMult: 1,
      healReceivedMult: 1,
      canCrit: true,
      rhythmReady: false,
      lastAction: null,
      repeatCount: 0,
    };
  }

  function setupTerminal(){
    state.terminal = new TerminalSystem({
      codesB64: data.codesB64,
      itemsById: data.itemsById,
      inventory: state.inventory,
      log: state.log
    });
  }

  function setScreen(s){
    state.screen = s;
    render(state);
  }
function recomputeSkills(){
  const base = getPlayerSkillsForClass(data, state.player.class_name);

  // Evolução: libera +4 skills da classe alvo (Arcano/Mestre das Lâminas/Algoz)
  let extra = [];
  const cls = data.classesById[state.player.class_id];
  const evoTarget = cls?.evolution_target;
  if(state.run.evolved && evoTarget){
    extra = getPlayerSkillsForClass(data, evoTarget);
  }

  // junta e ordena por id para consistência
  state.playerSkillsAll = [...base, ...extra].sort((a,b)=>String(a.skill_id).localeCompare(String(b.skill_id)));

  state.playerSkillsVisible = state.run.evolved ? state.playerSkillsAll.slice(0,8) : state.playerSkillsAll.slice(0,4);
}


  function recomputeStats(state, refreshMax){
    const ps = computePlayerStats(state);
    state.player.maxHp = ps.maxHp;
    state.player.maxMp = ps.maxMp;
    state.player.atq = ps.atq;
    state.player.def = ps.def;
    state.player.eva = ps.eva;
    state.player.crit = ps.crit;
    state.player.healReceivedMult = ps.healReceivedMult;

    if(refreshMax){
      state.player.hp = state.player.maxHp;
      state.player.mp = state.player.maxMp;
    }else{
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      state.player.mp = Math.min(state.player.mp, state.player.maxMp);
    }

    if(state.battle){
      const bs = computeBossStats(state);
      const b = state.battle.boss;
      b.maxHp = bs.maxHp;
      b.atq = bs.atq;
      b.def = bs.def;
      b.healReceivedMult = bs.healReceivedMult;
      if(refreshMax && b.hp <= 1){
        b.hp = b.maxHp;
      }else{
        b.hp = Math.min(b.hp, b.maxHp);
      }
    }
  }

  function applyEvolutionIfPending(){
    const pending = state.run.evolutionPendingItemId;
    if(!pending) return;
    const it = data.itemsById[pending];
    if(!it) return;

    state.player.permBonuses.hp += (it.stat_hp ?? 0);
    state.player.permBonuses.mp += (it.stat_mp ?? 0);
    state.player.permBonuses.atq += (it.stat_atq ?? 0);
    state.player.permBonuses.def += (it.stat_def ?? 0);
    state.player.permBonuses.eva += (it.stat_eva_pp ?? 0);
    state.player.permBonuses.crit += (it.stat_crit_pp ?? 0);

    state.run.evolved = true;
    state.run.evolutionPendingItemId = null;
    state.log.push(`EVOLUÇÃO: ${it.name} aplicada. Slots de skills: 8.`, "ok");
    state.vfx.emit("phase", { target:"center" });
    recomputeSkills();
    recomputeStats(state, true);
  }

  async function actPlayer(state, kind, payload){
    if(state.screen !== "battle") return;
    if(state.ui?.busy) return;

    state.ui.busy = true;
    render(state);

    const token = state.ui.turnToken;
    function stillValid(){
      return state.ui.turnToken === token && state.screen === "battle";
    }

    try{

    const preset = getSpeedPreset(state.settings?.combatSpeed);
    const mult = preset.mult;
    const pace = preset.pace;

    const p = state.player;
    const b = state.battle.boss;

    function updateRepeat(action){
      const prev = p.lastAction;
      if(!prev){
        p.repeatCount = 1;
        p.lastAction = action;
        return;
      }
      const sameAttack = (prev.type === "attack" && action.type === "attack");
      const sameSpell = (prev.type === "skill" && action.type === "skill" && prev.isSpell && action.isSpell && prev.skillId === action.skillId);
      if(sameAttack || sameSpell){
        p.repeatCount += 1;
      }else{
        p.repeatCount = 1;
      }
      p.lastAction = action;
    }

    // ===== Player step =====
    if(kind === "attack"){
      playerActionAttack(state);
      updateRepeat({ type:"attack", skillId:null, isSpell:false });
    }else if(kind === "defend"){
      playerActionDefend(state);
      state.vfx.emit("buff", { target:"player" });
      updateRepeat({ type:"defend", skillId:null, isSpell:false });
    }else if(kind === "skill"){
      const sk = state.playerSkillsVisible.find(s => s.skill_id === payload);
      if(!sk){ state.ui.busy = false; return; }
      const ok = playerActionSkill(state, sk);
      if(!ok){ state.ui.busy = false; render(state); return; }
      updateRepeat({ type:"skill", skillId:sk.skill_id, isSpell: String(sk.effect_text||"").includes("Dano mágico") });
    }else if(kind === "consumable"){
      playerUseConsumable(state, payload);
      updateRepeat({ type:"consumable", skillId:null, isSpell:false });
    }

    recomputeStats(state, false);
    render(state);

    if(b.hp <= 0){
      state.ui.busy = false;
      finishBoss(true);
      return;
    }

    // pausa para o jogador "ler" o impacto
    await wait(Math.round(pace.afterPlayer * mult));
    if(!stillValid()) return;

    // ===== Phase transition =====
    const transformed = checkPhaseTransition(state);
    if(transformed){
      state.vfx.emit("phase", { target:"center" });
      recomputeStats(state, false);
      render(state);
      await wait(Math.round(pace.phase * mult));
    if(!stillValid()) return;
    }

    // ===== Boss step =====
    if(!transformed){
      bossTurn(state);
    }else{
      state.log.push(`${b.boss_name} transformou e perdeu o turno.`, "info");
    }

    recomputeStats(state, false);
    render(state);

    if(state.battle.forceGameOver){
      state.ui.busy = false;
      finishBoss(false, true);
      return;
    }
    if(p.hp <= 0){
      state.ui.busy = false;
      finishBoss(false);
      return;
    }
    if(b.hp <= 0){
      state.ui.busy = false;
      finishBoss(true);
      return;
    }

    // pausa após ação do boss
    await wait(Math.round(pace.afterBoss * mult));
    if(!stillValid()) return;

    // ===== End round =====
    endRound(state);
    recomputeStats(state, false);
    render(state);

    if(p.hp <= 0){
      state.ui.busy = false;
      finishBoss(false);
      return;
    }
    if(b.hp <= 0){
      state.ui.busy = false;
      finishBoss(true);
      return;
    }

    await wait(Math.round(pace.endRound * mult));
    if(!stillValid()) return;

    

  }catch(err){
    console.error(err);
    state.log?.push(`ERRO: ${err?.message || err}`, "err");
  }finally{
    // se a run ou a tela mudou durante waits, garantimos desbloqueio
    if(state.ui) state.ui.busy = false;
    render(state);
  }
}



function bumpTurnToken(){
  if(!state.ui) state.ui = { busy:false, turnToken:0 };
  state.ui.turnToken = (state.ui.turnToken || 0) + 1;
}

function clearActionLocks(){
  if(state.ui) state.ui.busy = false;
  // limpa VFX pendentes para não "travar" visualmente em transições
  if(state.vfx?.queue) state.vfx.queue.length = 0;
  bumpTurnToken();
}


function applyEquipmentEntryCosts(){
  // equipamentos poderosos podem ter custo por batalha (HP/MP)
  const inv = state.inventory;
  let hpCost = 0, mpCost = 0;
  for(const slot of ["weapon","armor","artifact"]){
    const id = inv.equipment?.[slot];
    if(!id) continue;
    const it = data.itemsById[id];
    if(!it) continue;
    hpCost += (it.battle_entry_hp_cost ?? 0) || 0;
    mpCost += (it.battle_entry_mp_cost ?? 0) || 0;
  }
  hpCost = Math.max(0, Math.floor(hpCost));
  mpCost = Math.max(0, Math.floor(mpCost));
  if(hpCost <= 0 && mpCost <= 0) return;

  const p = state.player;
  const beforeHp = p.hp;
  const beforeMp = p.mp;
  if(hpCost > 0) p.hp = Math.max(1, p.hp - hpCost);
  if(mpCost > 0) p.mp = Math.max(0, p.mp - mpCost);

  const dhp = Math.max(0, beforeHp - p.hp);
  const dmp = Math.max(0, beforeMp - p.mp);
  if(dhp > 0) state.vfx?.emit("float", { target:"player", text:`-${dhp}`, kind:"dmg" });
  if(dmp > 0) state.vfx?.emit("float", { target:"player", text:`-${dmp} MP`, kind:"mana" });
  state.log.push(`Custo de equipamento: -${dhp} HP, -${dmp} MP.`, "err");
}

function startBattle(){
    clearActionLocks();
    applyEvolutionIfPending();
    const boss = data.bossOrder[state.run.bossIndex];
    initBattle(state, boss.boss_id);
    recomputeSkills();
    recomputeStats(state, true);
    applyEquipmentEntryCosts();

    state.run.bossStartMs = nowMs();
    state.terminal.resetBattleSlots();

    setScreen("battle");
  }

  function finishBoss(victory){
    const boss = data.bossOrder[state.run.bossIndex];
    const ms = nowMs() - state.run.bossStartMs;
    state.run.stats.bossTimeMs[boss.boss_name] += ms;

    if(victory){
      state.run.stats.bossesDefeated += 1;
      state.recomputeStats(true);
      state.screen = "post_battle";
      state.postBattleVictory = true;
    }else{
      state.screen = "post_battle";
      state.postBattleVictory = false;
    }

    render(state);
  }

  function afterPostBattle(){
    clearActionLocks();
    if(state.postBattleVictory){
      state.run.bossIndex += 1;
      state.battle = null;
      ui.battleView = null;

      if(state.run.bossIndex >= data.bossOrder.length){
        state.run.stats.victory = true;
        state.run.stats.totalMs = nowMs() - state.run.startMs;
        state.screen = "run_summary";
        render(state);
        return;
      }
      state.terminal.resetForNewBoss();
      state.screen = "prep";
      render(state);
    }else{
      state.run.stats.victory = false;
      state.run.stats.totalMs = nowMs() - state.run.startMs;
      state.screen = "run_summary";
      render(state);
    }
  }

  function resetToMenu(){
    clearActionLocks();
    ui.battleView = null;
    // reset theme
    if(document?.body){
      delete document.body.dataset.boss;
      delete document.body.dataset.phase;
      document.body.classList.remove("theme-pulse");
    }
    state.inventory = new InventorySystem();
    setupTerminal();
    state.run = newRun();
    state.player = null;
    state.battle = null;
    state.postBattleVictory = false;
    state.screen = "menu";
    state.log.clear();
    state.vfx.queue.length = 0;
    render(state);
  }

  setupTerminal();
  state.run = newRun();

  function render(state){
    document.body.dataset.screen = state.screen;

    // battle view: DOM persistente para sprites/VFX sem resetar GIFs
    if(state.screen === "battle"){
      if(!ui.battleView){
        ui.battleView = createBattleView(state, { onQuitToMenu: () => resetToMenu() });
        app.innerHTML = "";
        app.appendChild(ui.battleView.root);
      }
      ui.battleView.update();
      return;
    }

    // saindo do battle: limpa cache
    ui.battleView = null;
    app.innerHTML = "";

    if(state.screen === "menu"){
      app.appendChild(MenuScreen({ onStart: () => setScreen("class_select") }));
      return;
    }
    if(state.screen === "class_select"){
      app.appendChild(ClassSelectScreen({ data, onPick: (id) => {
        state.player = newPlayer(id);
        recomputeSkills();
        recomputeStats(state, true);
        state.terminal.resetForNewBoss();
        setScreen("prep");
      }}));
      return;
    }
    if(state.screen === "prep"){
      app.appendChild(PrepScreen({
        state,
        onStartBattle: () => startBattle(),
        onBackMenu: () => resetToMenu(),
      }));
      return;
    }
    if(state.screen === "post_battle"){
      app.appendChild(PostBattleScreen({
        state,
        victory: state.postBattleVictory,
        onNext: () => afterPostBattle(),
      }));
      return;
    }
    if(state.screen === "run_summary"){
      app.appendChild(RunSummaryScreen({
        state,
        onBackToMenu: () => resetToMenu(),
      }));
      return;
    }
  }

  state.render = () => render(state);
  render(state);
}

boot().catch(err => {
  app.innerHTML = `<pre style="color:#ff4d6d; white-space:pre-wrap;">${err.stack || err}</pre>`;
});
