import {
  Uri,
  ExtensionContext,
  commands,
  window,
  OpenDialogOptions,
  workspace,
  InputBoxOptions,
} from "vscode";
import {
  handleError,
  getClipboardText,
  getSelectedText,
  validateLength,
  createClass,
  appendPubspecDependencies,
} from "./lib";

import * as fs from "fs";
import * as _ from "lodash";
import * as mkdirp from "mkdirp";

import cp = require("child_process");
import { getUserInput, Input } from "./input";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand("jsonToDart.fromSelection", transformFromSelection)
  );
  context.subscriptions.push(
    commands.registerCommand("jsonToDart.fromClipboard", transformFromClipboard)
  );
  context.subscriptions.push(
    commands.registerCommand(
      "jsonToDart.addCodeGenerationLibraries",
      addCodeGenerationLibraries
    )
  );
  context.subscriptions.push(
    commands.registerCommand(
      "jsonToDart.fromClipboardToCodeGen",
      transformFromClipboardToCodeGen
    )
  );
  context.subscriptions.push(
    commands.registerCommand(
      "jsonToDart.fromSelectionToCodeGen",
      transformFromSelectionToCodeGen
    )
  );
}

async function transformFromSelection(uri: Uri) {
  const className = await promptForBaseClassName();
  if (_.isNil(className) || className.trim() === "") {
    window.showErrorMessage("The class name must not be empty");
    return;
  }

  const input = await getUserInput();

  let targetDirectory: String | undefined;
  if (
    _.isNil(_.get(uri, "fsPath")) ||
    !fs.lstatSync(uri.fsPath).isDirectory()
  ) {
    targetDirectory = await promptForTargetDirectory();
    if (_.isNil(targetDirectory)) {
      window.showErrorMessage("Please select a valid directory");
      return;
    }
  } else {
    targetDirectory = uri.fsPath;
  }

  getSelectedText()
    .then(validateLength)
    .then((json) =>
      generateClass(className, <string>targetDirectory, json, false, input)
    )
    .catch(handleError);
}

async function transformFromSelectionToCodeGen(uri: Uri) {
  const className = await promptForBaseClassName();
  if (_.isNil(className) || className.trim() === "") {
    window.showErrorMessage("The class name must not be empty");
    return;
  }

  const input = await getUserInput(true);

  let targetDirectory: String | undefined;
  if (
    _.isNil(_.get(uri, "fsPath")) ||
    !fs.lstatSync(uri.fsPath).isDirectory()
  ) {
    targetDirectory = await promptForTargetDirectory();
    if (_.isNil(targetDirectory)) {
      window.showErrorMessage("Please select a valid directory");
      return;
    }
  } else {
    targetDirectory = uri.fsPath;
  }

  getSelectedText()
    .then(validateLength)
    .then((json) =>
      generateClass(className, <string>targetDirectory, json, true, input)
    )
    .then((_) => {
      let terminal = window.createTerminal("pub get");
      terminal.show();
      terminal.sendText(
        "flutter pub run build_runner build --delete-conflicting-outputs"
      );
    })
    .catch(handleError);
}

async function transformFromClipboard(uri: Uri) {
  const className = await promptForBaseClassName();
  if (_.isNil(className) || className.trim() === "") {
    window.showErrorMessage("The class name must not be empty");
    return;
  }

  const input = await getUserInput();

  let targetDirectory: String | undefined;
  if (
    _.isNil(_.get(uri, "fsPath")) ||
    !fs.lstatSync(uri.fsPath).isDirectory()
  ) {
    targetDirectory = await promptForTargetDirectory();
    if (_.isNil(targetDirectory)) {
      window.showErrorMessage("Please select a valid directory");
      return;
    }
  } else {
    targetDirectory = uri.fsPath;
  }

  getClipboardText()
    .then(validateLength)
    .then((json) =>
      generateClass(className, <string>targetDirectory, json, false, input)
    )
    .catch(handleError);
}

async function transformFromClipboardToCodeGen(uri: Uri) {
  const className = await promptForBaseClassName();
  if (_.isNil(className) || className.trim() === "") {
    window.showErrorMessage("The class name must not be empty");
    return;
  }

  const input = await getUserInput(true);

  let targetDirectory: String | undefined;
  if (
    _.isNil(_.get(uri, "fsPath")) ||
    !fs.lstatSync(uri.fsPath).isDirectory()
  ) {
    targetDirectory = await promptForTargetDirectory();
    if (_.isNil(targetDirectory)) {
      window.showErrorMessage("Please select a valid directory");
      return;
    }
  } else {
    targetDirectory = uri.fsPath;
  }

  getClipboardText()
    .then(validateLength)
    .then((json) =>
      generateClass(className, <string>targetDirectory, json, true, input)
    )
    .then((_) => {
      let terminal = window.createTerminal("pub get");
      terminal.show();
      terminal.sendText(
        "flutter pub run build_runner build --delete-conflicting-outputs"
      );
    })
    .catch(handleError);
}

function promptForBaseClassName(): Thenable<string | undefined> {
  const classNamePromptOptions: InputBoxOptions = {
    prompt: "Base Class Name",
    placeHolder: "User",
  };
  return window.showInputBox(classNamePromptOptions);
}

async function promptForTargetDirectory(): Promise<string | undefined> {
  const options: OpenDialogOptions = {
    canSelectMany: false,
    openLabel: "Select a folder to create the Models",
    canSelectFolders: true,
    defaultUri: Uri.parse(workspace.rootPath?.replace(/\\/g, "/") + "/lib/"),
  };

  return window.showOpenDialog(options).then((uri) => {
    if (_.isNil(uri) || _.isEmpty(uri)) {
      return workspace.rootPath?.replace(/\\/g, "/") + "/lib/";
    }
    return uri[0].fsPath;
  });
}

async function generateClass(
  className: string,
  targetDirectory: string,
  object: string,
  codeGen: boolean,
  input: Input,
) {
  const classDirectoryPath = `${targetDirectory}/models`;
  if (!fs.existsSync(classDirectoryPath)) {
    await createDirectory(classDirectoryPath);
  }
  await createClass(className, targetDirectory, object, codeGen, input);
}

function createDirectory(targetDirectory: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirp(targetDirectory)
      .then((value) => resolve())
      .catch((error) => reject(error));
  });
}

async function addCodeGenerationLibraries() {
  let folderPath = workspace.rootPath;
  const targetPath = `${folderPath}/pubspec.yaml`;

  if (fs.existsSync(targetPath)) {
    appendPubspecDependencies(targetPath)
      .then((_) => window.showInformationMessage("Dependencies added!"))
      .catch(handleError);
  } else {
    window.showErrorMessage("pubspec.yaml does't exist :/");
  }
}
