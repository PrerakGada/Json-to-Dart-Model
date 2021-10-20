import { ClassNameModel, Settings } from '../settings';
import { generateClass, runBuildRunner, runDartFormat } from '../index';
import { Input } from '../input';
import { handleError } from '../lib';
import { jsonReader } from '../json-reader';
import { window } from 'vscode';

/** Used to warn users about changes. */
const deprecatedSettingsProperties: string[] = [
    'freezed',
    'equatable',
    'immutable',
    'toString',
    'copyWith',
    'equality',
    'serializable',
    'nullSafety',
    'targetDirectory',
    'primaryConfiguration',
    'fastMode',
];

/**
 * Checks if `models.jsonc` file have configuration object which has been moved to the VS Code settings.
 * @param {Object} object that contains the deprecated properties.
 * @returns `true` if contains old settings object keys.
 */
const isDeprecatedSettings = (object: Record<string, any>): boolean => {
    return Object.keys(object).every((prop) => {
        return deprecatedSettingsProperties.includes(prop);
    });
};

export const transformFromFile = async () => {
    if (jsonReader.existsSyncFile || jsonReader.existsSyncDir) {
        // All json objects from the tracked places.
        const allData = jsonReader.allData;
        const len = allData.length;
        // User configuration.
        const input = new Input();

        if (len === 0) {
            window.showInformationMessage('Nothing to generate from the tracked places');
            return;
        }

        if (isDeprecatedSettings(allData[0][1].value)) {
            window.showInformationMessage('Configuration from the file models.jsonc was moved to the Settings/Extensions/JSON To Dart Model. Configure a new option in the settings and remove the configuration item from the file models.jsonc to avoid this warning.');
            return;
        }

        const fastMode = input.fastMode ?? false;
        const confirm = !fastMode ? await jsonReader.getConfirmation() : fastMode;

        if (confirm) {
            // Start converting.
            for (let i = 0; i < len; i++) {
                const [err, data] = allData[i];

                if (err) {
                    const text = `Failed to read JSON in the file ${data.filePath}. ${err.name}: ${err.message}`;
                    window.showErrorMessage(text);
                    return;
                }

                if (!data.className) {
                    const text = `Some JSON objects do not have class names in the file ${data.filePath}.`;
                    window.showErrorMessage(text);
                    return;
                }

                // Settings config.
                const config: Settings = {
                    model: new ClassNameModel(data.className),
                    targetDirectory: data.targetDirectory,
                    json: data.json,
                    input: input,
                    targetDirectoryType: data.targetDirectoryType,
                };
                // Create new settings.
                const settings = new Settings(config);

                generateClass(settings).catch(handleError);

                window.showInformationMessage('Models successfully added');
            }

            // Format directories
            for (let i = 0; i < len; i++) {
                const data = allData[i][1];
                if (data.className) {
                    const model = new ClassNameModel(data.className);
                    runDartFormat(data.targetDirectory, model.className);
                }
            }

            if (input.generate && input.runBuilder) {
                runBuildRunner();
            }
        }
    } else {
        await jsonReader.createFile();
    }
};