export class LogSystem{
  constructor(){ this.lines = []; }
  push(msg, kind="info"){
    this.lines.push({ msg, kind, t: Date.now() });
  }
  clear(){ this.lines = []; }
}
