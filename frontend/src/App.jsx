// src/App.jsx
import React from "react";
import ChatBox from "./components/ChatBox";
import "./App.css";

export default function App() {
  return (
    <div className="app-wrapper">
      
      {/* VisionOS minimal header */}
      <h1 className="app-title">BiGPT-Next</h1>

      {/* Centered chat area */}
      <div className="chat-wrapper">
        <ChatBox />
      </div>

    </div>
  );
}
