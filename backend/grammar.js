// Cache to store command JSONs
const commandCache = {};

// Cache for selector args (loaded from backend/commands/other/selector_args.json)
let selectorArgKeys = null;

/**
 * Load selector arg keys from backend/commands/other/selector_args.json
 */
(async function loadSelectorArgs() {
    try {
        const response = await fetch("./backend/commands/other/selector_args.json");
        if (response.ok) {
            const data = await response.json();
            selectorArgKeys = data.keys || [];
        }
    } catch (e) { /* silent fail */ }
})();

/**
 * Renders a target selector segment as split html.
 * @x or @x[key=val,...] — the @x[ part is hl-selector, key=val pairs are hl-word,
 * commas and ] are hl-selector. plain @x with no brackets is just hl-selector.
 * Player names are hl-selector too.
 * Returns { html, valid } — valid is false if the segment doesnt match target format at all.
 */
function renderTarget(word) {
    // Plain player name — no brackets
    if (/^[A-Za-z0-9_]{3,16}$/.test(word)) {
        return { html: `<span class="hl-selector">${escapeHtml(word)}</span>`, valid: true };
    }

    // @x with no brackets
    const plainMatch = word.match(/^(@[aeprsv])$/i);
    if (plainMatch) {
        return { html: `<span class="hl-selector">${escapeHtml(word)}</span>`, valid: true };
    }

    // @x[...] with brackets
    const bracketMatch = word.match(/^(@[aeprsv])\[(.*)\]$/i);
    if (!bracketMatch) {
        return { html: `<span class="hl-error">${escapeHtml(word)}</span>`, valid: false };
    }

    const prefix = bracketMatch[1];   // e.g. @e
    const inner = bracketMatch[2];    // e.g. type=zombie,tag=mytag

    // Validate keys if selectorArgKeys is loaded
    let innerValid = true;
    if (selectorArgKeys) {
        const pairs = inner.split(",");
        for (let pair of pairs) {
            pair = pair.trim();
            if (!pair) continue;
            const eqIdx = pair.indexOf("=");
            if (eqIdx === -1) { innerValid = false; break; }
            const key = pair.slice(0, eqIdx).trim().toLowerCase();
            if (!selectorArgKeys.includes(key)) { innerValid = false; break; }
        }
    }

    if (!innerValid) {
        // Invalid bracket contents — whole thing is an error
        return { html: `<span class="hl-error">${escapeHtml(word)}</span>`, valid: false };
    }

    // Build split html: @x[ = hl-selector, each key=value = hl-word, commas+] = hl-selector
    let html = `<span class="hl-selector">${escapeHtml(prefix)}[</span>`;

    const pairs = inner.split(",");
    for (let j = 0; j < pairs.length; j++) {
        const pair = pairs[j];
        html += `<span class="hl-word">${escapeHtml(pair)}</span>`;
        if (j < pairs.length - 1) {
            html += `<span class="hl-selector">,</span>`;
        }
    }

    html += `<span class="hl-selector">]</span>`;

    return { html, valid: true };
}

/**
 * The "Brain" - Processes segments with the "Elimination Race" logic
 */
function processSegmentsSync(segments) {
    let processed = "";
    let commandData = null;
    let activePatterns = []; // This holds all the valid paths we are currently racing
    let argCounter = 0;
    let restOfLineMode = false;
    let restOfLineClass = "";

    for (let i = 0; i < segments.length; i++) {
        let segment = segments[i];

        // Preserve whitespace
        if (segment.trim() === "") {
            processed += segment;
            continue;
        }

        const segmentLower = segment.toLowerCase();

        if (!commandData) {
            // Check cache for the base command (e.g., "give", "tickingarea")
            commandData = commandCache[segmentLower];

            if (commandData) {
                processed += `<span class="hl-command">${escapeHtml(segment)}</span>`;
                
                // Initialize the Race!
                if (commandData.overloads) {
                    // If it has multiple paths, load them all
                    activePatterns = commandData.overloads.map(o => o.pattern);
                } else if (commandData.pattern) {
                    // If it's a simple file like fill.json, just load the one path
                    activePatterns = [commandData.pattern];
                } else {
                    activePatterns = [];
                }

            } else {
                // Not in cache? Fetch for next time and mark as error for now
                fetchCommandGrammar(segmentLower); 
                processed += `<span class="hl-error">${escapeHtml(segment)}</span>`;
            }
        } else {
            // Handle Execute Recursion
            if (segmentLower === "run" && commandData.command === "execute") {
                processed += `<span class="hl-command">run</span>`;
                // Process the rest of the line as a new command
                processed += processSegmentsSync(segments.slice(i + 1));
                break; 
            }

            // If we hit a restOfLine trigger previously, keep using that class
            if (restOfLineMode) {
                processed += `<span class="${restOfLineClass}">${escapeHtml(segment)}</span>`;
                continue;
            }

            // --- THE ELIMINATION RACE ---
            let bestClass = "hl-error";
            let matchedExpected = null;

            // Filter down the patterns to only the ones that match the current word
            let survivingPatterns = activePatterns.filter(pattern => {
                let expected = pattern[argCounter];
                
                // If this pattern ran out of arguments but the user is still typing, eliminate it
                if (!expected) return false; 
                
                let cssClass = getHighlightClass(segment, expected);
                // If the class isn't an error, this pattern survives!
                return cssClass !== "hl-error";
            });

            if (survivingPatterns.length > 0) {
                // We have a match! Update our active list to only the survivors
                activePatterns = survivingPatterns;
                
                // Grab the expected object from the first survivor to determine the CSS/RestOfLine
                matchedExpected = activePatterns[0][argCounter];
                bestClass = getHighlightClass(segment, matchedExpected);
            } else {
                // No patterns matched. The user typed an error.
                bestClass = "hl-error";
            }

            // Check for the new restOfLine state using the winning pattern
            if (matchedExpected && matchedExpected.restOfLine === "true") {
                restOfLineMode = true;
                restOfLineClass = bestClass;
            }

            // --- TARGET SPLIT RENDER ---
            // If the matched arg is a target type, use renderTarget instead of a plain span
            // so @x[ part = hl-selector and key=value pairs inside = hl-word
            if (matchedExpected && matchedExpected.type === "target") {
                const rendered = renderTarget(segment);
                processed += rendered.html;
            } else {
                processed += `<span class="${bestClass}">${escapeHtml(segment)}</span>`;
            }

            argCounter++;

            // --- THE 3 LINES FOR CHAINING ---
            if (activePatterns.length > 0 && argCounter >= activePatterns[0].length && !restOfLineMode) {
                argCounter = 0; 
            }
        }
    }
    return processed;
}

/**
 * Background Fetcher
 */
async function fetchCommandGrammar(cmd) {
    if (commandCache[cmd] || !cmd) return;
    try {
        const response = await fetch(`./backend/commands/${cmd}.json`);
        if (response.ok) {
            const data = await response.json();
            commandCache[cmd] = data;
            // Re-run highlighting now that we have the data
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
            // Validation only — rendering is handled by renderTarget in processSegmentsSync
            return /^(@[aeprsv](\[.*\])?|[A-Za-z0-9_]{3,16})$/i.test(word) ? "hl-selector" : "hl-error";
        case "word":
            if (expected.options) {
                if (expected.options.includes("*")) return "hl-item"; 
                if (expected.options.includes(word.toLowerCase())) return "hl-word"; 
            }
            if (expected.restOfLine === "true") return "hl-item";
            return "hl-error";
        case "item_id": 
            return /^([a-z0-9_]+:)?[a-z0-9_]+$/.test(word) ? "hl-item" : "hl-error";
        case "int": 
            // 1. Check if it's a valid coordinate (~, ^) or decimal number
            const isNumeric = /^([~^]-?\d*\.?\d*|-?\d+\.?\d*)$/.test(word);
            if (!isNumeric) return "hl-error";

            // 2. If it's a raw number (not relative), check min/max constraints
            if (/^-?\d+\.?\d*$/.test(word)) {
                const val = parseFloat(word);
                if (expected.min !== undefined && val < expected.min) return "hl-error";
                if (expected.max !== undefined && val > expected.max) return "hl-error";
            }
            return "hl-number";
        default: return "";
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
