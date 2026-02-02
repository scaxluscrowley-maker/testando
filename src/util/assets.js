export function slugify(str){
  return (str ?? "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const PLACEHOLDER_ICON = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" x2="1">
      <stop stop-color="#00e5ff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#7c4dff" stop-opacity=".45"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="rgba(8,12,26,.7)" stroke="rgba(27,43,85,.9)" stroke-width="2"/>
  <path d="M18 40 L30 18 L44 30 L50 22" stroke="url(#g)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20" cy="44" r="3" fill="#d7e3ff" opacity=".7"/>
</svg>`);

const PLACEHOLDER_SPRITE = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">
  <rect width="420" height="420" fill="rgba(8,12,26,.35)"/>
  <circle cx="210" cy="210" r="130" fill="rgba(0,229,255,.08)" stroke="rgba(0,229,255,.25)" stroke-width="3"/>
  <text x="210" y="220" text-anchor="middle" fill="rgba(215,227,255,.55)" font-family="monospace" font-size="22">SPRITE</text>
</svg>`);

export function resolveClassGif(className, manifest){
  const m = manifest?.classes?.[className];
  if(m) return m;
  return `./assets/sprites/classes/${slugify(className)}.gif`;
}

export function resolveBossGif(bossName, phase, manifest){
  const m = manifest?.bosses?.[bossName];
  if(m){
    return phase === 2 ? (m.p2 || m.p1) : (m.p1 || m.p2);
  }
  const slug = slugify(bossName);
  return phase === 2
    ? `./assets/sprites/bosses/${slug}_p2.gif`
    : `./assets/sprites/bosses/${slug}_p1.gif`;
}

export function resolveBossAttackGif(bossName, phase, manifest){
  const m = manifest?.bosses?.[bossName];
  if(m){
    return phase === 2
      ? (m.atk_p2 || m.atk2 || m.atk2_p2 || null)
      : (m.atk_p1 || m.atk1 || m.atk1_p1 || null);
  }
  return null;
}

export function resolveSkillIcon(skill, manifest){
  const m = manifest?.icons?.skills?.[skill.skill_id] || manifest?.icons?.skillsByName?.[skill.skill_name];
  if(m) return m;
  return `./assets/icons/skills/${slugify(skill.skill_name)}.png`;
}

export function resolveItemIcon(item, manifest){
  const m = manifest?.icons?.items?.[item.item_id] || manifest?.icons?.itemsByName?.[item.name];
  if(m) return m;
  return `./assets/icons/items/${slugify(item.name)}.png`;
}

export function placeholderIcon(){ return PLACEHOLDER_ICON; }
export function placeholderSprite(){ return PLACEHOLDER_SPRITE; }
