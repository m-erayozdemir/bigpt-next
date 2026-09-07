const fs = require("fs");
const fetch = require("node-fetch");

const OLLAMA_URL = process.env.OLLAMA_URL;

async function describeImage(filePath) {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");

    // GELİŞTİRİLMİŞ PROMPT
    const prompt = `
    Analyze this image in detail.
    1. If there is a **TABLE** or list, transcribe it strictly into a **Markdown Table**. Do not summarize the table; copy the data row by row.
    2. If there is an object (like a car, machine, person), describe its visual features (color, type, condition) and text on it.
    3. Output ONLY the description and the table. Do not add conversational filler.
    `;

    const payload = {
      model: "llava:latest", // Kullanıcının bu modeli pull ettiğinden emin olmalıyız!
      prompt: prompt,
      images: [base64Image],
      stream: false 
    };

    console.log("📡 LLaVA görüntü işliyor...");
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("LLaVA Error");
    const data = await res.json();
    
    // Bazen LLaVA boş dönebiliyor, kontrol edelim
    if (!data.response) return "Görsel analiz edilemedi.";
    
    return data.response; 

  } catch (err) {
    console.error("LLaVA Error:", err);
    throw err;
  }
}

module.exports = { describeImage };