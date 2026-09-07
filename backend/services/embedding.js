const { pipeline } = require("@xenova/transformers");

let embedder = null;

// Lazy load embedding model
async function loadEmbedder() {
  if (!embedder) {
    // console.log("📥 Embedding modeli yükleniyor..."); // Konsolu kirletmemesi için kapattık
    embedder = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
      quantized: true, 
    });
  }
  return embedder;
}

// Embed alma
async function createEmbedding(text) {
  try {
    const model = await loadEmbedder();

    // Çok uzun metinleri kes (Modelin çökmemesi için)
    // Safe limit: 512 tokens ~ 1500-2000 chars. 
    // Garanti olsun diye 1000 karakter alıyoruz.
    const safeText = text ? text.slice(0, 1000) : ""; 

    const result = await model(safeText, {
      pooling: "mean", 
      normalize: true, 
    });

    // --- KRİTİK DÜZELTME ---
    // result.data bir Float32Array gelir. Bunu standart Array'e çevirmeliyiz.
    // JSON.stringify, Float32Array'i bazen nesne gibi kaydeder, bu da "undefined" sorununa yol açar.
    if (result && result.data) {
        return Array.from(result.data); 
    }
    
    // Eğer bir şekilde veri yoksa boş dizi değil, null dönmeyelim, 
    // hata vermemesi için sıfırlardan oluşan bir vektör veya hata fırlatalım.
    console.error("Embedding üretilemedi (Boş sonuç).");
    return new Array(384).fill(0); 

  } catch (err) {
    console.error("Embedding Hatası:", err.message);
    return new Array(384).fill(0);
  }
}

module.exports = { createEmbedding };