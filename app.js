// ═══════════════════════════════════════════════════════════
// CompraFácil – C.E. Barrigón  |  app.js
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// MAPEO CÓDIGO DE OBJETO DE GASTO (FECE)
// Basado en Anexo Nº 1, Manual de Procedimientos FECE (2006)
// Cubre dos sistemas de categorización que coexisten en CompraFácil:
//  1) BANCO_BASE (data.js): usa campo "categoria" plano (ej. "Papelería")
//  2) Artículos importados vía PDF: usan "categoria" (árbol grande,
//     ej. "Materiales Escolares") + "subcategoria" (fino, ej. "Papelería")
// getCodigoFECE() prueba subcategoria primero, luego categoria.
// ═══════════════════════════════════════════════════════════
const MAPEO_FECE = {
  // Alimentos (subcategoria, árbol importados)
  "Frutas": "201", "Verduras": "201", "Granos y legumbres": "201",
  "Lácteos": "201", "Carnes y aves": "201", "Condimentos": "201",
  "Snacks": "201", "Bebidas": "203",

  // Limpieza y Aseo (subcategoria, árbol importados)
  "Químicos y desinfectantes": "240", "Detergentes y jabones": "270",
  "Utensilios de limpieza": "270", "Bolsas de basura": "270",
  "Papel e higiene": "230", "Aromatizantes": "270",

  // Mantenimiento (subcategoria, árbol importados)
  "Plomería": "250", "Electricidad": "250", "Pintura": "250",
  "Herramientas": "262", "Jardinería": "262", "Materiales de construcción": "250",

  // Materiales Escolares (subcategoria, árbol importados)
  "Papelería": "230", "Útiles de escritorio": "270", "Didácticos": "320",
  "Mobiliario": "350", "Tecnología": "380",

  // Salud y Protección (subcategoria, árbol importados)
  "Protección personal": "270", "Primeros auxilios": "611", "Higiene personal": "270",

  // Equipos y Servicios (subcategoria, árbol importados)
  "Aires acondicionados": "370", "Electrónica": "380", "Servicios generales": "169",

  // Implementos Deportivos (subcategoria, árbol importados)
  "Balones": "320", "Uniformes": "210", "Equipamiento": "320", "Accesorios deportivos": "320",

  // Instrumentos Musicales (subcategoria, árbol importados)
  "Cuerdas": "320", "Viento": "320", "Percusión": "320", "Accesorios musicales": "320",

  // Categorías PLANAS de BANCO_BASE (data.js) — distintas mayúsculas/nombres
  "Químicos / Desinfección": "240", "Detergentes y Jabones": "270",
  "Papel e Higiene": "230", "Utensilios de Limpieza": "270",
  "Bolsas de Basura": "270", "Cestos / Recipientes": "270",
  "Esponjas y Brillos": "270", "Protección Personal": "270",
  "Carnes y Aves": "201", "Granos y Legumbres": "201",
  "Útiles de Escritorio": "270", "Accesorios Deportivos": "320"
};

const NOMBRES_FECE = {
  "120": "Impresión, Encuadernación y Otros",
  "130": "Información y Publicidad",
  "141": "Viático dentro del País",
  "151": "Transporte dentro del País",
  "169": "Otros Servicios",
  "181": "Mantenimiento y Reparación de Edificios",
  "182": "Mantenimiento de Maquinarias y Otros Equipos",
  "183": "Mantenimiento de Mobiliario y Equipo de Oficina",
  "185": "Mantenimiento de Equipo de Computación",
  "189": "Otros Mantenimientos y Reparaciones",
  "201": "Alimento para Consumo Humano",
  "203": "Bebidas",
  "210": "Textiles y Vestuario",
  "220": "Combustible y Lubricantes",
  "230": "Productos de Papel y Cartón",
  "240": "Productos Químicos y Conexos",
  "250": "Otros Materiales de Construcción",
  "262": "Herramientas",
  "265": "Materiales, Accesorios y Suministros de Computación",
  "270": "Útiles y Materiales Diversos",
  "280": "Repuestos",
  "320": "Equipo Educacional y Recreativo",
  "340": "Equipo de Oficina",
  "350": "Mobiliario de Oficina",
  "370": "Maquinarias y Equipos Varios",
  "380": "Equipos de Computación",
  "611": "Donativo a Personas"
};

function getCodigoFECE(item) {
  if (!item) return '';
  // Prioridad 1: campo explícito objeto_gasto en el dato (BANCO_BASE revisado manualmente)
  if (item.objeto_gasto) return item.objeto_gasto;
  // Prioridad 2: inferencia por subcategoria/categoria (artículos importados sin objeto_gasto aún)
  return MAPEO_FECE[item.subcategoria] || MAPEO_FECE[item.categoria] || '';
}

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

// ── CARGAR JSON CORREGIDO (reemplaza cf_importados) ─────────
function cargarImportadosJSON(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch (err) {
      toast('❌ El archivo no es un JSON válido');
      fileInput.value = '';
      return;
    }

    if (!Array.isArray(data)) {
      toast('❌ El JSON debe ser un arreglo de artículos');
      fileInput.value = '';
      return;
    }

    const sinCodigo = data.filter(it => !it.codigo || !it.nombre).length;
    if (sinCodigo > 0) {
      toast(`⚠️ ${sinCodigo} artículo(s) sin código o nombre — revisa el archivo`);
    }

    if (!confirm(`¿Reemplazar los ${importados.length} artículos importados actuales con los ${data.length} de este archivo?`)) {
      fileInput.value = '';
      return;
    }

    importados = data;
    saveImportados();
    renderStats();
    toast(`📤 ${data.length} artículos cargados correctamente`);
    fileInput.value = '';
  };
  reader.onerror = () => {
    toast('❌ Error al leer el archivo');
    fileInput.value = '';
  };
  reader.readAsText(file);
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

function reclasificarBanco() {
  // Mapa de nombres viejos → categoría/subcategoría correcta
  const mapa = [
    // Alimentos
    { pat: /fruta|manzana|piña|mandarina|naranja|uva|melón|papaya|banano|guineo/i,        cat: "Alimentos",           sub: "Frutas" },
    { pat: /vegetal|verdura|repollo|zanahoria|cebolla|tomate|lechuga|apio|pepino|papa|yuca|ñame|otoe/i, cat: "Alimentos", sub: "Verduras" },
    { pat: /arroz|frijol|lenteja|garbanzo|maíz|trigo|avena|cereal|grano/i,               cat: "Alimentos",           sub: "Granos y legumbres" },
    { pat: /leche|queso|yogur|mantequilla|lácteo|crema/i,                                 cat: "Alimentos",           sub: "Lácteos" },
    { pat: /carne|pollo|res|cerdo|pescado|atún|sardina|chorizo|jamón|embutido/i,          cat: "Alimentos",           sub: "Carnes y aves" },
    { pat: /aceite|vinagre|sal|azúcar|salsa|ketchup|mayonesa|mostaza|condimento|especia/i,cat: "Alimentos",           sub: "Condimentos" },
    { pat: /galleta|snack|bocadillo|chips|pastel|dulce|caramelo|chocolate/i,              cat: "Alimentos",           sub: "Snacks" },
    { pat: /jugo|refresco|agua|bebida|leche en polvo/i,                                   cat: "Alimentos",           sub: "Bebidas" },
    { pat: /pasta|fideos|espagueti|macarrón/i,                                            cat: "Alimentos",           sub: "Granos y legumbres" },
    // Limpieza y Aseo
    { pat: /cloro|blanqueador|desinfectante|ácido|alcohol|potasa|saca.?gras|desgrasador|kangarú/i, cat: "Limpieza y Aseo", sub: "Químicos y desinfectantes" },
    { pat: /detergente|jabón|lavaplatos|lavandería|suavizante/i,                          cat: "Limpieza y Aseo",     sub: "Detergentes y jabones" },
    { pat: /escoba|trapeador|moña|recogedor|cepillo|balde|cubo|exprimidor|mopa|limpión|bayeta/i, cat: "Limpieza y Aseo", sub: "Utensilios de limpieza" },
    { pat: /bolsa.*(basura|plástico)|basura.*bolsa/i,                                     cat: "Limpieza y Aseo",     sub: "Bolsas de basura" },
    { pat: /papel.*(higiénico|toalla)|toalla.*papel|servilleta|dispensador.*papel/i,      cat: "Limpieza y Aseo",     sub: "Papel e higiene" },
    { pat: /ambientador|desodorante.*ambiental|aromatizante|pastilla.*olor/i,             cat: "Limpieza y Aseo",     sub: "Aromatizantes" },
    // Mantenimiento
    { pat: /tubo|pvc|llave.*agua|grifo|plomería|válvula|codo|tee|adaptador.*pvc/i,       cat: "Mantenimiento",       sub: "Plomería" },
    { pat: /cable.*eléctrico|enchufe|tomacorriente|foco|bombillo|interruptor|breaker/i,   cat: "Mantenimiento",       sub: "Electricidad" },
    { pat: /pintura|brocha|rodillo|sellador|barniz|lija/i,                                cat: "Mantenimiento",       sub: "Pintura" },
    { pat: /martillo|destornillador|llave.*tuerca|herramienta|taladro|serrucho/i,         cat: "Mantenimiento",       sub: "Herramientas" },
    { pat: /manguera|jardín|pala|rastrillo|semilla|abono|fertilizante/i,                  cat: "Mantenimiento",       sub: "Jardinería" },
    { pat: /cemento|bloque|arena|varilla|construcción|material.*construc/i,               cat: "Mantenimiento",       sub: "Materiales de construcción" },
    // Materiales Escolares
    { pat: /papel.*bond|cuaderno|folder|archivador|cartulina|papelería/i,                 cat: "Materiales Escolares",sub: "Papelería" },
    { pat: /lápiz|bolígrafo|pluma|marcador|borrador|tijera|regla|útil/i,                  cat: "Materiales Escolares",sub: "Útiles de escritorio" },
    { pat: /tiza|pizarra|pizarrón|marcador.*pizarra|didáctico/i,                          cat: "Materiales Escolares",sub: "Didácticos" },
    { pat: /silla|escritorio|mesa|pupitres|mobiliario|estante/i,                          cat: "Materiales Escolares",sub: "Mobiliario" },
    { pat: /computadora|impresora|tóner|cartucho|tecnología|usb|cable.*datos/i,           cat: "Materiales Escolares",sub: "Tecnología" },
    // Salud
    { pat: /mascarilla|guante.*látex|protección.*personal|casco|lente.*seguridad/i,       cat: "Salud y Protección",  sub: "Protección personal" },
    { pat: /venda|gasa|algodón|agua.*oxigenada|primeros.*auxilios|botiquín/i,             cat: "Salud y Protección",  sub: "Primeros auxilios" },
    { pat: /jabón.*manos|gel.*antibacterial|higiene.*personal/i,                          cat: "Salud y Protección",  sub: "Higiene personal" },
    // Equipos
    { pat: /aire.*acondicionado|split|condensadora/i,                                     cat: "Equipos y Servicios", sub: "Aires acondicionados" },
    { pat: /bocina|micrófono|proyector|televisor|electrónica/i,                           cat: "Equipos y Servicios", sub: "Electrónica" },
    // Deportivos
    { pat: /balón|pelota|fútbol|baloncesto|voleibol|béisbol/i,                            cat: "Implementos Deportivos", sub: "Balones" },
    { pat: /uniforme.*deport|camiseta.*deport|short.*deport/i,                            cat: "Implementos Deportivos", sub: "Uniformes" },
    // Musicales
    { pat: /guitarra|cuatro|violín|instrumento.*cuerda/i,                                 cat: "Instrumentos Musicales", sub: "Cuerdas" },
    { pat: /flauta|trompeta|instrumento.*viento/i,                                        cat: "Instrumentos Musicales", sub: "Viento" },
    { pat: /tambor|caja.*china|percusión|instrumento.*percusión/i,                        cat: "Instrumentos Musicales", sub: "Percusión" },
  ];

  let reclasificados = 0;
  const cats = getCategorias();
  const catNombres = cats.map(c => c.nombre.toLowerCase());

  importados = importados.map(it => {
    // Si ya tiene una categoría válida del árbol actual, no tocar
    const yaValida = catNombres.includes((it.categoria || '').toLowerCase());
    if (yaValida && it.subcategoria) return it;

    // Buscar en el mapa por nombre del artículo
    const texto = `${it.nombre} ${it.clasificacion || ''} ${it.categoria || ''}`;
    for (const m of mapa) {
      if (m.pat.test(texto)) {
        reclasificados++;
        return { ...it, categoria: m.cat, subcategoria: m.sub };
      }
    }
    // Si no encontró coincidencia, dejar en Otros
    if (!yaValida) {
      return { ...it, categoria: 'Otros', subcategoria: 'Sin clasificar' };
    }
    return it;
  });

  saveImportados();
  renderStats();
  toast(`✅ ${reclasificados} artículo${reclasificados !== 1 ? 's' : ''} reclasificado${reclasificados !== 1 ? 's' : ''}`);
}

// ── EXPORTAR ARTÍCULOS IMPORTADOS (cf_importados) ───────────
function exportarImportados() {
  if (!importados.length) {
    toast('⚠️ No hay artículos importados para exportar');
    return;
  }
  const fecha = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(importados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cf_importados_${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`📥 ${importados.length} artículos exportados`);
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
      <th>Cant.</th><th>Unidad</th><th>P. Ref. B/.</th><th>Obj. Gasto</th><th></th>
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
      <td>${renderSelectObjGasto(e.item, itemKey(e.item))}</td>
      <td><button class="btn-rm" onclick="removeFromCart('${itemKey(e.item)}')">✕</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

function renderSelectObjGasto(item, key) {
  const actual = item.objeto_gasto || '';
  const codigos = Object.keys(NOMBRES_FECE).sort();
  const opciones = ['<option value="">—</option>']
    .concat(codigos.map(c => `<option value="${c}" ${c === actual ? 'selected' : ''}>${c}</option>`))
    .join('');
  return `<select class="unit-inp" style="width:62px;font-family:'Space Mono',monospace;font-size:11px"
            onchange="updObjGasto('${key}',this.value)" title="${NOMBRES_FECE[actual] || 'Sin clasificar'}">
            ${opciones}
          </select>`;
}

function updObjGasto(key, val) {
  if (cart[key]) {
    cart[key].item.objeto_gasto = val;
    // Reflejar también en el banco origen si es un artículo importado,
    // para que la próxima vez que se busque ya venga con el código correcto.
    const idx = importados.findIndex(i => itemKey(i) === key);
    if (idx !== -1) importados[idx].objeto_gasto = val;
    saveImportados();
  }
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
          objeto_gasto:  MAPEO_FECE[it.subcategoria] || MAPEO_FECE[it.categoria] || '',
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
    // Cargar JSZip (librería estable y bien soportada en browser)
    if (!window.JSZip) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }

    // ── Helpers XML ──────────────────────────────────────────
    const esc = s => String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&apos;');

    const pt = n => Math.round(n * 20); // puntos → twips (1pt = 20 twips)

    // Celda de tabla
    const cell = (text, opts = {}) => {
      const w     = opts.w     || 1000;
      const bold  = opts.bold  ? '<w:b/><w:bCs/>' : '';
      const shade = opts.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>` : '';
      const align = opts.align ? `<w:jc w:val="${opts.align}"/>` : '';
      const sz    = opts.sz    ? `<w:sz w:val="${opts.sz * 2}"/><w:szCs w:val="${opts.sz * 2}"/>` : '<w:sz w:val="18"/><w:szCs w:val="18"/>';
      return `<w:tc>
        <w:tcPr>
          <w:tcW w:w="${w}" w:type="dxa"/>
          ${shade}
          <w:tcBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          </w:tcBorders>
          <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>
        </w:tcPr>
        <w:p><w:pPr>${align}<w:spacing w:before="0" w:after="0"/></w:pPr>
        <w:r><w:rPr>${bold}${sz}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>
        <w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`;
    };

    // Fila de tabla
    const row = cells => `<w:tr>${cells}</w:tr>`;

    // Párrafo
    const para = (runs, align = 'left', spaceBefore = 0, spaceAfter = 60) =>
      `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/></w:pPr>${runs}</w:p>`;

    // Run de texto
    const run = (text, opts = {}) => {
      const bold = opts.bold ? '<w:b/><w:bCs/>' : '';
      const sz   = opts.sz ? `<w:sz w:val="${opts.sz * 2}"/><w:szCs w:val="${opts.sz * 2}"/>` : '<w:sz w:val="20"/><w:szCs w:val="20"/>';
      return `<w:r><w:rPr>${bold}${sz}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
    };

    const blank = () => `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`;

    // ── Fila encabezado tabla ─────────────────────────────────
    // Cols: R(460) Cant(1000) Unidad(1300) Código(1260) Descripción(3540) P.Ref(1300) FECE(700)
    const colW = [460, 1000, 1300, 1260, 3540, 1300, 700];
    const hdr = row(
      cell('R',             { w: colW[0], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Cantidad',      { w: colW[1], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Unidad',        { w: colW[2], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Código UNSPSC', { w: colW[3], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Descripción',   { w: colW[4], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('P. Ref. B/.',   { w: colW[5], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Obj. Gasto',    { w: colW[6], bold: true, align: 'center', shade: 'D9D9D9' })
    );

    const itemRowsXml = entries.map(e =>
      row(
        cell('',                                    { w: colW[0], align: 'center' }) +
        cell(String(e.qty),                         { w: colW[1], align: 'center' }) +
        cell(e.unit || '',                          { w: colW[2] }) +
        cell(e.item.codigo || '',                   { w: colW[3], align: 'center' }) +
        cell(e.item.nombre,                         { w: colW[4] }) +
        cell(e.item.precio_ref || e.item.precio_unitario
              ? Number(e.item.precio_ref || e.item.precio_unitario).toFixed(2) : '',
              { w: colW[5], align: 'right' }) +
        cell(getCodigoFECE(e.item),       { w: colW[6], align: 'center' })
      )
    ).join('');

    const tW = colW.reduce((a, v) => a + v, 0);
    const tabla = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${tW}" w:type="dxa"/>
        <w:tblLook w:val="0000"/>
      </w:tblPr>
      <w:tblGrid>${colW.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
      ${hdr}${itemRowsXml}
    </w:tbl>`;

    // ── Resumen agrupado por código de objeto de gasto ────────
    const totalesPorCodigo = {};
    const articulosPorCodigo = {};
    entries.forEach(e => {
      const cod = getCodigoFECE(e.item);
      const precio = Number(e.item.precio_ref || e.item.precio_unitario || 0);
      const monto = precio * (e.qty || 1);
      const key = cod || 'SIN CLASIFICAR';
      totalesPorCodigo[key] = (totalesPorCodigo[key] || 0) + monto;
      if (!articulosPorCodigo[key]) articulosPorCodigo[key] = [];
      articulosPorCodigo[key].push(`${e.item.nombre} (${e.qty} ${e.unit || ''})`);
    });

    const codigosOrdenados = Object.keys(totalesPorCodigo).sort();
    const colWResumen = [800, 3600, 1000, 1700, 1360];
    const hdrResumen = row(
      cell('Código',  { w: colWResumen[0], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Objeto de Gasto', { w: colWResumen[1], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Cant.', { w: colWResumen[2], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Artículos incluidos', { w: colWResumen[3], bold: true, align: 'center', shade: 'D9D9D9' }) +
      cell('Monto B/.', { w: colWResumen[4], bold: true, align: 'center', shade: 'D9D9D9' })
    );
    const filasResumen = codigosOrdenados.map(cod => {
      const nombre = cod === 'SIN CLASIFICAR' ? 'Sin clasificar — asignar al editar' : (NOMBRES_FECE[cod] || '');
      const lista = articulosPorCodigo[cod].join('; ');
      return row(
        cell(cod === 'SIN CLASIFICAR' ? '—' : cod, { w: colWResumen[0], align: 'center' }) +
        cell(nombre, { w: colWResumen[1] }) +
        cell(String(articulosPorCodigo[cod].length), { w: colWResumen[2], align: 'center' }) +
        cell(lista, { w: colWResumen[3], sz: 7 }) +
        cell(totalesPorCodigo[cod].toFixed(2), { w: colWResumen[4], align: 'right' })
      );
    }).join('');
    const totalGeneral = Object.values(totalesPorCodigo).reduce((a, v) => a + v, 0);
    const filaTotalResumen = row(
      cell('', { w: colWResumen[0] }) +
      cell('TOTAL', { w: colWResumen[1], bold: true, align: 'right' }) +
      cell(String(entries.length), { w: colWResumen[2], bold: true, align: 'center' }) +
      cell('', { w: colWResumen[3] }) +
      cell(totalGeneral.toFixed(2), { w: colWResumen[4], bold: true, align: 'right' })
    );

    const tWResumen = colWResumen.reduce((a, v) => a + v, 0);
    const tablaResumen = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${tWResumen}" w:type="dxa"/>
        <w:tblLook w:val="0000"/>
      </w:tblPr>
      <w:tblGrid>${colWResumen.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
      ${hdrResumen}${filasResumen}${filaTotalResumen}
    </w:tbl>`;

    // ── Fondo checkmark ──────────────────────────────────────
    const fondoTexto =
      fondo === 'Matrícula'
        ? 'Matrícula  ✓                                    Bienestar Estudiantil      '
        : fondo === 'Bienestar Estudiantil'
        ? 'Matrícula               Bienestar Estudiantil  ✓'
        : 'Matrícula               Bienestar Estudiantil      ';
    const partida = fondo === 'Partida Extraordinaria'
      ? 'Partida Extraordinaria  ✓'
      : 'Partida Extraordinaria        ';

    // ── Documento XML ────────────────────────────────────────
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
  ${para(run('Formulario Nº 2', { sz: 9 }), 'right', 0, 60)}
  ${para(run('MINISTERIO DE EDUCACIÓN', { bold: true, sz: 11 }) + run('    ', {}) + run('FONDO DE EQUIDAD Y CALIDAD DE LA EDUCACIÓN (FECE)', { bold: true, sz: 11 }), 'center', 0, 60)}
  ${para(run('SOLICITUD DE BIENES Y/O SERVICIOS', { bold: true, sz: 12 }), 'center', 0, 60)}
  ${para(run('Dirección Regional de Educación de Coclé', { bold: true, sz: 11 }), 'center', 0, 60)}
  ${blank()}
  ${para(run('Código del Centro Educativo:   201-0074     Fecha: ' + fecha), 'left', 0, 60)}
  ${para(run('Nombre del Centro Educativo: Barrigón   _____________________________'), 'left', 0, 60)}
  ${para(run('Zona 18'), 'left', 0, 60)}
  ${para(run('Nombre del Director(a): ') + run('Yira Gómez', { bold: true }), 'left', 0, 60)}
  ${blank()}
  ${para(run('Fondo: ', { bold: true }) + run(fondoTexto), 'left', 0, 60)}
  ${para(run(partida), 'left', 0, 60)}
  ${blank()}
  ${para(run('Descripción detallada de la compra de los bienes y/o servicios: ', { bold: true }) + run(desc), 'left', 0, 60)}
  ${blank()}
  ${tabla}
  ${blank()}
  ${para(run('* Precios de referencia de Cuadros de Cotización PanamaCompra (MEDUCA 2024-2026). Sujetos a variación.', { sz: 8 }), 'left', 0, 60)}
  ${blank()}
  ${para(run('RESUMEN POR OBJETO DE GASTO', { bold: true, sz: 11 }), 'left', 0, 60)}
  ${tablaResumen}
  ${blank()}
  ${para(run('Observación: ', { bold: true }) + run(obs), 'left', 0, 60)}
  ${blank()}${blank()}${blank()}
  ${para(run('___________________________________                  _______________________________', { bold: true }), 'left', 0, 60)}
  ${para(run('        Director(a) del Centro Educativo                       Representante de la comunidad Educativa', { bold: true }), 'left', 0, 60)}
  <w:sectPr>
    <w:pgSz w:w="12240" w:h="15840"/>
    <w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="708" w:footer="708" w:gutter="0"/>
  </w:sectPr>
</w:body>
</w:document>`;

    // ── Empacar como .docx (ZIP) ─────────────────────────────
    const zip = new JSZip();

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    zip.file('word/document.xml', docXml);

    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `Solicitud_Barrigon_${fecha.replace(/\//g, '-')}.docx`
    });
    a.click();
    URL.revokeObjectURL(url);
    closeModal();
    toast('✅ Documento Word descargado');

  } catch(err) {
    console.error(err);
    toast('❌ Error: ' + err.message);
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
