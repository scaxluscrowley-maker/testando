export function PostBattleScreen({ state, victory, onNext }){
  const root = document.createElement("div");
  root.className = "panel col";

  const boss = state.data.bossOrder[state.run.bossIndex];
  root.innerHTML = `
    <div class="row">
      <span class="badge">PÓS-BATALHA</span>
      <span class="badge">Kernel: <b>${boss.boss_name}</b></span>
      <span class="badge">${victory ? "VITÓRIA" : "DERROTA"}</span>
    </div>
  `;

  const frag = state.run.fragments[boss.boss_name] ?? [];
  if(victory){
    const f = document.createElement("div");
    f.className = "small";
    f.innerHTML = `<div class="hr"></div><b>FRAGMENTOS</b><div class="hr"></div>` + frag.map(x=>`<div class="mono">${x}</div>`).join("");
    root.appendChild(f);
  }

  const btn = document.createElement("button");
  btn.className = "btn primary";
  btn.textContent = "Continuar";
  btn.onclick = onNext;
  root.appendChild(btn);

  return root;
}
