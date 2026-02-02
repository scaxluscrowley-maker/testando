export async function loadJSON(path){
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`);
  return res.json();
}
