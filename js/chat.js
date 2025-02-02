// js/chat.js
import { getEmojiCandidates } from "./emoji.js";

export function appendMessage(text, type = "incoming") {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) {
    console.error("Message area not found.");
    return;
  }
  const msgDiv = document.createElement("div");
  msgDiv.className = "message " + type;
  msgDiv.textContent = text;
  messageArea.appendChild(msgDiv);
  messageArea.scrollTop = messageArea.scrollHeight;
  console.log("Appended message:", text);
}

export function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  if (!chatInput) {
    console.error("Chat input not found.");
    return;
  }
  const text = chatInput.value.trim();
  if (!text) return;
  appendMessage("You: " + text, "outgoing");
  chatInput.value = "";
  const candidates = getEmojiCandidates(text);
  displayEmojiPanel(candidates);
}

export function displayEmojiPanel(candidates) {
  const emojiPanel = document.getElementById("emojiPanel");
  if (!emojiPanel) {
    console.error("Emoji panel not found.");
    return;
  }
  emojiPanel.innerHTML = "";
  if (candidates.length !== 3) {
    emojiPanel.style.display = "none";
    return;
  }
  candidates.forEach(emoji => {
    const btn = document.createElement("button");
    btn.className = "emoji-button";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      appendMessage("Bot: " + emoji, "incoming");
      emojiPanel.style.display = "none";
    });
    emojiPanel.appendChild(btn);
  });
  emojiPanel.style.display = "flex";
  console.log("Displayed emoji panel with candidates:", candidates);
}
