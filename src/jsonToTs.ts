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

// d.ts + jsdoc 生成
function generatingTsDefinitions(input: string) {
  const data = fs.readFileSync(input, "utf8");
  const json: libraryDefinition = JSON.parse(data);

  const nullableSuffix = (isNullable: boolean | undefined): string =>
    isNullable ? " | undefined" : "";

  const handleParamName = (name: string): string =>
    name === "var" ? "val" : name;

  const output = path.basename(input, ".json");
  const stream = fs.createWriteStream(output + ".d.ts");

  stream.write("/** @noSelfInFile */\n\n");

  for (const value of Object.values(json)) {
    if (value.symbol === "type") {
      stream.write(
        `declare interface ${value.name} extends ${value.extends} { __${value.name}: never; }\n`
      );
    } else if (value.symbol === "global") {
      stream.write(
        `declare ${value.isConstant ? "const" : "var"} ${value.name}`
      );

      if (value.isArray) {
        stream.write(
          `: Record<number, ${value.type}${
            value.isNullable ? " | undefined" : ""
          }>;`
        );
      } else {
        stream.write(
          `: ${value.type}${value.isNullable ? " | undefined" : ""};`
        );
      }

      stream.write("\n");
    } else if (value.symbol === "native" || value.symbol === "function") {
      stream.write(`declare function ${value.name}(`);

      if (value.takes.length > 0) {
        const isDefaultable: Array<boolean> = [];
        let allowDefault = true;
        for (let i = value.takes.length - 1; i >= 0; i--) {
          allowDefault = allowDefault && !!value.takes[i].isNullable;
          isDefaultable[i] = allowDefault;
        }

        stream.write(
          value.takes
            .map((param, i) => {
              if (param.name === "var") {
                param.name = "val";
              }
              if (param.isNullable) {
                return `${param.name}${isDefaultable[i] ? "?" : ""}: ${
                  param.type
                }${!isDefaultable[i] ? " | undefined" : ""}`;
              }
              return `${param.name}: ${param.type}`;
            })
            .join(", ")
        );
      }

      stream.write(
        `): ${value.returns}${value.isNullable ? " | undefined" : ""};\n`
      );
    }
  }

  stream.end();
}
