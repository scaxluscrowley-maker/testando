import { placeholderSprite } from "../../util/assets.js";

function imgWithFallback(src){
  const img = document.createElement("img");
  img.src = src || placeholderSprite();
  img.alt = "";
  img.decoding = "async";
  img.loading = "eager";
  img.onerror = () => { img.src = placeholderSprite(); };
  return img;
}

export function createArena(){
  const root = document.createElement("div");
  root.className = "arena";

  // velocidade (VFX e timings) - controlada pelo seletor na batalha
  let speedMult = 1;
  function setSpeed(speed){
    const s = String(speed || "normal");
    speedMult = s === "cinematic" ? 2.10 : s === "slow" ? 1.60 : 1.25;
    // expõe também como CSS var, para animações puramente CSS
    root.style.setProperty("--spd", String(speedMult));
  }
  setSpeed("normal");

  const spriteLayer = document.createElement("div");
  spriteLayer.className = "sprite-layer";

  // Boss (left)
  const bossWrap = document.createElement("div");
  bossWrap.className = "sprite boss";
  const bossFront = imgWithFallback(placeholderSprite());
  const bossBack = imgWithFallback(placeholderSprite());
  bossBack.className = "double";
  bossWrap.appendChild(bossFront);
  bossWrap.appendChild(bossBack);

  // Player (right)
  const playerWrap = document.createElement("div");
  playerWrap.className = "sprite player";
  const playerFront = imgWithFallback(placeholderSprite());
  const playerBack = imgWithFallback(placeholderSprite());
  playerBack.className = "double";
  playerWrap.appendChild(playerFront);
  playerWrap.appendChild(playerBack);

  spriteLayer.appendChild(bossWrap);
  spriteLayer.appendChild(playerWrap);

  const vfxLayer = document.createElement("div");
  vfxLayer.className = "vfx-layer";

  const floatLayer = document.createElement("div");
  floatLayer.className = "float-layer";

  const calloutLayer = document.createElement("div");
  calloutLayer.className = "callout-layer";

  const bannerLayer = document.createElement("div");
  bannerLayer.className = "banner-layer";

  root.appendChild(spriteLayer);
  root.appendChild(vfxLayer);
  root.appendChild(floatLayer);
  root.appendChild(calloutLayer);
  root.appendChild(bannerLayer);

  function crossfade(front, back, src){
    if(!src) return;
    if(front.src === src) return;

    // pré-carrega no back para evitar flash branco
    back.classList.remove("show");
    back.src = src;

    const onload = () => {
      // faz crossfade
      requestAnimationFrame(() => {
        back.classList.add("show");
        // após a transição, troca o front
        setTimeout(() => {
          front.src = src;
          back.classList.remove("show");
        }, 240);
      });
      back.removeEventListener("load", onload);
    };
    back.addEventListener("load", onload);
  }

  function shake(){
    root.classList.remove("shake");
    // força reflow para reiniciar animação
    void root.offsetWidth;
    root.classList.add("shake");
  }

  function shake2(){
    root.classList.remove("shake2");
    void root.offsetWidth;
    root.classList.add("shake2");
  }

  function playVfx(type, target="center", intensity=1, vars=null){
    // target: "boss" | "player" | "center"
    const node = document.createElement("div");
    node.className = "vfx " + type;
    if(vars){
      for(const [k,v] of Object.entries(vars)) node.style.setProperty(`--${k}`, String(v));
    }

    // offsets (pequena variação para partículas)
    const ox = (Math.random()*36 - 18) * intensity;
    const oy = (Math.random()*28 - 14) * intensity;

    if(target === "boss"){
      node.style.left = "25%";
      node.style.top = "55%";
    }else if(target === "player"){
      node.style.left = "75%";
      node.style.top = "62%";
    }else{
      node.style.left = "50%";
      node.style.top = "55%";
    }

    if(type === "vfx-lightning"){
      node.style.top = "35%";
      node.style.setProperty("--lx", `${ox}px`);
    }else{
      node.style.transform = `translate(-50%,-50%) translate(${ox}px,${oy}px)`;
    }
    vfxLayer.appendChild(node);

    // remove após animação
    const ttlBase = type === "vfx-phase2" ? 1200 : type === "vfx-phase" ? 900 : type === "vfx-lightning" ? 620 : 820;
    const ttl = Math.round(ttlBase * speedMult);
    setTimeout(() => node.remove(), ttl);

    // intensifica com múltiplos "hits" (barato)
    if(type === "vfx-lightning"){
      const extra = Math.min(2, Math.floor(intensity));
      for(let i=0;i<extra;i++){
        const b = document.createElement("div");
        b.className = "vfx vfx-lightning";
        b.style.left = node.style.left;
        b.style.top = "35%";
        const ox3 = (Math.random()*30 - 15) * intensity;
        b.style.setProperty("--lx", `${ox3}px`);
        vfxLayer.appendChild(b);
        setTimeout(()=> b.remove(), Math.round(620 * speedMult));
      }
      return;
    }

    if(type === "vfx-hit" || type === "vfx-crit"){
      const extra = Math.min(3, intensity);
      for(let i=0;i<extra;i++){
        const n2 = document.createElement("div");
        n2.className = "vfx " + type;
        const ox2 = (Math.random()*56 - 28) * intensity;
        const oy2 = (Math.random()*40 - 20) * intensity;
        n2.style.left = node.style.left;
        n2.style.top = node.style.top;
        n2.style.transform = `translate(-50%,-50%) translate(${ox2}px,${oy2}px)`;
        vfxLayer.appendChild(n2);
        setTimeout(() => n2.remove(), Math.round(820 * speedMult));
      }
    }
  }


function getAnchor(target){
  const arenaRect = root.getBoundingClientRect();
  const wrap = (target === "boss" ? bossWrap : target === "player" ? playerWrap : root);
  const r = wrap.getBoundingClientRect();

  // posição base (centro X, "cabeça" em Y)
  const headFactor = target === "player" ? 0.14 : 0.18;
  let x = (r.left + r.width/2) - arenaRect.left;
  let y = (r.top + r.height*headFactor) - arenaRect.top;

  // clamp horizontal para não cortar textos longos nas bordas
  const pad = 100;
  x = Math.max(pad, Math.min((arenaRect.width - pad), x));
  y = Math.max(48, y);

  return { x, y, arenaRect };
}

function floatText(target, text, kind="dmg"){
  const { x, y } = getAnchor(target);
  const node = document.createElement("div");
  node.className = `float-text ${kind}`;
  node.textContent = text;

  const dx = (Math.random()*26 - 13);
  const dy = (Math.random()*10 - 5);
  node.style.left = `${x}px`;
  node.style.top = `${y + dy}px`;
  node.style.setProperty("--dx", `${dx}px`);
  floatLayer.appendChild(node);
  setTimeout(()=> node.remove(), Math.round(1900 * speedMult));
}

let bossCallout = null;
let playerCallout = null;

function showCallout(target, text){
  const { x, y } = getAnchor(target);
  const node = document.createElement("div");
  node.className = "skill-callout";
  node.textContent = text;

  node.style.left = `${x}px`;
  node.style.top = `${Math.max(26, y - 26)}px`;

  // substitui callout anterior para não empilhar
  if(target === "boss"){
    bossCallout?.remove();
    bossCallout = node;
  }else if(target === "player"){
    playerCallout?.remove();
    playerCallout = node;
  }
  calloutLayer.appendChild(node);
  // anim start
  requestAnimationFrame(()=> node.classList.add("show"));
  const keep = Math.round(1200 * speedMult);
  const fade = Math.round(420 * speedMult);
  setTimeout(()=> {
    node.classList.remove("show");
    setTimeout(()=> node.remove(), fade);
  }, keep);
}

  

function showBanner(title, sub=null){
  const node = document.createElement("div");
  node.className = "battle-banner";
  const t = document.createElement("div");
  t.className = "title";
  t.textContent = title || "";
  node.appendChild(t);
  if(sub){
    const s = document.createElement("div");
    s.className = "sub";
    s.textContent = sub;
    node.appendChild(s);
  }
  bannerLayer.appendChild(node);
  // remove after animation window
  setTimeout(()=> node.remove(), Math.round(1750 * speedMult));
}

let bossIdleSrc = null;

function setBossIdle(src){
  bossIdleSrc = src;
  crossfade(bossFront, bossBack, src);
}

function playBossAction(actionSrc, durationMs=480){
  if(!actionSrc) return;
  // troca para action e volta pro idle
  crossfade(bossFront, bossBack, actionSrc);
  setTimeout(() => {
    if(bossIdleSrc) crossfade(bossFront, bossBack, bossIdleSrc);
  }, Math.max(Math.round(260*speedMult), Math.round(durationMs * speedMult)));
}
return {
    root,
    setBossSrc: (src) => setBossIdle(src),
    setSpeed,
    setBossIdle,
    setPlayerSrc: (src) => crossfade(playerFront, playerBack, src),
    shake,
    playVfx,
    playBossAction,
    floatText,
    showCallout,
  };
}
