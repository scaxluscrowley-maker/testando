export function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// meio pra cima (half-up), arredonda somente no final do evento
export function roundHalfUp(x){
  const s = Math.sign(x) || 1;
  const ax = Math.abs(x);
  const r = Math.floor(ax + 0.5);
  return s * r;
}

export function pct(x){ return `${x.toFixed(0)}%`; }

export function nowMs(){ return performance?.now?.() ?? Date.now(); }
