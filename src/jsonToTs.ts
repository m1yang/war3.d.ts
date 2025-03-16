import * as fs from "fs";
import * as path from "path";

type typeDeclaration = {
  name: string;
  description?: string;
  extends: string;
  source?: string;
  symbol: "type";
};

type globalDeclaration = {
  name: string;
  description?: string;
  isConstant: boolean;
  type: string;
  isArray: boolean;
  value: string;
  isNullable?: boolean;
  source?: string;
  symbol: "global";
};

type params = {
  description?: string;
  name: string;
  type: string;
  isNullable?: boolean;
};

type nativeDeclaration = {
  name: string;
  description?: string;
  takes: Array<params>;
  returns: string;
  isNullable?: boolean;
  source?: string;
  symbol: "native";
};

type functionDeclaration = {
  name: string;
  description?: string;
  takes: Array<params>;
  returns: string;
  isNullable?: boolean;
  source?: string;
  symbol: "function";
};

type libraryDefinition = {
  [keyof: string]:
    | typeDeclaration
    | globalDeclaration
    | nativeDeclaration
    | functionDeclaration;
};

const nullableParam = (isNullable: boolean | undefined): string =>
  isNullable ? " | undefined" : "";

const validParam = (name: string): string =>
  name === "var" ? "val" : name;

function fixType(type: string): string {
  switch (type) {
    case "real":
    case "integer":
      type = "number";
      break;
    case "nothing":
      type = "void";
      break;
    case "code":
      type = "() => void";
      break;
  }
  return type;
}

function typeDef(value: typeDeclaration) {
  return `declare interface ${value.name} extends ${value.extends} { __${value.name}: never; }\n`;
}

function globalDef(value: globalDeclaration) {
  let tempString = "";
  tempString += `declare ${value.isConstant ? "const" : "var"} ${value.name}`;

  if (value.isArray) {
    tempString += `: Record<number, ${fixType(value.type)}${nullableParam(
      value.isNullable
    )}>;`;
  } else {
    tempString += `: ${fixType(value.type)}${nullableParam(value.isNullable)};`;
  }

  tempString += "\n";

  return tempString;
}

function functionDef(value: functionDeclaration | nativeDeclaration) {
  let tempString = "";
  tempString += `declare function ${value.name}(`;

  if (value.takes.length > 0) {
    const isDefaultable: Array<boolean> = [];
    let allowDefault = true;
    for (let i = value.takes.length - 1; i >= 0; i--) {
      allowDefault = allowDefault && !!value.takes[i].isNullable;
      isDefaultable[i] = allowDefault;
    }

    tempString += value.takes
      .map((param, i) => {
        param.name = validParam(param.name);
        param.type = fixType(param.type);
        if (param.isNullable) {
          return `${param.name}${isDefaultable[i] ? "?" : ""}: ${
            param.type
          }${nullableParam(value.isNullable)}`;
        }
        return `${param.name}: ${param.type}`;
      })
      .join(", ");
  }

  tempString += `): ${fixType(value.returns)}${nullableParam(value.isNullable)};\n`;
  return tempString;
}

// d.ts + jsdoc 生成
export function generatingTsDefinitions(input: string) {
  const data = fs.readFileSync(input, "utf8");
  const json: libraryDefinition = JSON.parse(data);

  const output = path.basename(input, ".json");
  const stream = fs.createWriteStream(output + ".d.ts");

  stream.write("/** @noSelfInFile */\n\n");

  for (const value of Object.values(json)) {
    if (value.symbol === "type") {
      stream.write(typeDef(value));
    } else if (value.symbol === "global") {
      stream.write(globalDef(value));
    } else if (value.symbol === "native" || value.symbol === "function") {
      stream.write(functionDef(value));
    }
  }

  stream.end();
}
