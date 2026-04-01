/**
 * Main Entry Point
 */
async function applyHighlighting(text) {
    const lines = text.split('\n');
    let finalHtml = "";
    const errorLines = []; 

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Handle Empty Lines
        if (line.trim() === "") {
            finalHtml += "\n";
            continue;
        }

        // 2. Handle Comments
        if (line.trim().startsWith('#')) {
            finalHtml += `<span class="hl-comment">${escapeHtml(line)}</span>\n`;
            continue;
        }

        // 3. Process Command Logic (Calls grammar.js)
        const segments = line.split(/(\s+)/);
        const processed = processSegmentsSync(segments);

        // Track errors for the gutter dots
        if (processed.includes('hl-error')) {
            errorLines.push(i + 1);
        }

        finalHtml += processed + "\n";
    }

    // Call the dot update in the HTML if it exists
    if (typeof window.updateErrorDots === "function") {
        window.updateErrorDots(errorLines);
    }

    return finalHtml;
}

/* --- THEME SWITCHING LOGIC --- */

function setTheme(themeName) {
    const themeLink = document.getElementById('theme-link');
    if (themeLink) {
        const themeUrl = `theme/editor/${themeName.toLowerCase()}.css`;
        themeLink.href = themeUrl;
        localStorage.setItem('selected-editor-theme', themeName.toLowerCase());
        console.log("Switched theme to:", themeUrl);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // 1. Load saved theme
    const savedTheme = localStorage.getItem('selected-editor-theme') || 'default';
    setTheme(savedTheme);

    // 2. Attach click events
    const themeButtons = document.querySelectorAll('.sub-dropdown div');
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const themeName = btn.textContent.trim().toLowerCase();
            setTheme(themeName);
        });
    });
});
