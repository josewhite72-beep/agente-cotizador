// api/precios.js — Consulta de precios de referencia via DeepSeek
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

  const { articulo } = req.body;
  if (!articulo) return res.status(400).json({ error: 'Falta el artículo' });

  const prompt = `Eres un asistente especializado en precios de mercado en Panamá para compras públicas (MEDUCA, entidades del Estado).

El usuario pregunta por el precio de referencia de: "${articulo}"

Responde SOLO con un JSON con esta estructura exacta, sin texto adicional, sin markdown:
{
  "articulo": "nombre normalizado del artículo",
  "precio_min": número o null,
  "precio_max": número o null,
  "precio_estimado": número o null,
  "unidad": "unidad de medida más común",
  "fuentes": ["fuente1", "fuente2"],
  "notas": "observaciones relevantes sobre precio, presentación, marca común en Panamá",
  "confianza": "alta|media|baja",
  "fecha_referencia": "año o período de referencia"
}

REGLAS:
- Precios en Balboas (B/.) panameños
- Basa tus estimados en precios de supermercados, ferreterías y distribuidoras panameñas (Rey, Super 99, Do it Center, EPA, Novey, El Machetazo)
- Si no tienes datos confiables de Panamá, indica confianza "baja"
- precio_estimado debe ser el precio unitario más común en el mercado panameño
- Si el artículo se vende por caja/bulto, indica el precio unitario Y el precio del paquete en las notas
- Devuelve SOLO el JSON, sin texto adicional`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 800,
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
    catch { return res.status(500).json({ error: 'Respuesta inválida de DeepSeek', raw }); }

    return res.status(200).json(parsed);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
