// js/theme.js
export function initTheme() {
    // Currently, our index.html already sets data-theme="dark" on the <html> element.
    // Here you could add logic to detect system preferences or load a stored preference.
    // For now, we just log the active theme.
    const currentTheme = document.documentElement.getAttribute("data-theme");
    console.log("Current theme:", currentTheme);
  }
  