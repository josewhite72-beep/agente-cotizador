// ═══════════════════════════════════════════════════════════
// CompraFácil – C.E. Barrigón  |  app.js
// ═══════════════════════════════════════════════════════════

// ── ESTADO ──────────────────────────────────────────────────
let cart = {};
let importados = [];
let activeLetra = 'all';

// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadImportados();
  buildAZ();
  renderStats();
  buildPCLinks();
  renderHistorial();

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
  buildAZ();
}
function clearImportados() {
  if (!confirm('¿Eliminar todos los artículos importados de PDFs? El banco base se mantiene.')) return;
  importados = [];
  saveImportados();
  renderStats();
  toast('🗑 Artículos importados eliminados');
}

function corregirPrecios() {
  let corregidos = 0;
  importados = importados.map(it => {
    if (it.precio_ref && it.precio_ref > 500) {
      corregidos++;
      return { ...it, precio_ref: parseFloat((it.precio_ref / 100).toFixed(2)) };
    }
    return it;
  });
  saveImportados();
  renderStats();
  if (corregidos > 0) {
    toast(`🔧 ${corregidos} precio${corregidos > 1 ? 's' : ''} corregido${corregidos > 1 ? 's' : ''}`);
  } else {
    toast('✅ No se encontraron precios inflados');
  }
}

// ── BANCO COMPLETO (base + importados) ──────────────────────
function getBanco() {
  // Combina banco base con importados, marcando origen
  const base = BANCO_BASE.map(i => ({ ...i, origen: 'base' }));
  const imp  = importados.map(i => ({ ...i, origen: 'importado' }));
  return [...base, ...imp];
}

// ── NAVEGACIÓN ──────────────────────────────────────────────
const NAV_IDS = ['busqueda', 'categorias', 'solicitud', 'precios', 'importar', 'panamacompra', 'gestion'];

function navTo(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  // Sincroniza nav desktop
  document.querySelectorAll('header nav button').forEach((b, i) => {
    b.classList.toggle('active', NAV_IDS[i] === id);
  });
  // Sincroniza nav móvil
  document.querySelectorAll('#mobile-nav button').forEach((b, i) => {
    b.classList.toggle('active', NAV_IDS[i] === id);
  });
  document.getElementById('panel-' + id).classList.add('active');
  if (id === 'busqueda')   { buildAZ(); buscar(); }
  if (id === 'categorias') { buildTree(); }
  if (id === 'importar')   { renderStats(); }
  if (id === 'gestion')    { renderGestion(); }
}

// Alias para compatibilidad con llamadas internas
function nav(id) { navTo(id); }

// ── ÍNDICE A-Z ─────────────────────────────────────────────
function buildAZ() {
  const container = document.getElementById('az-index');
  if (!container) return;

  const banco = getBanco();
  // Letras que tienen al menos un artículo
  const letrasConArticulos = new Set(
    banco.map(i => i.nombre.trim()[0].toUpperCase())
         .filter(l => /[A-Z]/.test(l))
  );

  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  container.innerHTML = '';

  // Botón "Todos"
  const all = document.createElement('button');
  all.className = 'az-btn all' + (activeLetra === 'all' ? ' active' : '');
  all.textContent = 'Todos';
  all.onclick = () => setLetra('all', all);
  container.appendChild(all);

  // Botones A-Z
  letras.forEach(l => {
    const btn = document.createElement('button');
    const tieneArticulos = letrasConArticulos.has(l);
    btn.className = 'az-btn' +
      (activeLetra === l ? ' active' : '') +
      (!tieneArticulos ? ' disabled' : '');
    btn.textContent = l;
    if (tieneArticulos) btn.onclick = () => setLetra(l, btn);
    container.appendChild(btn);
  });
}

function setLetra(letra, btn) {
  activeLetra = letra;
  // Limpiar búsqueda de texto al tocar letra
  document.getElementById('main-search').value = '';
  document.querySelectorAll('.az-btn').forEach(b => b.classList.remove('active'));
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
    // Filtro por letra A-Z (solo si no hay texto escrito)
    const matchLetra = q
      ? true
      : activeLetra === 'all' || it.nombre.trim().toUpperCase().startsWith(activeLetra);
    // Filtro por texto
    const matchQ = !q ||
      it.nombre.toLowerCase().includes(q) ||
      it.categoria.toLowerCase().includes(q) ||
      (it.clasificacion || '').toLowerCase().includes(q) ||
      (it.codigo || '').includes(q) ||
      (it.descripcion || '').toLowerCase().includes(q);
    return matchLetra && matchQ;
  });

  // Ordenar alfabéticamente
  results.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // Meta info
  if (q) {
    meta.innerHTML = `<strong>${results.length}</strong> resultado${results.length !== 1 ? 's' : ''} para "<strong>${q}</strong>"`;
  } else if (activeLetra !== 'all') {
    meta.innerHTML = `<strong>${results.length}</strong> artículo${results.length !== 1 ? 's' : ''} con <strong>${activeLetra}</strong>`;
  } else {
    meta.innerHTML = `<strong>${banco.length}</strong> artículos en el banco · <strong>${importados.length}</strong> importados`;
  }

  if (!results.length) {
    grid.innerHTML = `<div class="no-results">
      No se encontraron artículos${q ? ` para "<strong>${q}</strong>"` : ''}.
      <br><span style="font-size:12px">Importa más PDFs de PanamaCompra para ampliar el banco.</span>
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
  const m = document.getElementById('cart-badge-m');
  if (m) m.textContent = n;
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
      body: JSON.stringify({
        pdfText,
        fileName: file.name,
        categoriasPrompt: getCategoriasParaPrompt()
      })
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

      // Validación de sanidad del precio
      // Si el precio parece ser el monto total (precio > 50 y hay cantidad),
      // intentar recalcular el precio unitario
      let precio = it.precio_ref || it.precio_unitario || null;
      if (precio && it.cantidad && it.cantidad > 1) {
        const posibleUnitario = parseFloat((precio / it.cantidad).toFixed(2));
        // Si dividir entre la cantidad da un resultado más razonable (< precio/2),
        // es probable que se haya tomado el monto total
        if (precio > 50 && posibleUnitario < precio * 0.3) {
          precio = posibleUnitario;
        }
      }
      // Fallback: si aún supera B/.500 dividir entre 100
      if (precio && precio > 500) {
        precio = parseFloat((precio / 100).toFixed(2));
      }

      if (!existe && it.nombre) {
        importados.push({
          codigo:        it.codigo         || '',
          clasificacion: it.clasificacion  || '',
          nombre:        it.nombre,
          descripcion:   it.descripcion    || '',
          unidad:        it.unidad         || 'Unidad',
          precio_ref:    precio,
          precio_unitario: precio,
          categoria:     it.categoria      || 'Otros',
          subcategoria:  it.subcategoria   || 'Sin clasificar',
          entidad:       data.entidad      || file.name,
          proceso:       data.proceso      || '',
          fecha:         data.fecha        || '',
          importadoEn:   data.importadoEn  || new Date().toISOString(),
          origen:        'importado'
        });
        nuevos++;
      }
    });

    saveImportados();
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

// ── CONSULTA DE PRECIOS ──────────────────────────────────────
let historialPrecios = JSON.parse(localStorage.getItem('cf_precios_hist') || '[]');

function precioRapido(term) {
  document.getElementById('precio-input').value = term;
  consultarPrecio();
}

async function consultarPrecio() {
  const input = document.getElementById('precio-input');
  const articulo = input.value.trim();
  if (!articulo) return;

  const res = document.getElementById('precio-resultado');
  const btn = document.getElementById('btn-consultar');

  // Loading state
  btn.disabled = true;
  btn.textContent = '⏳ Consultando…';
  res.innerHTML = `<div class="precio-card loading">
    <div class="precio-articulo">🔍 Consultando precio de "${articulo}"…</div>
    <div style="color:var(--text3);font-size:13px">DeepSeek está estimando el precio de mercado en Panamá…</div>
  </div>`;

  try {
    const resp = await fetch('/api/precios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articulo })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || `Error ${resp.status}`);
    }

    const data = await resp.json();
    renderPrecioResultado(data);

    // Guardar en historial
    const entrada = {
      articulo: data.articulo || articulo,
      precio: data.precio_estimado,
      unidad: data.unidad,
      ts: Date.now()
    };
    historialPrecios = [entrada, ...historialPrecios.filter(h => h.articulo !== entrada.articulo)].slice(0, 20);
    localStorage.setItem('cf_precios_hist', JSON.stringify(historialPrecios));
    renderHistorial();

  } catch(err) {
    res.innerHTML = `<div class="precio-card error">
      <div class="precio-articulo">❌ Error al consultar</div>
      <div style="color:var(--accent);font-size:13px">${err.message}</div>
      <div style="color:var(--text3);font-size:12px;margin-top:6px">Verifica tu conexión o que la API key de DeepSeek esté configurada en Vercel.</div>
    </div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '💰 Consultar';
  }
}

function renderPrecioResultado(d) {
  const conf = d.confianza || 'media';
  const confClass = { alta: 'confianza-alta', media: 'confianza-media', baja: 'confianza-baja' }[conf] || 'confianza-media';
  const confLabel = { alta: '✓ Confianza alta', media: '~ Confianza media', baja: '⚠ Confianza baja' }[conf] || '~';

  let valoresHTML = '';
  if (d.precio_estimado) {
    valoresHTML += `<div class="precio-val-box">
      <div class="precio-val-num">B/. ${Number(d.precio_estimado).toFixed(2)}</div>
      <div class="precio-val-label">Estimado</div>
    </div>`;
  }
  if (d.precio_min && d.precio_max) {
    valoresHTML += `<div class="precio-val-box">
      <div class="precio-val-num rango">B/. ${Number(d.precio_min).toFixed(2)} – ${Number(d.precio_max).toFixed(2)}</div>
      <div class="precio-val-label">Rango de mercado</div>
    </div>`;
  }
  if (!valoresHTML) {
    valoresHTML = `<div class="precio-val-box">
      <div class="precio-val-num" style="color:var(--text3);font-size:14px">No disponible</div>
      <div class="precio-val-label">Sin datos suficientes</div>
    </div>`;
  }

  document.getElementById('precio-resultado').innerHTML = `
    <div class="precio-card">
      <div class="precio-articulo">${d.articulo || '—'}</div>
      <div class="precio-valores">${valoresHTML}</div>
      ${d.unidad ? `<div class="precio-unidad">📦 Unidad de referencia: <strong>${d.unidad}</strong></div>` : ''}
      ${d.notas ? `<div class="precio-notas">💡 ${d.notas}</div>` : ''}
      ${d.fuentes?.length ? `<div class="precio-fuentes">🏪 Fuentes: ${d.fuentes.join(', ')}</div>` : ''}
      <span class="confianza-badge ${confClass}">${confLabel}</span>
      ${d.fecha_referencia ? ` <span style="font-size:11px;color:var(--text3)">· Ref. ${d.fecha_referencia}</span>` : ''}
      <div class="precio-disclaimer">⚠ Precio estimado por IA. Verifica antes de incluir en documentos oficiales.</div>
    </div>`;
}

function renderHistorial() {
  const card = document.getElementById('precio-historial-card');
  const cont = document.getElementById('precio-historial');
  if (!historialPrecios.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  cont.innerHTML = historialPrecios.map(h => `
    <div class="hist-item" onclick="precioRapido('${h.articulo}')">
      <span class="hist-name">${h.articulo}</span>
      <span class="hist-price">${h.precio ? 'B/. ' + Number(h.precio).toFixed(2) : '—'} <span style="font-size:10px;font-weight:400;color:var(--text3)">/${h.unidad||'unidad'}</span></span>
    </div>`).join('');
}

function clearHistorial() {
  historialPrecios = [];
  localStorage.removeItem('cf_precios_hist');
  renderHistorial();
}

// ── ÁRBOL DE CATEGORÍAS ──────────────────────────────────────
let treeState = { nivel: 'cats', catId: null, sub: null };

function buildTree() {
  treeState = { nivel: 'cats', catId: null, sub: null };
  renderTree();
}

function renderTree() {
  const nav    = document.getElementById('tree-nav');
  const back   = document.getElementById('tree-back');
  const meta   = document.getElementById('tree-meta');
  const res    = document.getElementById('tree-results');
  const cats   = getCategorias();
  const banco  = getBanco();

  res.innerHTML = '';
  meta.innerHTML = '';

  if (treeState.nivel === 'cats') {
    back.classList.remove('show');
    nav.innerHTML = '';
    cats.forEach(cat => {
      // Contar artículos en esta categoría
      const total = banco.filter(i =>
        (i.categoria || '').toLowerCase() === cat.nombre.toLowerCase()
      ).length;

      const div = document.createElement('div');
      div.className = 'tree-cat';
      div.innerHTML = `
        <div class="tree-cat-hdr" onclick="treeSelectCat('${cat.id}')">
          <span class="tree-cat-icon">${cat.icono}</span>
          <span class="tree-cat-name">${cat.nombre}</span>
          <span class="tree-cat-count">${total} artículo${total !== 1 ? 's' : ''}</span>
          <span class="tree-cat-arrow">›</span>
        </div>`;
      nav.appendChild(div);
    });

  } else if (treeState.nivel === 'subs') {
    const cat = cats.find(c => c.id === treeState.catId);
    if (!cat) return;
    back.classList.add('show');
    document.getElementById('tree-back-label').textContent = 'Todas las categorías';
    nav.innerHTML = '';

    cat.subs.forEach(sub => {
      const total = banco.filter(i =>
        (i.categoria || '').toLowerCase() === cat.nombre.toLowerCase() &&
        (i.subcategoria || '').toLowerCase() === sub.toLowerCase()
      ).length;

      const btn = document.createElement('button');
      btn.className = 'tree-sub-btn';
      btn.innerHTML = `${sub} <span class="tree-sub-count">(${total})</span>`;
      btn.onclick = () => treeSelectSub(cat.id, sub);
      nav.appendChild(btn);
    });

    // También botón "Ver todos"
    const allBtn = document.createElement('button');
    const totalCat = banco.filter(i =>
      (i.categoria || '').toLowerCase() === cat.nombre.toLowerCase()
    ).length;
    allBtn.className = 'tree-sub-btn active';
    allBtn.innerHTML = `Todos <span class="tree-sub-count">(${totalCat})</span>`;
    allBtn.onclick = () => treeSelectSub(cat.id, 'all');
    nav.insertBefore(allBtn, nav.firstChild);

  } else if (treeState.nivel === 'items') {
    const cat = cats.find(c => c.id === treeState.catId);
    if (!cat) return;
    back.classList.add('show');
    document.getElementById('tree-back-label').textContent = cat.nombre;
    nav.innerHTML = '';

    let items = banco.filter(i =>
      (i.categoria || '').toLowerCase() === cat.nombre.toLowerCase()
    );
    if (treeState.sub !== 'all') {
      items = items.filter(i =>
        (i.subcategoria || '').toLowerCase() === (treeState.sub || '').toLowerCase()
      );
    }
    items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    meta.innerHTML = `<strong>${items.length}</strong> artículo${items.length !== 1 ? 's' : ''} en <strong>${treeState.sub === 'all' ? cat.nombre : treeState.sub}</strong>`;

    if (!items.length) {
      res.innerHTML = `<div class="no-results">No hay artículos en esta subcategoría.<br><span style="font-size:12px">Importa PDFs para agregar artículos.</span></div>`;
      return;
    }

    items.forEach(it => {
      const inCart = !!cart[itemKey(it)];
      const div = document.createElement('div');
      div.className = 'result-card' + (inCart ? ' in-cart' : '');
      div.innerHTML = `
        <span class="rc-check">✓</span>
        <div class="rc-code">${it.codigo || '—'}${it.origen === 'importado' ? '<span class="tag-importado">PDF</span>' : ''}</div>
        <div class="rc-name">${it.nombre}</div>
        <div class="rc-cat">${it.subcategoria || it.clasificacion || it.categoria}</div>
        ${it.precio_ref || it.precio_unitario
          ? `<div class="rc-price">B/. ${Number(it.precio_ref || it.precio_unitario).toFixed(2)}<span style="font-size:10px;font-weight:400;color:var(--text3)"> / ${it.unidad}</span></div>`
          : '<div class="rc-price" style="color:var(--text3);font-size:11px">Precio no disponible</div>'}
        <div class="rc-source">${it.entidad || ''}</div>`;
      div.onclick = () => toggleCart(it, div);
      res.appendChild(div);
    });
  }
}

function treeSelectCat(catId) {
  treeState = { nivel: 'subs', catId, sub: null };
  renderTree();
}

function treeSelectSub(catId, sub) {
  treeState = { nivel: 'items', catId, sub };
  renderTree();
}

function treeBack() {
  if (treeState.nivel === 'items') {
    treeState = { nivel: 'subs', catId: treeState.catId, sub: null };
  } else {
    treeState = { nivel: 'cats', catId: null, sub: null };
  }
  renderTree();
}

// ── GESTIÓN DE CATEGORÍAS ─────────────────────────────────────
function renderGestion() {
  const list = document.getElementById('gcat-list');
  const cats = getCategorias();
  list.innerHTML = '';

  cats.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'gcat-item';
    div.innerHTML = `
      <div class="gcat-hdr" onclick="toggleGcatSubs('subs_${cat.id}')">
        <span class="gcat-icon-lbl">${cat.icono}</span>
        <span class="gcat-nombre">${cat.nombre}</span>
        <div class="gcat-actions" onclick="event.stopPropagation()">
          <button class="gcat-btn" title="Editar" onclick="showEditCat('${cat.id}')">✏️</button>
          <button class="gcat-btn" title="Eliminar" onclick="deleteCatConfirm('${cat.id}')">🗑</button>
        </div>
      </div>
      <div class="gcat-subs-list" id="subs_${cat.id}">
        ${cat.subs.map(s => `
          <span class="gsub-chip">
            ${s}
            <button class="gsub-del" onclick="delSub('${cat.id}','${s.replace(/'/g,"\\'")}')">×</button>
          </span>`).join('')}
        <button class="gadd-sub" onclick="showAddSub('${cat.id}')">+ subcategoría</button>
      </div>`;
    list.appendChild(div);
  });
}

function toggleGcatSubs(id) {
  document.getElementById(id)?.classList.toggle('open');
}

function showAddCat() {
  const nombre = prompt('Nombre de la nueva categoría:');
  if (!nombre?.trim()) return;
  const icono = prompt('Ícono (emoji, opcional):', '📋') || '📋';
  const nueva = addCategoria(nombre.trim(), icono.trim());
  if (!nueva) { toast('⚠ Ya existe una categoría con ese nombre'); return; }
  toast(`✅ Categoría "${nueva.nombre}" agregada`);
  renderGestion();
}

function showEditCat(id) {
  const cats  = getCategorias();
  const cat   = cats.find(c => c.id === id);
  if (!cat) return;
  const nombre = prompt('Nuevo nombre:', cat.nombre);
  if (!nombre?.trim()) return;
  const icono  = prompt('Nuevo ícono:', cat.icono) || cat.icono;
  editCategoria(id, nombre.trim(), icono.trim());
  toast(`✅ Categoría actualizada`);
  renderGestion();
}

function deleteCatConfirm(id) {
  const cats = getCategorias();
  const cat  = cats.find(c => c.id === id);
  if (!cat) return;
  if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Los artículos asignados quedarán sin categoría.`)) return;
  deleteCategoria(id);
  toast(`🗑 Categoría eliminada`);
  renderGestion();
}

function showAddSub(catId) {
  const sub = prompt('Nombre de la subcategoría:');
  if (!sub?.trim()) return;
  const ok = addSubcategoria(catId, sub.trim());
  if (!ok) { toast('⚠ Ya existe esa subcategoría'); return; }
  toast(`✅ Subcategoría "${sub.trim()}" agregada`);
  renderGestion();
}

function delSub(catId, sub) {
  if (!confirm(`¿Eliminar la subcategoría "${sub}"?`)) return;
  deleteSubcategoria(catId, sub);
  toast(`🗑 Subcategoría eliminada`);
  renderGestion();
}

function resetCatsConfirm() {
  if (!confirm('¿Restaurar todas las categorías a los valores originales? Se perderán tus cambios.')) return;
  resetCategorias();
  toast('✅ Categorías restauradas');
  renderGestion();
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
