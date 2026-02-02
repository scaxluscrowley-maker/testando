export function RunSummaryScreen({ state, onBackToMenu }){
  const root = document.createElement("div");
  root.className = "panel col";

  const s = state.run.stats;
  root.innerHTML = `
    <div class="row">
      <span class="badge">RESUMO DA RUN</span>
      <span class="badge">${s.victory ? "VITÓRIA" : "DERROTA"}</span>
    </div>
    <div class="hr"></div>
    <div class="kv"><span>Tempo total</span><span><b>${(s.totalMs/1000).toFixed(1)}s</b></span></div>
    <div class="kv"><span>Dano causado</span><span><b>${s.damageDealt}</b></span></div>
    <div class="kv"><span>Dano recebido</span><span><b>${s.damageTaken}</b></span></div>
    <div class="kv"><span>Cura feita</span><span><b>${s.healDone}</b></span></div>
    <div class="kv"><span>BOSSES derrotados</span><span><b>${s.bossesDefeated}/3</b></span></div>
    <div class="hr"></div>
    <div><b>Tempo por boss</b></div>
    <div class="small">${Object.entries(s.bossTimeMs).map(([k,v])=>`${k}: ${(v/1000).toFixed(1)}s`).join("<br>")}</div>
    <div class="hr"></div>
  `;

  const btn = document.createElement("button");
  btn.className = "btn primary";
  btn.textContent = "Confirmar e voltar ao menu";
  btn.onclick = onBackToMenu;
  root.appendChild(btn);

  const tip = document.createElement("div");
  tip.className = "small";
  tip.textContent = "Dica: você pode publicar no GitHub Pages (Settings → Pages).";
  root.appendChild(tip);
  return root;
}
