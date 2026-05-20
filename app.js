// ═══════════════════════════════════════════════════════════
// CompraFácil – C.E. Barrigón  |  app.js
// ═══════════════════════════════════════════════════════════

// ── ESTADO ──────────────────────────────────────────────────
let cart = {};             // { id: { item, qty, unit } }
let activeFilter = 'all';
let importados = [];       // artículos importados de PDFs (persisten en localStorage)

// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadImportados();
  buildFilters();
  renderStats();
  buildPCLinks();

  // fecha de hoy en modal
  const hoy = new Date();
  document.getElementById('doc-fecha').value =
    `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;
});

// ── PERSISTENCIA ────────────────────────────────────────────
function loadImportados() {
  try { importados = JSON.parse(localStorage.getItem('cf_importados') || '[]'); }
  catch { importados = []; }
}
function saveImportados() {
  localStorage.setItem('cf_importados', JSON.stringify(importados));
}
function clearImportados() {
  if (!confirm('¿Eliminar todos los artículos importados de PDFs? El banco base se mantiene.')) return;
  importados = [];
  saveImportados();
  renderStats();
  toast('🗑 Artículos importados eliminados');
}

// ── BANCO COMPLETO (base + importados) ──────────────────────
function getBanco() {
  // Combina banco base con importados, marcando origen
  const base = BANCO_BASE.map(i => ({ ...i, origen: 'base' }));
  const imp  = importados.map(i => ({ ...i, origen: 'importado' }));
  return [...base, ...imp];
}

// ── NAVEGACIÓN ──────────────────────────────────────────────
function nav(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  btn.classList.add('active');
  if (id === 'busqueda') buscar();
  if (id === 'importar') renderStats();
}

// ── FILTROS DE CATEGORÍA ─────────────────────────────────────
function buildFilters() {
  const container = document.getElementById('filters');
  const cats = [...new Set(getBanco().map(i => i.categoria))].sort();
  container.innerHTML = '';

  const all = Object.assign(document.createElement('button'), {
    className: 'filter-btn active', textContent: 'Todos'
  });
  all.onclick = () => setFilter('all', all);
  container.appendChild(all);

  cats.forEach(cat => {
    const btn = Object.assign(document.createElement('button'), {
      className: 'filter-btn', textContent: cat
    });
    btn.onclick = () => setFilter(cat, btn);
    container.appendChild(btn);
  });
}

function setFilter(val, btn) {
  activeFilter = val;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  buscar();
}

// ── BÚSQUEDA PRINCIPAL ───────────────────────────────────────
function buscar() {
  const q     = document.getElementById('main-search').value.toLowerCase().trim();
  const banco = getBanco();
  const grid  = document.getElementById('results-grid');
  const meta  = document.getElementById('search-meta');

  let results = banco.filter(it => {
    const matchCat = activeFilter === 'all' || it.categoria === activeFilter;
    const matchQ   = !q ||
      it.nombre.toLowerCase().includes(q) ||
      it.categoria.toLowerCase().includes(q) ||
      (it.clasificacion || '').toLowerCase().includes(q) ||
      (it.codigo || '').includes(q) ||
      (it.descripcion || '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  // Ordenar: primero los que hacen match en nombre, luego resto
  if (q) {
    results.sort((a, b) => {
      const aName = a.nombre.toLowerCase().includes(q) ? 0 : 1;
      const bName = b.nombre.toLowerCase().includes(q) ? 0 : 1;
      return aName - bName;
    });
  }

  meta.innerHTML = q
    ? `<strong>${results.length}</strong> resultado${results.length !== 1 ? 's' : ''} para "<strong>${q}</strong>"`
    : `<strong>${banco.length}</strong> artículos en el banco (${importados.length} importados)`;

  if (!results.length) {
    grid.innerHTML = `<div class="no-results">
      No se encontraron artículos para "<strong>${q}</strong>".<br>
      <span style="font-size:12px">Puedes importar PDFs de PanamaCompra para ampliar el banco.</span>
    </div>`;
    return;
  }

  grid.innerHTML = '';
  results.forEach(it => {
    const inCart = !!cart[itemKey(it)];
    const div = document.createElement('div');
    div.className = 'result-card' + (inCart ? ' in-cart' : '');
    div.innerHTML = `
      <span class="rc-check">✓</span>
      <div class="rc-code">${it.codigo || '—'}${it.origen === 'importado' ? '<span class="tag-importado">PDF</span>' : ''}</div>
      <div class="rc-name">${it.nombre}</div>
      <div class="rc-cat">${it.clasificacion || it.categoria}</div>
      ${it.precio_ref ? `<div class="rc-price">B/. ${Number(it.precio_ref).toFixed(2)}<span style="font-size:10px;font-weight:400;color:var(--text3)"> / ${it.unidad}</span></div>` : '<div class="rc-price" style="color:var(--text3);font-size:11px">Precio no disponible</div>'}
      <div class="rc-source">${it.entidad || ''} ${it.proceso ? '· ' + it.proceso : ''}</div>`;
    div.onclick = () => toggleCart(it, div);
    grid.appendChild(div);
  });
}

function itemKey(it) {
  return (it.codigo || '') + '_' + it.nombre;
}

// ── CARRITO ──────────────────────────────────────────────────
function toggleCart(it, cardEl) {
  const key = itemKey(it);
  if (cart[key]) {
    delete cart[key];
    cardEl && cardEl.classList.remove('in-cart');
  } else {
    cart[key] = { item: it, qty: 1, unit: it.unidad };
    cardEl && cardEl.classList.add('in-cart');
    toast(`✅ "${it.nombre.substring(0,40)}" agregado`);
  }
  updateBadge();
  renderCart();
}

function updateBadge() {
  const n = Object.keys(cart).length;
  document.getElementById('cart-badge').textContent = n;
  document.getElementById('btn-word').disabled = n === 0;
}

function renderCart() {
  const entries = Object.values(cart);
  const cont = document.getElementById('cart-content');
  if (!entries.length) {
    cont.innerHTML = '<div class="empty-cart">Agrega artículos desde el buscador</div>';
    return;
  }
  cont.innerHTML = `<div class="cart-table-wrap"><table class="cart-table">
    <thead><tr>
      <th>#</th><th>Código UNSPSC</th><th>Artículo</th>
      <th>Cant.</th><th>Unidad</th><th>P. Ref. B/.</th><th></th>
    </tr></thead><tbody>
    ${entries.map((e,i) => `<tr>
      <td style="color:var(--text3);font-size:11px">${i+1}</td>
      <td class="code-cell">${e.item.codigo || '—'}</td>
      <td style="font-size:13px">${e.item.nombre}</td>
      <td><input class="qty-inp" type="number" min="1" value="${e.qty}"
          onchange="updQty('${itemKey(e.item)}',this.value)"></td>
      <td><input class="unit-inp" type="text" value="${e.unit}"
          onchange="updUnit('${itemKey(e.item)}',this.value)"></td>
      <td style="font-family:'Space Mono',monospace;font-size:12px;color:var(--green)">
        ${e.item.precio_ref ? 'B/. ' + Number(e.item.precio_ref).toFixed(2) : '—'}</td>
      <td><button class="btn-rm" onclick="removeFromCart('${itemKey(e.item)}')">✕</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

function updQty(key, val)  { if (cart[key]) cart[key].qty  = Math.max(1, parseInt(val)||1); }
function updUnit(key, val) { if (cart[key]) cart[key].unit = val; }
function removeFromCart(key) {
  delete cart[key];
  updateBadge();
  renderCart();
  buscar(); // actualizar checkmarks
}
function clearCart() {
  cart = {};
  updateBadge();
  renderCart();
  buscar();
}

// ── IMPORTAR PDFs ────────────────────────────────────────────
function dzDrag(e, on) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.toggle('dragover', on);
}
function dzDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
}
function handleFiles(files) {
  if (!files.length) return;
  Array.from(files).forEach(file => {
    if (file.type !== 'application/pdf') {
      addLog('err', `❌ "${file.name}" no es un PDF`);
      return;
    }
    processPDF(file);
  });
}

async function processPDF(file) {
  const logId = 'log_' + Date.now() + Math.random().toString(36).slice(2);
  addLog('loading', `⏳ Procesando "${file.name}"…`, logId);

  try {
    // Leer PDF como ArrayBuffer y extraer texto con pdf.js (CDN)
    if (!window.pdfjsLib) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf    = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let   pdfText = '';

    for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
      const page    = await pdf.getPage(p);
      const content = await page.getTextContent();
      pdfText += content.items.map(i => i.str).join(' ') + '\n';
    }

    if (!pdfText.trim()) throw new Error('No se pudo extraer texto del PDF');

    // Llamar al proxy en Vercel
    updateLog(logId, 'loading', `⏳ Analizando con IA: "${file.name}"…`);

    const resp = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfText, fileName: file.name })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || `Error ${resp.status}`);
    }

    const data = await resp.json();

    if (!data.items || !data.items.length) throw new Error('No se encontraron ítems en el PDF');

    // Agregar al banco evitando duplicados por código+nombre
    let nuevos = 0;
    data.items.forEach(it => {
      const key = (it.codigo || '') + '_' + (it.nombre || '');
      const existe = importados.some(i => (i.codigo || '') + '_' + (i.nombre || '') === key) ||
                     BANCO_BASE.some(i => (i.codigo || '') + '_' + (i.nombre || '') === key);
      if (!existe && it.nombre) {
        importados.push({
          codigo:       it.codigo        || '',
          clasificacion:it.clasificacion || '',
          nombre:       it.nombre,
          descripcion:  it.descripcion   || '',
          unidad:       it.unidad        || 'Unidad',
          precio_ref:   it.precio_ref    || it.precio_unitario || null,
          categoria:    it.categoria     || 'Importado',
          entidad:      data.entidad     || file.name,
          proceso:      data.proceso     || '',
          fecha:        data.fecha       || '',
          importadoEn:  data.importadoEn || new Date().toISOString(),
          origen:       'importado'
        });
        nuevos++;
      }
    });

    saveImportados();
    buildFilters();
    renderStats();
    updateLog(logId, 'ok',
      `✅ "${file.name}" — ${data.items.length} ítems encontrados, ${nuevos} nuevos agregados al banco`);

  } catch(err) {
    updateLog(logId, 'err', `❌ "${file.name}": ${err.message}`);
  }
}

function addLog(type, msg, id) {
  const log = document.getElementById('import-log');
  const div = document.createElement('div');
  div.className = `log-item log-${type}`;
  if (id) div.id = id;
  div.textContent = msg;
  log.prepend(div);
}
function updateLog(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `log-item log-${type}`;
  el.textContent = msg;
}

// ── ESTADÍSTICAS ─────────────────────────────────────────────
function renderStats() {
  const bar = document.getElementById('stats-bar');
  const cats = [...new Set(importados.map(i => i.categoria))].length;
  const conPrecio = importados.filter(i => i.precio_ref).length;
  bar.innerHTML = `
    <div class="stat-card">
      <div class="stat-num">${BANCO_BASE.length}</div>
      <div class="stat-label">Artículos base (limpieza)</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:var(--orange)">${importados.length}</div>
      <div class="stat-label">Importados de PDFs</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:var(--green)">${BANCO_BASE.length + importados.length}</div>
      <div class="stat-label">Total en el banco</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${cats}</div>
      <div class="stat-label">Categorías importadas</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:var(--green)">${conPrecio}</div>
      <div class="stat-label">Con precio de referencia</div>
    </div>`;
}

// ── PANAMACOMPRA LINKS ───────────────────────────────────────
function buildPCLinks() {
  const term    = (document.getElementById('pc-term')?.value || '').trim() || 'materiales de limpieza';
  const entidad = document.getElementById('pc-entidad')?.value || 'Ministerio de Educación';
  const cont    = document.getElementById('pc-links');
  if (!cont) return;

  const searches = [
    {
      title: 'Cuadros de Cotización adjudicados',
      desc:  'PDFs descargables con ítems, códigos UNSPSC y precios reales',
      q: `"Cuadro de Cotizaciones" "${term}" "${entidad}" 2025 OR 2026`
    },
    {
      title: 'Licitaya – ítems con precios',
      desc:  'Indexa lotes de PanamaCompra con más detalle y filtros',
      q: `licitaya.com.pa "${entidad}" "${term}" lotes 2026`
    },
    {
      title: 'MEDUCA Coclé – búsqueda regional',
      desc:  'Resultados de centros educativos de tu provincia',
      q: `"${term}" "MEDUCA" "Coclé" panamacompra 2026`
    },
    {
      title: 'Búsqueda general PanamaCompra',
      desc:  'Cualquier proceso que mencione el término',
      q: `"${term}" "${entidad}" site:panamacompra.gob.pa`
    },
  ];

  cont.innerHTML = searches.map(s => `
    <div class="link-card">
      <div class="link-info">
        <h4>${s.title}</h4>
        <p>${s.desc}</p>
        <div class="link-query">${s.q}</div>
      </div>
      <a href="https://www.google.com/search?q=${encodeURIComponent(s.q)}" target="_blank" class="btn-link">Abrir →</a>
    </div>`).join('');
}

// ── MODAL WORD ───────────────────────────────────────────────
function openModal()  { document.getElementById('word-modal').classList.add('open'); }
function closeModal() { document.getElementById('word-modal').classList.remove('open'); }
document.getElementById('word-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ── GENERAR WORD ─────────────────────────────────────────────
async function generateWord() {
  const entries = Object.values(cart);
  if (!entries.length) return;

  const fecha = document.getElementById('doc-fecha').value || '___________';
  const fondo = document.getElementById('doc-fondo').value;
  const desc  = document.getElementById('doc-desc').value;
  const obs   = document.getElementById('doc-obs').value;

  toast('⏳ Generando documento Word…');

  try {
    if (!window.docx) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/build/index.min.js');
    }

    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign
    } = window.docx;

    const b  = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
    const bs = { top: b, bottom: b, left: b, right: b };

    // Columnas: R(460) | Cant(1000) | Unidad(1300) | Código(1260) | Descripción(4040) | P.Ref(1300)
    const colW = [460, 1000, 1300, 1260, 4040, 1300];
    const tW   = colW.reduce((a, v) => a + v, 0); // 9360

    function tc(text, w, opts = {}) {
      return new TableCell({
        borders: bs,
        width: { size: w, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: opts.align || AlignmentType.LEFT,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({
            text, font: "Arial",
            size: opts.size || 17,
            bold: opts.bold || false
          })]
        })]
      });
    }

    const hRow = new TableRow({ tableHeader: true, children: [
      tc("R",               colW[0], { bold:true, align:AlignmentType.CENTER, shading:"D9D9D9" }),
      tc("Cantidad",        colW[1], { bold:true, align:AlignmentType.CENTER, shading:"D9D9D9" }),
      tc("Unidad",          colW[2], { bold:true, align:AlignmentType.CENTER, shading:"D9D9D9" }),
      tc("Código UNSPSC",   colW[3], { bold:true, align:AlignmentType.CENTER, shading:"D9D9D9" }),
      tc("Descripción",     colW[4], { bold:true, align:AlignmentType.CENTER, shading:"D9D9D9" }),
      tc("P. Ref. B/.",     colW[5], { bold:true, align:AlignmentType.CENTER, shading:"D9D9D9" }),
    ]});

    const itemRows = entries.map(e => new TableRow({ children: [
      tc("",                              colW[0], { align: AlignmentType.CENTER }),
      tc(String(e.qty),                   colW[1], { align: AlignmentType.CENTER }),
      tc(e.unit,                          colW[2]),
      tc(e.item.codigo || "",             colW[3], { align: AlignmentType.CENTER }),
      tc(e.item.nombre,                   colW[4]),
      tc(e.item.precio_ref ? Number(e.item.precio_ref).toFixed(2) : "", colW[5], { align: AlignmentType.RIGHT }),
    ]}));

    const table = new Table({
      width: { size: tW, type: WidthType.DXA },
      columnWidths: colW,
      rows: [hRow, ...itemRows]
    });

    const t  = (text, s, bold) => new TextRun({ text, font: "Arial", size: s || 20, bold: !!bold });
    const p  = (children, align) => new Paragraph({ alignment: align || AlignmentType.LEFT, spacing: { before: 0, after: 60 }, children });
    const bl = () => new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun("")] });

    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 900, right: 900, bottom: 900, left: 900 }
          }
        },
        children: [
          p([t("Formulario Nº 2", 18)], AlignmentType.RIGHT),
          p([t("MINISTERIO DE EDUCACIÓN", 22, true), t("    "), t("FONDO DE EQUIDAD Y CALIDAD DE LA EDUCACIÓN (FECE)", 22, true)], AlignmentType.CENTER),
          p([t("SOLICITUD DE BIENES Y/O SERVICIOS", 24, true)], AlignmentType.CENTER),
          p([t("Dirección Regional de Educación de Coclé", 22, true)], AlignmentType.CENTER),
          bl(),
          p([t("Código del Centro Educativo:   201-0074     Fecha: " + fecha)]),
          p([t("Nombre del Centro Educativo: Barrigón   _____________________________")]),
          p([t("Zona 18")]),
          p([t("Nombre del Director(a): ", 20), t("Yira Gómez", 20, true)]),
          bl(),
          p([
            t("Fondo: ", 20, true),
            t(fondo === "Matrícula"          ? "Matrícula  ✓                                    Bienestar Estudiantil      " :
              fondo === "Bienestar Estudiantil" ? "Matrícula               Bienestar Estudiantil  ✓" :
              "Matrícula               Bienestar Estudiantil      ")
          ]),
          p([t(fondo === "Partida Extraordinaria" ? "Partida Extraordinaria  ✓" : "Partida Extraordinaria        ")]),
          bl(),
          p([t("Descripción detallada de la compra de los bienes y/o servicios: ", 20, true), t(desc)]),
          bl(),
          table,
          bl(),
          p([t("* Precios de referencia de Cuadros de Cotización PanamaCompra (MEDUCA 2024-2026). Sujetos a variación.", 15)]),
          bl(),
          p([t("Observación: ", 20, true), t(obs)]),
          bl(), bl(), bl(),
          p([t("___________________________________                  _______________________________", 20, true)]),
          p([t("        Director(a) del Centro Educativo                       Representante de la comunidad Educativa", 20, true)]),
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url    = URL.createObjectURL(blob);
    const a      = Object.assign(document.createElement('a'), {
      href: url, download: `Solicitud_Barrigon_${fecha.replace(/\//g, '-')}.docx`
    });
    a.click();
    URL.revokeObjectURL(url);
    closeModal();
    toast('✅ Word generado con código UNSPSC incluido');

  } catch(err) {
    console.error(err);
    toast('❌ Error al generar Word: ' + err.message);
  }
}

// ── UTILIDADES ───────────────────────────────────────────────
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}
