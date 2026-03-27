require.config({
  paths: {
    vs: "https://unpkg.com/monaco-editor@0.45.0/min/vs"
  }
});

require(["vs/editor/editor.main"], function () {

  // register mcfunction language
  monaco.languages.register({
    id: "mcfunction"
  });

  // basic highlighting
  monaco.languages.setMonarchTokensProvider(
    "mcfunction",
    {
      tokenizer: {
        root: [

          [
            /\b(give|setblock|execute|say|tp)\b/,
            "keyword"
          ],

          [
            /@[pares]/,
            "variable"
          ],

          [
            /#.*$/,
            "comment"
          ]

        ]
      }
    }
  );

  // create editor
  window.editor = monaco.editor.create(
    document.getElementById("editor"),
    {
      value: "give @p diamond_sword",
      language: "mcfunction",
      theme: "vs-dark",
      fontSize: 14,
      automaticLayout: true
    }
  );

});

async function loadCommandList() {

  const res =
    await fetch("commands/commands.json");

  return await res.json();

}

async function loadCommands() {

  const names =
    await loadCommandList();

  const commands = [];

  for (const name of names) {

    const res =
      await fetch(
        `commands/${name}.json`
      );

    const json =
      await res.json();

    commands.push(json);

  }

  return commands;

}
