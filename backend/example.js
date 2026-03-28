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

#### 2. Creating Command JSONs (`backend/commands/give.json`)
Structure them so your `example.js` can read the sequence.
```json
{
  "name": "give",
  "params": ["target", "item", "amount", "data"]
}

#### 3. Creating Themes (`theme/editor/themename.css`)
Style the span classes defined in the CSS block above:
* `.hl-command`: The base command (e.g., `give`).
* `.hl-selector`: Targets (e.g., `@s`, `@a`).
* `.hl-item`: Namespaced IDs (e.g., `minecraft:stick`).
* `.hl-number`: Amounts or data values.
* `.hl-error`: Highlighting for incorrect syntax.
