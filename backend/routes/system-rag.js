const express = require("express");
// DEĞİŞİKLİK BURADA: pdf-parse yerine pdf-extraction
const pdf = require("pdf-extraction");
const fs = require("fs");
const path = require("path");
const { createEmbedding } = require("../services/embedding");

const router = express.Router();

router.post("/build", async (req, res) => {
  try {
    // System RAG belgeleri docs klasöründe
    const dir = path.join(__dirname, "..", "docs");
    
    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: "Docs folder not found" });
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".pdf"));

    let store = [];

    for (let file of files) {
      const buffer = fs.readFileSync(path.join(dir, file));
      
      // pdf-extraction kullanımı
      const data = await pdf(buffer);
      const text = data.text;

      if (!text || text.trim().length === 0) continue;

      // Chunk oluşturma
      const chunks = text.match(/[\s\S]{1,1500}/g) || [];

      for (let chunk of chunks) {
        const embedding = await createEmbedding(chunk);
        store.push({ file, chunk: chunk.trim(), vector: embedding });
      }
    }

    // Store kaydetme
    fs.writeFileSync(
      path.join(__dirname, "..", "rag-system-store.json"),
      JSON.stringify(store, null, 2)
    );

    res.json({ ok: true, chunks: store.length });

  } catch (err) {
    console.error("System RAG error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;