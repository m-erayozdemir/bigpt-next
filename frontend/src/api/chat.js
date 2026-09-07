import { API_BASE } from "../config";

export async function sendChatStream(history, model, onChunk, onDone = () => {}) {
  const response = await fetch(`${API_BASE}/api/chat-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ history, model }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Streaming connection failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE mesajları çift enter ile ayrılır
    const parts = buffer.split("\n\n");
    
    // Son parça genelde yarım kalır, buffera geri at
    buffer = parts.pop(); 

    for (let part of parts) {
      if (part.startsWith("data:")) {
        // "data:" kısmını at
        let content = part.slice(5); 
        
        // Eğer "data: " ise baştaki boşluğu at
        if (content.startsWith(" ")) {
          content = content.slice(1);
        }

        // PAKETİ AÇ (UNPACK)
        try {
          const parsed = JSON.parse(content);
          
          if (parsed === "[END]") {
            onDone();
            return;
          }
          
          // Parse edilmiş temiz metni gönder
          onChunk(parsed);

        } catch {
          // Eğer JSON değilse (eski format vs) olduğu gibi ver
          if (content.trim() !== "") {
            onChunk(content);
          }
        }
      }
    }
  }

  onDone();
}