// Example of how you would write your logic
async function applyHighlighting(text) {
    const lines = text.split('\n');
    let output = "";

    for (let line of lines) {
        let words = line.split(' ');
        let command = words[0];

        // Fetch command.json logic
        try {
            const res = await fetch(`backend/commands/${command}.json`);
            if (res.ok) {
                const grammar = await res.json();
                // Match words to grammar structure...
                output += `<span class="hl-command">${command}</span> ...\n`;
            } else {
                output += line + "\n";
            }
        } catch(e) { output += line + "\n"; }
    }
    return output;
}

/**
 * Main entry point called by editor.html
 */
async function applyHighlighting(text) {
    const lines = text.split('\n');
    let finalHtml = "";

    for (let line of lines) {
        if (line.trim().startsWith('#')) {
            finalHtml += `<span class="hl-comment">${escapeHtml(line)}</span>\n`;
            continue;
        }

        const words = line.split(/(\s+)/); // Keep spaces for perfect alignment
        let processedLine = "";
        let commandData = null;
        let argumentIndex = 0;

        for (let segment of words) {
            // If it's just whitespace, keep it as is
            if (segment.trim() === "") {
                processedLine += segment;
                continue;
            }

            // The first non-space word is the command
            if (!commandData) {
                commandData = await fetchCommandGrammar(segment);
                if (commandData) {
                    processedLine += `<span class="hl-command">${segment}</span>`;
                } else {
                    processedLine += `<span class="hl-error">${segment}</span>`;
                }
            } else {
                // It's an argument. Check it against the JSON pattern
                let expected = commandData.pattern[argumentIndex];
                let cssClass = getHighlightClass(segment, expected);
                
                processedLine += `<span class="${cssClass}">${segment}</span>`;
                argumentIndex++;
            }
        }
        finalHtml += processedLine + "\n";
    }
    return finalHtml;
}

/**
 * Fetches your JSON file from the backend folder
 */
async function fetchCommandGrammar(cmd) {
    try {
        const response = await fetch(`backend/commands/${cmd}.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        return null;
    }
}

/**
 * Decides which CSS class to use based on the grammar type
 */
function getHighlightClass(word, expected) {
    if (!expected) return ""; // No more arguments expected (extra words)

    switch (expected.type) {
        case "target":
            // Regex for @s, @a, @p, @r, @e or player names
            return /^(@[a-p|e|s|r]|[A-Za-z0-9_]{3,16})$/.test(word) ? "hl-selector" : "hl-error";
        case "item_id":
            return word.includes(':') || /^[a-z_]+$/.test(word) ? "hl-item" : "hl-error";
        case "int":
            return /^\d+$/.test(word) ? "hl-number" : "hl-error";
        default:
            return "";
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
