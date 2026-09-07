const fetch = require("node-fetch");

const OLLAMA_URL = process.env.OLLAMA_URL;

// HİBRİT SİSTEM PROMPT'U
const BASE_SYSTEM_PROMPT = `
You are BiGPT, an intelligent assistant specialized in Defense and Avionics but also capable of general conversation.

RULES:
1. **IF Context is Provided:** You MUST strictly base your answer on the provided "KAYNAK BİLGİLER" (Source Info). Cite the specific document names if mentioned in the source.
2. **IF NO Context is Provided:** Answer the user's question using your own general knowledge helpfully and accurately. Do not mention that you are missing context.
3. **Language:** Always answer in the same language as the user's question (Turkish or English).
`;

async function chat(model, messages) {
  const incomingSystemMsg = messages.find(m => m.role === "system");
  let finalSystemContent = BASE_SYSTEM_PROMPT;

  if (incomingSystemMsg) {
    finalSystemContent = `${incomingSystemMsg.content}\n\n${BASE_SYSTEM_PROMPT}`;
  }

  const finalMessages = [
    { role: "system", content: finalSystemContent },
    ...messages.filter(m => m.role !== "system")
  ];

  const payload = {
    model,
    messages: finalMessages,
    stream: false,
    options: { num_predict: 2048, temperature: 0.3 } 
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Ollama error");
  const data = await res.json();
  return data?.message?.content || "";
}

async function chatStream(model, messages) {
  const incomingSystemMsg = messages.find(m => m.role === "system");
  let finalSystemContent = BASE_SYSTEM_PROMPT;

  if (incomingSystemMsg) {
    finalSystemContent = `${incomingSystemMsg.content}\n\n${BASE_SYSTEM_PROMPT}`;
  }

  const finalMessages = [
    { role: "system", content: finalSystemContent },
    ...messages.filter(m => m.role !== "system")
  ];

  const payload = {
    model,
    messages: finalMessages,
    stream: true,
    options: { num_predict: 4096, temperature: 0.3 } 
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Stream error");
  return res.body;
}

module.exports = { chat, chatStream };