// Cache to store command JSONs so we don't fetch them every single keystroke
const commandCache = {};

/**
 * Main entry point called by editor.html
 */
async function applyHighlighting(text) {
    const lines = text.split('\n');
    let finalHtml = "";

    for (let line of lines) {
        // Handle Comments
        if (line.trim().startsWith('#')) {
            finalHtml += `<span class="hl-comment">${escapeHtml(line)}</span>\n`;
            continue;
        }

        const segments = line.split(/(\s+)/); // Keep spaces for perfect alignment
        let processedLine = "";
        let commandData = null;
        let argCounter = 0;

        for (let segment of segments) {
            if (segment.trim() === "") {
                processedLine += segment;
                continue;
            }

            // The first word is the command
            if (!commandData) {
                const cmdClean = segment.toLowerCase();
                commandData = await fetchCommandGrammar(cmdClean);
                
                if (commandData) {
                    processedLine += `<span class="hl-command">${escapeHtml(segment)}</span>`;
                } else {
                    processedLine += `<span class="hl-error">${escapeHtml(segment)}</span>`;
                }
            } else {
                // Check argument against JSON pattern
                let expected = commandData.pattern[argCounter];
                let cssClass = getHighlightClass(segment, expected);
                
                processedLine += `<span class="${cssClass}">${escapeHtml(segment)}</span>`;
                argCounter++;
            }
        }
        finalHtml += processedLine + "\n";
    }
    return finalHtml;
}

/**
 * Fetches with Caching
 */
async function fetchCommandGrammar(cmd) {
    if (commandCache[cmd]) return commandCache[cmd];

    try {
        // Use ./ to ensure relative pathing on GitHub Pages
        const response = await fetch(`./backend/commands/${cmd}.json`);
        if (!response.ok) return null;
        const data = await response.json();
        commandCache[cmd] = data; 
        return data;
    } catch (e) {
        return null;
    }
}

/**
 * Validates Bedrock Targets (@s, player names, selectors with brackets)
 */
function isValidTarget(word) {
    // 1. Basic selectors: @p, @a, @r, @e, @s, @v, @initiator
    const basicSelector = /^@(p|a|r|e|s|v|initiator)$/i;
    
    // 2. Complex selectors: @a[tag=test, c=1]
    const complexSelector = /^@(p|a|r|e|s|v|initiator)\[.*\]$/i;
    
    // 3. Player names: 3-16 chars, alphanumeric and underscores
    const playerName = /^[A-Za-z0-9_]{3,16}$/;

    return basicSelector.test(word) || complexSelector.test(word) || playerName.test(word);
}

/**
 * Decides which CSS class to use
 */
function getHighlightClass(word, expected) {
    if (!expected) return ""; 

    switch (expected.type) {
        case "target": 
            return isValidTarget(word) ? "hl-selector" : "hl-error";
        
        case "item_id": 
            // Matches namespaced IDs like minecraft:stick or just stick
            const itemRegex = /^([a-z0-9_]+:)?[a-z0-9_]+$/;
            return itemRegex.test(word) ? "hl-item" : "hl-error";
        
        case "int": 
            // Matches positive/negative integers
            return /^-?\d+$/.test(word) ? "hl-number" : "hl-error";

        case "json_component":
            // Basic check for opening brace of a component string
            return word.startsWith('{') ? "hl-item" : "hl-error";

        default: 
            return "";
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
