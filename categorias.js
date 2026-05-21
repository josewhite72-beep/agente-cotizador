// ═══════════════════════════════════════════════════════════
// categorias.js — Árbol de categorías CompraFácil
// Persiste en localStorage como 'cf_categorias'
// ═══════════════════════════════════════════════════════════

const CATEGORIAS_DEFAULT = [
  {
    id: "alimentos", nombre: "Alimentos", icono: "📦",
    subs: ["Frutas", "Verduras", "Granos y legumbres", "Lácteos",
           "Carnes y aves", "Condimentos", "Snacks", "Bebidas"]
  },
  {
    id: "limpieza", nombre: "Limpieza y Aseo", icono: "🧹",
    subs: ["Químicos y desinfectantes", "Detergentes y jabones",
           "Utensilios de limpieza", "Bolsas de basura",
           "Papel e higiene", "Aromatizantes"]
  },
  {
    id: "mantenimiento", nombre: "Mantenimiento", icono: "🔧",
    subs: ["Plomería", "Electricidad", "Pintura", "Herramientas",
           "Jardinería", "Materiales de construcción"]
  },
  {
    id: "escolares", nombre: "Materiales Escolares", icono: "📚",
    subs: ["Papelería", "Útiles de escritorio", "Didácticos",
           "Mobiliario", "Tecnología"]
  },
  {
    id: "salud", nombre: "Salud y Protección", icono: "🏥",
    subs: ["Protección personal", "Primeros auxilios", "Higiene personal"]
  },
  {
    id: "equipos", nombre: "Equipos y Servicios", icono: "🖥️",
    subs: ["Aires acondicionados", "Electrónica", "Servicios generales"]
  },
  {
    id: "deportivos", nombre: "Implementos Deportivos", icono: "⚽",
    subs: ["Balones", "Uniformes", "Equipamiento", "Accesorios deportivos"]
  },
  {
    id: "musicales", nombre: "Instrumentos Musicales", icono: "🎵",
    subs: ["Cuerdas", "Viento", "Percusión", "Accesorios musicales"]
  },
  {
    id: "otros", nombre: "Otros", icono: "📋",
    subs: ["General", "Sin clasificar"]
  }
];

// ── CRUD de categorías ──────────────────────────────────────
function getCategorias() {
  try {
    const saved = localStorage.getItem('cf_categorias');
    return saved ? JSON.parse(saved) : CATEGORIAS_DEFAULT;
  } catch { return CATEGORIAS_DEFAULT; }
}

function saveCategorias(cats) {
  localStorage.setItem('cf_categorias', JSON.stringify(cats));
}

function resetCategorias() {
  localStorage.removeItem('cf_categorias');
  return CATEGORIAS_DEFAULT;
}

function addCategoria(nombre, icono) {
  const cats = getCategorias();
  const id = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (cats.find(c => c.id === id)) return null; // ya existe
  const nueva = { id, nombre, icono: icono || '📋', subs: ['General'] };
  cats.push(nueva);
  saveCategorias(cats);
  return nueva;
}

function editCategoria(id, nombre, icono) {
  const cats = getCategorias();
  const cat = cats.find(c => c.id === id);
  if (!cat) return false;
  cat.nombre = nombre;
  cat.icono  = icono || cat.icono;
  saveCategorias(cats);
  return true;
}

function deleteCategoria(id) {
  let cats = getCategorias();
  cats = cats.filter(c => c.id !== id);
  saveCategorias(cats);
}

function addSubcategoria(catId, subNombre) {
  const cats = getCategorias();
  const cat = cats.find(c => c.id === catId);
  if (!cat || cat.subs.includes(subNombre)) return false;
  cat.subs.push(subNombre);
  saveCategorias(cats);
  return true;
}

function editSubcategoria(catId, oldSub, newSub) {
  const cats = getCategorias();
  const cat = cats.find(c => c.id === catId);
  if (!cat) return false;
  const idx = cat.subs.indexOf(oldSub);
  if (idx === -1) return false;
  cat.subs[idx] = newSub;
  saveCategorias(cats);
  return true;
}

function deleteSubcategoria(catId, subNombre) {
  const cats = getCategorias();
  const cat = cats.find(c => c.id === catId);
  if (!cat) return false;
  cat.subs = cat.subs.filter(s => s !== subNombre);
  saveCategorias(cats);
  return true;
}

// ── Genera lista plana para prompt de DeepSeek ─────────────
function getCategoriasParaPrompt() {
  const cats = getCategorias();
  return cats.map(c =>
    `- ${c.nombre}: ${c.subs.join(', ')}`
  ).join('\n');
}
