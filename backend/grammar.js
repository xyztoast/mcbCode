// Cache to store command JSONs
const commandCache = {};

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

                // --- NESTED PATTERN SUPPORT ---
                // If the matched arg has nested overloads or a nested pattern, expand them.
                // We collect all nested patterns from ALL surviving patterns that matched
                // this word, merge them into a new activePatterns list, and reset argCounter.
                // This is 100% backwards compatible - if no nested patterns exist, nothing changes.
                let nestedPatterns = [];
                for (let sp of survivingPatterns) {
                    let exp = sp[argCounter];
                    if (!exp) continue;
                    // Only expand nested patterns if this word actually matched
                    if (getHighlightClass(segment, exp) === "hl-error") continue;
                    if (exp.overloads && Array.isArray(exp.overloads)) {
                        // e.g. { type: "word", options: ["objectives"], overloads: [{pattern:[...]}, ...] }
                        for (let ov of exp.overloads) {
                            if (ov.pattern) nestedPatterns.push(ov.pattern);
                        }
                    } else if (exp.pattern && Array.isArray(exp.pattern)) {
                        // e.g. { type: "word", options: ["add"], pattern: [...] }
                        nestedPatterns.push(exp.pattern);
                    }
                }

                if (nestedPatterns.length > 0) {
                    // Switch into the nested pattern context
                    activePatterns = nestedPatterns;
                    argCounter = -1; // will be incremented to 0 at end of loop
                }
            } else {
                // No patterns matched. The user typed an error.
                bestClass = "hl-error";
            }

            // Check for the new restOfLine state using the winning pattern
            // json type always triggers restOfLine since json blobs span the whole rest of the line
            if (matchedExpected && (matchedExpected.restOfLine === "true" || matchedExpected.type === "json")) {
                restOfLineMode = true;
                restOfLineClass = bestClass;
            }

            processed += `<span class="${bestClass}">${escapeHtml(segment)}</span>`;
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
            return /^(@[a-p|e|s|r|v]|@[a-p|e|s|r|v]\[.*\]|[A-Za-z0-9_]{3,16})$/i.test(word) ? "hl-selector" : "hl-error";
        case "word":
            if (expected.options) {
                if (expected.options.includes("*")) return "hl-item"; 
                if (expected.options.includes(word.toLowerCase())) return "hl-word"; 
            }
            if (expected.restOfLine === "true") return "hl-item";
            return "hl-error";
        case "item_id": 
            return /^([a-z0-9_]+:)?[a-z0-9_]+$/.test(word) ? "hl-item" : "hl-error";
        case "int": {
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
        }
        case "float": {
            // Same as int but explicitly allows decimals, no ~ ^ support
            const isFloat = /^-?\d+(\.\d+)?$/.test(word);
            if (!isFloat) return "hl-error";
            const val = parseFloat(word);
            if (expected.min !== undefined && val < expected.min) return "hl-error";
            if (expected.max !== undefined && val > expected.max) return "hl-error";
            return "hl-number";
        }
        case "json":
            // Marks the rest of the line as a json blob (tellraw, summon events, etc)
            // Accepts anything that starts with { or [ as valid json-like content
            return /^[\[{]/.test(word.trim()) ? "hl-item" : "hl-error";
        default: return "";
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
