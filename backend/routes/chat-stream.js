const express = require("express");
const router = express.Router();

const { chatStream } = require("../services/ollama");
const auto = require("../services/auto");
const { ragRetrieve } = require("../services/rag");

router.post("/", async (req, res) => {
  let { history, model } = req.body;

  // Bağlantı Ayarları
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    if (!history || !Array.isArray(history)) history = [];

    // --- 1. GEÇMİŞ TEMİZLİĞİ (HAFIZA DÜZELTMESİ) ---
    // Sorunun Çözümü Burası:
    // Modelin kafası karışmasın diye, geçmiş turlardaki (eski) RAG verilerini siliyoruz.
    // Geçmişte sadece kullanıcının saf sorusu ("Bu nedir?", "Özetle" vb.) kalmalı.
    const cleanHistory = history.map((msg, index) => {
      // Son mesaj hariç diğerlerini temizle (Son mesajı birazdan taze veriyle dolduracağız)
      if (index === history.length - 1) return { ...msg };

      const newMsg = { ...msg };
      if (newMsg.role === "user" && newMsg.content.includes("--- BAŞLANGIÇ BİLGİSİ")) {
        // Eski RAG formatını ayıkla ve sadece soruyu al
        const parts = newMsg.content.split("KULLANICI SORUSU: ");
        if (parts.length > 1) {
          newMsg.content = parts[1].trim(); // Sadece "Bunu özetle" kısmı kalır
        }
      }
      return newMsg;
    });
    // --------------------------------------------------

    let lastUserContent = "";
    if (cleanHistory.length > 0) {
       const lastMsg = cleanHistory[cleanHistory.length - 1];
       if (lastMsg.role === "user") lastUserContent = lastMsg.content;
    }

    // --- 2. RAG ENTEGRASYONU (YENİ SORU İÇİN) ---
    if (lastUserContent) {
      const context = await ragRetrieve(lastUserContent);
      
      if (context) {
        console.log("✅ RAG Verisi Modele Enjekte Ediliyor.");
        
        // Sadece ŞU ANKİ mesajı RAG verisiyle dolduruyoruz
        cleanHistory[cleanHistory.length - 1].content = 
          `Aşağıdaki "KAYNAK BİLGİLER"i kullanarak soruyu cevapla.\n` +
          `Eğer kaynaklarda bilgi yoksa, sadece soruyu kendi bilginle cevapla.\n\n` +
          `--- KAYNAK BİLGİLER BAŞLANGIÇ ---\n${context}\n--- KAYNAK BİLGİLER BİTİŞ ---\n\n` +
          `KULLANICI SORUSU: ${lastUserContent}`;
      } else {
        console.log("⏩ RAG Verisi Yok, Doğrudan Cevap.");
      }
    }
    // ------------------------------------

    // Model Seçimi (Auto Modu)
    let targetModel = model;
    if (model === "auto") {
      // Auto servisine temizlenmiş history'i gönderiyoruz
      targetModel = await auto(cleanHistory, { returnModel: true });
      
      const modelNames = {
        "llama3.1:latest": "LLaMA 3.1",
        "qwen2.5:latest": "Qwen 2.5",
        "deepseek-r1:latest": "DeepSeek R1",
        "mistral:latest": "Mistral"
      };
      const friendlyName = modelNames[targetModel] || targetModel;
      send(`[Seçilen Model: ${friendlyName}]\n\n`);
    }

    // Yayını Başlat (Temizlenmiş history ile)
    const stream = await chatStream(targetModel, cleanHistory);

    stream.on("data", (chunk) => {
      const raw = chunk.toString(); 
      const lines = raw.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue; 
        try {
          const json = JSON.parse(line);
          if (json.message?.thinking) continue;
          
          if (json.message?.content) {
            send(json.message.content);
          }
        } catch (e) { }
      }
    });

    stream.on("end", () => {
      send("[END]");
      res.end();
    });

    stream.on("error", (err) => {
      console.error("Stream Error:", err);
      send("\n[Hata: Bağlantı koptu]");
      res.end();
    });

  } catch (err) {
    console.error("Route Error:", err);
    send("Error: " + err.message);
    res.end();
  }
});

module.exports = router;