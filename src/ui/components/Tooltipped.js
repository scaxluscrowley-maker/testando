export function tooltipped(label, tipHtml){
  const w = document.createElement("span");
  w.className = "tooltip";
  const a = document.createElement("span");
  a.textContent = label;
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.innerHTML = tipHtml;
  w.appendChild(a);
  w.appendChild(tip);
  return w;
}
