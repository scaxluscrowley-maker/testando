# Monsters & Code — Build completo (Base64)

Este projeto é um jogo web (HTML/CSS/JS) pronto para rodar em **GitHub Pages**.

## Rodar localmente
Você precisa de um servidor estático (por causa do `fetch()` dos JSONs).

### Opção A (Python)
```bash
python -m http.server 8000
```
Abra no navegador:
- http://localhost:8000

### Opção B (VS Code)
Extensão: **Live Server** → "Go Live".

## Atualizar os dados (planilha -> JSON)
Requisitos:
```bash
pip install openpyxl
```

Rode na raiz do projeto:
```bash
python tools/export_balance_to_json.py Monsters_Code_BalanceSheets_v1.2.0.xlsx
python tools/build_codes_b64.py Monsters_Code_BalanceSheets_v1.2.0.xlsx
```

Isso atualiza arquivos em `src/data/`.

> IMPORTANTE: `codes_b64.json` contém os códigos em Base64 (ofuscação leve).

## Publicar no GitHub Pages
1. Crie um repositório no GitHub.
2. Suba todos os arquivos deste projeto (commit + push).
3. Vá em **Settings → Pages**
4. Em **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** (ou master) e **/(root)**
5. Salve. O GitHub vai gerar a URL do seu jogo.

## Regras implementadas (resumo)
- 3 bosses em ordem: Yamach → Infimius → Valtherion
- 2 fases por boss (transformação imediata consome turno do boss)
- Pré-boss: Terminal (7 tentativas), equipamentos e consumíveis (máx 4, uso único, sem duplicados)
- Entre bosses: cura total de HP/MP, mantém equipamento/consumíveis
- EVA evita ataques/skills, mas não evita DoT já aplicado
- DoT ticka no fim da rodada por 3 rodadas:
  - Sangramento 3% HP max (+DEF -10%)
  - Veneno 2% HP max (+cura recebida -50%)
  - Queimadura 2% HP max (+ATQ -10%)
- Arredondamento: meio pra cima, somente no final do evento

## Assets
Você pode substituir/colocar:
- `assets/sprites/` (GIFs do operador e bosses)
- `assets/vfx/`, `assets/sfx/`, `assets/music/`
Atualmente o jogo roda com UI + logs (placeholder visual).

## Terminal (pré-luta) + Terminal (durante a batalha)

### Pré-luta (Preparação)
- Você tem **7 tentativas por boss** para inserir códigos no Terminal.
- Pode inserir códigos de **equipamentos (weapon/armor/artifact)**, **evolução**, e **consumíveis**.
- **Válido / inválido / repetido** consome tentativa.
- O mesmo **código não pode ser repetido** no boss atual (vale para a soma de pré-luta + luta).

### Durante a batalha (novo)
- No combate, existe um **TERMINAL** na UI (lado direito).
- Você pode inserir **+3 códigos extras**, mas **somente consumíveis**.
- **Válido / inválido / repetido** consome slot.
- Não pode repetir um código já usado na preparação (ou na própria luta) daquele boss.


- Evolução também troca o sprite do player para a classe evoluída (ex: Mago -> Arcano).


## Feedback de combate (RPG)
- Ao usar uma habilidade, aparece um **callout** acima do usuário com o nome da skill.
- Dano / crítico / cura / DoT aparecem como **números flutuantes** acima do alvo.

- MP restaurado aparece como número flutuante azul (ex: +30 MP).
