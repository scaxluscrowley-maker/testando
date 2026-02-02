import { hpBar, mpBar } from "./components/StatBars.js";
import { createArena } from "./components/Arena.js";
import { applyBossTheme } from "./theme.js";
import { resolveBossGif, resolveBossAttackGif, resolveClassGif, resolveSkillIcon, resolveItemIcon, placeholderIcon } from "../util/assets.js";

function prettyStatusId(id){
  const s = String(id||"");
  if(s.endsWith("_NEXT")) return s.replace("_NEXT","⏳");
  return s;
}



function baseStatusId(id){
  const s = String(id||"");
  return s.endsWith("_NEXT") ? s.slice(0, -5) : s;
}

function statusDisplayName(id){
  const b = baseStatusId(id);
  const map = {
    ATQ_UP:"Ataque ↑",
    DEF_UP:"Defesa ↑",
    EVA_UP:"Esquiva ↑",
    CRIT_UP:"Crítico ↑",
    ATQ_DOWN:"Ataque ↓",
    DEF_DOWN:"Defesa ↓",
    BLEED:"Sangramento",
    BURN:"Queimadura",
    POISON:"Veneno",
    SILENCE:"Silêncio",
    SILENCE_BOSS:"Silêncio (Boss)",
    DEFEND:"Defender",
    TERMINAL_LOCK:"Terminal Bloqueado",
    DMG_TO_MP:"Escudo de Mana",
    DOUBLE_NEXT_ACTIVE:"Potência Dupla",
    FREE_NEXT_ACTIVE:"Foco",
    IGNORE_DEF_NEXT_HIT:"Ruptura",
    BOSS_DAMAGE_NULL:"Anular Dano",
    IMMUNE_NEXT_DIRECT:"Imunidade",
    SPELL_COST_UP:"Custo Arcano ↑",
    BOSS_DMG_DOWN:"Dano do Boss ↓",
    VAL_REGEN:"Regeneração",
    YAMACH_LEAK:"Vazamento",
  };
  return map[b] ?? prettyStatusId(id);
}

function fmtTurns(n){
  if(n === null || n === undefined) return "—";
  if(n <= 0) return "0";
  return String(n);
}

function statusDetailsHtml(s){
  const id = String(s?.id||"");
  const b = baseStatusId(id);
  const isNext = id.endsWith("_NEXT");
  const pp = s?.data?.pp;
  const dur = s?.duration;
  const delay = s?.delay ?? 0;

  const lines = [];
  lines.push(`<b>${statusDisplayName(id)}</b>`);
  lines.push(`<div class="small mono">${prettyStatusId(id)}</div>`);

  // descrição (regras do GDD / sistemas atuais)
  if(b === "ATQ_UP") lines.push(`<div class="small">Aumenta o <b>ATQ Total</b> em <b>${pp ?? 0}%</b>.</div>`);
  else if(b === "DEF_UP") lines.push(`<div class="small">Aumenta a <b>DEF Total</b> em <b>${pp ?? 0}%</b>.</div>`);
  else if(b === "EVA_UP") lines.push(`<div class="small">Aumenta a <b>Esquiva</b> em <b>${pp ?? 0}%</b>.</div>`);
  else if(b === "CRIT_UP") lines.push(`<div class="small">Aumenta o <b>Crítico</b> em <b>${pp ?? 0}%</b>.</div>`);
  else if(b === "ATQ_DOWN") lines.push(`<div class="small">Reduz o <b>ATQ Total</b> em <b>${pp ?? 0}%</b>.</div>`);
  else if(b === "DEF_DOWN") lines.push(`<div class="small">Reduz a <b>DEF Total</b> em <b>${pp ?? 0}%</b>.</div>`);
  else if(b === "DEFEND") lines.push(`<div class="small">Ganha <b>+50%</b> de DEF Total até o <b>fim da rodada</b>.</div>`);
  else if(b === "BLEED") lines.push(`<div class="small">Causa <b>3%</b> da vida máxima por rodada e reduz DEF em <b>10%</b>.</div>`);
  else if(b === "BURN") lines.push(`<div class="small">Causa <b>2%</b> da vida máxima por rodada e reduz ATQ em <b>10%</b>.</div>`);
  else if(b === "POISON") lines.push(`<div class="small">Causa <b>2%</b> da vida máxima por rodada e reduz cura recebida em <b>-50%</b>.</div>`);
  else if(b === "SILENCE") lines.push(`<div class="small">Impedido de usar <b>habilidades</b> enquanto durar.</div>`);
  else if(b === "SILENCE_BOSS") lines.push(`<div class="small">O boss não pode usar <b>habilidades</b> no turno afetado.</div>`);
  else if(b === "TERMINAL_LOCK") lines.push(`<div class="small">Terminal bloqueado: não pode usar <b>consumíveis</b>.</div>`);
  else if(b === "DMG_TO_MP") lines.push(`<div class="small">Dano direto drena <b>MP</b> antes do <b>HP</b> (até acabar o MP).</div>`);
  else if(b === "DOUBLE_NEXT_ACTIVE") lines.push(`<div class="small">A próxima habilidade ofensiva tem <b>dano dobrado</b>.</div>`);
  else if(b === "FREE_NEXT_ACTIVE") lines.push(`<div class="small">A próxima habilidade ativa custa <b>0 MP</b>.</div>`);
  else if(b === "IGNORE_DEF_NEXT_HIT") lines.push(`<div class="small">O próximo dano direto ignora a <b>DEF</b> do boss.</div>`);
  else if(b === "BOSS_DAMAGE_NULL") lines.push(`<div class="small">Anula o próximo <b>dano direto</b> do boss (não bloqueia DoT).</div>`);
  else if(b === "IMMUNE_NEXT_DIRECT") lines.push(`<div class="small">Bloqueia o próximo <b>dano direto</b> recebido.</div>`);
  else if(b === "SPELL_COST_UP") lines.push(`<div class="small">Feitiços de dano mágico custam <b>+25%</b> de MP.</div>`);
  else if(b === "BOSS_DMG_DOWN") lines.push(`<div class="small">Reduz o dano causado em <b>${pp ?? 0}%</b>.</div>`);
  else if(b === "VAL_REGEN") lines.push(`<div class="small">Regenera <b>50 HP</b> no fim da rodada.</div>`);
  else if(b === "YAMACH_LEAK") lines.push(`<div class="small">Causa <b>5</b> de dano por rodada.</div>`);

  // timing/duração
  if(delay > 0){
    lines.push(`<div class="small"><b>Ativa em:</b> ${delay} turno(s).</div>`);
  }
  if(dur === null || dur === undefined){
    // efeitos consumíveis: duração indefinida até consumir / até o fim da run
    const forever = (b === "FREE_NEXT_ACTIVE" || b === "DOUBLE_NEXT_ACTIVE" || b === "IGNORE_DEF_NEXT_HIT" || b === "IMMUNE_NEXT_DIRECT") 
      ? "até ser consumido"
      : "—";
    lines.push(`<div class="small"><b>Duração:</b> ${forever}</div>`);
  }else{
    lines.push(`<div class="small"><b>Duração restante:</b> ${fmtTurns(dur)} rodada(s)</div>`);
  }

  if(isNext){
    lines.push(`<div class="small">⏳ Este efeito está <b>preparado</b> para o próximo turno.</div>`);
  }

  return lines.join("");
}

function renderStatusChips(container, statuses){
  container.innerHTML = "";
  if(!statuses || statuses.length === 0){
    container.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"-" }));
    return;
  }
  const row = document.createElement("div");
  row.className = "status-row";
  for(const s of statuses){
    const w = document.createElement("span");
    w.className = "tooltip";
    const chip = document.createElement("span");
    const bid = baseStatusId(s.id);
    const neg = ["BLEED","BURN","POISON","ATQ_DOWN","DEF_DOWN","SILENCE","SPELL_COST_UP","TERMINAL_LOCK","YAMACH_LEAK"].includes(bid) || bid.endsWith("_DOWN");
    chip.className = "status-chip " + (neg ? "debuff" : "buff");
    chip.textContent = statusDisplayName(s.id);
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.innerHTML = statusDetailsHtml(s);
    w.appendChild(chip);
    w.appendChild(tip);
    row.appendChild(w);
  }
  container.appendChild(row);
}


function makeIcon(src){
  const img = document.createElement("img");
  img.className = "icon";
  img.src = src || placeholderIcon();
  img.alt = "";
  img.decoding = "async";
  img.loading = "eager";
  img.onerror = () => { img.src = placeholderIcon(); };
  return img;
}


function phase2Phrase(bossName){
  const n = String(bossName||"").toLowerCase();
  if(n.includes("valtherion")) return { title: "O Inferno Desperta!", sub: "Valtherion revela sua verdadeira forma." };
  if(n.includes("yamach")) return { title: "Sobrecarga Total!", sub: "Yamach entra em modo crítico." };
  if(n.includes("infimius")) return { title: "Protocolo Abissal!", sub: "Infimius rompe o selo da arena." };
  return { title: "Fase 2!", sub: "A batalha ficou mais perigosa." };
}

export function createBattleView(state, { onQuitToMenu }){
  const root = document.createElement("div");
  root.className = "col battle-root";

  const header = document.createElement("div");
  header.className = "panel col battle-header";

  const hud = document.createElement("div");
  hud.className = "grid2";

  // Boss HUD
  const bossHud = document.createElement("div");
  bossHud.className = "col";
  const bossTitle = document.createElement("div");
  bossTitle.className = "row";
  bossTitle.innerHTML = `<span class="badge">BOSS</span><span class="badge"><b id="bossName"></b></span><span class="badge">Fase <b id="bossPhase"></b></span><span class="badge">Turno <b id="turnNo"></b></span><span class="badge badge-ctl">Velocidade <select id="speedSelect" class="speed-select"><option value="normal">Normal</option><option value="slow">Lento</option><option value="cinematic">Cinemático</option></select></span>`;
// botão de desistir (compacto) para não ocupar o painel direito
const quitBtn = document.createElement("button");
quitBtn.id = "quitBtn";
quitBtn.className = "btn danger mini";
quitBtn.textContent = "Desistir";
quitBtn.onclick = onQuitToMenu;
bossTitle.appendChild(quitBtn);

bossHud.appendChild(bossTitle);
  const bossStats = document.createElement("div");
  bossStats.className = "small";
  const bossHpBarWrap = document.createElement("div");
  const bossStatus = document.createElement("div");
  bossStatus.className = "small";
  bossStatus.style.display = "none";
  bossHud.appendChild(bossStats);
  bossHud.appendChild(bossHpBarWrap);
  bossHud.appendChild(bossStatus);

  // Player HUD
  const playerHud = document.createElement("div");
  playerHud.className = "col";
  const playerTitle = document.createElement("div");
  playerTitle.className = "row";
  playerTitle.innerHTML = `<span class="badge">JOGADOR</span><span class="badge"><b id="playerName"></b></span><span class="badge" id="evolvedTag" style="display:none;">EVOLUÍDO</span>`;
  playerHud.appendChild(playerTitle);
  const playerStats = document.createElement("div");
  playerStats.className = "small";
  const playerHpBarWrap = document.createElement("div");
  const playerMpBarWrap = document.createElement("div");
  const playerStatus = document.createElement("div");
  playerStatus.className = "small";
  playerStatus.style.display = "none";
  playerHud.appendChild(playerStats);
  playerHud.appendChild(playerHpBarWrap);
  playerHud.appendChild(playerMpBarWrap);
  const equipsLine = document.createElement("div");
  equipsLine.className = "small equips-line";
  playerHud.appendChild(equipsLine);
  playerHud.appendChild(playerStatus);

  hud.appendChild(bossHud);
  hud.appendChild(playerHud);

  header.appendChild(hud);

  // Arena
  const arena = createArena();
  const speedSelect = bossHud.querySelector('#speedSelect');
  if(speedSelect){
    speedSelect.value = state.settings?.combatSpeed || 'normal';
    speedSelect.onchange = () => { state.setCombatSpeed?.(speedSelect.value); state.render(); };
  }


// aplica tema imediatamente (fase 1 também muda o ground)
applyBossTheme(state.battle.boss.boss_name, state.battle.boss.phase);
  header.appendChild(arena.root);
  root.appendChild(header);

  // Middle layout: left actions/skills, right consumables
  const mid = document.createElement("div");
  mid.className = "battle-layout battle-mid";

  const left = document.createElement("div");
  left.className = "panel col";
  left.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">AÇÕES</span>` }));

  const actionRow = document.createElement("div");
  actionRow.className = "row";

  const btnAtk = document.createElement("button");
  btnAtk.className = "btn primary";
  btnAtk.textContent = "Atacar";
  btnAtk.onclick = () => state.actPlayer("attack");

  const btnDef = document.createElement("button");
  btnDef.className = "btn";
  btnDef.textContent = "Defender (+50% DEF)";
  btnDef.onclick = () => state.actPlayer("defend");

  actionRow.appendChild(btnAtk);
  actionRow.appendChild(btnDef);
  left.appendChild(actionRow);

  left.appendChild(Object.assign(document.createElement("div"), { className:"hr" }));

  const skillsTitle = document.createElement("div");
  skillsTitle.className = "row";
  skillsTitle.innerHTML = `<span class="badge">SKILLS</span><span class="small">Passe o mouse para ver detalhes</span>`;
  left.appendChild(skillsTitle);

  const skillsWrap = document.createElement("div");
  skillsWrap.className = "skills-grid";
  left.appendChild(skillsWrap);

  // Right: consumables
  const right = document.createElement("div");
  right.className = "panel col";
  // Tabs do painel direito
const tabs = document.createElement("div");
tabs.className = "tabs";

function makeTabBtn(id, label){
  const b = document.createElement("button");
  b.className = "tab-btn";
  b.textContent = label;
  b.dataset.tab = id;
  return b;
}

const btnTabTerm = makeTabBtn("terminal", "Terminal");
const btnTabCons = makeTabBtn("cons", "Consumíveis");
const btnTabStatus = makeTabBtn("status", "Status");
tabs.appendChild(btnTabTerm);
tabs.appendChild(btnTabCons);
tabs.appendChild(btnTabStatus);
right.appendChild(tabs);

const tabTerm = document.createElement("div");
tabTerm.className = "tab-pane";
const tabCons = document.createElement("div");
tabCons.className = "tab-pane";
const tabStatus = document.createElement("div");
tabStatus.className = "tab-pane";

right.appendChild(tabTerm);
right.appendChild(tabCons);
right.appendChild(tabStatus);

function setTab(id){
  const panes = { terminal: tabTerm, cons: tabCons, status: tabStatus };
  for(const k of Object.keys(panes)){
    panes[k].style.display = (k===id) ? "block" : "none";
  }
  right.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab===id));
  state.settings = state.settings || {};
  state.settings.rightTab = id;
}

// Terminal
const termHeader = document.createElement("div");
termHeader.className = "row";
termHeader.innerHTML = `<span class="badge">TERMINAL</span><span class="small" id="termSlots"></span>`;
tabTerm.appendChild(termHeader);

const termInput = document.createElement("input");
termInput.type = "text";
termInput.placeholder = "Digite o código do consumível…";
tabTerm.appendChild(termInput);

const termBtn = document.createElement("button");
termBtn.className = "btn primary";
termBtn.textContent = "Executar";
termBtn.onclick = () => {
  const raw = termInput.value;
  const r = state.useTerminalCode(raw);
  termInput.value = "";

  // speech/callout em cima do player para feedback imediato
  if(!r || !r.ok){
    const reason = r?.reason || "invalid";
    const msg =
      reason === "no_tries" ? "SEM SLOTS" :
      reason === "empty" ? "CÓDIGO VAZIO" :
      reason === "repeat_boss" ? "CÓDIGO REPETIDO" :
      reason === "invalid" ? "CÓDIGO INVÁLIDO" :
      reason === "not_consumable" ? "SÓ CONSUMÍVEL" :
      reason === "duplicate_consumable" ? "JÁ NO INVENTÁRIO" :
      "ERRO";
    state.vfx?.emit("speech", { target:"player", text: msg });
  }else{
    state.vfx?.emit("speech", { target:"player", text: "CONSUMÍVEL +" });
  }
};

tabTerm.appendChild(termBtn);

const termMsg = document.createElement("div");
termMsg.className = "term-msg";
termMsg.textContent = "";
tabTerm.appendChild(termMsg);

const termHint = document.createElement("div");
termHint.className = "small";
termHint.textContent = `Máx. ${state.consts.MAX_BATTLE_CONSUMABLE_CODES} inserções por batalha (válido/inválido/repetido consome slot).`;
tabTerm.appendChild(termHint);

// Consumíveis
tabCons.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">CONSUMÍVEIS</span>` }));
const lockHint = document.createElement("div");
lockHint.className = "small";
tabCons.appendChild(lockHint);

const consWrap = document.createElement("div");
consWrap.className = "cons-grid";
tabCons.appendChild(consWrap);

// Status
tabStatus.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">STATUS</span><span class="small">Passe o mouse para ver detalhes</span>` }));
const stPlayer = document.createElement("div");
stPlayer.className = "panel-inset";
const stBoss = document.createElement("div");
stBoss.className = "panel-inset";
tabStatus.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"Jogador" }));
tabStatus.appendChild(stPlayer);
tabStatus.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"Boss" }));
tabStatus.appendChild(stBoss);

// Quit (sempre visível no painel direito)

// eventos dos tabs
btnTabTerm.onclick = () => setTab("terminal");
btnTabCons.onclick = () => setTab("cons");
btnTabStatus.onclick = () => setTab("status");

// tab inicial
setTab(state.settings?.rightTab || "cons");
mid.appendChild(left);
  mid.appendChild(right);
  root.appendChild(mid);

  // state to detect changes
  let lastBossPhase = 1;
  let lastBossName = "";
  let lastPlayerClass = "";

  function rebuildSkillButtons(){
    skillsWrap.innerHTML = "";
    for(const sk of state.playerSkillsVisible){
      const w = document.createElement("span");
      w.className = "tooltip";

      const btn = document.createElement("button");
      btn.className = "btn skill-btn";
      btn.style.position = "relative";
      const icon = makeIcon(resolveSkillIcon(sk, state.data.assetManifest));
      const meta = document.createElement("div");
      meta.className = "meta";
      const n = document.createElement("div");
      n.className = "name";
      n.textContent = sk.skill_name;
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = `MP ${sk.mp_cost} • CD ${sk.cooldown_turns}`;
      meta.appendChild(n); meta.appendChild(sub);

      btn.appendChild(icon);
      const cdBadge = document.createElement("span");
      cdBadge.className = "cd-badge";
      cdBadge.textContent = "";
      btn.appendChild(cdBadge);
      btn.appendChild(meta);

      btn.onclick = () => state.actPlayer("skill", sk.skill_id);

      const tip = document.createElement("div");
      tip.className = "tip";
      tip.innerHTML = `<b>${sk.skill_name}</b><br><span class="small">${sk.effect_text}</span><br><span class="small">MP: ${sk.mp_cost} • CD: ${sk.cooldown_turns}</span>`;
      w.appendChild(btn);
      w.appendChild(tip);
      skillsWrap.appendChild(w);
    }
  }

  function rebuildConsumables(){
    consWrap.innerHTML = "";
    const busy = !!state.ui?.busy;
    const locked = state.player.statuses.some(s=>s.id==="TERMINAL_LOCK");
    const slots = state.terminal?.battleTriesLeft ?? 0;
    const maxSlots = state.consts.MAX_BATTLE_CONSUMABLE_CODES;
    const elSlots = right.querySelector("#termSlots");
    if(elSlots) elSlots.textContent = `Slots: ${slots}/${maxSlots}`;

// feedback do terminal (sem log)
if(state.ui?.terminalFeedback && termMsg){
  const fb = state.ui.terminalFeedback;
  // evita reprint contínuo
  if(termMsg.dataset.at !== String(fb.at)){
    termMsg.dataset.at = String(fb.at);
    termMsg.textContent = fb.msg;
    termMsg.classList.toggle("ok", fb.kind === "ok");
    termMsg.classList.toggle("err", fb.kind === "err");
    termMsg.classList.add("show");
  }
}
    termInput.disabled = slots <= 0 || locked || busy;
    termBtn.disabled = slots <= 0 || locked || busy;
    lockHint.textContent = locked ? "Terminal bloqueado: não pode usar consumíveis." : "Clique para usar (uso único).";

    for(const id of state.inventory.consumables){
      const it = state.data.itemsById[id];
      const btn = document.createElement("button");
      btn.className = "btn skill-btn";
      btn.style.position = "relative";
      btn.disabled = locked;

      const icon = makeIcon(it ? resolveItemIcon(it, state.data.assetManifest) : null);
      const meta = document.createElement("div");
      meta.className = "meta";
      const n = document.createElement("div");
      n.className = "name";
      n.textContent = it ? it.name : id;
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = it?.effect_text ?? "";
      meta.appendChild(n); meta.appendChild(sub);

      btn.appendChild(icon);
      const cdBadge = document.createElement("span");
      cdBadge.className = "cd-badge";
      cdBadge.textContent = "";
      btn.appendChild(cdBadge);
      btn.appendChild(meta);

      btn.disabled = busy || locked;
      btn.onclick = () => state.actPlayer("consumable", id);
      consWrap.appendChild(btn);
    }

    if(state.inventory.consumables.length === 0){
      consWrap.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"(vazio)" }));
    }
  }

  function updateHud(){
    const p = state.player;
    const b = state.battle.boss;

    header.querySelector("#bossName").textContent = b.boss_name;
    header.querySelector("#bossPhase").textContent = String(b.phase);
    header.querySelector("#turnNo").textContent = String(state.battle.turnBattle);

    bossStats.textContent = `HP ${b.hp}/${b.maxHp} | ATQ ${b.atq.toFixed(1)} | DEF ${b.def.toFixed(1)}`;
    bossHpBarWrap.innerHTML = "";
    bossHpBarWrap.appendChild(hpBar(b.hp, b.maxHp));
    bossStatus.innerHTML = ""; renderStatusChips(bossStatus, b.statuses); renderStatusChips(stBoss, b.statuses);

    header.querySelector("#playerName").textContent = p.class_name;
    header.querySelector("#evolvedTag").style.display = state.run.evolved ? "inline-block" : "none";

    playerStats.textContent = `HP ${p.hp}/${p.maxHp} | MP ${p.mp}/${p.maxMp} | ATQ ${p.atq.toFixed(1)} | DEF ${p.def.toFixed(1)} | EVA ${p.eva}% | CRIT ${p.crit}%`;
    playerHpBarWrap.innerHTML = "";
    playerHpBarWrap.appendChild(hpBar(p.hp, p.maxHp));
    playerMpBarWrap.innerHTML = "";
    playerMpBarWrap.appendChild(mpBar(p.mp, p.maxMp));
// Equipamentos (nomes)
const it = state.data.itemsById;
const eq = state.inventory.equipment;
const weapon = eq.weapon ? (it[eq.weapon]?.name ?? eq.weapon) : "-";
const armor  = eq.armor  ? (it[eq.armor]?.name ?? eq.armor) : "-";
const artifact = eq.artifact ? (it[eq.artifact]?.name ?? eq.artifact) : "-";
const evo = state.run.evolutionPendingItemId
  ? (it[state.run.evolutionPendingItemId]?.name ?? state.run.evolutionPendingItemId)
  : (state.run.evolved ? "Ativa" : "-");
equipsLine.textContent = `Equip: Evo ${evo} | Weapon ${weapon} | Armor ${armor} | Artifact ${artifact}`;
    playerStatus.innerHTML = ""; renderStatusChips(playerStatus, p.statuses); renderStatusChips(stPlayer, p.statuses);
  }

  function updateSprites(){
    const b = state.battle.boss;
    const p = state.player;

    const bossSrc = resolveBossGif(b.boss_name, b.phase, state.data.assetManifest);

    // Sprite do player muda ao evoluir (ex: Mago -> Arcano)
    const evoTarget = state.data?.classesById?.[p.class_id]?.evolution_target;
    const visualClassName = (state.run?.evolved && evoTarget) ? evoTarget : p.class_name;
    const playerSrc = resolveClassGif(visualClassName, state.data.assetManifest);

    if(b.boss_name !== lastBossName){
      lastBossName = b.boss_name;
      arena.setBossSrc(bossSrc);
      applyBossTheme(b.boss_name, b.phase);
    }
    if(visualClassName !== lastPlayerClass){
      lastPlayerClass = visualClassName;
      arena.setPlayerSrc(playerSrc);
    }

    if(b.phase !== lastBossPhase){
      lastBossPhase = b.phase;
      arena.setBossSrc(bossSrc);
      applyBossTheme(b.boss_name, b.phase);

      if(b.phase === 2){
        const ph = phase2Phrase(b.boss_name);
arena.playVfx("vfx-phase2", "center", 1.75);

// burst extra por boss (impacto da transformação)
if(b.boss_name === "Valtherion"){
  arena.playVfx("vfx-inferno", "center", 1.25, { h: 12, a: 0.55 });
  arena.playVfx("vfx-flame", "center", 1.10, { h: 12, a: 0.45 });
}else if(b.boss_name === "Yamach"){
  arena.playVfx("vfx-emp", "center", 1.15, { h: 200, a: 0.28 });
  arena.playVfx("vfx-sparks", "center", 1.10, { h: 205, a: 0.55 });
  // raio vertical no centro (sem JS pesado)
  arena.playVfx("vfx-lightning", "center", 1.20);
}else if(b.boss_name === "Infimius"){
  arena.playVfx("vfx-glitch", "center", 1.15, { h: 270, a: 0.35 });
  arena.playVfx("vfx-voidtear", "center", 1.10, { h: 265, a: 0.40 });
}

arena.shake2();

        arena.showBanner(ph.title, ph.sub);
        // callout do boss com frase curta
        state.vfx?.emit("speech", { target:"boss", text: "TRANSFORMAÇÃO!" });
      }else{
        arena.playVfx("vfx-phase", "center", 1);
      }
    }
  }

  function playQueuedVfx(){
    const q = state.vfx.queue;
    while(q.length){
      const ev = q.shift();
      if(ev.type === "hit"){
        arena.playVfx("vfx-hit", ev.target, ev.intensity ?? 1);
        arena.shake();
      }else if(ev.type === "crit"){
        arena.playVfx("vfx-crit", ev.target, ev.intensity ?? 1.2);
        arena.shake();
      }else if(ev.type === "speech"){
        arena.showCallout(ev.target, ev.text);
      }else if(ev.type === "float"){
        arena.floatText(ev.target, ev.text, ev.kind);
      }else if(ev.type === "custom"){
        arena.playVfx(ev.className, ev.target, ev.intensity ?? 1, ev.vars ?? null);
      }else if(ev.type === "heal"){
        arena.playVfx("vfx-heal", ev.target, 1);
      }else if(ev.type === "buff"){
        arena.playVfx("vfx-buff", ev.target, 1);
      }else if(ev.type === "debuff"){
        arena.playVfx("vfx-debuff", ev.target, 1);
      }else if(ev.type === "lightning"){
        arena.playVfx("vfx-lightning", ev.target, ev.intensity ?? 1);
        arena.shake();
      }else if(ev.type === "bossatk1"){
        arena.playVfx("vfx-bossatk1", ev.target, 1);
        const src = resolveBossAttackGif(state.battle.boss.boss_name, 1, state.data.assetManifest);
        if(src) arena.playBossAction(src, 520);
      }else if(ev.type === "bossatk2"){
        arena.playVfx("vfx-bossatk2", ev.target, 1);
        const src = resolveBossAttackGif(state.battle.boss.boss_name, 2, state.data.assetManifest);
        if(src) arena.playBossAction(src, 560);
      }else if(ev.type === "bossSprite"){
        arena.playBossAction(ev.src, ev.ms ?? 520);
      }else if(ev.type === "phase"){
        arena.playVfx("vfx-phase", "center", 1);
      }
    }
  }

  function update(){
    // velocidade (VFX + pacing)
    const sp = state.settings?.combatSpeed || 'normal';
    arena.setSpeed?.(sp);

    // rebuild skill buttons only if list changed size (evolução)
    if(skillsWrap.childElementCount !== state.playerSkillsVisible.length){
      rebuildSkillButtons();
    }
    rebuildConsumables();
    updateHud();
    updateSprites();
    playQueuedVfx();

    
// bloquear input enquanto anima/resolve turnos
const busy = !!state.ui?.busy;
btnAtk.disabled = busy;
btnDef.disabled = busy;

// update disabled state on skills (cd/locked)
    const buttons = skillsWrap.querySelectorAll("button");
    buttons.forEach((btn, idx) => {
      const sk = state.playerSkillsVisible[idx];
      if(!sk) return;
      const cd = state.player.cooldowns[sk.skill_id] ?? 0;
      const locked = state.player.lockedSkills.has(sk.skill_id);
      btn.disabled = busy || locked || cd > 0;

// badge compacto de CD
const cdBadge = btn.querySelector(".cd-badge");
btn.classList.toggle("cd", cd > 0 && !locked);
if(cdBadge){
  cdBadge.textContent = cd > 0 && !locked ? String(cd) : "";
}

const metaSub = btn.querySelector(".sub");
if(metaSub){
  metaSub.textContent = locked ? "Bloqueada" : cd>0 ? `CD ${cd}` : `MP ${sk.mp_cost} • CD ${sk.cooldown_turns}`;
}
    });
  }

  // initial build
  rebuildSkillButtons();
  rebuildConsumables();
  updateHud();
  updateSprites();

  return { root, update };
}