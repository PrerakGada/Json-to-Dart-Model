import { snakeCase } from "./utils";
import { Input } from "./input";

/** Separates class names and enhancement names from syntax */
export class ClassNameModel {
    readonly className: string;
    readonly nameEnhancement: string = '';

    constructor(className: string) {
        if (!className.match(/\W/gm)) {
            this.className = className;
        } else {
            let split = className.split(/\W{1,}/gm);
            let first = split.shift();
            let last = '.' + split.join('.').split('.').map((e) => snakeCase(e)).join('.');
            this.className = first ? first : className;
            this.nameEnhancement = last;
            if (last.match(/(\W|dart)+$/gm)) {
                this.nameEnhancement = '.' + last.replace(/(\W|dart)+$/gm, '').split('.').map((e) => snakeCase(e)).join('.');
            }
        }
    }
}

/** The indicates how the path was taken. */
export enum TargetDirectoryType {
    /** 
     *  The path type from the default options as from the settings.
     */
    Default,
    /** 
     * The path to the `models` folder from user input.
     */
    Standard,
    /** 
     * The raw path directly from the context.
     */
    Raw,
}

export interface ISettings {
    /**
     * Class definition model. Required root class name.
     */
    model: ClassNameModel;
    /**
     * File target directory.
     */
    targetDirectory: string;
    /**
     * JSON object.
     */
    object: string;
    /**
     * User input.
     */
    input: Input;
    /**
     * The path input method type.
     */
    targetDirectoryType: TargetDirectoryType;
}

export class Settings implements ISettings {
    model: ClassNameModel;
    targetDirectory: string;
    object: string;
    input: Input;
    targetDirectoryType: TargetDirectoryType;

    constructor(settings: ISettings) {
        this.model = settings.model;
        this.object = settings.object;
        this.input = settings.input;
        this.targetDirectoryType = settings.targetDirectoryType;

        switch (settings.targetDirectoryType) {
            case TargetDirectoryType.Default:
                this.targetDirectory = settings.targetDirectory + `/${snakeCase(settings.model.className)}`;
                break;
            case TargetDirectoryType.Standard:
                this.targetDirectory = settings.targetDirectory + `/models`;
                break;
            default:
                this.targetDirectory = settings.targetDirectory;
        }
    }
}