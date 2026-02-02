export function getPlayerSkillsForClass(data, className){
  const list = data.skillsPlayer.filter(s => s.class_name === className);
  // ordena pelo skill_id para consistência
  list.sort((a,b) => String(a.skill_id).localeCompare(String(b.skill_id)));
  return list;
}

export function effectiveCooldownForSkill(state, baseCd){
  const artId = state.inventory.equipment.artifact;
  if(!artId) return baseCd;
  const art = state.data.itemsById[artId];
  if(art?.name === "Ampulheta Curta"){
    return Math.max(0, (baseCd ?? 0) - 2);
  }
  return baseCd ?? 0;
}

export function isMagicSkill(skill){
  return String(skill.effect_text||"").includes("Dano mágico");
}

export function isOffensiveSkill(skill){
  return String(skill.effect_text||"").includes("Dano físico") || String(skill.effect_text||"").includes("Dano mágico");
}
