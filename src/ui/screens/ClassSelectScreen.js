import { tooltipped } from "../components/Tooltipped.js";
import { hpBar, mpBar } from "../components/StatBars.js";
import { resolveClassGif, placeholderSprite } from "../../util/assets.js";

export function ClassSelectScreen({ data, onPick }){
  const root = document.createElement("div");
  root.className = "panel col";
  root.appendChild(Object.assign(document.createElement("div"), { className:"row", innerHTML:`<span class="badge">SELEÇÃO DE CLASSE</span>` }));

  const grid = document.createElement("div");
  grid.className = "grid3";

  for(const cls of data.classes){
    const card = document.createElement("div");
    card.className = "panel col";
    card.style.borderColor = "var(--border)";

    const title = document.createElement("div");
    title.className = "row";
    title.appendChild(tooltipped(cls.class_name, `<b>${cls.class_name}</b><br><span class="small">Evolui para: ${cls.evolution_target}</span>`));
    card.appendChild(title);

    const portrait = document.createElement("div");
    portrait.className = "portrait";
    const img = document.createElement("img");
    img.src = resolveClassGif(cls.class_name, data.assetManifest);
    img.alt = cls.class_name;
    img.decoding = "async";
    img.loading = "eager";
    img.onerror = () => { img.src = placeholderSprite(); };
    portrait.appendChild(img);
    card.appendChild(portrait);

    const s = document.createElement("div");
    s.className = "small";
    s.innerHTML = `
      <div class="kv"><span>HP</span><span>${cls.hp_base}</span></div>
      <div class="kv"><span>MP</span><span>${cls.mp_base}</span></div>
      <div class="kv"><span>ATQ</span><span>${cls.atq_base}</span></div>
      <div class="kv"><span>DEF</span><span>${cls.def_base}</span></div>
      <div class="kv"><span>EVA</span><span>${cls.eva_pp}%</span></div>
      <div class="kv"><span>CRIT</span><span>${cls.crit_pp}%</span></div>
    `;
    card.appendChild(s);

    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = "Escolher";
    btn.onclick = () => onPick(cls.class_id);
    card.appendChild(btn);

    grid.appendChild(card);
  }

  root.appendChild(grid);
  return root;
}
