import { hpBar, mpBar } from "../components/StatBars.js";
import { tooltipped } from "../components/Tooltipped.js";

export function BattleScreen({ state, onQuitToMenu }){
  const root = document.createElement("div");
  root.className = "col";

  const p = state.player;
  const b = state.battle.boss;

  const header = document.createElement("div");
  header.className = "panel";
  const top = document.createElement("div");
  top.className = "grid2";

  // Boss panel
  const bossPanel = document.createElement("div");
  bossPanel.className = "col";
  bossPanel.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">BOSS</span><span class="badge"><b>${b.boss_name}</b> (Fase ${b.phase})</span><span class="badge">Turno ${state.battle.turnBattle}</span>` }));
  bossPanel.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:`HP ${b.hp}/${b.maxHp} | ATQ ${b.atq.toFixed(1)} | DEF ${b.def.toFixed(1)}` }));
  bossPanel.appendChild(hpBar(b.hp, b.maxHp));
  bossPanel.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:`Status: ${b.statuses.map(s=>s.id).join(", ") || "-"}` }));

  // Player panel
  const playerPanel = document.createElement("div");
  playerPanel.className = "col";
  playerPanel.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">JOGADOR</span><span class="badge"><b>${state.player.class_name}</b>${state.run.evolved ? " (Evoluído)" : ""}</span>` }));
  playerPanel.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:`HP ${p.hp}/${p.maxHp} | MP ${p.mp}/${p.maxMp} | ATQ ${p.atq.toFixed(1)} | DEF ${p.def.toFixed(1)} | EVA ${p.eva}% | CRIT ${p.crit}%` }));
  playerPanel.appendChild(hpBar(p.hp, p.maxHp));
  playerPanel.appendChild(mpBar(p.mp, p.maxMp));
  playerPanel.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:`Status: ${p.statuses.map(s=>s.id).join(", ") || "-"}` }));

  top.appendChild(bossPanel);
  top.appendChild(playerPanel);

  header.appendChild(top);
  root.appendChild(header);

  const mid = document.createElement("div");
  mid.className = "grid2";

  // actions left
  const actionPanel = document.createElement("div");
  actionPanel.className = "panel col";
  actionPanel.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">AÇÕES</span>` }));

  const row1 = document.createElement("div");
  row1.className = "row";
  const atk = document.createElement("button");
  atk.className = "btn primary";
  atk.textContent = "Atacar";
  atk.onclick = () => state.actPlayer("attack");
  const def = document.createElement("button");
  def.className = "btn";
  def.textContent = "Defender (+50% DEF, expira no fim da rodada)";
  def.onclick = () => state.actPlayer("defend");
  row1.appendChild(atk); row1.appendChild(def);
  actionPanel.appendChild(row1);

  const skillsWrap = document.createElement("div");
  skillsWrap.className = "col";
  skillsWrap.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">SKILLS</span>` }));

  const skillsRow = document.createElement("div");
  skillsRow.className = "row";
  for(const sk of state.playerSkillsVisible){
    const cd = state.player.cooldowns[sk.skill_id] ?? 0;
    const locked = state.player.lockedSkills.has(sk.skill_id);
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.disabled = locked || cd > 0;
    btn.textContent = locked ? `🔒 ${sk.skill_name}` : cd>0 ? `${sk.skill_name} (CD ${cd})` : sk.skill_name;
    const tip = `<b>${sk.skill_name}</b><br><span class="small">${sk.effect_text}</span><br><span class="small">MP: ${sk.mp_cost} | CD: ${sk.cooldown_turns}</span>`;
    const w = document.createElement("span");
    w.className = "tooltip";
    const label = document.createElement("span");
    label.textContent = "";
    const tipEl = document.createElement("div");
    tipEl.className = "tip";
    tipEl.innerHTML = tip;
    w.appendChild(btn);
    w.appendChild(tipEl);
    skillsRow.appendChild(w);

    btn.onclick = () => state.actPlayer("skill", sk.skill_id);
  }
  skillsWrap.appendChild(skillsRow);
  actionPanel.appendChild(skillsWrap);

  // consumables right
  const invPanel = document.createElement("div");
  invPanel.className = "panel col";
  invPanel.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">CONSUMÍVEIS</span>` }));
  const lock = state.player.statuses.some(s=>s.id==="TERMINAL_LOCK");
  if(lock){
    invPanel.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"Terminal bloqueado: não pode usar consumíveis." }));
  }else{
    invPanel.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"Clique para usar (uso único)." }));
  }

  for(const id of state.inventory.consumables){
    const it = state.data.itemsById[id];
    const b = document.createElement("button");
    b.className = "btn";
    b.disabled = lock;
    b.textContent = it ? it.name : id;
    b.onclick = () => state.actPlayer("consumable", id);
    const small = document.createElement("div");
    small.className = "small";
    small.textContent = it?.effect_text ?? "";
    invPanel.appendChild(b);
    invPanel.appendChild(small);
  }
  if(state.inventory.consumables.length === 0){
    invPanel.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"(vazio)" }));
  }

  mid.appendChild(actionPanel);
  mid.appendChild(invPanel);
  root.appendChild(mid);

  const bottom = document.createElement("div");
  bottom.className = "grid2";

  const quit = document.createElement("div");
  quit.className = "panel col";
  const qbtn = document.createElement("button");
  qbtn.className = "btn danger";
  qbtn.textContent = "Desistir e voltar ao menu";
  qbtn.onclick = onQuitToMenu;
  quit.appendChild(qbtn);
  quit.appendChild(Object.assign(document.createElement("div"), { className:"small", textContent:"Sem salvamento. Voltar ao menu reinicia a run." }));
  bottom.appendChild(quit);

  root.appendChild(bottom);

  return root;
}
