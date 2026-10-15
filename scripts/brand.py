#!/usr/bin/env python3
"""
Gera os assets oficiais e provisórios da marca Vanpack:
- Reinstancia e subsetta a fonte Archivo (wght 400..900, wdth 100)
- Converte o logotipo "VANPACK" em curvas vetoriais com HarfBuzz e fonttools
- Produz os SVGs limpos (sem <text> nem c2pa metadata) em public/brand/
- Gera src/brand/marks.js com paths e Path2D para HTML e Canvas/WebWorker
"""
import os
import subprocess
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib.instancer import instantiateVariableFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP_VAR_FONT = '/tmp/Archivo-Variable.ttf'
TMP_BLACK_FONT = '/tmp/ArchivoBlack-Regular.ttf'
OUTPUT_FONT = os.path.join(BASE_DIR, 'public', 'fonts', 'archivo-latin.woff2')
BRAND_DIR = os.path.join(BASE_DIR, 'public', 'brand')
MARKS_JS = os.path.join(BASE_DIR, 'src', 'brand', 'marks.js')

os.makedirs(BRAND_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUTPUT_FONT), exist_ok=True)
os.makedirs(os.path.dirname(MARKS_JS), exist_ok=True)

# 1. Reinstanciar e subsetar Archivo
print("1. Reinstanciando Archivo (wdth=100, wght=400:900)...")
var_font = TTFont(TMP_VAR_FONT)
inst_font = instantiateVariableFont(var_font, {'wdth': 100, 'wght': (400, 900)})
inst_path = '/tmp/archivo-inst.ttf'
inst_font.save(inst_path)

unicodes = (
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,'
    'U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
)
subprocess.run([
    'pyftsubset',
    inst_path,
    f'--unicodes={unicodes}',
    '--flavor=woff2',
    f'--output-file={OUTPUT_FONT}'
], check=True)
print(f"   Fonte salva em {OUTPUT_FONT} ({os.path.getsize(OUTPUT_FONT)} bytes)")

# 2. Gerar curvas de VANPACK
print("2. Gerando curvas vetoriais para o logotipo VANPACK...")
blob = hb.Blob.from_file_path(TMP_BLACK_FONT)
face = hb.Face(blob)
hb_font = hb.Font(face)
tt_font = TTFont(TMP_BLACK_FONT)
glyph_set = tt_font.getGlyphSet()
upem = face.upem

def shape_text(text, font_size, tracking, x_start, y_baseline):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf)
    scale = font_size / upem
    cur_x = x_start
    commands = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        glyph_name = tt_font.getGlyphOrder()[info.codepoint]
        glyph = glyph_set[glyph_name]
        gx = cur_x + pos.x_offset * scale
        gy = y_baseline - pos.y_offset * scale
        pen = SVGPathPen(glyph_set)
        tpen = TransformPen(pen, (scale, 0, 0, -scale, gx, gy))
        glyph.draw(tpen)
        cmd = pen.getCommands()
        if cmd:
            commands.append(cmd)
        cur_x += pos.x_advance * scale + tracking
    return ' '.join(commands), cur_x - tracking

# Curvas para Horizontal (font-size 50, tracking 0.5, start 124, baseline 67)
text_h_d, end_x = shape_text('VANPACK', 50, 0.5, 124, 67)

# Curvas para Vertical (font-size 46, tracking 0.46, center 140, baseline 162)
_, total_w_46 = shape_text('VANPACK', 46, 0.46, 0, 0)
v_start_x = round(140 - total_w_46 / 2, 2)
text_v_d, _ = shape_text('VANPACK', 46, 0.46, v_start_x, 162)

# Símbolo: paths canônicos
# Moldura quadrada (borda de 7px de 0 a 100):
# stroke=7 em rect x=3.5 y=3.5 w=93 h=93 é equivalente ao caminho:
frame_d = "M3.5 3.5h93v93h-93z"
# Ou como fill em Path2D: M0 0h100v100h-100z M7 7h86v86h-86z (evenodd)
frame_fill_d = "M0 0h100v100H0z M7 7v86h86V7H7z"

# Abas e corpo da caixa (transform="translate(22 22.6) scale(0.56)"):
# Points calculados diretamente em coordenadas do viewBox 100x100:
# [x*0.56 + 22, y*0.56 + 22.6]
def transform_points(pts):
    res = []
    for pt in pts.split():
        x, y = map(float, pt.split(','))
        res.append(f"{x * 0.56 + 22:.2f},{y * 0.56 + 22.6:.2f}")
    return ' '.join(res)

box_polys = [
    "14,35 48,18 45,2 11,19",
    "86,35 52,18 55,2 89,19",
    "14,41 48,58 42,46 8,29",
    "86,41 52,58 58,46 92,29",
    "14,46 50,64 50,96 14,78",
    "50,64 86,46 86,78 50,96"
]

box_paths_d = []
for p in box_polys:
    coords = [tuple(map(float, pt.split(','))) for pt in p.split()]
    tx = [f"{x * 0.56 + 22:.2f} {y * 0.56 + 22.6:.2f}" for x, y in coords]
    box_paths_d.append(f"M{tx[0]} L{' L'.join(tx[1:])} Z")

box_fill_d = ' '.join(box_paths_d)
symbol_combined_d = f"{frame_fill_d} {box_fill_d}"

# 3. Gerar arquivos SVG em public/brand/
print("3. Gravando SVGs oficiais em public/brand/...")

# Símbolo oficial (Floresta #14513A)
svg_simbolo = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Vanpack"><rect x="3.5" y="3.5" width="93" height="93" fill="none" stroke="#14513A" stroke-width="7"/><g transform="translate(22 22.6) scale(0.56)" fill="#14513A"><polygon points="14,35 48,18 45,2 11,19"/><polygon points="86,35 52,18 55,2 89,19"/><polygon points="14,41 48,58 42,46 8,29"/><polygon points="86,41 52,58 58,46 92,29"/><polygon points="14,46 50,64 50,96 14,78"/><polygon points="50,64 86,46 86,78 50,96"/></g></svg>'''
with open(os.path.join(BRAND_DIR, 'vanpack-simbolo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_simbolo)

# Símbolo Preto (Carvão #1B1A17)
svg_simbolo_preto = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Vanpack"><rect x="3.5" y="3.5" width="93" height="93" fill="none" stroke="#1B1A17" stroke-width="7"/><g transform="translate(22 22.6) scale(0.56)" fill="#1B1A17"><polygon points="14,35 48,18 45,2 11,19"/><polygon points="86,35 52,18 55,2 89,19"/><polygon points="14,41 48,58 42,46 8,29"/><polygon points="86,41 52,58 58,46 92,29"/><polygon points="14,46 50,64 50,96 14,78"/><polygon points="50,64 86,46 86,78 50,96"/></g></svg>'''
with open(os.path.join(BRAND_DIR, 'vanpack-simbolo-preto.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_simbolo_preto)

# Símbolo Negativo (Papel #FBF8F2 sobre Floresta #14513A)
svg_simbolo_negativo = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Vanpack"><rect width="100" height="100" fill="#14513A"/><rect x="3.5" y="3.5" width="93" height="93" fill="none" stroke="#FBF8F2" stroke-width="7"/><g transform="translate(22 22.6) scale(0.56)" fill="#FBF8F2"><polygon points="14,35 48,18 45,2 11,19"/><polygon points="86,35 52,18 55,2 89,19"/><polygon points="14,41 48,58 42,46 8,29"/><polygon points="86,41 52,58 58,46 92,29"/><polygon points="14,46 50,64 50,96 14,78"/><polygon points="50,64 86,46 86,78 50,96"/></g></svg>'''
with open(os.path.join(BRAND_DIR, 'vanpack-simbolo-negativo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_simbolo_negativo)

# Horizontal em Curvas (Floresta #14513A)
svg_horizontal = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" role="img" aria-label="Vanpack"><rect x="3.5" y="3.5" width="93" height="93" fill="none" stroke="#14513A" stroke-width="7"/><g transform="translate(22 22.6) scale(0.56)" fill="#14513A"><polygon points="14,35 48,18 45,2 11,19"/><polygon points="86,35 52,18 55,2 89,19"/><polygon points="14,41 48,58 42,46 8,29"/><polygon points="86,41 52,58 58,46 92,29"/><polygon points="14,46 50,64 50,96 14,78"/><polygon points="50,64 86,46 86,78 50,96"/></g><path d="{text_h_d}" fill="#14513A"/></svg>'''
with open(os.path.join(BRAND_DIR, 'vanpack-horizontal.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_horizontal)

# Horizontal Negativo (Papel #FBF8F2, para uso sobre Floresta): mesma geometria, só a cor muda
with open(os.path.join(BRAND_DIR, 'vanpack-horizontal-negativo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_horizontal.replace('#14513A', '#FBF8F2'))

# Vertical em Curvas (Floresta #14513A)
svg_vertical = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180" role="img" aria-label="Vanpack"><g transform="translate(90 0)"><rect x="3.5" y="3.5" width="93" height="93" fill="none" stroke="#14513A" stroke-width="7"/><g transform="translate(22 22.6) scale(0.56)" fill="#14513A"><polygon points="14,35 48,18 45,2 11,19"/><polygon points="86,35 52,18 55,2 89,19"/><polygon points="14,41 48,58 42,46 8,29"/><polygon points="86,41 52,58 58,46 92,29"/><polygon points="14,46 50,64 50,96 14,78"/><polygon points="50,64 86,46 86,78 50,96"/></g></g><path d="{text_v_d}" fill="#14513A"/></svg>'''
with open(os.path.join(BRAND_DIR, 'vanpack-vertical.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_vertical)

# 4. Gerar src/brand/marks.js
print("4. Gerando src/brand/marks.js...")
marks_content = f'''// Marcas e símbolos canônicos da Vanpack convertidos em caminhos vetoriais.
// Usado no HTML (sprite SVG) e no 3D (texturas desenhadas via Path2D).

export const BRAND_COLORS = {{
  floresta: '#14513A',
  carvao: '#1B1A17',
  papel: '#FBF8F2',
  kraft: '#B78C5C',
}};

export const SYMBOL = {{
  viewBox: '0 0 100 100',
  framePath: '{frame_fill_d}',
  boxPath: '{box_fill_d}',
  combinedPath: '{symbol_combined_d}',
}};

export const HORIZONTAL = {{
  viewBox: '0 0 400 100',
  symbolTransform: 'translate(0, 0)',
  textPath: '{text_h_d}',
}};

export const VERTICAL = {{
  viewBox: '0 0 280 180',
  symbolTransform: 'translate(90, 0)',
  textPath: '{text_v_d}',
}};

/**
 * Desenha a marca horizontal em um canvas 2D usando Path2D.
 * Ideal para renderizar a textura no baú do caminhão sem dependência de SVG externo.
 * @param {{CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D}} ctx
 * @param {{number}} x
 * @param {{number}} y
 * @param {{number}} targetWidth
 * @param {{string}} color
 */
export function drawHorizontalBrand(ctx, x, y, targetWidth, color = BRAND_COLORS.floresta) {{
  const scale = targetWidth / 400;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;

  // Símbolo
  if (typeof Path2D !== 'undefined') {{
    const symbol = new Path2D(SYMBOL.combinedPath);
    ctx.fill(symbol, 'evenodd');
    const text = new Path2D(HORIZONTAL.textPath);
    ctx.fill(text);
  }} else {{
    // Fallback simples
    ctx.fillRect(0, 0, 100, 100);
  }}
  ctx.restore();
}}
'''

with open(MARKS_JS, 'w', encoding='utf-8') as f:
    f.write(marks_content)

print("Processo concluído com sucesso!")

