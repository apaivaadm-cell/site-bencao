// Bênção Consórcio — Cartas Contempladas (Netlify Function)
// Busca as cartas do fornecedor, soma o acréscimo na entrada e mostra com o seu WhatsApp.
// Endereço no site: /contempladas  (e /contempladas?segmento=veiculo)

// ---------- CONFIGURAÇÕES ----------
const MEU_WHATSAPP = '5584988737601';
const NOME_EMPRESA = 'Bênção Consórcio';
const MOSTRAR_CODIGO = true;
const CACHE_MINUTOS = 30;
const FONTE = 'https://contempladas.bielonegocios.com.br/?segmento=';

function acrescimo(seg, credito) {
  if (seg === 'veiculo') return credito <= 99000 ? 1000 : 2000;
  return credito <= 400000 ? 2000 : 4000; // imóvel
}
// -----------------------------------

const brlParaNum = (v) => {
  const m = String(v || '').match(/[\d.]+,\d{2}/);
  return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
};
const numParaBrl = (n) =>
  'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function decodeEntities(t) {
  return t
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&([a-z]+);/gi, (m, n) => ({ ccedil: 'ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ecirc: 'ê', ocirc: 'ô', acirc: 'â', Eacute: 'É', Oacute: 'Ó', times: '×' }[n] || m));
}

export function extrair(html, seg) {
  let t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|span)>/gi, '$&\n');
  t = decodeEntities(t.replace(/<[^>]+>/g, '')).replace(/[ \t ]+/g, ' ');

  const partes = t.split(/Detalhes da cota/).slice(1);
  const campo = (b, rot) => {
    const m = b.match(new RegExp(rot + '\\s*:\\s*([^\\n]+)'));
    return m ? m[1].trim() : null;
  };

  const cartas = new Map();
  for (const b of partes) {
    const credito = brlParaNum(campo(b, 'Crédito'));
    const entrada = brlParaNum(campo(b, 'Entrada'));
    const cod = campo(b, 'Código');
    if (!credito || !entrada || !cod) continue;
    const parc = campo(b, 'Parcelas') || '';
    const pm = parc.match(/(\d+)\s*[x×]\s*(R\$\s*[\d.,]+)/);
    cartas.set(cod, {
      codigo: cod,
      adm: campo(b, 'Administradora') || '',
      credito,
      entrada: entrada + acrescimo(seg, credito),
      nParc: pm ? pm[1] : '',
      vParc: pm ? pm[2] : parc,
      transf: campo(b, 'Transferência') || 'Consultar',
      saldo: campo(b, 'Saldo devedor') || '',
      venc: campo(b, 'Próximo vencimento') || '',
      situacao: campo(b, 'Situação') || 'Disponível',
      obs: campo(b, 'Observações') || '',
    });
  }
  return [...cartas.values()].sort((a, b) => b.credito - a.credito);
}

function linkWhats(c, rotuloSeg) {
  const msg =
    'Olá! Tenho interesse nesta carta contemplada:\n\n' +
    `Segmento: ${rotuloSeg}\n` +
    (MOSTRAR_CODIGO ? `Código: ${c.codigo}\n` : '') +
    `Administradora: ${c.adm}\n` +
    `Crédito: ${numParaBrl(c.credito)}\n` +
    `Entrada: ${numParaBrl(c.entrada)}\n` +
    `Parcelas: ${c.nParc} x ${c.vParc}`;
  return `https://wa.me/${MEU_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

export function pagina(cartas, seg) {
  const rotuloSeg = seg === 'veiculo' ? 'Veículo' : 'Imóvel';
  const cards = cartas.map((c) => {
    const res = /reserv/i.test(c.situacao);
    return `
    <article class="carta" data-credito="${c.credito}" data-entrada="${c.entrada}">
      <div class="topo"><span>${esc(c.adm)}${MOSTRAR_CODIGO ? ' · Cód. ' + esc(c.codigo) : ''}</span>
        <span class="selo ${res ? 'res' : ''}">${esc(c.situacao)}</span></div>
      <div class="credito">${numParaBrl(c.credito)}</div>
      <dl>
        <dt>Entrada</dt><dd class="entrada">${numParaBrl(c.entrada)}</dd>
        <dt>Parcelas</dt><dd>${esc(c.nParc)}x ${esc(c.vParc)}</dd>
        <dt>Saldo devedor</dt><dd>${esc(c.saldo)}</dd>
        <dt>Transferência</dt><dd>${esc(c.transf)}</dd>
        ${c.venc ? `<dt>Próx. vencimento</dt><dd>${esc(c.venc)}</dd>` : ''}
        ${c.obs ? `<dt>Obs.</dt><dd>${esc(c.obs)}</dd>` : ''}
      </dl>
      <a class="btn" target="_blank" rel="noopener" href="${esc(linkWhats(c, rotuloSeg))}">Tenho interesse</a>
    </article>`;
  }).join('');

  const vazio = cartas.length ? '' :
    `<p class="vazio">No momento não conseguimos carregar as cartas. Fale com a gente no <a href="https://wa.me/${MEU_WHATSAPP}">WhatsApp</a>.</p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cartas Contempladas de ${rotuloSeg} | ${NOME_EMPRESA}</title>
<meta name="description" content="Cartas de consórcio contempladas de ${rotuloSeg} disponíveis na ${NOME_EMPRESA}.">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--azul:#0B3445;--azul2:#124E66;--ouro:#A58D69;--fundo:#F6F3EE;--card:#fff;--txt:#123A4A;--suave:#5A6E76;--borda:rgba(18,78,102,.2);--verde:#1a8f4a}
*{box-sizing:border-box}body{margin:0;font-family:Montserrat,system-ui,sans-serif;background:var(--fundo);color:var(--txt)}
header{background:linear-gradient(160deg,var(--azul),var(--azul2));color:#F6F3EE;padding:20px 16px 72px;text-align:center}
.voltar{display:block;text-align:left;max-width:1180px;margin:0 auto 16px;color:#F6F3EE;font-size:.9rem}
header h1{margin:0 0 6px;font-size:clamp(1.5rem,4vw,2.2rem)}header p{margin:0;opacity:.85}
.abas{display:flex;gap:8px;justify-content:center;margin-top:20px}
.abas a{color:#F6F3EE;text-decoration:none;padding:10px 22px;border-radius:999px;border:1px solid #ffffff55;font-weight:600}
.abas a.ativa{background:var(--ouro);border-color:var(--ouro);color:var(--azul)}
main{max-width:1180px;margin:-48px auto 40px;padding:0 16px}
.filtro{background:var(--card);border-radius:14px;padding:14px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;box-shadow:0 6px 20px #0b344514;margin-bottom:18px}
.filtro label{font-size:.85rem;color:var(--suave)}.filtro input{padding:9px 10px;border:1px solid var(--borda);border-radius:8px;width:150px;font:inherit}
.filtro span{margin-left:auto;font-size:.9rem;color:var(--suave)}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.carta{background:var(--card);border-radius:14px;padding:18px;box-shadow:0 4px 14px #0b344510;display:flex;flex-direction:column;border-top:4px solid var(--ouro)}
.topo{display:flex;justify-content:space-between;gap:8px;font-size:.8rem;color:var(--suave);margin-bottom:6px}
.selo{background:#e5f4ea;color:var(--verde);padding:2px 9px;border-radius:999px;font-weight:600;white-space:nowrap}
.selo.res{background:#fbf0dc;color:#8a5a00}
.credito{font-size:1.6rem;font-weight:700;color:var(--azul);margin:2px 0 12px}
dl{margin:0 0 14px;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:.9rem}
dt{color:var(--suave)}dd{margin:0;text-align:right;font-weight:600}dd.entrada{color:var(--azul2);font-size:1.05rem}
.btn{margin-top:auto;display:block;text-align:center;background:var(--verde);color:#fff;text-decoration:none;padding:12px;border-radius:10px;font-weight:700}
.vazio{text-align:center;padding:40px;color:var(--suave)}
footer{text-align:center;font-size:.8rem;color:var(--suave);padding:0 16px 32px;max-width:800px;margin:0 auto}
</style></head><body>
<header>
  <a class="voltar" href="/">← Voltar ao início</a>
  <h1>Cartas Contempladas</h1>
  <p>${NOME_EMPRESA} · crédito liberado, sem esperar sorteio</p>
  <nav class="abas">
    <a href="/contempladas?segmento=imovel" class="${seg === 'imovel' ? 'ativa' : ''}">Imóvel</a>
    <a href="/contempladas?segmento=veiculo" class="${seg === 'veiculo' ? 'ativa' : ''}">Veículo</a>
  </nav>
</header>
<main>
  <div class="filtro">
    <label>Crédito mínimo<br><input id="min" inputmode="numeric" placeholder="ex: 100000"></label>
    <label>Entrada máxima<br><input id="maxEnt" inputmode="numeric" placeholder="ex: 50000"></label>
    <span id="cont">${cartas.length} cartas</span>
  </div>
  <div class="grade">${vazio}${cards}</div>
</main>
<footer>Valores sujeitos a alteração e à disponibilidade da carta no momento da negociação. A transferência depende de análise e aprovação da administradora.</footer>
<script>
const n=v=>parseFloat(String(v).replace(/\\D/g,''))||0;
function filtrar(){const mi=n(min.value),me=n(maxEnt.value);let k=0;
 document.querySelectorAll('.carta').forEach(c=>{const ok=(!mi||+c.dataset.credito>=mi)&&(!me||+c.dataset.entrada<=me);c.style.display=ok?'':'none';k+=ok});
 cont.textContent=k+' cartas';}
min.oninput=maxEnt.oninput=filtrar;
</script>
</body></html>`;
}

export default async (req) => {
  const url = new URL(req.url);
  const seg = url.searchParams.get('segmento') === 'veiculo' ? 'veiculo' : 'imovel';
  let cartas = [];
  try {
    const r = await fetch(FONTE + seg, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
    });
    if (r.ok) cartas = extrair(await r.text(), seg);
  } catch (e) { /* fornecedor fora do ar */ }

  return new Response(pagina(cartas, seg), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // guarda a página no cache da Netlify por 30 min; se o fornecedor cair, usa a última versão por até 1 dia
      'Netlify-CDN-Cache-Control': cartas.length
        ? `public, durable, s-maxage=${CACHE_MINUTOS * 60}, stale-while-revalidate=86400`
        : 'no-store',
      'Netlify-Vary': 'query=segmento',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};

export const config = { path: '/contempladas' };
