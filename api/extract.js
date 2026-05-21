// api/extract.js — Vercel Serverless Function
// Recibe un PDF en base64, llama a DeepSeek y devuelve artículos estructurados

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada en Vercel' });

  const { pdfText, fileName } = req.body;
  if (!pdfText) return res.status(400).json({ error: 'No se recibió texto del PDF' });

  const prompt = `Eres un asistente especializado en contrataciones públicas de Panamá (PanamaCompra).

Se te proporciona el texto extraído de un "Cuadro de Cotizaciones" de PanamaCompra.

Tu tarea es extraer TODOS los artículos/ítems y devolver SOLO este JSON, sin texto adicional, sin markdown:

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
      "categoria": "categoría general del artículo"
    }
  ]
}

INSTRUCCIÓN CRÍTICA SOBRE PRECIOS:
- "precio_unitario" = el valor de la columna "Precio Unitario" del PDF. Es el precio de UNA sola unidad.
- "monto_neto" = el valor de la columna "Monto Neto" del PDF. Es precio_unitario × cantidad.
- Extrae AMBOS valores tal como aparecen en el PDF, sin calcular ni modificar nada.
- Si una columna no existe o no tiene valor, usa null.
- NO intercambies estos valores. NO calcules nada.

OTRAS REGLAS:
- Extrae TODOS los ítems sin omitir ninguno.
- El código UNSPSC siempre tiene 8 dígitos numéricos.
- Devuelve SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.

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

    // Limpiar posibles markdown fences
    const clean = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(e) {
      return res.status(500).json({ error: 'DeepSeek devolvió JSON inválido', raw });
    }

    // ── POST-PROCESO: garantizar precio_unitario correcto ──
    if (parsed.items && Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map(it => {
        let pu = it.precio_unitario;
        const mn = it.monto_neto;
        const qty = it.cantidad;

        // Si tenemos monto_neto y cantidad, calculamos el precio unitario real
        if (mn && qty && qty > 0) {
          const calculado = parseFloat((mn / qty).toFixed(4));
          // Si precio_unitario es igual al monto_neto (error común) o no existe,
          // usamos el calculado
          if (!pu || Math.abs(pu - mn) < 0.01) {
            pu = calculado;
          }
        }

        // Si aún así el precio parece ser monto total (> 50 y hay cantidad > 1),
        // dividimos como último recurso
        if (pu && qty && qty > 1 && pu > 50) {
          const posible = parseFloat((pu / qty).toFixed(4));
          if (posible < 50) pu = posible;
        }

        return { ...it, precio_unitario: pu ? parseFloat(pu.toFixed(2)) : null };
      });
    }

    // Agregar metadata del archivo
    parsed.fileName    = fileName || 'sin_nombre.pdf';
    parsed.importadoEn = new Date().toISOString();

    return res.status(200).json(parsed);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
