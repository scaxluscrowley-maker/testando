import { LogPanel } from "../components/LogPanel.js";
import { resolveBossGif, resolveItemIcon, placeholderSprite } from "../../util/assets.js";

export function PrepScreen({ state, onStartBattle, onBackMenu }){
  const root = document.createElement("div");
  root.className = "col";

  const header = document.createElement("div");
  header.className = "panel row";
  const boss = state.data.bossOrder[state.run.bossIndex];
  header.innerHTML = `
    <span class="badge">PREPARAÇÃO</span>
    <span class="badge">Kernel: <b>${boss.boss_name}</b></span>
    <span class="badge">Terminal (pré): <b>${state.terminal.prepTriesLeft}/${state.consts.MAX_TRIES_PER_BOSS}</b></span>
    <span class="badge">Terminal (luta): <b>${state.consts.MAX_BATTLE_CONSUMABLE_CODES} slots</b></span>
    <span class="badge">Consumíveis: <b>${state.inventory.consumables.length}/${state.consts.MAX_CONSUMABLES}</b></span>
  `;
  root.appendChild(header);

  const mid = document.createElement("div");
  mid.className = "grid2";

  const terminalPanel = document.createElement("div");
terminalPanel.className = "panel col";
terminalPanel.innerHTML = `<div class="row"><span class="badge">TERMINAL (pré-luta)</span></div>`;

const termInput = document.createElement("input");
termInput.type = "text";
termInput.placeholder = "Digite o código (equip/evolução/consumível)…";

const termBtn = document.createElement("button");
termBtn.className = "btn primary";
termBtn.textContent = "Executar";
termBtn.onclick = () => {
  state.submitPrepCode(termInput.value);
  termInput.value = "";
};

const termInfo = document.createElement("div");
termInfo.className = "small";
termInfo.innerHTML = `
  Tentativas: <b>${state.terminal.prepTriesLeft}/${state.consts.MAX_TRIES_PER_BOSS}</b><br>
  <span class="small">Válido / inválido / repetido consome tentativa.</span><br>
  <span class="small">Em combate, você ganha <b>+${state.consts.MAX_BATTLE_CONSUMABLE_CODES}</b> inserções (somente consumíveis).</span>
`;

const fr = (state.run.fragments?.[boss.boss_name] ?? []).map(x=>`<span class="badge">${x}</span>`).join(" ");
const fragLine = document.createElement("div");
fragLine.className = "row";
fragLine.innerHTML = fr || `<span class="small">(sem fragmentos configurados)</span>`;

const fragTitle = document.createElement("div");
fragTitle.className = "small";
fragTitle.textContent = "Fragmentos recuperados:";

terminalPanel.appendChild(termInput);
terminalPanel.appendChild(termBtn);
terminalPanel.appendChild(Object.assign(document.createElement("div"), { className:"hr" }));
terminalPanel.appendChild(termInfo);
terminalPanel.appendChild(Object.assign(document.createElement("div"), { className:"hr" }));
terminalPanel.appendChild(fragTitle);
terminalPanel.appendChild(fragLine);

  const inv = document.createElement("div");
inv.className = "panel col";
const it = state.data.itemsById;

const weapon = state.inventory.equipment.weapon ? (it[state.inventory.equipment.weapon]?.name ?? state.inventory.equipment.weapon) : "-";
const armor  = state.inventory.equipment.armor  ? (it[state.inventory.equipment.armor]?.name ?? state.inventory.equipment.armor)   : "-";
const artifact = state.inventory.equipment.artifact ? (it[state.inventory.equipment.artifact]?.name ?? state.inventory.equipment.artifact) : "-";
const evo = state.run.evolutionPendingItemId ? (it[state.run.evolutionPendingItemId]?.name ?? state.run.evolutionPendingItemId) : "-";

const consNames = state.inventory.consumables.map(id => it[id]?.name ?? id);

inv.innerHTML = `<div class="row"><span class="badge">EQUIPAMENTOS</span></div>
  <div class="small">Itens equipados permanecem entre bosses. Evolução é aplicada ao iniciar a batalha.</div>

  <div class="hr"></div>
  <div class="kv"><b>Evolução (pendente):</b> <span>${evo}</span></div>
  <div class="kv"><b>Weapon:</b> <span>${weapon}</span></div>
  <div class="kv"><b>Armor:</b> <span>${armor}</span></div>
  <div class="kv"><b>Artifact:</b> <span>${artifact}</span></div>

  <div class="hr"></div>
  <div><b>Consumíveis (${state.inventory.consumables.length}/${state.consts.MAX_CONSUMABLES}):</b></div>
  <div class="small">${consNames.join(", ") || "-"}</div>
`;

mid.appendChild(terminalPanel);
mid.appendChild(inv);

  root.appendChild(mid);

  const footer = document.createElement("div");
  footer.className = "grid2";
  footer.appendChild(LogPanel(state.log));

  const actions = document.createElement("div");
  actions.className = "panel col";

  const b1 = document.createElement("button");
  b1.className = "btn primary";
  b1.textContent = "Iniciar Batalha";
  b1.onclick = onStartBattle;

  const b2 = document.createElement("button");
  b2.className = "btn";
  b2.textContent = "Voltar ao Menu";
  b2.onclick = onBackMenu;

  actions.appendChild(b1);
  actions.appendChild(b2);

  const tip = document.createElement("div");
  tip.className = "small";
  tip.textContent = "Obs.: agora o Terminal é usado DURANTE a luta para inserir códigos de consumíveis.";
  actions.appendChild(tip);

  footer.appendChild(actions);
  root.appendChild(footer);

  return root;
}
