export function LogPanel(log){
  const el = document.createElement("div");
  el.className = "panel";
  const title = document.createElement("div");
  title.className = "row";
  title.innerHTML = `<span class="badge">LOG</span>`;
  const list = document.createElement("div");
  list.className = "log";

  for(const line of log.lines.slice(-250)){
    const d = document.createElement("div");
    d.className = "line " + (line.kind === "ok" ? "ok" : line.kind === "err" ? "err" : "");
    d.textContent = line.msg;
    list.appendChild(d);
  }

  el.appendChild(title);
  el.appendChild(list);
  return el;
}
