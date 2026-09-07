const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { createEmbedding } = require("../services/embedding");

// PDF Kütüphanesi
const pdfLib = require("pdf-extraction");

// YENİ: LLaVA Servisi (Tesseract yerine)
const { describeImage } = require("../services/llava");

const router = express.Router();

// Uploads klasörünü garantiye al
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Dosya gönderilmedi." });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype; 

    console.log(`📥 Dosya işleniyor: ${originalName} (${mimeType})`);

    let text = "";

    // --- SENARYO 1: PDF DOSYASI ---
    if (mimeType === "application/pdf" || originalName.toLowerCase().endsWith(".pdf")) {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfLib(dataBuffer);
        text = data.text;
        console.log("📄 PDF metin çıkarma tamamlandı.");
      } catch (pdfErr) {
        console.error("PDF Hatası:", pdfErr);
        throw new Error("PDF okunamadı: " + pdfErr.message);
      }
    }
    
    // --- SENARYO 2: RESİM DOSYASI (LLaVA - Vision) ---
    else if (mimeType.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(originalName)) {
      console.log("👁️ Resim tespit edildi. LLaVA (Vision) analizi başlıyor...");
      
      try {
        // LLaVA servisini çağır
        const description = await describeImage(filePath);
        
        // Gelen veriyi formatla
        text = `[GÖRSEL ANALİZİ - ${originalName}]\nBu görselin LLaVA tarafından yapılan analizi:\n${description}`;
        
        console.log("✅ LLaVA analizi tamamlandı.");
        console.log("📝 Özet:", description.slice(0, 100) + "...");

      } catch (llavaErr) {
        console.error("LLaVA Hatası:", llavaErr);
        throw new Error("Resim LLaVA ile analiz edilemedi. RunPod bağlantısını kontrol edin.");
      }
    } 
    
    else {
      throw new Error("Desteklenmeyen format. Sadece PDF, JPG ve PNG.");
    }

    // --- ORTAK İŞLEMLER ---

    if (!text || text.trim().length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Dosyadan anlamlı bir veri çıkarılamadı." });
    }

    // Metni temizle
    const cleanText = text.replace(/\s+/g, " ").trim();
    const chunks = cleanText.match(/[\s\S]{1,1000}/g) || [];
    
    console.log(`   ✂️ ${chunks.length} parçaya bölündü ve embedding oluşturuluyor...`);

    const storePath = path.join(__dirname, "..", "rag-user-store.json");
    let store = [];

    if (fs.existsSync(storePath)) {
      try {
        store = JSON.parse(fs.readFileSync(storePath, "utf8"));
      } catch (e) {
        store = [];
      }
    }

    for (let chunk of chunks) {
      const vector = await createEmbedding(chunk);
      store.push({
        file: originalName,
        chunk: chunk.trim(),
        vector: vector
      });
    }

    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
    console.log(`💾 Hafıza güncellendi.`);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ 
      status: "ok", 
      chunksAdded: chunks.length, 
      message: "Dosya (veya Görsel) başarıyla analiz edildi." 
    });

  } catch (err) {
    console.error("Upload Router Hatası:", err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;