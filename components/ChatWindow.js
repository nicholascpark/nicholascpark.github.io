// components/ChatWindow.js
import { sendMessage } from "../js/chat.js";

export function ChatWindow() {
  // Create header
  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Moody Emoji Chat";
  header.appendChild(title);

  // Create message area
  const messageArea = document.createElement("div");
  messageArea.id = "messageArea";
  messageArea.className = "message-area";

  // Create emoji panel (initially hidden)
  const emojiPanel = document.createElement("div");
  emojiPanel.id = "emojiPanel";
  emojiPanel.className = "emoji-panel";
  emojiPanel.style.display = "none";

  // Create input area
  const inputArea = document.createElement("div");
  inputArea.className = "input-area";
  const chatInput = document.createElement("input");
  chatInput.id = "chatInput";
  chatInput.placeholder = "Send an emoji...";
  chatInput.autocomplete = "off";
  const sendBtn = document.createElement("button");
  sendBtn.id = "sendBtn";
  sendBtn.textContent = "Send";
  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
  inputArea.appendChild(chatInput);
  inputArea.appendChild(sendBtn);

  // Assemble chat container
  const chatContainer = document.createElement("div");
  chatContainer.className = "chat-container";
  chatContainer.appendChild(header);
  chatContainer.appendChild(messageArea);
  chatContainer.appendChild(emojiPanel);
  chatContainer.appendChild(inputArea);

  return chatContainer;
}
