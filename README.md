# CompraFácil – C.E. Barrigón

PWA para gestión de compras MEDUCA. Busca artículos, importa PDFs de PanamaCompra, genera solicitudes Word con código UNSPSC.

## Estructura del proyecto

```
barrigon-v2/
├── index.html        ← PWA principal
├── app.js            ← Lógica de la aplicación
├── data.js           ← Banco base (93 artículos de limpieza)
├── manifest.json     ← Configuración PWA
├── vercel.json       ← Configuración Vercel
└── api/
    └── extract.js    ← Serverless function (proxy DeepSeek)
```

## Deploy en Vercel

### 1. Subir a GitHub
Crea un repositorio nuevo en GitHub y sube todos los archivos manteniendo la estructura (incluyendo la carpeta `api/`).

### 2. Importar en Vercel
1. Ve a [vercel.com](https://vercel.com) → New Project
2. Importa el repositorio de GitHub
3. Framework Preset: **Other**
4. Haz clic en **Deploy**

### 3. Configurar la API key de DeepSeek
1. En el dashboard de Vercel, ve a tu proyecto → **Settings** → **Environment Variables**
2. Agrega:
   - **Name:** `DEEPSEEK_API_KEY`
   - **Value:** tu API key de DeepSeek (la obtienes en platform.deepseek.com)
   - **Environment:** Production, Preview, Development
3. Haz clic en **Save**
4. Ve a **Deployments** → los tres puntos → **Redeploy** para aplicar la variable

## Uso

### 🔍 Buscar
Escribe cualquier término: "alimentos", "plomería", "aires acondicionados", "útiles escolares", etc.
El banco base incluye 93 artículos de limpieza con precios reales de PanamaCompra 2024-2026.

### 📥 Importar PDF
1. Descarga Cuadros de Cotización de PanamaCompra (cualquier categoría)
2. Ve al panel "Importar PDF" y sube los archivos
3. DeepSeek extrae automáticamente: código UNSPSC, nombre, unidad, precio
4. Los artículos quedan guardados en el navegador (localStorage)

### 🛒 Solicitud → Word
1. Haz clic en los artículos para agregarlos al carrito
2. Ajusta cantidades y unidades
3. Haz clic en "Generar Word"
4. El documento incluye el formato oficial FECE/MEDUCA con columna de código UNSPSC

### 🌐 PanamaCompra
Genera búsquedas optimizadas en Google para encontrar Cuadros de Cotización adjudicados.

## Notas técnicas
- Los artículos importados persisten en `localStorage` del navegador
- La función `/api/extract.js` corre en Vercel Edge Functions (Node.js)
- El Word se genera en el cliente con la librería `docx` desde CDN
- El PDF se lee con `pdf.js` desde CDN (no se sube a ningún servidor, solo el texto extraído va a DeepSeek)
