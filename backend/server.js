require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
// DEĞİŞİKLİK BURADA: pdf-parse yerine pdf-extraction
const pdf = require("pdf-extraction"); 
const { createEmbedding } = require("./services/embedding");

const chatRoute = require("./routes/chat");
const chatStreamRoute = require("./routes/chat-stream");
const uploadRoute = require("./routes/upload");
const systemRagRoute = require("./routes/system-rag");

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.OLLAMA_URL) {
  console.error("❌ OLLAMA_URL .env dosyasında tanımlı değil!");
  process.exit(1);
}

// ---------- ROUTES ----------
app.use("/api/chat", chatRoute);
app.use("/api/chat-stream", chatStreamRoute);
app.use("/api/upload", uploadRoute);
app.use("/api/system-rag", systemRagRoute);

app.post("/api/reset", (req, res) => {
  const userStorePath = path.join(__dirname, "rag-user-store.json");
  
  try {
    // Dosyanın üzerine boş bir liste [] yazarak içini temizliyoruz
    fs.writeFileSync(userStorePath, JSON.stringify([], null, 2));
    console.log("🧹 Sayfa yenilendi: Kullanıcı hafızası (User Store) temizlendi.");
    res.json({ status: "cleared" });
  } catch (err) {
    console.error("Reset Error:", err);
    res.status(500).json({ error: "Sıfırlama hatası" });
  }
});

// ---------- AUTOMATIC RAG BUILDER ----------
async function initSystemRag() {
  const storePath = path.join(__dirname, "rag-system-store.json");
  const docsDir = path.join(__dirname, "docs");

  if (!fs.existsSync(docsDir)) {
    console.log("⚠️ 'docs' klasörü bulunamadı, RAG sistemi pas geçiliyor.");
    return;
  }

  // Store varsa ve boyutu 0 değilse pas geç
  if (fs.existsSync(storePath)) {
    const stats = fs.statSync(storePath);
    if (stats.size > 50) { // 50 byte'tan büyükse dolu kabul et
       console.log(`✅ System RAG store mevcut (${(stats.size / 1024).toFixed(2)} KB).`);
       return;
    }
  }

  console.log("🔄 System RAG store oluşturuluyor...");
  
  try {
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith(".pdf"));
    if (files.length === 0) {
      console.log("⚠️ Docs klasöründe PDF bulunamadı.");
      return;
    }

    let store = [];
    console.log(`📄 Toplam ${files.length} adet PDF işlenecek...`);

    for (let file of files) {
      const filePath = path.join(docsDir, file);
      const buffer = fs.readFileSync(filePath);
      
      try {
        // PDF Extraction Kullanımı
        const data = await pdf(buffer);
        const text = data.text;

        if (!text || text.trim().length === 0) continue;

        const chunks = text.match(/[\s\S]{1,1500}/g) || [];
        console.log(`   👉 ${file}: ${chunks.length} parça embedding oluşturuluyor...`);

        for (let chunk of chunks) {
          const embedding = await createEmbedding(chunk);
          store.push({ 
            file, 
            chunk: chunk.trim(), 
            vector: embedding 
          });
        }
      } catch (err) {
        console.error(`   ❌ ${file} işlenirken hata:`, err.message);
      }
    }

    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
    console.log(`✅ System RAG indeksleme tamamlandı! Toplam ${store.length} vektör kaydedildi.`);

  } catch (err) {
    console.error("❌ System RAG init error:", err);
  }
}

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log("✅ Backend running on port", PORT);
  console.log("🌐 OLLAMA_URL:", process.env.OLLAMA_URL);
  await initSystemRag();
});