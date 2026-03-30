if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/app/sw.js').then(() => {
    console.log('sw registered');
  }).catch(console.error);
}

document.addEventListener('DOMContentLoaded', () => {
  const codeArea = document.getElementById('codeArea');

  // only run file-handler code if in PWA mode
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (!isPWA) return;

  // create hidden file input for fallback
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.mcfunction';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => codeArea.value = reader.result;
    reader.readAsText(file);
  });

  // handle file opened via PWA file handler
  if (window.launchQueue) {
    launchQueue.setConsumer(fileHandles => {
      if (!fileHandles.length) return;
      const file = fileHandles[0];
      file.getFile().then(f => {
        const reader = new FileReader();
        reader.onload = () => codeArea.value = reader.result;
        reader.readAsText(f);
      });
    });
  }

  // drag & drop support
  document.body.addEventListener('drop', e => {
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    const file = e.dataTransfer.files[0];
    if (!file.name.endsWith('.mcfunction')) return;
    const reader = new FileReader();
    reader.onload = () => codeArea.value = reader.result;
    reader.readAsText(file);
  });

  document.body.addEventListener('dragover', e => e.preventDefault());
});
