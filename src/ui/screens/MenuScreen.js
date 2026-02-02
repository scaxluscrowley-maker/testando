export function MenuScreen({ onStart }){
  const root = document.createElement("div");
  root.className = "panel col";
  root.innerHTML = `
    <div class="row">
      <span class="badge">MONSTERS & CODE</span>
      <span class="badge">Tech-RPG</span>
    </div>
    <div class="small">
      MVP web (HTML/CSS/JS). Sem salvamento. 3 kernels. Códigos são descobertos fora do jogo.
    </div>
    <div class="hr"></div>
  `;
  const btn = document.createElement("button");
  btn.className = "btn primary";
  btn.textContent = "Iniciar";
  btn.onclick = onStart;
  root.appendChild(btn);

  const tip = document.createElement("div");
  tip.className = "small";
  tip.style.marginTop = "10px";
  tip.textContent = "Dica: use o Terminal na preparação para resgatar itens por código (Base64).";
  root.appendChild(tip);
  return root;
}
