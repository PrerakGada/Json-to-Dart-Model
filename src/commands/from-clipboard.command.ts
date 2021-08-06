import * as _ from "lodash";
import * as fs from "fs";

import { Uri, window } from "vscode";
import { runDartFormat, generateClass, runBuildRunner, } from "../index";
import { getUserInput, Input } from "../input";
import { getClipboardText, handleError, validateLength } from "../lib";
import { TargetDirectoryType, Settings, ClassNameModel } from "../settings";
import { promptForBaseClassName, promptForTargetDirectory } from "../shared/user-prompts";

export const transformFromClipboard = async (uri: Uri) => {
    const className = await promptForBaseClassName();
    let input = new Input();
    let targetDirectoryType: TargetDirectoryType = TargetDirectoryType.Standard;

    if (_.isNil(className) || className.trim() === "") {
        window.showErrorMessage("The class name must not be empty");
        return;
    }

    if (!input.primaryConfiguration) {
        input = await getUserInput();
    }

    let targetDirectory: string | undefined;

    if (_.isNil(_.get(uri, "fsPath")) || !fs.lstatSync(uri.fsPath).isDirectory()) {
        targetDirectory = await promptForTargetDirectory();
        if (_.isNil(targetDirectory)) {
            window.showErrorMessage("Please select a valid directory");
            return;
        }
    } else {
        targetDirectoryType = TargetDirectoryType.Raw;
        targetDirectory = uri.fsPath;
    }

    const json: string = await getClipboardText().then(validateLength).catch(handleError);

    const config: Settings = {
        model: new ClassNameModel(className),
        targetDirectory: <string>targetDirectory,
        object: json,
        input: input,
        targetDirectoryType: targetDirectoryType,
    };
    // Create new settings.
    const settings = new Settings(config);

    await generateClass(settings).then((_) => {
        runDartFormat(
            <string>targetDirectory,
            settings.targetDirectoryType === TargetDirectoryType.Raw ? "" : "models"
        );
        if (input.generate && input.runBuilder) {
            runBuildRunner();
        }
    }).catch(handleError);
};