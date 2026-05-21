// api/extract.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada en Vercel' });

  const { pdfText, fileName, categoriasPrompt } = req.body;
  if (!pdfText) return res.status(400).json({ error: 'No se recibió texto del PDF' });

  const arbol = categoriasPrompt || `
- Alimentos: Frutas, Verduras, Granos y legumbres, Lácteos, Carnes y aves, Condimentos, Snacks, Bebidas
- Limpieza y Aseo: Químicos y desinfectantes, Detergentes y jabones, Utensilios de limpieza, Bolsas de basura, Papel e higiene, Aromatizantes
- Mantenimiento: Plomería, Electricidad, Pintura, Herramientas, Jardinería, Materiales de construcción
- Materiales Escolares: Papelería, Útiles de escritorio, Didácticos, Mobiliario, Tecnología
- Salud y Protección: Protección personal, Primeros auxilios, Higiene personal
- Equipos y Servicios: Aires acondicionados, Electrónica, Servicios generales
- Implementos Deportivos: Balones, Uniformes, Equipamiento, Accesorios deportivos
- Instrumentos Musicales: Cuerdas, Viento, Percusión, Accesorios musicales
- Otros: General, Sin clasificar`;

  const prompt = `Eres un asistente especializado en contrataciones públicas de Panamá (PanamaCompra).

Extrae TODOS los artículos del siguiente Cuadro de Cotizaciones y devuelve SOLO este JSON sin markdown:

{
  "entidad": "nombre de la entidad compradora",
  "proceso": "número de proceso",
  "fecha": "fecha de publicación",
  "items": [
    {
      "codigo": "código UNSPSC de 8 dígitos",
      "clasificacion": "nombre de la clasificación UNSPSC",
      "nombre": "nombre corto del artículo (máx 80 chars)",
      "cantidad": número o null,
      "unidad": "Unidad/Bulto/Caja/Galón/etc",
      "precio_unitario": número o null,
      "monto_neto": número o null,
      "categoria": "categoría padre exacta de la lista",
      "subcategoria": "subcategoría exacta de la lista"
    }
  ]
}

CATEGORÍAS DISPONIBLES (usa EXACTAMENTE estos nombres):
${arbol}

REGLAS DE CLASIFICACIÓN:
- "categoria" debe ser exactamente uno de los nombres padre (ej: "Alimentos")
- "subcategoria" debe ser exactamente una subcategoría de esa categoría (ej: "Frutas")
- Si no encaja en ninguna, usa categoria="Otros" y subcategoria="Sin clasificar"

REGLAS CRÍTICAS DE PRECIOS:
- "precio_unitario" = columna "Precio Unitario" (precio de UNA unidad)
- "monto_neto" = columna "Monto Neto" (precio_unitario × cantidad)
- Extrae AMBOS tal como aparecen. NO calcules ni intercambies estos valores.
- Devuelve SOLO el JSON, sin texto adicional.

TEXTO DEL PDF:
${pdfText.substring(0, 12000)}`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `DeepSeek error: ${err}` });
    }

    const data = await response.json();
    const raw  = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { return res.status(500).json({ error: 'JSON inválido', raw }); }

    // Post-proceso: calcular precio_unitario correcto
    if (parsed.items && Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map(it => {
        let pu  = it.precio_unitario;
        const mn  = it.monto_neto;
        const qty = it.cantidad;
        if (mn && qty && qty > 0) {
          const calculado = parseFloat((mn / qty).toFixed(4));
          if (!pu || Math.abs(pu - mn) < 0.01) pu = calculado;
        }
        if (pu && qty && qty > 1 && pu > 50) {
          const posible = parseFloat((pu / qty).toFixed(4));
          if (posible < 50) pu = posible;
        }
        return { ...it, precio_unitario: pu ? parseFloat(pu.toFixed(2)) : null };
      });
    }

    parsed.fileName    = fileName || 'sin_nombre.pdf';
    parsed.importadoEn = new Date().toISOString();
    return res.status(200).json(parsed);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
