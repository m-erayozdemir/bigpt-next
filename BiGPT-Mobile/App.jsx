import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Markdown from 'react-native-markdown-display';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import EventSource from "react-native-sse";

// ⚠️ BURAYA KENDİ IP ADRESİNİ YAZMAYI UNUTMA
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001"; 

// Mevcut Modeller
const MODELS = [
  { id: "auto", name: "✨ Auto (Akıllı)" },
  { id: "llama3.1:latest", name: "🦙 Llama 3.1" },
  { id: "qwen2.5:latest", name: "🐉 Qwen 2.5" },
  { id: "deepseek-r1:latest", name: "🧠 DeepSeek R1" },
  { id: "mistral:latest", name: "🌪️ Mistral" },
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Model Seçimi State'i
  const [currentModel, setCurrentModel] = useState("auto");
  const [showModelSelector, setShowModelSelector] = useState(false);

  const flatListRef = useRef();
  const eventSourceRef = useRef(null); // Stream kontrolü için ref

  useEffect(() => {
    fetch(`${API_URL}/api/reset`, { method: "POST" })
      .then(() => console.log("Mobil oturum sıfırlandı"))
      .catch(e => console.log("Bağlantı hatası:", e));
      
    // Component kapanırsa bağlantıyı kes
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const file = result.assets ? result.assets[0] : result;
        setSelectedFile(file);
      }
    } catch (err) {
      console.log("Dosya seçme hatası", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !selectedFile) return;
    if (isTyping) return;

    const userText = input;
    setInput("");
    setIsTyping(true);
    setShowModelSelector(false);

    // 1. Kullanıcı mesajını ekle
    const userMsg = { id: Date.now(), role: 'user', content: userText, file: selectedFile };
    setMessages(prev => [...prev, userMsg]);
    
    // 2. Bot placeholder oluştur
    const botMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', content: "" }]);

    const fileToUpload = selectedFile;
    setSelectedFile(null);

    try {
      // --- A) DOSYA YÜKLEME ---
      if (fileToUpload) {
        setMessages(prev => prev.map(m => m.id === botMsgId ? {...m, content: "Dosya analiz ediliyor..."} : m));
        
        const formData = new FormData();
        formData.append('file', {
          uri: fileToUpload.uri,
          name: fileToUpload.name,
          type: fileToUpload.mimeType || 'application/pdf', 
        });

        const uploadRes = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (!uploadRes.ok) throw new Error("Upload başarısız");
        
        setMessages(prev => prev.map(m => m.id === botMsgId ? {...m, content: ""} : m));
      }

      // --- B) STREAMING CHAT ---
      
      const historyPayload = [
        ...messages.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: userText }
      ];

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const es = new EventSource(`${API_URL}/api/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          history: historyPayload, 
          model: currentModel 
        }),
        pollingInterval: 0, 
      });

      eventSourceRef.current = es;

      es.addEventListener("open", () => {
        console.log("Stream bağlantısı açıldı.");
      });

      es.addEventListener("message", (event) => {
        // 🔥 DÜZELTME BURADA: "[END]" kontrolünü esnettik (Tırnak işaretleri sorununu çözer)
        if (event.data.includes("[END]")) {
          console.log("Yanıtlama bitti (Signal).");
          es.close();
          eventSourceRef.current = null;
          setIsTyping(false); // Yazıyor animasyonunu kapat
          return;
        }

        try {
          const chunk = JSON.parse(event.data);
          
          if (!chunk) return;

          setMessages(prev => {
            const newMsgs = [...prev];
            const lastIndex = newMsgs.findIndex(m => m.id === botMsgId);
            
            if (lastIndex !== -1) {
              const lastMsg = newMsgs[lastIndex];
              if (lastMsg.content === "Dosya analiz ediliyor...") {
                  lastMsg.content = chunk;
              } else {
                  lastMsg.content += chunk;
              }
            }
            return newMsgs;
          });
        } catch (e) {}
      });

      es.addEventListener("error", (event) => {
        console.log("Stream sonlandı (Error/Close):", event.type);
        // Bağlantı kapansa bile güvenli şekilde bitir
        es.close(); 
        eventSourceRef.current = null;
        setIsTyping(false); 
      });

    } catch (error) {
      Alert.alert("Hata", "Sunucu hatası.");
      setMessages(prev => prev.map(m => m.id === botMsgId ? {...m, content: "❌ Hata oluştu."} : m));
      setIsTyping(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1a1a', '#000000']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>BiGPT-Next</Text>
            <Text style={styles.subHeader}>
              {MODELS.find(m => m.id === currentModel)?.name || "Auto"}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.modelToggleBtn} 
            onPress={() => setShowModelSelector(!showModelSelector)}
          >
            <Ionicons name="settings-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* MODEL SEÇİCİ (Açılır Kapanır) */}
        {showModelSelector && (
          <View style={styles.modelSelectorContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{paddingVertical: 10}}>
              {MODELS.map((m) => (
                <TouchableOpacity 
                  key={m.id} 
                  style={[styles.modelBtn, currentModel === m.id && styles.modelBtnActive]}
                  onPress={() => setCurrentModel(m.id)}
                >
                  <Text style={[styles.modelBtnText, currentModel === m.id && styles.modelBtnTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* MESAJ LİSTESİ */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })} 
          renderItem={({ item }) => (
            <View style={[styles.messageRow, item.role === 'user' ? styles.userRow : styles.botRow]}>
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.botBubble]}>
                {item.file && (
                  <View style={styles.fileTag}>
                    <Ionicons name="document-text" size={14} color="white" />
                    <Text style={styles.fileText}>{item.file.name}</Text>
                  </View>
                )}
                {item.role === 'bot' ? (
                  <Markdown style={markdownStyles}>{item.content}</Markdown>
                ) : (
                  <Text style={styles.userText}>{item.content}</Text>
                )}
              </View>
            </View>
          )}
        />

        {/* INPUT ALANI */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <BlurView intensity={30} tint="dark" style={styles.inputContainer}>
            
            {selectedFile && (
              <View style={styles.selectedFileBar}>
                <Text style={{color:'white', fontSize:12}}>📎 {selectedFile.name}</Text>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close-circle" size={16} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={pickDocument} disabled={isTyping}>
                <Ionicons name="attach" size={24} color="#ccc" />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder={isTyping ? "BiGPT yazıyor..." : "Mesaj gönder..."}
                placeholderTextColor="#666"
                value={input}
                onChangeText={setInput}
                editable={!isTyping}
                multiline
              />

              <TouchableOpacity 
                style={[styles.sendBtn, isTyping && {opacity: 0.5}]} 
                onPress={sendMessage}
                disabled={isTyping}
              >
                {isTyping ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </LinearGradient>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  subHeader: { color: '#00ff88', fontSize: 12, fontWeight: '600' },
  modelToggleBtn: { padding: 5 },
  
  modelSelectorContainer: {
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
  },
  modelBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
    justifyContent: 'center',
    height: 35,
    marginTop: 5,
  },
  modelBtnActive: {
    backgroundColor: '#007AFF',
  },
  modelBtnText: { color: '#aaa', fontSize: 13 },
  modelBtnTextActive: { color: 'white', fontWeight: 'bold' },

  listContent: { padding: 15, paddingBottom: 20 },
  messageRow: { marginBottom: 15, flexDirection: 'row', width: '100%' },
  userRow: { justifyContent: 'flex-end' },
  botRow: { justifyContent: 'flex-start' },
  bubble: {
    padding: 12,
    borderRadius: 20,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.5)',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 4,
  },
  userText: { color: 'white', fontSize: 16 },
  fileTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: 5, borderRadius: 8, marginBottom: 5 },
  fileText: { color: 'white', fontSize: 12, marginLeft: 5 },
  
  inputContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  selectedFileBar: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 5
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  attachBtn: { padding: 10 },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: 'white',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 10,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const markdownStyles = {
  body: { color: '#e0e0e0', fontSize: 15 },
  heading1: { color: 'white', fontWeight: 'bold', fontSize: 22, marginVertical: 10 },
  heading2: { color: 'white', fontWeight: 'bold', fontSize: 20, marginVertical: 8 },
  strong: { fontWeight: 'bold', color: 'white' },
  code_inline: { backgroundColor: '#333', color: '#ffcc00', borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  fence: { backgroundColor: '#222', color: '#e0e0e0', padding: 10, borderRadius: 8, marginVertical: 5 },
  table: { borderWidth: 1, borderColor: '#444', marginVertical: 10 },
  tr: { borderBottomWidth: 1, borderColor: '#444', flexDirection: 'row' },
  th: { borderRightWidth: 1, borderColor: '#444', padding: 8, fontWeight: 'bold', color: '#fff' },
  td: { borderRightWidth: 1, borderColor: '#444', padding: 8, color: '#ddd' },
  link: { color: '#4facfe' },
};