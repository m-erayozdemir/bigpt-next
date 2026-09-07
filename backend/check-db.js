const fs = require("fs");
const path = require("path");

const systemStorePath = path.join(__dirname, "rag-system-store.json");

console.log("🔍 RAG Veritabanı Kontrolü Başlatılıyor...\n");

if (!fs.existsSync(systemStorePath)) {
    console.error("❌ HATA: rag-system-store.json dosyası BULUNAMADI!");
    console.log("👉 Lütfen 'node server.js' çalıştırıp indekslemenin bitmesini bekleyin.");
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(systemStorePath, "utf8");
    const data = JSON.parse(rawData);

    console.log(`✅ Veritabanı dosyası okundu.`);
    console.log(`📊 Toplam Parça (Chunk) Sayısı: ${data.length}`);

    if (data.length === 0) {
        console.error("❌ HATA: Veritabanı dosyasının içi BOŞ! PDF'ler okunamamış.");
        process.exit(1);
    }

    // İlk kaydı incele
    const firstEntry = data[0];
    console.log("\n--- ÖRNEK KAYIT (İlk Chunk) ---");
    console.log(`📄 Dosya Adı: ${firstEntry.file}`);
    console.log(`📝 Metin Uzunluğu: ${firstEntry.chunk.length} karakter`);
    console.log(`🧮 Vektör Boyutu: ${firstEntry.vector ? firstEntry.vector.length : "YOK!"}`);
    console.log(`💬 İçerik Önizleme: "${firstEntry.chunk.slice(0, 100)}..."`);

    // BITES kontrolü
    const bitesChunks = data.filter(d => d.file.toLowerCase().includes("bites"));
    console.log(`\n--- BITES.PDF KONTROLÜ ---`);
    if (bitesChunks.length > 0) {
        console.log(`✅ 'bites.pdf' için ${bitesChunks.length} parça veri bulundu.`);
        // İçinde "ATOK" geçiyor mu?
        const atokCheck = bitesChunks.find(d => d.chunk.includes("ATOK") || d.chunk.includes("atok"));
        if (atokCheck) {
            console.log(`✅ KRİTİK BAŞARI: 'ATOK' kelimesi veritabanında bulundu!`);
        } else {
            console.error(`❌ UYARI: 'bites.pdf' var ama içinde 'ATOK' kelimesi bulunamadı. PDF okuma kalitesi düşük olabilir.`);
        }
    } else {
        console.error("❌ HATA: 'bites.pdf' veritabanında YOK! Dosya adı farklı olabilir mi?");
    }

} catch (err) {
    console.error("❌ BEKLENMEYEN HATA:", err.message);
}