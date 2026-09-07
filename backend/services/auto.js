const { chat } = require("./ollama");

// Regex Tanımları
const CODE_REGEX = /(function|class\s|import\s|def\s|var\s|const\s|return\s|console\.|=>|\{|\}|\[|\]|sql|select\s|update\s|api|http|json|docker|linux|terminal|bug|hata|error)/i;
const REASONING_REGEX = /(hesapla|çöz|calculate|solve|math|integral|türev|olasılık|mantık|analiz et|neden|niçin|step by step|adım adım|planla|algoritma)/i;
const TR_CHAR_REGEX = /[çğışüöÇĞİŞÜÖ]/;

function detectLanguage(text) {
  if (!text) return "en";
  // Sadece temizlenmiş kullanıcı sorusuna bakacağız
  if (TR_CHAR_REGEX.test(text) || /\b(merhaba|nasılsın|nedir|evet|hayır|tamam)\b/i.test(text)) {
    return "tr";
  }
  return "en";
}

module.exports = async function auto(history, options = {}) {
  // Son kullanıcı mesajını bul
  let lastUserMessage = "";
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      lastUserMessage = history[i].content;
      break;
    }
  }

  // --- 1. METİN TEMİZLİĞİ VE ANALİZ ---
  // chat-stream.js'deki formata göre temizlik yapıyoruz.
  let cleanMessageForDetection = lastUserMessage;
  
  // chat-stream.js'de eklediğimiz etiket: "KULLANICI SORUSU:"
  if (lastUserMessage.includes("KULLANICI SORUSU:")) {
      const parts = lastUserMessage.split("KULLANICI SORUSU:");
      if (parts.length > 1) {
          cleanMessageForDetection = parts[1].trim();
      }
  }

  const lang = detectLanguage(cleanMessageForDetection);
  console.log(`🌐 Algılanan Dil: ${lang.toUpperCase()} (Analiz edilen: "${cleanMessageForDetection.slice(0, 30)}...")`);

  // --- 2. CONTEXT KONTROLÜ (DÜZELTİLDİ) ---
  // chat-stream.js'deki YENİ etiket ile uyumlu hale getirildi.
  const hasContext = lastUserMessage.includes("--- KAYNAK BİLGİLER BAŞLANGIÇ ---");

  // --- 3. SİSTEM MESAJI AYARI ---
  let dynamicSystemPrompt = "";
  if (lang === "tr") {
      dynamicSystemPrompt = "Sen BiGPT-Next adında yardımcı bir asistansın. Cevabını Türkçe ver.";
  } else {
      dynamicSystemPrompt = "You are BiGPT-Next. Answer in English.";
  }

  const systemMsg = { role: "system", content: dynamicSystemPrompt };
  
  // History'nin başına sistem mesajını ekle veya güncelle
  if (history.length > 0 && history[0].role === "system") {
      history[0] = systemMsg;
  } else {
      history.unshift(systemMsg);
  }

  // --- 4. MODEL SEÇİM MANTIĞI ---
  let model = "llama3.1:latest";
  let reason = "Default";

  // Temiz mesaj üzerinden niyet analizi yapıyoruz
  const isCoding = CODE_REGEX.test(cleanMessageForDetection);
  const isReasoning = REASONING_REGEX.test(cleanMessageForDetection);

  if (hasContext) {
    // RAG varsa DeepSeek kullanmıyoruz çünkü context'i çok iyi takip etmeyebilir,
    // Qwen ve Llama context takibinde daha stabil.
    if (lang === "tr") {
        model = "qwen2.5:latest";
        reason = "RAG + TR -> Qwen";
    } else {
        model = "llama3.1:latest";
        reason = "RAG + EN -> Llama 3.1";
    }
  } 
  else {
    // Context YOKSA yeteneklere göre seç
    if (isCoding || isReasoning) {
        model = "deepseek-r1:latest";
        reason = "Complex Task (Reasoning/Code)";
    }
    else if (lang === "tr") {
        model = "qwen2.5:latest";
        reason = "TR Chat";
    }
    else {
        model = "llama3.1:latest";
        reason = "EN Chat";
    }
  }

  console.log(`🤖 Auto-Model Kararı: ${model} (${reason})`);

  if (options.returnModel) {
    return model;
  }

  return await chat(model, history);
};