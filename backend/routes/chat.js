const express = require("express");
const router = express.Router();

const { chat } = require("../services/ollama");
const auto = require("../services/auto");
const { ragRetrieve } = require("../services/rag");

// Bu endpoint normal (streaming olmayan) chat içindir.
// Şu anki arayüz ağırlıklı olarak chat-stream kullanıyor ama
// sistemin çökmemesi için bu dosyanın da geçerli bir router olması şart.

router.post("/", async (req, res) => {
  const { message, history, model } = req.body;

  try {
    // Eğer history geldiyse (yeni yapı), son mesajı al
    let finalMessage = message;
    let conversation = history;

    if (!conversation && message) {
      conversation = [{ role: "user", content: message }];
    }
    
    // Son kullanıcı mesajını bul
    if (conversation && conversation.length > 0) {
      const lastMsg = conversation[conversation.length - 1];
      if (lastMsg.role === "user") {
        finalMessage = lastMsg.content;
      }
    }

    // RAG Bağlamı
    const context = await ragRetrieve(finalMessage);
    
    // Eğer RAG bir şey bulursa, conversation'ın son elemanını güncelle
    if (context && conversation.length > 0) {
      const lastIdx = conversation.length - 1;
      conversation[lastIdx].content = 
        `Bağlam:\n${context}\n\nSoru: ${conversation[lastIdx].content}`;
    }

    // Yanıt üret
    const reply =
      model === "auto"
        ? await auto(conversation) // Auto servisi artık history kabul ediyor
        : await chat(model, conversation);

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Backend error: " + err.message });
  }
});

module.exports = router;