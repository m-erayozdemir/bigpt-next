import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Send, Paperclip, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { sendChatStream } from "../api/chat";
import { API_BASE, PREVIEW } from "../config";

function mergeTokens(prev, token) {
  return prev + token;
}

export default function ChatBox() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [model, setModel] = useState("auto");
  const [dropdown, setDropdown] = useState(false);
  const [files, setFiles] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const models = [
    { id: "llama3.1:latest", name: "LLaMA 3.1" },
    { id: "qwen2.5:latest", name: "Qwen 2.5" },
    { id: "deepseek-r1:latest", name: "DeepSeek R1" },
    { id: "mistral:latest", name: "Mistral" },
    { id: "auto", name: "Auto" },
  ];

  useEffect(() => {
    if (PREVIEW) return;
    // Reset the local prototype session.
    fetch(`${API_BASE}/api/reset`, { method: "POST" })
      .then(() => console.log("Oturum sıfırlandı."))
      .catch(err => console.error("Oturum sıfırlanamadı:", err));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleFileSelect(e) {
    if (!e.target.files || e.target.files.length === 0) return;

    const selected = Array.from(e.target.files).map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    
    setFiles((prev) => [...prev, ...selected]);

    // ÖNEMLİ: Input değerini sıfırla ki aynı dosya tekrar seçilebilsin
    e.target.value = ""; 
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleSend() {
    if (PREVIEW || isTyping) return;
    if (!input.trim() && files.length === 0) return;

    setIsTyping(true);

    const userMessage = {
      id: Date.now() + "_user",
      role: "user",
      text: input,
      files: [...files],
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    const botId = Date.now() + "_bot";
    setMessages((prev) => [...prev, { id: botId, role: "bot", text: "" }]);

    const filesToUpload = [...files];
    setInput("");
    setFiles([]);

    try {
      // --- A) DOSYA YÜKLEME AŞAMASI ---
      if (filesToUpload.length > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId ? { ...m, text: "Dosyalar analiz ediliyor (OCR & Embedding)..." } : m
          )
        );

        for (const fileObj of filesToUpload) {
          const formData = new FormData();
          formData.append("file", fileObj.file);
          
          const uploadRes = await fetch(`${API_BASE}/api/upload`, {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json();
            throw new Error(`Upload hatası (${fileObj.name}): ${errData.error || uploadRes.statusText}`);
          }
        }
      }

      // --- B) CHAT AŞAMASI ---
      const historyPayload = updatedMessages.map((msg) => ({
        role: msg.role === "bot" ? "assistant" : "user",
        content: msg.text,
      }));

      await sendChatStream(
        historyPayload,
        model,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== botId) return m;
              // "Analyzing..." yazısını sil
              const currentText = m.text.startsWith("Dosyalar analiz") ? "" : m.text;
              return { ...m, text: mergeTokens(currentText, chunk) };
            })
          );
        },
        () => setIsTyping(false)
      );

    } catch (err) {
      setIsTyping(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId ? { ...m, text: "❌ Hata: " + err.message } : m
        )
      );
    }
  }

  return (
    <div className="chatbox-container">
      {PREVIEW && <div className="preview-notice" role="status">Arayüz önizlemesi · Model ve belge işleme bağlantısı kapalı</div>}
      <div className="messages-container">
        <div className="messages-inner">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-row ${
                msg.role === "user" ? "message-user" : "message-bot"
              }`}
            >
              <div
                className={`message-bubble ${
                  msg.role === "user" ? "bubble-user" : "bubble-bot"
                }`}
              >
                {msg.role === "bot" ? (
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                )}

                {msg.files && msg.files.length > 0 && (
                  <div className="message-file-list" style={{ marginTop: 10 }}>
                    {msg.files.map((f) => (
                      <div key={f.id} className="message-file">📎 {f.name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef}></div>
        </div>
      </div>

      <div className="input-wrapper">
        <div className="input-inner">
          {files.length > 0 && (
            <div className="selected-files">
              {files.map((f) => (
                <div key={f.id} className="selected-file">
                  📎 {f.name}
                  <button
                    className="selected-file-remove"
                    onClick={() => removeFile(f.id)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="input-row">
            <button
              className="btn-attach"
              aria-label="Dosya ekle"
              onClick={() => fileInputRef.current.click()}
              disabled={PREVIEW || isTyping}
            >
              <Paperclip size={18} />
            </button>

            {/* GÜNCELLEME BURADA YAPILDI: accept özelliği eklendi */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf, .jpg, .jpeg, .png" 
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            <div className="model-dropdown">
              <button
                className="btn-model"
                onClick={() => !isTyping && setDropdown(!dropdown)}
                disabled={isTyping}
              >
                {models.find((m) => m.id === model)?.name}
                <ChevronDown size={16} />
              </button>

              {dropdown && (
                <div className="model-menu">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setDropdown(false);
                        setMessages([]);
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              className="text-input"
              rows={1}
              value={input}
              disabled={PREVIEW || isTyping}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={PREVIEW ? "Önizleme — model bağlantısı kapalı" : isTyping ? "Bot yazıyor..." : "Mesaj yazın…"}
              style={{
                resize: "none",
                overflow: "hidden",
                minHeight: "46px",
                paddingTop: "12px",
              }}
            />

            <button
              className="btn-send"
              aria-label="Mesaj gönder"
              onClick={handleSend}
              disabled={PREVIEW || isTyping}
              style={{ opacity: isTyping ? 0.5 : 1 }}
            >
              <Send size={18} color="white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}