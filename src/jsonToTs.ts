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
  name?: string;
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

function weStringToJsdoc(we: string) {
  const wePath = path.resolve("dist/WorldEditStrings.json");
  const weJson: Record<string, string> = mpqJsonCache(wePath);

  let display = we;
  if (we.startsWith("WESTRING")) {
    const weValue = weJson[we];
    if (weValue.startsWith("WESTRING")) {
      we = weValue;
    }
    display = weJson[we];
  }
  return display;
}

function categoryToJsdoc(category: string) {
  // ydwe kkapi dzapi2 bzapi
  for (const dir of ["ydwe", "kkapi", "dzapi2", "bzapi", "japi"]) {
    const mpqPath = path.resolve(`dist/mpq/${dir}/define.json`);
    const mpqJson = mpqJsonCache(mpqPath);
    const categories = mpqJson["TriggerCategories"];
    if (categories && categories[category]) {
      // console.log(categories[category]);
      return "- " + weStringToJsdoc(categories[category]["display"]);
    }
  }
}

function fileTags(file: string) {
  const fileMap = {
    "action.json": "动作",
    "call.json": "调用",
    "condition.json": "条件",
    "event.json": "事件",
  };
  return fileMap[file] || "其他";
}

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

function mpqToJsDoc(mpq: mpqUI, jass?: any, file?: string) {
  let result = "\n";

  const title = mpq.title ? ` * ${mpq.title}  \n` : "";
  const desc = mpq.description ? ` * ${mpq.description}\n` : "";
  const comment = mpq.comment ? ` * @remark\n * ${mpq.comment}\n *\n` : "";
  //  * @param {string} [somebody=John Doe] - Somebody's name.
  // 将jass中的args的name加入到mpq中来
  // mpq参数与jass参数类型不一致，mpq更细致，mpq参数中的default用于编辑器上默认的选择，而不是函数传参的默认值
  // const params = mpq.args ? argsToJsdoc(mpq.args) : "";
  // const returns = mpq.returns ? ` * @return {${fixType(mpq.returns)}}\n` : "";

  // script_name字段并没有在.j中实现
  let source = "";
  if (jass) {
    source = ` * [${jass.source}] [${jass.symbol}]  \n`;
  }
  let fileTag = "";
  if (file) {
    fileTag = fileTags(file);
  }

  const category = mpq.category
    ? ` * ${fileTag} ${categoryToJsdoc(mpq.category) || ""}\n`
    : "";

  // const doc = `/**\n${title}${desc} *\n${comment}${params}\n${returns} *\n${category} */`;
  const doc = `/**\n${title}${desc} *\n${comment}${source}${category} */`;
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

const jsonCache: Record<string, any> = {};
function mpqJsonCache(path: string) {
  if (jsonCache[path] !== undefined) {
    return jsonCache[path];
  }
  try {
    const mpqData = fs.readFileSync(path, "utf8");
    const mpqJson = JSON.parse(mpqData);
    jsonCache[path] = mpqJson;
    return mpqJson;
  } catch (error) {
    console.error(`Error reading or parsing file at ${path}:`, error);
    throw error;
  }
}

function mpqFileToJsdoc(jassFileName: string, jassKey: string, jassValue: any) {
  // 找到.j对应的mpq文件
  const mpqDir = path.resolve("dist/mpq", mpqToJass[jassFileName]);

  const mpqFiles = fs.readdirSync(mpqDir);
  for (const mpqFile of mpqFiles) {
    if (mpqFile === "define.json") {
      continue;
    }
    const mpqPath = path.resolve(mpqDir, mpqFile);
    const mpqJson = mpqJsonCache(mpqPath);

    if (mpqJson[jassKey] !== undefined) {
      return mpqToJsDoc(mpqJson[jassKey], jassValue, mpqFile);
    }
  }
}

// common.json文件路径
export function makeBaseType(input: string) {
  const jassJson: libraryDefinition = mpqJsonCache(input);

  const stream = fs.createWriteStream("base.d.ts");

  const mpqPath = path.resolve("dist/mpq/ydwe/define.json");
  const mpqJson = mpqJsonCache(mpqPath);

  const wePath = path.resolve("dist/WorldEditStrings.json");
  const weJson = mpqJsonCache(wePath);

  stream.write("/** @noSelfInFile */\n\n");
  stream.write(
    "/** 对象 */\ndeclare interface handle { __handle: never; }\n\n"
  );

  for (const [key, value] of Object.entries(jassJson)) {
    if (value.symbol === "type") {
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
  const jassJson: libraryDefinition = mpqJsonCache(input);

  const output = path.basename(input, ".json");
  const stream = fs.createWriteStream(output + ".d.ts");

  stream.write("/** @noSelfInFile */\n\n");
  stream.write('/// <reference path="base.d.ts" />\n\n');
  for (const [key, value] of Object.entries(jassJson)) {
    // const mpqDoc = mpqFileToJsdoc(output, key);
    // if (mpqDoc !== undefined) {
    //   stream.write(mpqDoc);
    // }

    if (value.symbol === "global") {
      stream.write(globalToTs(value));
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
  const jassJson: libraryDefinition = mpqJsonCache(input);

  const output = path.basename(input, ".json");
  const outputDit = path.resolve("dist/types/");

  if (!fs.existsSync(outputDit)) {
    fs.mkdirSync(outputDit, { recursive: true });
  }
  const notFound = new Set<string>();
  const stream = fs.createWriteStream(
    path.resolve(outputDit, output + ".d.ts")
  );

  // stream.write('/// <reference path="base.d.ts" />\n\n');
  stream.write("/** @noSelfInFile */\n\n");

  for (const [key, value] of Object.entries(jassJson)) {
    if (value.symbol === "native" || value.symbol === "function") {
      const mpqDoc = mpqFileToJsdoc(output, key, value);
      if (mpqDoc !== undefined) {
        stream.write(mpqDoc);
      } else {
        notFound.add(key);
      }
      stream.write(funcToTs(value));
    }
  }

  stream.end();
  if (notFound.size > 0) {
    // console.log(input, notFound);
    const notFoundDir = path.resolve("dist/404");

    if (!fs.existsSync(notFoundDir)) {
      fs.mkdirSync(notFoundDir, { recursive: true });
    }

    fs.writeFileSync(
      path.resolve(`${notFoundDir}/${output}.json`),
      JSON.stringify(Array.from(notFound), null, 2),
      "utf8"
    );
  }
}
