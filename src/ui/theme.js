import { slugify, resolveBossGif } from "../util/assets.js";

export function applyBossTheme(bossName, phase){
  const body = document.body;
  if(!body) return;
  body.dataset.boss = slugify(bossName);
  body.dataset.phase = String(phase || 1);

  // global themed background FX
  let bgFx = document.getElementById("bgFx");
  if(!bgFx){
    bgFx = document.createElement("div");
    bgFx.id = "bgFx";
    document.body.appendChild(bgFx);
  }

  // ambient boss silhouette (Phase 2)
  let bg = document.getElementById("bossBg");
  if(!bg){
    bg = document.createElement("div");
    bg.id = "bossBg";
    document.body.appendChild(bg);
  }
  const src = resolveBossGif(bossName, phase, null);
  bg.style.backgroundImage = `url(${src})`;

  // pulse on phase change / boss change
  body.classList.remove("theme-pulse");
  // force reflow
  void body.offsetWidth;
  body.classList.add("theme-pulse");
  setTimeout(()=> body.classList.remove("theme-pulse"), 720);
}
