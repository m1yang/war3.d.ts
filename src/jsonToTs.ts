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
  source?: string;
  symbol: "global";
};

type params = {
  description?: string;
  name: string;
  type: string;
};

type nativeDeclaration = {
  name: string;
  description?: string;
  takes: Array<params>;
  returns: string;
  source?: string;
  symbol: "native";
};

type functionDeclaration = {
  name: string;
  description?: string;
  takes: Array<params>;
  returns: string;
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

// const nullableParam = (isNullable: boolean | undefined): string =>
//   isNullable ? " | undefined" : "";

const validParam = (name: string): string => (name === "var" ? "val" : name);

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

function typeToTs(value: typeDeclaration) {
  return `declare interface ${value.name} extends ${value.extends} { __${value.name}: never; }\n`;
}

function globalToTs(value: globalDeclaration) {
  let tempString = "";
  tempString += `declare ${value.isConstant ? "const" : "var"} ${value.name}`;

  if (value.isArray) {
    tempString += `: Record<number, ${fixType(value.type)}>;`;
  } else {
    tempString += `: ${fixType(value.type)};`;
  }

  tempString += "\n";

  return tempString;
}

function funcToTs(value: functionDeclaration | nativeDeclaration) {
  let tempString = "";
  tempString += `declare function ${value.name}(`;

  if (value.takes.length > 0) {
    tempString += value.takes
      .map((param, i) => {
        param.name = validParam(param.name);
        param.type = fixType(param.type);
        return `${param.name}: ${param.type}`;
      })
      .join(", ");
  }

  tempString += `): ${fixType(value.returns)};\n`;
  return tempString;
}

type mpqArgs = {
  type: string;
  default?: string;
  min?: string;
  max?: string;
};

type mpqUI = {
  title: string;
  description: string;
  comment?: string;
  script_name?: string;
  category: string;
  use_in_event?: string;
  returns?: string;
  args?: Array<mpqArgs> | mpqArgs;
};

type mpqDefine = {
  // TFT-only (1) or RoC and TFT (0)
  version: number;
  // can be a global variable
  global: number;
  // can be used with comparison operators
  comparison: number;
  // string to display in the editor
  display: string;
  // base type, used only for custom types
  baseType: string;
  // variable type
  type: string;
  // used in script
  code: string;
  icon: string;
  default: string;
};

function argsToJsdoc(args: mpqArgs | Array<mpqArgs>) {
  let result = "";
  const corvertArg = (arg: mpqArgs) => {
    return ` * @param {${fixType(arg.type)}} ${
      arg.default ? `[${arg.default}]` : ""
    }`;
  };

  if (Array.isArray(args)) {
    result = args.map(corvertArg).join("\n");
  } else {
    result = corvertArg(args);
  }
  return result;
}

function mpqToJsDoc(data: mpqUI) {
  let result = "\n";

  const title = data.title ? ` * ${data.title}\n` : "";
  const desc = data.description ? ` * ${data.description}\n` : "";
  const comment = data.comment ? ` * @remark\n * ${data.comment}\n *\n` : "";
  const params = data.args ? argsToJsdoc(data.args) : "";
  const returns = data.returns ? ` * @return {${fixType(data.returns)}}\n` : "";
  const label = data.category ? ` * @${data.category}\n` : "";

  const doc = `/**\n${title}${desc} *\n${comment}${params}\n${returns} *\n${label} */`;
  // const doc = `/**\n${title}${desc} *\n${comment}${label} */`;
  result += `${doc}\n`;
  return result;
}
const mpqToJass = {
  common: "ydwe",
  blizzard: "ydwe",
  BlizzardAPI: "bzapi",
  DzAPI: "dzapi2",
  japi: "japi",
  KKAPI: "kkapi",
  KKPRE: "kkapi",
};

function mpqFileToJsdoc(jassFileName: string, jassKeyName: string) {
  const mpqDir = path.resolve("dist/mpq", mpqToJass[jassFileName]);

  const mpqFiles = fs.readdirSync(mpqDir);
  for (const mpqFile of mpqFiles) {
    if (mpqFile === "define.json") {
      continue;
    }
    const filePath = path.resolve(mpqDir, mpqFile);
    const mpqData = fs.readFileSync(filePath, "utf8");
    if (mpqData.includes(`"${jassKeyName}":`)) {
      const mpqJson = JSON.parse(mpqData);
      return mpqToJsDoc(mpqJson[jassKeyName]);
    }
  }
}

// common.json文件路径
export function makeBaseType(input: string) {
  const data = fs.readFileSync(input, "utf8");
  const json: libraryDefinition = JSON.parse(data);

  const stream = fs.createWriteStream("base.d.ts");

  const mpqPath = path.resolve("dist/mpq/ydwe/define.json");
  const mpqString = fs.readFileSync(mpqPath, "utf-8");
  const mpqJson = JSON.parse(mpqString);

  const wePath = path.resolve("dist/WorldEditStrings.json");
  const weString = fs.readFileSync(wePath, "utf-8");
  const weJson = JSON.parse(weString);

  stream.write("/** @noSelfInFile */\n\n");
  stream.write(
    "/** 编号 */\ndeclare interface handle { __handle: never; }\n\n"
  );

  for (const [key, value] of Object.entries(json)) {
    const mpqTypes = mpqJson["TriggerTypes"][key];
    if (mpqTypes !== undefined) {
      let display = mpqTypes["display"] as string;
      if (display.startsWith("WESTRING")) {
        const weValue = weJson[display] as string;
        if (weValue.startsWith("WESTRING")) {
          display = weValue as string;
        }
        display = weJson[display] as string;
      }

      stream.write(`/** ${display} */\n`);
    }

    if (value.symbol === "type") {
      stream.write(typeToTs(value));
      stream.write(`\n`);
    }
  }

  stream.end();
}

/**
 * blizzard.j common.j japi.j KKAPI.j
 */
export function makeGlobalType(input: string) {
  const data = fs.readFileSync(input, "utf8");
  const json: libraryDefinition = JSON.parse(data);

  const output = path.basename(input, ".json");
  const stream = fs.createWriteStream(output + ".d.ts");

  stream.write("/** @noSelfInFile */\n\n");

  for (const [key, value] of Object.entries(json)) {
    const mpqDoc = mpqFileToJsdoc(output, key);
    if (mpqDoc !== undefined) {
      stream.write(mpqDoc);
    }

    if (value.symbol === "type") {
      // define.json
      stream.write(typeToTs(value));
    } else if (value.symbol === "global") {
      stream.write(globalToTs(value));
    } else if (value.symbol === "native" || value.symbol === "function") {
      stream.write(funcToTs(value));
    }
  }

  stream.end();
}

/**
 * d.ts + jsdoc 生成
 * blizzard.j 一个native都没有
 * common.j 一个function都没有 KKPRE 现在也是
 * @param input
 */
export function makeFunctionType(input: string) {
  const data = fs.readFileSync(input, "utf8");
  const json: libraryDefinition = JSON.parse(data);

  const output = path.basename(input, ".json");
  const stream = fs.createWriteStream(output + ".d.ts");

  stream.write("/** @noSelfInFile */\n\n");

  for (const [key, value] of Object.entries(json)) {
    const mpqDoc = mpqFileToJsdoc(output, key);
    if (mpqDoc !== undefined) {
      stream.write(mpqDoc);
    }

    if (value.symbol === "type") {
      // define.json
      stream.write(typeToTs(value));
    } else if (value.symbol === "global") {
      stream.write(globalToTs(value));
    } else if (value.symbol === "native" || value.symbol === "function") {
      stream.write(funcToTs(value));
    }
  }

  stream.end();
}
