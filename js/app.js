// js/app.js
import { ChatWindow } from "../components/ChatWindow.js";
import { initTheme } from "./theme.js";

initTheme();

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("chat-root");
  root.appendChild(ChatWindow());
});
