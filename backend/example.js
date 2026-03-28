// Cache to store command JSONs
const commandCache = {};

/**
 * Main Entry Point - Now runs synchronously if data is cached
 */
async function applyHighlighting(text) {
    const lines = text.split('\n');
    let finalHtml = "";
    const errorLines = []; 

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle empty lines
        if (line.trim() === "") {
            finalHtml += "\n";
            continue;
        }

        // Handle comments
        if (line.trim().startsWith('#')) {
            finalHtml += `<span class="hl-comment">${escapeHtml(line)}</span>\n`;
            continue;
        }

        const segments = line.split(/(\s+)/);
        const processed = processSegmentsSync(segments);
        
        // Error tracking
        if (processed.includes('hl-error')) {
            errorLines.push(i + 1);
        }
        
        finalHtml += processed + "\n";
    }

    // Update the dots if the function exists
    if (window.updateErrorDots) window.updateErrorDots(errorLines);

    return finalHtml;
}

/**
 * The "Brain" - Processes segments instantly if cached
 */
function processSegmentsSync(segments) {
    let processed = "";
    let commandData = null;
    let argCounter = 0;

    for (let i = 0; i < segments.length; i++) {
        let segment = segments[i];
        if (segment.trim() === "") {
            processed += segment;
            continue;
        }

        const segmentLower = segment.toLowerCase();

        if (!commandData) {
            // Instant cache check (No 'await' here!)
            commandData = commandCache[segmentLower];

            if (commandData) {
                processed += `<span class="hl-command">${escapeHtml(segment)}</span>`;
            } else {
                // If not in cache, start a background fetch for next time
                fetchCommandGrammar(segmentLower); 
                processed += `<span class="hl-error">${escapeHtml(segment)}</span>`;
            }
        } else {
            // Execute Recursion
            if (segmentLower === "run" && commandData.command === "execute") {
                processed += `<span class="hl-command">run</span>`;
                processed += processSegmentsSync(segments.slice(i + 1));
                break; 
            }

            let expected = commandData.pattern[argCounter];
            let cssClass = getHighlightClass(segment, expected);
            processed += `<span class="${cssClass}">${escapeHtml(segment)}</span>`;
            argCounter++;
        }
    }
    return processed;
}

/**
 * Background Fetcher - Populates the cache
 */
async function fetchCommandGrammar(cmd) {
    if (commandCache[cmd] || !cmd) return;
    try {
        const response = await fetch(`./backend/commands/${cmd}.json`);
        if (response.ok) {
            const data = await response.json();
            commandCache[cmd] = data;
            // Trigger a re-render now that we have the data
            if (typeof updateHighlighting === "function") updateHighlighting();
        }
    } catch (e) { /* Command doesn't exist */ }
}

/**
 * Highlighting Logic
 */
function getHighlightClass(word, expected) {
    if (!expected) return ""; 

    switch (expected.type) {
        case "target": 
            return /^(@[a-p|e|s|r|v]|@[a-p|e|s|r|v]\[.*\]|[A-Za-z0-9_]{3,16})$/i.test(word) ? "hl-selector" : "hl-error";

        case "word":
            if (expected.options) {
                if (expected.options.includes("*")) return "hl-item"; 
                if (expected.options.includes(word.toLowerCase())) return "hl-command"; 
            }
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
