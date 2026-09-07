const fs = require("fs");
const path = require("path");
const { createEmbedding } = require("./embedding");

// --- HİBRİT KARAR MEKANİZMASI İÇİN ANAHTAR KELİMELER ---
const SYSTEM_KEYWORDS = [
  "bites", "aselsan", "havelsan", "tai", "tusaş",
  "do-178", "do-254", "do-330", "do-326", "arp4754",
  "mil-std", "1553", "1760", "arinc", "429", "afdx",
  "avionics", "aviyonik", "kokpit", "cockpit",
  "test", "verification", "validation", "doğrulama", "geçerleme",
  "coverage", "kapsama", "mc/dc", "statement coverage",
  "simulation", "simülasyon", "simulator", "simülatör",
  "istqb", "yazılım", "software", "embedded", "gömülü",
  "sarp", "altay", "atak", "atok", "xperverse", "metaverse",
  "dijital ikiz", "digital twin", "xr", "artırılmış gerçeklik"
];

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function loadStore(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data.trim() ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Store okuma hatası (${path.basename(filePath)}):`, e.message);
    return [];
  }
}

async function ragRetrieve(question) {
  const userStorePath = path.join(__dirname, "..", "rag-user-store.json");
  const systemStorePath = path.join(__dirname, "..", "rag-system-store.json");

  const userStore = loadStore(userStorePath);
  
  const qLower = question.toLowerCase();
  const hasUserFile = userStore.length > 0;
  const isSystemRelevant = SYSTEM_KEYWORDS.some(kw => qLower.includes(kw));

  // Kullanıcı dosyası yoksa VE konu teknik değilse RAG yapma
  if (!hasUserFile && !isSystemRelevant) {
    console.log("⏩ Konu genel sohbet, RAG atlanıyor.");
    return null;
  }

  console.log(`🔍 RAG Tetiklendi: "${question}"`);

  let queryText = question;
  if (qLower.includes("bites")) queryText += " savunma defense technology";
  
  const qVec = await createEmbedding(queryText);
  const systemStore = loadStore(systemStorePath);

  let allCandidates = [];

  // --- 🔥 KRİTİK DEĞİŞİKLİK: TEK DOSYA ODAĞI 🔥 ---
  
  // 1. En son yüklenen dosyanın ismini bul
  let activeUserFile = null;
  if (userStore.length > 0) {
      activeUserFile = userStore[userStore.length - 1].file;
      console.log(`📂 Aktif Kullanıcı Dosyası: ${activeUserFile}`);
  }

  // 2. KULLANICI VERİLERİ (SADECE AKTİF DOSYAYI AL)
  // Diğer dosyaları (eski yüklenenleri) döngüye bile sokmuyoruz.
  if (activeUserFile) {
      const activeChunks = userStore.filter(entry => entry.file === activeUserFile);
      
      activeChunks.forEach(entry => {
        let score = cosineSim(qVec, entry.vector);
        score += 0.60; // Kullanıcı dosyasına büyük öncelik ver

        allCandidates.push({
          type: "USER",
          source: "KULLANICI DOSYASI",
          file: entry.file,
          chunk: entry.chunk,
          score: score
        });
      });
  }

  // 3. SİSTEM VERİLERİ (PDF'ler)
  // Eğer kullanıcı dosyası varsa, sistem verilerini sadece "ilgili anahtar kelime" varsa ekle.
  // Eğer anahtar kelime yoksa sistem verilerini ekleme ki araya girmesin.
  if (isSystemRelevant || !activeUserFile) {
      systemStore.forEach(entry => {
        allCandidates.push({
          type: "SYSTEM",
          source: "BİLGİ BANKASI",
          file: entry.file,
          chunk: entry.chunk,
          score: cosineSim(qVec, entry.vector)
        });
      });
  }

  // --- SIRALAMA VE TEMİZLİK ---
  allCandidates.sort((a, b) => b.score - a.score);

  if (allCandidates.length === 0) return null;

  // En iyi sonucu al
  const bestMatch = allCandidates[0];

  // İZOLASYON: Eğer kazanan USER ise, SYSTEM (Bilgi Bankası) verilerini sonuçtan temizle.
  // Böylece araba görseli varken araya BITES bilgisi de sıkışmaz.
  const isolatedResults = allCandidates.filter(c => {
      if (bestMatch.type === "USER") {
          return c.type === "USER";
      }
      return true;
  });

  // Son filtreleme (Çok düşük puanlıları at)
  const finalResults = isolatedResults.filter(c => c.score > 0.35);
  
  // En iyi 4 parça
  const topResults = finalResults.slice(0, 4);

  if (topResults.length > 0) {
    console.log(`   ✅ SEÇİLEN KAYNAK: ${topResults[0].file} (${topResults.length} parça)`);
    return topResults
      .map(r => `[KAYNAK: ${r.source} - ${r.file}]\n${r.chunk}`)
      .join("\n\n---\n\n");
  }

  console.log("   ❌ Yeterli eşleşme bulunamadı.");
  return null;
}

module.exports = { ragRetrieve };