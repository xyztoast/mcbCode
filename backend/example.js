// Cache to store command JSONs
const commandCache = {};
// Cache for § color codes
const colorCodes = {};

/**
 * Main Entry Point
 */
async function applyHighlighting(text) {
    // Initial fetch for color codes if not loaded
    if (Object.keys(colorCodes).length === 0) {
        fetchColorCodes();
    }

    const lines = text.split('\n');
    let finalHtml = "";
    const errorLines = []; 

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim() === "") {
            finalHtml += "\n";
            continue;
        }

        if (line.trim().startsWith('#')) {
            finalHtml += `<span class="hl-comment">${escapeHtml(line)}</span>\n`;
            continue;
        }

        const segments = line.split(/(\s+)/);
        const processed = processSegmentsSync(segments);
        
        if (processed.includes('hl-error')) {
            errorLines.push(i + 1);
        }
        
        finalHtml += processed + "\n";
    }

    if (typeof window.updateErrorDots === "function") {
        window.updateErrorDots(errorLines);
    }

    return finalHtml;
}

/**
 * The "Brain" - Processes segments
 */
function processSegmentsSync(segments) {
    let processed = "";
    let commandData = null;
    let argCounter = 0;
    let restOfLineMode = false;
    let restOfLineClass = "";
    
    // NEW: Color State
    let activeColor = null;

    for (let i = 0; i < segments.length; i++) {
        let segment = segments[i];
        
        if (segment.trim() === "") {
            processed += segment;
            continue;
        }

        // § COLOR LOGIC: Check if segment contains or starts a color code
        if (segment.includes('§')) {
            const parts = segment.split(/(§[0-9a-f-r])/i);
            let colorSegmentHtml = "";
            
            for (let part of parts) {
                if (/§[0-9a-f]/i.test(part)) {
                    const code = part.charAt(1).toLowerCase();
                    activeColor = colorCodes[code] || null;
                    colorSegmentHtml += `<span class="hl-code">${part}</span>`;
                } else if (/§r/i.test(part)) {
                    activeColor = null;
                    colorSegmentHtml += `<span class="hl-code">${part}</span>`;
                } else {
                    const style = activeColor ? `style="color: ${activeColor}"` : "";
                    colorSegmentHtml += `<span ${style}>${escapeHtml(part)}</span>`;
                    
                    // Stop coloring if we hit a closing quote
                    if (part.includes('"') || part.includes("'")) activeColor = null;
                }
            }
            processed += colorSegmentHtml;
            continue; 
        }

        const segmentLower = segment.toLowerCase();

        if (!commandData) {
            commandData = commandCache[segmentLower];
            if (commandData) {
                processed += `<span class="hl-command">${escapeHtml(segment)}</span>`;
            } else {
                fetchCommandGrammar(segmentLower); 
                processed += `<span class="hl-error">${escapeHtml(segment)}</span>`;
            }
        } else {
            if (segmentLower === "run" && commandData.command === "execute") {
                processed += `<span class="hl-command">run</span>`;
                processed += processSegmentsSync(segments.slice(i + 1));
                break; 
            }

            if (restOfLineMode) {
                const style = activeColor ? `style="color: ${activeColor}"` : "";
                processed += `<span class="${restOfLineClass}" ${style}>${escapeHtml(segment)}</span>`;
                continue;
            }

            let expected = commandData.pattern[argCounter];
            let cssClass = getHighlightClass(segment, expected);
            
            if (expected && expected.restOfLine === "true") {
                restOfLineMode = true;
                restOfLineClass = cssClass;
            }

            const style = activeColor ? `style="color: ${activeColor}"` : "";
            processed += `<span class="${cssClass}" ${style}>${escapeHtml(segment)}</span>`;
            argCounter++;
        }
    }
    return processed;
}

/**
 * Fetchers
 */
async function fetchColorCodes() {
    try {
        const response = await fetch(`./colorcodes.json`);
        if (response.ok) {
            const data = await response.json();
            Object.assign(colorCodes, data);
        }
    } catch (e) { /* silent fail */ }
}

async function fetchCommandGrammar(cmd) {
    if (commandCache[cmd] || !cmd) return;
    try {
        const response = await fetch(`./backend/commands/${cmd}.json`);
        if (response.ok) {
            const data = await response.json();
            commandCache[cmd] = data;
            if (typeof updateHighlighting === "function") updateHighlighting();
        }
    } catch (e) { /* silent fail */ }
}

/**
 * Helper: Mapping JSON types to CSS classes
 */
function getHighlightClass(word, expected) {
    if (!expected) return ""; 

    switch (expected.type) {
        case "target": 
            return /^(@[a-p|e|s|r|v]|@[a-p|e|s|r|v]\[.*\]|[A-Za-z0-9_]{3,16})$/i.test(word) ? "hl-selector" : "hl-error";
        case "word":
            if (expected.options) {
                if (expected.options.includes(word.toLowerCase())) return "hl-command"; 
            }
            if (expected.restOfLine === "true") return "hl-item";
            return "hl-error";
        case "item_id": 
            return /^([a-z0-9_]+:)?[a-z0-9_]+$/.test(word) ? "hl-item" : "hl-error";
        case "int": 
            return /^([~^]-?\d*|-?\d+)$/.test(word) ? "hl-number" : "hl-error";
        default: return "";
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* --- THEME SWITCHING LOGIC --- */

function setTheme(themeName) {
    const themeLink = document.getElementById('theme-link');
    if (themeLink) {
        const themeUrl = `theme/editor/${themeName.toLowerCase()}.css`;
        themeLink.href = themeUrl;
        localStorage.setItem('selected-editor-theme', themeName.toLowerCase());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('selected-editor-theme') || 'default';
    setTheme(savedTheme);

    const themeButtons = document.querySelectorAll('.sub-dropdown div');
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const themeName = btn.textContent.trim().toLowerCase();
            setTheme(themeName);
        });
    });
});
