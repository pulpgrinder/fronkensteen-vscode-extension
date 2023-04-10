# fronkensteen-vscode-extension
Extension for Visual Studio Code that lets you remotely execute Scheme code in a running Fronkensteen system from within VS Code.

Usage:

If you just want to use the extension, just install the .vsix package from the Visual Studio Code extension manager. If you want to modify it, you can do that by following the standard VSC extension development process.

1) Start the Fronkensteen server with `node fronkensteen-server`.

2) Load Fronkensteen app in a browser with ?remote as a parameter (e.g., `http://localhost:8000/index.html?remote`). Specify a passphrase of your choice (this is never sent across the wire).

You will now be able to evaluate Scheme expressions in the app from within the Visual Studio Code editor, even if they are running on different machines (provided there are no firewalls, NATs, etc. in the way, of course).

To evaluate a single Scheme expression (either a pair or an atom), place the cursor just after the expression and choose Evaluate Scheme Expression from the right-click context menu.

The result of the evaluation (or an error message, if there is one) will be inserted as a Scheme comment into the Atom editor. The result will be selected, so it's easy to remove it by just hitting delete (alternatively, Ctrl-Z or Command-Z will also remove it).

Happy Scheming!
