export function normalizeCode(input){
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function bytesToBase64(bytes){
  // converte Uint8Array -> base64 compatível com Python base64.b64encode(utf8)
  let bin = "";
  const chunkSize = 0x8000;
  for(let i=0; i<bytes.length; i+=chunkSize){
    bin += String.fromCharCode(...bytes.subarray(i, i+chunkSize));
  }
  return btoa(bin);
}

export function codeToB64(normalized){
  const bytes = new TextEncoder().encode(normalized);
  return bytesToBase64(bytes);
}
