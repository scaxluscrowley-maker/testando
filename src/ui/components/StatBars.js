export function hpBar(cur, max){
  const pct = Math.max(0, Math.min(100, (cur/max)*100));
  const wrap = document.createElement("div");
  wrap.className = "bar red";
  const inner = document.createElement("div");
  inner.style.width = pct + "%";
  wrap.appendChild(inner);
  return wrap;
}

export function mpBar(cur, max){
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (cur/max)*100));
  const wrap = document.createElement("div");
  wrap.className = "bar";
  const inner = document.createElement("div");
  inner.style.width = pct + "%";
  wrap.appendChild(inner);
  return wrap;
}
