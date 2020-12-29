import * as changeCase from "change-case";
import {
    ArrayNode, ASTNode,


    LiteralNode, ObjectNode
} from "json-to-ast";
import {
    isArray, isMap
} from "./lib";
import { newAmbiguousType, Warning, WithWarning } from "./syntax";

export enum ListType { Object, String, Double, Int, dynamic, Null }

class MergeableListType {
    listType: ListType;
    isAmbigous: boolean;

    constructor(listType: ListType, isAmbigous: boolean) {
        this.isAmbigous = isAmbigous;
        this.listType = listType;
    };
}

function mergeableListType(list: Array<any>): MergeableListType {
    var t = ListType.dynamic;
    var isAmbigous = false;
    list.forEach((e) => {
        var inferredType: ListType;
        if (typeof e + "" === 'number') {
            inferredType = e % 1 === 0 ? ListType.Int : ListType.Double;
        } else if (typeof e === 'string') {
            inferredType = ListType.String;
        } else if (isMap(e)) {
            inferredType = ListType.Object;
        }
        if (t !== ListType.Null && t !== inferredType!!) {
            isAmbigous = true;
        }
        t = inferredType!!;
    });
    return new MergeableListType(t, isAmbigous);
}


const PRIMITIVE_TYPES: { [name: string]: boolean } = {
    'int': true,
    'double': true,
    'String': true,
    'bool': true,
    'dynamic': true,
    'DateTime': false,
    'List<DateTime>': false,
    'List<int>': true,
    'List<double>': true,
    'List<String>': true,
    'List<bool>': true,
    'List<dynamic>': true,
    'Null': true,
};

export function isList(text: string) {
    return text.startsWith("List");
}

export function camelCase(text: string): string {
    return changeCase.camelCase(text);
}

export function pascalCase(text: string): string {
    return changeCase.pascalCase(text);
}

export function snakeCase(text: string): string {
    return changeCase.snakeCase(text);
}

export function isPrimitiveType(typeName: string) {
    var isPrimitive = PRIMITIVE_TYPES[typeName];
    if (isPrimitive === null || isPrimitive === undefined) {
        return false;
    }
    return isPrimitive;
}

/**
 * Returns value name. If it reserved by the system will be mixed with class name.
 * @param name value name.
 * @param prefix class name used to recreate reserved names.
 * @param isPrivate means is a private value or not.
 */
export function fixFieldName(name: string, prefix: string, isPrivate = false): string {
    var filedName = camelCase(name);
    if (filedName == 'get') {
        return filedName = camelCase(`${prefix}Get`);
    }
    if (isPrivate) {
        return `_${filedName}`;
    }
    return filedName;
}

export function getTypeName(obj: any): string {
    var type = typeof obj + "";
    if (type === 'string') {
        return 'String';
    } else if (type === 'number') {
        return obj % 1 === 0 ? "int" : "double";
    } else if (type === "boolean") {
        return 'bool';
    } else if (obj === "undefined") {
        return 'Null';
    } else if (isArray(obj)) {
        return 'List';
    } else {
        // assumed class
        return 'Class';
    }
}

export function navigateNode(astNode: ASTNode, path: string): ASTNode {
    let node: ASTNode;
    if (astNode?.type === "Object") {
        var objectNode: ObjectNode = astNode as ObjectNode;
        var propertyNode = objectNode.children[0];
        if (propertyNode !== null) {
            propertyNode.key.value = path;
            node = propertyNode.value;
        }
    }
    if (astNode?.type === "Array") {
        var arrayNode: ArrayNode = astNode as ArrayNode;
        var index = +path ?? null;
        if (index !== null && arrayNode.children.length > index) {
            node = arrayNode.children[index];
        }
    }
    return node!!;
}

var _pattern = /([0-9]+)\.{0,1}([0-9]*)e(([-0-9]+))/g;

export function isASTLiteralDouble(astNode: ASTNode): boolean {
    if (astNode !== null && astNode !== undefined && astNode.type === "Literal") {
        var literalNode: LiteralNode = astNode as LiteralNode;
        var containsPoint = literalNode.raw.includes('.');
        var containsExponent = literalNode.raw.includes('e');
        if (containsPoint || containsExponent) {
            var isDouble = containsPoint;
            if (containsExponent) {
                var matches = literalNode.raw.split(_pattern);
                if (matches !== null) {
                    var integer = matches[1];
                    var comma = matches[2];
                    var exponent = matches[3];
                    isDouble = _isDoubleWithExponential(integer, comma, exponent);
                }
            }
            return isDouble;
        }
    }
    return false;
}

export function mergeObjectList(list: Array<any>, path: string, idx = -1): WithWarning<Map<any, any>> {
    var warnings = new Array<Warning>();
    var obj = new Map();
    for (var i = 0; i < list.length; i++) {
        var toMerge = new Map(Object.entries(list[i]));
        if (toMerge.size !== 0) {
            toMerge.forEach((v: any, k: any) => {
                var t = getTypeName(obj.get(k));
                if (obj.get(k) === undefined) {
                    obj.set(k, v);
                } else {
                    var otherType = getTypeName(v);
                    if (t !== otherType) {
                        if (t === 'int' && otherType === 'double') {
                            // if double was found instead of int, assign the double
                            obj.set(k, v);
                        } else if (t !== 'double' && otherType !== 'int') {
                            // if types are not equal, then
                            var realIndex = i;
                            if (idx !== -1) {
                                realIndex = idx - i;
                            }
                            var ambiguosTypePath = `${path}[${realIndex}]/${k}`;
                            warnings.push(newAmbiguousType(ambiguosTypePath));
                        }
                    } else if (t === 'List') {
                        var l = Array.from(obj.get(k));
                        var beginIndex = l.length;
                        l.push(v);
                        // bug is here
                        var mergeableType = mergeableListType(l);
                        if (ListType.Object === mergeableType.listType) {
                            var mergedList =
                                mergeObjectList(l, `${path}[${i}]/${k}`, beginIndex);
                            mergedList.warnings.forEach((wrn) => warnings.push(wrn));
                            obj.set(k, new Array((mergedList.result)));
                        } else {
                            if (l.length > 0) {
                                obj.set(k, new Array(l[0]));
                            }
                            if (mergeableType.isAmbigous) {
                                warnings.push(newAmbiguousType(`${path}[${i}]/${k}`));
                            }
                        }
                    } else if (t === 'Class') {
                        var properIndex = i;
                        if (idx !== -1) {
                            properIndex = i - idx;
                        }
                        var mergedObj = mergeObj(
                            obj.get(k),
                            v,
                            `${path}[${properIndex}]/${k}`,
                        );
                        mergedObj.warnings.forEach((wrn) => warnings.push(wrn));
                        obj.set(k, mergedObj.result);
                    }
                }
            });
        }
    }
    return new WithWarning(obj, warnings);
}

function mergeObj(obj: Map<any, any>, other: Map<any, any>, path: string): WithWarning<Map<any, any>> {
    var warnings = new Array<Warning>();
    var clone = new Map(obj);
    other.forEach((k, v) => {
        if (clone.get(k) === null) {
            clone.set(k, v);
        } else {
            var otherType = getTypeName(v);
            var t = getTypeName(clone.get(k));
            if (t !== otherType) {
                if (t === 'int' && otherType === 'double') {
                    // if double was found instead of int, assign the double
                    clone.set(k, v);
                } else if (typeof v + "" !== 'number' && clone.get(k) % 1 === 0) {
                    // if types are not equal, then
                    warnings.push(newAmbiguousType(`${path}/${k}`));
                }
            } else if (t === 'List') {
                var l = Array(clone.get(k));
                l.push(other.get(k));
                var mergeableType = mergeableListType(l);
                if (ListType.Object === mergeableType.listType) {
                    var mergedList = mergeObjectList(l, `${path}`);
                    mergedList.warnings.forEach((wrn) => warnings.push(wrn));
                    clone.set(k, new Array(mergedList.result));
                } else {
                    if (l.length > 0) {
                        clone.set(k, new Array(l[0]));
                    }
                    if (mergeableType.isAmbigous) {
                        warnings.push(newAmbiguousType(`${path}/${k}`));
                    }
                }
            } else if (t === 'Class') {
                var mergedObj = mergeObj(clone.get(k), other.get(k), `${path}/${k}`);
                mergedObj.warnings.forEach((wrn) => warnings.push(wrn));
                clone.set(k, mergedObj.result);
            }
        }
    });
    return new WithWarning(clone, warnings);
}

function _isDoubleWithExponential(integer: string, comma: string, exponent: string): boolean {
    var integerNumber = +integer ?? 0;
    var exponentNumber = +exponent ?? 0;
    var commaNumber = +comma ?? 0;
    if (exponentNumber !== null) {
        if (exponentNumber === 0) {
            return commaNumber > 0;
        }
        if (exponentNumber > 0) {
            return exponentNumber < comma.length && commaNumber > 0;
        }
        return commaNumber > 0 ||
            ((integerNumber * Math.pow(10, exponentNumber)) % 1 > 0);
    }
    return false;
}
