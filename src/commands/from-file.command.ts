import { window } from "vscode";
import { dartFormat, generateClass, getConfiguration, runBuildRunner } from "../index";
import { handleError } from "../lib";
import { Models } from "../models_file";
import { ISettings, PathType, Settings } from "../settings";

export const transformFromFile = async () => {
    const jsonc = require('jsonc').safe;

    const models = new Models();

    if (models.exist) {
        const data = models.data;
        const [err, result] = jsonc.parse(data);
        if (err) {
            handleError(new Error(`Failed to parse JSON: ${err.message}.\nProbably bad JSON syntax.`));
        } else {
            // All json objects from the models.jsonc.
            const objects: any[] = result;
            // User configuration.
            const input = getConfiguration();

            if (!objects.length) {
                window.showInformationMessage('models.jsonc file is empty');
                return;
            }

            if (Object.keys(objects[0]).every((key) => Object.keys(input).includes(key))) {
                window.showInformationMessage('Configuration from the file models.jsonc was moved to the Settings/Extensions/JSON To Dart Model. - Configure a new option in the settings and remove the configuration item from the file models.jsonc to avoid this warning.');
                return;
            }

            const targetDirectory = models.directory + input.targetDirectory;
            const duplicates = await models.duplicatesClass(objects);

            if (duplicates.length) {
                for (const name of duplicates) {
                    if (name === undefined) {
                        window.showWarningMessage('Some JSON objects do not have a class name');
                        return;
                    }
                    window.showWarningMessage(`Rename any of the duplicate class ${name} to continue`);
                    return;
                }
            }

            const fastMode = input.fastMode ?? false;
            const confirm = !fastMode ? await models.getConfirmation() : fastMode;

            if (confirm && objects.length) {
                // Start converting.
                for await (const object of objects) {
                    // Class name key.
                    const key = '__className';
                    // Separate class names from objects.
                    const { [key]: className, ...jsonObject } = object;
                    // Conver back to json.
                    const json = JSON.stringify(jsonObject);
                    // Check if the class name is not missing.
                    if (className === undefined) {
                        window.showWarningMessage('Some JSON objects do not have a class name');
                        return;
                    }
                    // Settings config.
                    let config: ISettings = {
                        className: className,
                        targetDirectory: <string>targetDirectory,
                        object: json,
                        input: input,
                        pathType: PathType.Default,
                    };
                    // Create new settings.
                    const settings = new Settings(config);

                    await generateClass(settings).catch(handleError);
                }
                window.showInformationMessage('Models successfully added');
                // Format directories
                for await (const object of objects) {
                    // Class name key.
                    const key = '__className';
                    // Separate class names from objects.
                    const { [key]: className } = object;
                    dartFormat(targetDirectory, className);
                }
                if (input.generate && input.runBuilder) {
                    runBuildRunner();
                }
            }
        }
    } else {
        models.create();
    }
};