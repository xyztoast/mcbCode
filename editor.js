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
