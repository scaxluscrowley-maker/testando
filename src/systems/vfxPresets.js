/**
 * VFX Presets (data-driven)
 * Objetivo: VFX únicos por habilidade (player e boss) com CSS leve (transform/opacity).
 *
 * Saída: enfileira eventos em state.vfx.queue:
 *  - {type:"custom", className:"vfx-slice", target:"boss", intensity:1, vars:{h:190, a:0.9}}
 *  - {type:"lightning", target:"boss", intensity:1.5}
 */
function norm(s){
  return String(s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}


function hueByClass(className){
  // 6 classes -> paleta fixa (consistente)
  const n = norm(className);
  if(n.includes("mago")) return 200;
  if(n.includes("arcano")) return 265;
  if(n.includes("gatuno")) return 120;
  if(n.includes("algoz")) return 350;
  if(n.includes("espadachim")) return 35;
  if(n.includes("mestre")) return 50;
  return 190;
}

function hueByBoss(bossName){
  const n = norm(bossName);
  if(n.includes("valtherion")) return 355;
  if(n.includes("yamach")) return 200;
  if(n.includes("infimius")) return 260;
  return 190;
}

function pick(arr, seed){
  return arr[Math.abs(seed) % arr.length];
}

function seedFromId(skillId){
  let s = String(skillId || "");
  let h = 0;
  for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return h;
}


function emitMany(state, list){
  for(const it of list){
    emitCustom(state, it.className, it.target, it.intensity ?? 1, it.vars ?? null);
  }
}

function emitCustom(state, className, target, intensity, vars){
  state?.vfx?.emit("custom", { className, target, intensity, vars });
}

function emitCombo(state, baseHue, target, seed, phaseMult){
  // Gera um combo visual "único" por seed
  const types = ["vfx-slice","vfx-pierce","vfx-burst","vfx-rune","vfx-cloud","vfx-hex","vfx-shards","vfx-wave","vfx-glitch"];
  const extra = ["vfx-ring","vfx-sparks","vfx-ring2"];
  const t1 = pick(types, seed);
  const t2 = pick(extra, seed >> 3);

  const inten = 1 + ((seed % 5) * 0.12);
  const hue1 = baseHue;
  const hue2 = (baseHue + 40 + (seed % 30)) % 360;

  emitCustom(state, t1, target, inten * phaseMult, { h: hue1, a: 0.90 });
  emitCustom(state, t2, target, 0.9 * phaseMult, { h: hue2, a: 0.55 });
}

export function emitSkillVfx(state, skill, ctx){
  const name = norm(skill?.skill_name);
  const id = skill?.skill_id ?? name;
  const seed = seedFromId(id);

  const target = ctx?.target || (ctx?.source === "boss" ? "player" : "boss");
  const phase = ctx?.phase || 1;

  const baseHue = ctx?.source === "boss"
    ? hueByBoss(ctx?.bossName || ctx?.boss || "")
    : hueByClass(skill?.class_name || "");

  const phaseMult = phase === 2 ? 1.18 : 1.0;


// ===== Presets específicos (mais condizentes com o nome) =====
if(ctx?.source !== "boss"){
  // PLAYER (6 classes)
  switch(name){
case "ataque basico":
  // pequeno impacto físico/místico conforme a classe
  if(norm(skill?.class_name).includes("mago") || norm(skill?.class_name).includes("arcano")){
    emitMany(state, [
      { className:"vfx-rune", target, intensity:0.95*phaseMult, vars:{ h: baseHue, a:0.30 } },
      { className:"vfx-burst", target, intensity:0.95*phaseMult, vars:{ h: baseHue, a:0.22 } },
    ]);
  }else{
    emitMany(state, [
      { className:"vfx-slice", target, intensity:1.00*phaseMult, vars:{ h: baseHue, a:0.55 } },
      { className:"vfx-sparks", target, intensity:0.85*phaseMult, vars:{ h: (baseHue+20)%360, a:0.35 } },
    ]);
  }
  return;
case "defender":
  emitMany(state, [
    { className:"vfx-shield", target:"player", intensity:1.10*phaseMult, vars:{ h: baseHue, a:0.55 } },
    { className:"vfx-ring2", target:"player", intensity:0.95*phaseMult, vars:{ h: (baseHue+20)%360, a:0.20 } },
  ]);
  return;
    // MAGO
    case "relampago":
      state?.vfx?.emit("lightning", { target, intensity: 1.85 * phaseMult });
      emitMany(state, [
        { className:"vfx-sparks", target, intensity:1.1*phaseMult, vars:{ h: 200, a:0.90 } },
        { className:"vfx-ring2", target, intensity:0.9*phaseMult, vars:{ h: 220, a:0.28 } },
      ]);
      return;
    case "misseis de chamas":
      emitMany(state, [
        { className:"vfx-wave", target, intensity:1.05*phaseMult, vars:{ h: 18, a:0.55 } },
        { className:"vfx-flame", target, intensity:1.10*phaseMult, vars:{ h: 18, a:0.78 } },
        { className:"vfx-burst", target, intensity:0.95*phaseMult, vars:{ h: 5, a:0.30 } },
      ]);
      return;
    case "canalizacao":
      // "carrega" energia: runas + anel no jogador
      emitMany(state, [
        { className:"vfx-rune", target:"player", intensity:1.05, vars:{ h: 205, a:0.45 } },
        { className:"vfx-ring", target:"player", intensity:0.95, vars:{ h: 200, a:0.32 } },
        { className:"vfx-sparks", target:"player", intensity:0.80, vars:{ h: 210, a:0.55 } },
      ]);
      return;
    case "escudo magico":
      emitMany(state, [
        { className:"vfx-shield", target:"player", intensity:1.10, vars:{ h: 200, a:0.60 } },
        { className:"vfx-ring2", target:"player", intensity:0.90, vars:{ h: 210, a:0.20 } },
      ]);
      return;

    // GATUNO
    case "punhal envenenado":
      emitMany(state, [
        { className:"vfx-pierce", target, intensity:1.15*phaseMult, vars:{ h: 120, a:0.85 } },
        { className:"vfx-poison", target, intensity:1.05*phaseMult, vars:{ h: 130, a:0.70 } },
        { className:"vfx-cloud", target, intensity:0.95*phaseMult, vars:{ h: 140, a:0.35 } },
      ]);
      return;
    case "corte serrilhado":
      emitMany(state, [
        { className:"vfx-slice", target, intensity:1.20*phaseMult, vars:{ h: 350, a:0.78 } },
        { className:"vfx-shards", target, intensity:0.95*phaseMult, vars:{ h: 10, a:0.22 } },
      ]);
      return;
    case "tocaia":
      emitMany(state, [
        { className:"vfx-shadowburst", target, intensity:1.10*phaseMult, vars:{ h: 265, a:0.55 } },
        { className:"vfx-slice", target, intensity:1.10*phaseMult, vars:{ h: 120, a:0.70 } },
      ]);
      return;
    case "sede de sangue":
      emitMany(state, [
        { className:"vfx-blood", target:"player", intensity:1.05, vars:{ h: 350, a:0.70 } },
        { className:"vfx-ring", target:"player", intensity:0.95, vars:{ h: 355, a:0.26 } },
        { className:"vfx-sparks", target:"player", intensity:0.85, vars:{ h: 355, a:0.55 } },
      ]);
      return;

    // ESPADACHIM
    case "golpe flamejante":
      emitMany(state, [
        { className:"vfx-slice", target, intensity:1.15*phaseMult, vars:{ h: 25, a:0.75 } },
        { className:"vfx-flame", target, intensity:1.05*phaseMult, vars:{ h: 18, a:0.78 } },
        { className:"vfx-burst", target, intensity:0.90*phaseMult, vars:{ h: 8, a:0.30 } },
      ]);
      return;
    case "concentracao de aco":
      emitMany(state, [
        { className:"vfx-shield", target:"player", intensity:1.05, vars:{ h: 45, a:0.46 } },
        { className:"vfx-shards", target:"player", intensity:0.90, vars:{ h: 55, a:0.18 } },
      ]);
      return;
    case "furia":
      emitMany(state, [
        { className:"vfx-sparks", target:"player", intensity:1.05, vars:{ h: 25, a:0.75 } },
        { className:"vfx-ring2", target:"player", intensity:0.90, vars:{ h: 35, a:0.22 } },
      ]);
      return;
    case "quebra postura":
      emitMany(state, [
        { className:"vfx-hex", target, intensity:1.0*phaseMult, vars:{ h: 330, a:0.38 } },
        { className:"vfx-shards", target, intensity:1.0*phaseMult, vars:{ h: 20, a:0.20 } },
      ]);
      return;

    // MESTRE DAS LÂMINAS
    case "automutilacao":
      emitMany(state, [
        { className:"vfx-blood", target:"player", intensity:1.05, vars:{ h: 350, a:0.60 } },
        { className:"vfx-sparks", target:"player", intensity:0.90, vars:{ h: 50, a:0.55 } },
      ]);
      return;
    case "encantar lamina":
      emitMany(state, [
        { className:"vfx-rune", target:"player", intensity:1.05, vars:{ h: 55, a:0.40 } },
        { className:"vfx-sparks", target:"player", intensity:0.95, vars:{ h: 60, a:0.60 } },
        { className:"vfx-ring", target:"player", intensity:0.85, vars:{ h: 58, a:0.22 } },
      ]);
      return;
    case "finalizador de vidas":
      emitMany(state, [
        { className:"vfx-exec", target, intensity:1.12*phaseMult, vars:{ h: 50, a:0.75 } },
        { className:"vfx-burst", target, intensity:1.0*phaseMult, vars:{ h: 18, a:0.24 } },
        { className:"vfx-sparks", target, intensity:0.95*phaseMult, vars:{ h: 45, a:0.55 } },
      ]);
      return;
    case "lamina afiada":
      emitMany(state, [
        { className:"vfx-pierce", target, intensity:1.10*phaseMult, vars:{ h: 55, a:0.85 } },
        { className:"vfx-slice", target, intensity:1.00*phaseMult, vars:{ h: 40, a:0.55 } },
      ]);
      return;

    // ALGOZ
    case "explosao toxica":
      emitMany(state, [
        { className:"vfx-poison", target, intensity:1.15*phaseMult, vars:{ h: 120, a:0.78 } },
        { className:"vfx-burst", target, intensity:1.05*phaseMult, vars:{ h: 140, a:0.26 } },
        { className:"vfx-cloud", target, intensity:1.00*phaseMult, vars:{ h: 130, a:0.35 } },
      ]);
      return;
    case "1000 cortes":
      emitMany(state, [
        { className:"vfx-slice", target, intensity:0.95*phaseMult, vars:{ h: 355, a:0.70 } },
        { className:"vfx-slice", target, intensity:1.05*phaseMult, vars:{ h: 15, a:0.65 } },
        { className:"vfx-slice", target, intensity:1.15*phaseMult, vars:{ h: 200, a:0.40 } },
        { className:"vfx-sparks", target, intensity:1.05*phaseMult, vars:{ h: 350, a:0.55 } },
      ]);
      return;
    case "marti das sombras":
      emitMany(state, [
        { className:"vfx-glitch", target:"player", intensity:0.95, vars:{ h: 280, a:0.45 } },
        { className:"vfx-shadowburst", target:"player", intensity:1.05, vars:{ h: 265, a:0.50 } },
      ]);
      return;
    case "limite obscuro":
      emitMany(state, [
        { className:"vfx-hex", target:"player", intensity:1.05, vars:{ h: 300, a:0.40 } },
        { className:"vfx-shadowburst", target:"player", intensity:1.10, vars:{ h: 265, a:0.55 } },
        { className:"vfx-ring2", target:"player", intensity:0.90, vars:{ h: 280, a:0.20 } },
      ]);
      return;

    // ARCANO
    case "amplificacao mistica":
      emitMany(state, [
        { className:"vfx-rune", target:"player", intensity:1.10, vars:{ h: 265, a:0.45 } },
        { className:"vfx-ring2", target:"player", intensity:1.00, vars:{ h: 275, a:0.22 } },
        { className:"vfx-sparks", target:"player", intensity:0.90, vars:{ h: 285, a:0.55 } },
      ]);
      return;
    case "sacrificio astral":
      emitMany(state, [
        { className:"vfx-voidtear", target, intensity:1.10*phaseMult, vars:{ h: 265, a:0.55 } },
        { className:"vfx-rune", target, intensity:1.00*phaseMult, vars:{ h: 280, a:0.40 } },
        { className:"vfx-burst", target, intensity:1.10*phaseMult, vars:{ h: 300, a:0.26 } },
      ]);
      return;
    case "devastador de horizontes":
      emitMany(state, [
        { className:"vfx-wave", target, intensity:1.20*phaseMult, vars:{ h: 265, a:0.55 } },
        { className:"vfx-shards", target, intensity:1.05*phaseMult, vars:{ h: 280, a:0.22 } },
        { className:"vfx-ring2", target, intensity:0.90*phaseMult, vars:{ h: 255, a:0.18 } },
      ]);
      return;
    case "dissipacao arcana":
      emitMany(state, [
        { className:"vfx-healburst", target:"player", intensity:1.00, vars:{ h: 265, a:0.55 } },
        { className:"vfx-ring2", target:"player", intensity:0.90, vars:{ h: 200, a:0.14 } },
      ]);
      return;
  }
}else{
  // BOSS (skills por nome)
  switch(name){
    // YAMACH
    case "garra voltaica":
      state?.vfx?.emit("lightning", { target, intensity: 1.55 * phaseMult });
      emitMany(state, [
        { className:"vfx-pierce", target, intensity:1.05*phaseMult, vars:{ h: 200, a:0.80 } },
        { className:"vfx-sparks", target, intensity:1.05*phaseMult, vars:{ h: 205, a:0.70 } },
      ]);
      return;
    case "rugido estatico":
      emitMany(state, [
        { className:"vfx-emp", target:"center", intensity:1.05*phaseMult, vars:{ h: 200, a:0.45 } },
        { className:"vfx-glitch", target, intensity:0.95*phaseMult, vars:{ h: 200, a:0.45 } },
      ]);
      return;
    case "pulso draconico emp":
      emitMany(state, [
        { className:"vfx-emp", target:"center", intensity:1.20*phaseMult, vars:{ h: 210, a:0.55 } },
        { className:"vfx-shards", target:"player", intensity:1.0*phaseMult, vars:{ h: 210, a:0.20 } },
      ]);
      return;
    case "turbilhao ionizante":
      emitMany(state, [
        { className:"vfx-wave", target, intensity:1.10*phaseMult, vars:{ h: 210, a:0.45 } },
        { className:"vfx-sparks", target, intensity:1.00*phaseMult, vars:{ h: 205, a:0.60 } },
        { className:"vfx-ring2", target, intensity:0.85*phaseMult, vars:{ h: 240, a:0.16 } },
      ]);
      return;
    case "sobrecarga draconica transformacao":
      emitMany(state, [
        { className:"vfx-phase", target:"center", intensity:1.05, vars:{ h: 205, a:0.35 } },
        { className:"vfx-emp", target:"center", intensity:1.15, vars:{ h: 210, a:0.50 } },
      ]);
      return;

    // INFIMIUS
    case "extracao de dados":
      emitMany(state, [
        { className:"vfx-glitch", target, intensity:1.10*phaseMult, vars:{ h: 265, a:0.55 } },
        { className:"vfx-pierce", target, intensity:0.95*phaseMult, vars:{ h: 200, a:0.65 } },
      ]);
      return;
    case "sifao de processos":
      emitMany(state, [
        { className:"vfx-voidtear", target, intensity:1.05*phaseMult, vars:{ h: 265, a:0.52 } },
        { className:"vfx-wave", target, intensity:0.95*phaseMult, vars:{ h: 200, a:0.35 } },
      ]);
      return;
    case "pacote corrompido":
      emitMany(state, [
        { className:"vfx-glitch", target, intensity:1.15*phaseMult, vars:{ h: 280, a:0.60 } },
        { className:"vfx-shards", target, intensity:1.05*phaseMult, vars:{ h: 265, a:0.22 } },
      ]);
      return;
    case "quarentena de execucao":
      emitMany(state, [
        { className:"vfx-rune", target, intensity:1.05*phaseMult, vars:{ h: 265, a:0.40 } },
        { className:"vfx-hex", target, intensity:0.95*phaseMult, vars:{ h: 285, a:0.30 } },
      ]);
      return;
    case "dominio nucleo infectado transformacao":
      emitMany(state, [
        { className:"vfx-voidtear", target:"center", intensity:1.10, vars:{ h: 270, a:0.55 } },
        { className:"vfx-rune", target:"center", intensity:1.00, vars:{ h: 265, a:0.35 } },
      ]);
      return;

    // VALTHERION
    case "garras do inferno":
    case "lamina infernal":
      emitMany(state, [
        { className:"vfx-inferno", target, intensity:1.10*phaseMult, vars:{ h: 12, a:0.60 } },
        { className:"vfx-slice", target, intensity:1.15*phaseMult, vars:{ h: 5, a:0.70 } },
      ]);
      return;
    case "chamas da condenacao":
    case "misseis infernais":
      emitMany(state, [
        { className:"vfx-inferno", target, intensity:1.15*phaseMult, vars:{ h: 14, a:0.65 } },
        { className:"vfx-burst", target, intensity:1.05*phaseMult, vars:{ h: 0, a:0.30 } },
        { className:"vfx-wave", target, intensity:0.95*phaseMult, vars:{ h: 25, a:0.40 } },
      ]);
      return;
    case "modo raiz execucao absoluta transformacao":
      emitMany(state, [
        { className:"vfx-phase", target:"center", intensity:1.05, vars:{ h: 0, a:0.28 } },
        { className:"vfx-exec", target:"center", intensity:1.10, vars:{ h: 10, a:0.55 } },
        { className:"vfx-inferno", target:"center", intensity:1.05, vars:{ h: 14, a:0.45 } },
      ]);
      return;
  }
}

  // Regras específicas por palavra-chave (deixa "sabor" por skill)
  if(name.includes("relampago")){
    state?.vfx?.emit("lightning", { target, intensity: 1.65 * phaseMult });
    emitCustom(state, "vfx-sparks", target, 1.0 * phaseMult, { h: baseHue, a: 0.85 });
    emitCustom(state, "vfx-ring2", target, 0.8 * phaseMult, { h: (baseHue + (seed % 90)) % 360, a: 0.28 });
    return;
  }

  if(name.includes("cura") || name.includes("curar") || name.includes("restaur")){
    emitCustom(state, "vfx-healburst", target === "boss" ? "player" : target, 1.0, { h: 120, a: 0.75 });
    emitCustom(state, "vfx-ring2", target === "boss" ? "player" : target, 0.8, { h: (120 + (seed % 80)) % 360, a: 0.22 });
    return;
  }

  if(name.includes("venen") || name.includes("toxic")){
    emitCustom(state, "vfx-poison", target, 1.0 * phaseMult, { h: 120, a: 0.70 });
    emitCustom(state, "vfx-cloud", target, 1.1 * phaseMult, { h: 140, a: 0.40 });
    emitCustom(state, "vfx-ring2", target, 0.75 * phaseMult, { h: (140 + (seed % 80)) % 360, a: 0.20 });
    return;
  }

  if(name.includes("sangr") || name.includes("hemor") || name.includes("bleed")){
    emitCustom(state, "vfx-blood", target, 1.0 * phaseMult, { h: 350, a: 0.70 });
    emitCustom(state, "vfx-slice", target, 1.1 * phaseMult, { h: 355, a: 0.85 });
    emitCustom(state, "vfx-ring2", target, 0.75 * phaseMult, { h: (355 + (seed % 80)) % 360, a: 0.18 });
    return;
  }

  if(name.includes("queima") || name.includes("fogo") || name.includes("burn")){
    emitCustom(state, "vfx-flame", target, 1.05 * phaseMult, { h: 15, a: 0.75 });
    emitCustom(state, "vfx-burst", target, 0.95 * phaseMult, { h: 0, a: 0.35 });
    emitCustom(state, "vfx-ring2", target, 0.75 * phaseMult, { h: (15 + (seed % 80)) % 360, a: 0.18 });
    return;
  }

  if(name.includes("escudo") || name.includes("defend") || name.includes("barreira")){
    emitCustom(state, "vfx-shield", ctx?.source === "boss" ? "boss" : "player", 1.0, { h: baseHue, a: 0.55 });
    emitCustom(state, "vfx-ring2", ctx?.source === "boss" ? "boss" : "player", 0.7, { h: (baseHue + (seed % 90)) % 360, a: 0.16 });
    return;
  }

  if(name.includes("silenc") || name.includes("hack") || name.includes("glitch") || name.includes("corromp")){
    emitCustom(state, "vfx-glitch", target, 1.0 * phaseMult, { h: baseHue, a: 0.55 });
    emitCustom(state, "vfx-rune", target, 0.9 * phaseMult, { h: (baseHue+60)%360, a: 0.35 });
    emitCustom(state, "vfx-ring2", target, 0.7 * phaseMult, { h: (baseHue + (seed % 90)) % 360, a: 0.18 });
    return;
  }

  // keyword-based fallback (mais condizente)
// Se não houver preset exato, tenta inferir por palavras-chave do nome
if(ctx?.source !== "boss"){
  if(name.includes("venen") || name.includes("tox") ){
    emitMany(state, [
      { className:"vfx-poison", target, intensity:1.05*phaseMult, vars:{ h:(baseHue+20)%360, a:0.65 } },
      { className:"vfx-cloud", target, intensity:0.95*phaseMult, vars:{ h:(baseHue+30)%360, a:0.30 } },
    ]);
    return;
  }
  if(name.includes("queima") || name.includes("chama") || name.includes("infer") || name.includes("flame")){
    emitMany(state, [
      { className:"vfx-flame", target, intensity:1.05*phaseMult, vars:{ h:12, a:0.70 } },
      { className:"vfx-burst", target, intensity:0.95*phaseMult, vars:{ h:8, a:0.22 } },
    ]);
    return;
  }
  if(name.includes("sang") || name.includes("corte") || name.includes("lamina") || name.includes("golpe") || name.includes("cortes")){
    emitMany(state, [
      { className:"vfx-slice", target, intensity:1.05*phaseMult, vars:{ h:(baseHue+5)%360, a:0.70 } },
      { className:"vfx-blood", target, intensity:0.95*phaseMult, vars:{ h:350, a:0.45 } },
    ]);
    return;
  }
  if(name.includes("escud") || name.includes("barre") || name.includes("defe") || name.includes("guard")){
    emitMany(state, [
      { className:"vfx-shield", target:"player", intensity:1.10*phaseMult, vars:{ h:baseHue, a:0.55 } },
      { className:"vfx-ring", target:"player", intensity:0.90*phaseMult, vars:{ h:(baseHue+15)%360, a:0.18 } },
    ]);
    return;
  }
  if(name.includes("relamp") || name.includes("volta") || name.includes("raio") || name.includes("estatic") || name.includes("sobrec")){
    state?.vfx?.emit("lightning", { target, intensity: 1.55 * phaseMult });
    emitMany(state, [
      { className:"vfx-sparks", target, intensity:1.05*phaseMult, vars:{ h: 200, a:0.70 } },
      { className:"vfx-ring2", target, intensity:0.90*phaseMult, vars:{ h: 210, a:0.18 } },
    ]);
    return;
  }
  if(name.includes("arc") || name.includes("mist") || name.includes("runa") || name.includes("canal") || name.includes("dissi")){
    emitMany(state, [
      { className:"vfx-rune", target: (name.includes("cura")||name.includes("dissi")) ? "player" : target, intensity:1.05*phaseMult, vars:{ h:baseHue, a:0.40 } },
      { className:"vfx-ring2", target: (name.includes("cura")||name.includes("dissi")) ? "player" : target, intensity:0.90*phaseMult, vars:{ h:(baseHue+15)%360, a:0.18 } },
    ]);
    return;
  }
  if(name.includes("sombra") || name.includes("obsc") || name.includes("vazio") || name.includes("abiss")){
    emitMany(state, [
      { className:"vfx-voidtear", target, intensity:1.00*phaseMult, vars:{ h:280, a:0.45 } },
      { className:"vfx-shadowburst", target, intensity:1.05*phaseMult, vars:{ h:265, a:0.48 } },
    ]);
    return;
  }
}else{
  // boss keyword fallback
  if(name.includes("infer") || name.includes("chama") || name.includes("brasa")){
    emitMany(state, [
      { className:"vfx-inferno", target, intensity:1.10*phaseMult, vars:{ h:12, a:0.60 } },
      { className:"vfx-flame", target, intensity:1.05*phaseMult, vars:{ h:12, a:0.55 } },
    ]);
    return;
  }
  if(name.includes("volta") || name.includes("estatic") || name.includes("sobrec") || name.includes("raio")){
    state?.vfx?.emit("lightning", { target, intensity: 1.40 * phaseMult });
    emitMany(state, [
      { className:"vfx-emp", target:"center", intensity:1.00*phaseMult, vars:{ h:200, a:0.22 } },
      { className:"vfx-sparks", target, intensity:1.05*phaseMult, vars:{ h:200, a:0.60 } },
    ]);
    return;
  }
  if(name.includes("abiss") || name.includes("proto") || name.includes("glitch")){
    emitMany(state, [
      { className:"vfx-glitch", target:"center", intensity:1.05*phaseMult, vars:{ h:270, a:0.35 } },
      { className:"vfx-voidtear", target, intensity:1.00*phaseMult, vars:{ h:265, a:0.40 } },
    ]);
    return;
  }
}

// fallback: combo determinístico por skill_id (único)
  emitCombo(state, baseHue, target, seed, phaseMult);
}

export function emitBossBasicVfx(state, bossName, phase){
  const boss = norm(bossName);
  const h = hueByBoss(bossName);
  const p = phase === 2 ? 1.15 : 1.0;

  if(boss.includes("yamach")){
    state?.vfx?.emit("lightning", { target:"player", intensity: 1.20 * p });
    emitMany(state, [
      { className: phase === 2 ? "vfx-bossatk2" : "vfx-bossatk1", target:"player", intensity:1.0, vars:{ h, a: 0.30 } },
      { className:"vfx-sparks", target:"player", intensity:1.05*p, vars:{ h: 205, a: 0.65 } },
      { className:"vfx-pierce", target:"player", intensity:0.95*p, vars:{ h: 210, a: 0.65 } },
    ]);
    return;
  }

  if(boss.includes("valtherion")){
    emitMany(state, [
      { className: phase === 2 ? "vfx-bossatk2" : "vfx-bossatk1", target:"player", intensity:1.0, vars:{ h, a: 0.28 } },
      { className:"vfx-inferno", target:"player", intensity:1.00*p, vars:{ h: 12, a: 0.55 } },
      { className:"vfx-slice", target:"player", intensity:1.05*p, vars:{ h: 8, a: 0.70 } },
    ]);
    return;
  }

  if(boss.includes("infimius")){
    emitMany(state, [
      { className: phase === 2 ? "vfx-bossatk2" : "vfx-bossatk1", target:"player", intensity:1.0, vars:{ h, a: 0.30 } },
      { className:"vfx-glitch", target:"player", intensity:1.00*p, vars:{ h: 270, a: 0.50 } },
      { className:"vfx-rune", target:"player", intensity:0.85*p, vars:{ h: 265, a: 0.30 } },
    ]);
    return;
  }

  // fallback
  emitCustom(state, phase === 2 ? "vfx-bossatk2" : "vfx-bossatk1", "player", 1.0, { h, a: 0.35 });
  emitCustom(state, "vfx-slice", "player", 1.0*p, { h, a: 0.60 });
}
