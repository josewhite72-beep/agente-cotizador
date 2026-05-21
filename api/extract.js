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

Tu tarea es extraer TODOS los artículos/ítems listados y devolver un JSON con esta estructura exacta:

{
  "entidad": "nombre de la entidad compradora",
  "proceso": "número de proceso (ej: 2026-0-07-02-02-CM-055459)",
  "fecha": "fecha de publicación",
  "items": [
    {
      "codigo": "código UNSPSC de 8 dígitos (ej: 47131604)",
      "clasificacion": "nombre de la clasificación UNSPSC",
      "nombre": "nombre corto y claro del artículo (máx 80 chars)",
      "descripcion": "descripción completa tal como aparece en el PDF",
      "cantidad": número o null,
      "unidad": "Unidad/Bulto/Caja/Galón/etc",
      "precio_ref": número o null,
      "precio_unitario": número o null,
      "categoria": "categoría general del artículo"
    }
  ]
}

REGLAS CRÍTICAS SOBRE PRECIOS — LEE CON ATENCIÓN:
- "precio_ref" = Precio de Referencia unitario que aparece en la columna "Precio Referencia" del PDF
- "precio_unitario" = Precio Unitario adjudicado al proveedor (columna "Precio Unitario")
- NUNCA uses el "Monto Neto" ni el "Total" — esos son precio × cantidad y NO son el precio unitario
- Ejemplo correcto: si el PDF dice Cantidad=60, Precio Unitario=B/.2.50, Monto Neto=B/.150.00 → precio_unitario=2.50, NO 150.00
- Si solo aparece el monto total y la cantidad, calcula: precio_unitario = monto_total / cantidad
- Los precios unitarios de artículos de consumo escolar en Panamá raramente superan B/.50.00 por unidad
- Si calculas un precio unitario mayor a B/.500, es casi seguro un error — revisa si tomaste el monto total

OTRAS REGLAS:
- Extrae TODOS los ítems sin omitir ninguno
- El campo "nombre" debe ser corto y descriptivo (sin especificaciones técnicas largas)
- Si un campo no existe en el PDF, usa null
- El código UNSPSC siempre tiene 8 dígitos numéricos
- Devuelve SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones

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

    // Agregar metadata del archivo
    parsed.fileName    = fileName || 'sin_nombre.pdf';
    parsed.importadoEn = new Date().toISOString();

    return res.status(200).json(parsed);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
