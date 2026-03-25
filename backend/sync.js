const codeArea = document.getElementById('codeArea');
const highlighted = document.getElementById('highlighted');
const highlightLayer = document.getElementById('highlight-layer');
const lineNumbers = document.getElementById('lineNumbers');

function updateEditor() {
    const text = codeArea.value;

    // 1. Copy the text to the hidden highlight layer
    highlighted.textContent = text;

    // 2. Clear the highlight.js "already done" flag so it re-runs every time
    delete highlighted.dataset.highlighted;

    // 3. Trigger the highlighting
    hljs.highlightElement(highlighted);

    // 4. Update Line Numbers
    const lines = text.split('\n').length;
    lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
}

// Sync scrolling so the highlight layer and line numbers move with the textarea
codeArea.addEventListener('scroll', () => {
    highlightLayer.scrollTop = codeArea.scrollTop;
    highlightLayer.scrollLeft = codeArea.scrollLeft;
    lineNumbers.scrollTop = codeArea.scrollTop;
});

// Update on every keystroke
codeArea.addEventListener('input', updateEditor);

// Initial run to highlight default text
updateEditor();
