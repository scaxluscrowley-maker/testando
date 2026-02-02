export class RNG{
  constructor(seed=null){
    this._seed = seed ?? Math.floor(Math.random()*1e9);
  }
  // Mulberry32
  next(){
    let t = this._seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  chance(pp){
    return this.next() < (pp/100);
  }
  pick(arr){
    return arr[Math.floor(this.next()*arr.length)];
  }
  weightedPick(items){
    // items: [{w, v}]
    const total = items.reduce((s, it)=>s+it.w, 0);
    if(total <= 0) return null;
    let r = this.next()*total;
    for(const it of items){
      r -= it.w;
      if(r <= 0) return it.v;
    }
    return items[items.length-1].v;
  }
}
