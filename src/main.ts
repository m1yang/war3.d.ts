import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

import { jassToJson } from "./jassToJson";
import {
  mpqNewUiToJson,
  mpqNewDefToJson,
  mpqStringToJson,
  mpqDataToJson,
  mpqEditToJson,
} from "./mpqToJson";

console.time("build");
console.log("Generating definitions");

async function writeJsonFile(
  stringFilePath: string,
  jsonFilePath: string,
  callback: Function
) {
  try {
    const fileContent = await fs.promises.readFile(stringFilePath, "utf8");
    const jsonObject = callback(fileContent);

    const jsonDir = path.dirname(jsonFilePath);
    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    await fs.promises.writeFile(
      jsonFilePath,
      JSON.stringify(jsonObject, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error(`处理文件 ${stringFilePath} 失败:`, err);
  }
}

async function processFiles(we: string) {
  const outputDir = path.resolve("./dist");
  const jassDir = path.resolve(we, "jass");
  // BlizzardAPI.j DzAPI.j KKAPI.j KKPRE.j
  const dzapiFn = async () => {
    for (const fileName of ["BlizzardAPI", "DzAPI", "KKAPI", "KKPRE"]) {
      const jassFile = fileName + ".j";
      const filePath = path.resolve(jassDir, jassFile);
      if (fs.existsSync(filePath)) {
        await writeJsonFile(
          filePath,
          `${outputDir}/jass/${fileName}.json`,
          jassToJson
        );
      }
    }
  };

  // japi 所有.j文件
  const japiFn = async () => {
    const japiDir = path.resolve(jassDir, "japi");
    const japiFiles = fs.readdirSync(japiDir);
    for (const file of japiFiles) {
      const filePath = path.resolve(japiDir, file);
      if (path.extname(file) === ".j") {
        await writeJsonFile(
          filePath,
          `${outputDir}/jass/japi/${path.basename(file, ".j")}.json`,
          jassToJson
        );
      }
    }
  };

  // system/ht common.j blizzard.j
  const nativeFn = async () => {
    for (const fileName of ["common", "blizzard"]) {
      const jassFile = fileName + ".j";
      const filePath = path.resolve(jassDir, "system", "ht", jassFile);
      if (fs.existsSync(filePath)) {
        await writeJsonFile(
          filePath,
          `${outputDir}/jass/${fileName}.json`,
          jassToJson
        );
      }
    }
  };

  const mpqDir = path.resolve(we, "share/mpq");
  const mpqFolders = ["bzapi", "dzapi2", "japi", "kkapi", "ydwe"];

  const mpqUIFn = async () => {
    const mpqFiles = ["action", "call", "condition", "event"];
    for (const folder of mpqFolders) {
      for (const file of mpqFiles) {
        const txtFile = path.resolve(mpqDir, folder, `${file}.txt`);
        if (fs.existsSync(txtFile)) {
          await writeJsonFile(
            txtFile,
            `${outputDir}/mpq/${folder}/${file}.json`,
            mpqNewUiToJson
          );
        }
      }
    }
  };

  // mpqFolders define.txt
  const mpqDefineFn = async () => {
    for (const folder of mpqFolders) {
      const txtFile = path.resolve(mpqDir, folder, "define.txt");
      if (fs.existsSync(txtFile)) {
        writeJsonFile(
          txtFile,
          `${outputDir}/mpq/${folder}/define.json`,
          mpqNewDefToJson
        );
      }
    }
  };

  // dzapi/ui/TriggerStrings.txt TriggerData.txt
  const mpqOldStringFn = async () => {
    const filePath = path.resolve(
      we,
      "share/mpq/dzapi/ui",
      "TriggerStrings.txt"
    );
    if (fs.existsSync(filePath)) {
      writeJsonFile(
        filePath,
        `${outputDir}/mpq/dzapi2/TriggerStrings.json`,
        mpqStringToJson
      );
    }
  };

  const mpqOldDataFn = async () => {
    const filePath = path.resolve(we, "share/mpq/dzapi/ui", "TriggerData.txt");
    if (fs.existsSync(filePath)) {
      writeJsonFile(
        filePath,
        `${outputDir}/mpq/dzapi2/TriggerData.json`,
        mpqDataToJson
      );
    }
  };

  // units/ui/WorldEditStrings.txt 编码格式很可能是 GB2312
  const mpqWeFn = async () => {
    const filePath = path.resolve(
      we,
      "share/mpq/units/ui",
      "WorldEditStrings.txt"
    );
    if (fs.existsSync(filePath)) {
      writeJsonFile(
        filePath,
        `${outputDir}/mpq/WorldEditStrings.json`,
        mpqEditToJson
      );
    }
  };

  const fnList = [dzapiFn, japiFn, nativeFn, mpqUIFn, mpqDefineFn, mpqOldStringFn, mpqOldDataFn, mpqWeFn]

  // const fnList = [mpqOldDataFn];
  for (const fn of fnList) {
    await fn();
  }
}

const we:string = process.env.ydwe as string;
processFiles(we).catch(console.error);

console.timeEnd("build");

// TriggerStrings.txt TriggerData.txt
// https://www.hiveworkshop.com/threads/modding-the-we-trigger-editor.52529/
// https://www.hiveworkshop.com/threads/tutorial-modifying-the-world-editors-trigger-editor.46040/

/*
function updateJson(jsonFile: string, content: object) {
  let jsonObj;

  if (fs.existsSync(jsonFile)) {
    const data = fs.readFileSync(jsonFile, "utf8");
    try {
      jsonObj = JSON.parse(data);
    } catch (parseErr) {
      console.error("解析JSON失败:", parseErr);
      return;
    }
  }

  // 修改对象
  jsonObj = { ...jsonObj, ...content };

  const jsonString = JSON.stringify(jsonObj, null, 2);
  // 写入修改后的JSON字符串到文件
  fs.writeFile(jsonFile, jsonString, "utf8", (writeErr) => {
    if (writeErr) {
      console.error("写入文件失败:", writeErr);
    } else {
      console.log("文件修改成功！");
    }
  });
}

function parseJassToJson(filePath: string) {
  let library: libraryDefinition = {};

  const TYPE_DEFINITION: RegExp = new RegExp(
    "type\\s+(?<name>\\w+)\\s+extends\\s+(?<parent>\\w+)"
  );
  const NATIVE_DEFINITION: RegExp = new RegExp(
    "native\\s+(?<name>\\w+)\\s+takes\\s+(?<prototype>.+)"
  );
  const GLOBAL_DEFINITION: RegExp = new RegExp(
    "(?<constant>constant)?\\s*(?<type>\\w+)(\\s+(?<array>array))?\\s+(?<name>\\w+)(\\s+=\\s(?<value>.+))?"
  );
  const FUNCTION_DEFINITION: RegExp = new RegExp(
    "function\\s+(?<name>\\w+)\\s+takes\\s+(?<prototype>.+)"
  );

  const clean = (input: string): string => {
    input = input.trim();
    input = input.replace(/\s{2,}/g, " ");
    input = input.replace(/\\r/g, "");
    if (input.indexOf("//") >= 0) {
      input = input.substring(0, input.indexOf("//"));
    }
    return input;
  };
  const processGlobalDefinition = (line: string) => {
    const globalDefinition = line.match(GLOBAL_DEFINITION);
    if (globalDefinition?.groups) {
      const isNullOrWhitespace = (input: string) =>
        input == null || input.replace(/\s/g, "").length < 1;
      const { type, value, name, constant, array } = globalDefinition.groups;
      const trimmedValue =
        typeof value === "string" ? value.trim().replace(/^"|"$/g, "") : value;
      return {
        name,
        isConstant: !isNullOrWhitespace(constant),
        type,
        isArray: !isNullOrWhitespace(array),
        value: trimmedValue,
      };
    }
  };

  const processTypeDefinition = (line: string) => {
    const typeDefinition = line.match(TYPE_DEFINITION);
    if (typeDefinition?.groups) {
      return {
        name: typeDefinition.groups["name"],
        extends: typeDefinition.groups["parent"],
      };
    }
  };

  const processNativeDefinition = (line: string) => {
    const nativeDefinition = line.match(NATIVE_DEFINITION);
    if (nativeDefinition?.groups) {
      const { name, prototype } = nativeDefinition.groups;
      let [jassTakes, jassReturns] = prototype.split("returns");
      jassTakes = clean(jassTakes);
      const takes =
        jassTakes === "nothing"
          ? []
          : jassTakes
              .split(",")
              .map((s) => s.trim())
              .map((s) => ({
                type: s.split(" ")[0],
                name: s.split(" ")[1],
              }));

      const returns = clean(jassReturns);

      return {
        name,
        takes,
        returns,
      };
    }
  };

  const processFunctionDefinition = (line: string) => {
    const functionDefinition = line.match(FUNCTION_DEFINITION);
    if (functionDefinition?.groups) {
      const name = functionDefinition.groups["name"];
      const prototype = functionDefinition.groups["prototype"];
      const takes = clean(prototype.split("returns")[0]);
      const returns = clean(prototype.split("returns")[1]);

      return {
        name: name,
        takes:
          takes === "nothing"
            ? []
            : takes
                .split(",")
                .map((s) => s.trim())
                .map((s) => ({
                  type: s.split(" ")[0],
                  name: s.split(" ")[1],
                })),
        returns: returns,
      };
    }
  };

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  console.log("Parsing file...", filePath);

  let inGlobals = false;
  rl.on("line", (rawLine) => {
    const line: string = clean(rawLine);
    if (
      line.startsWith("//") ||
      line.trim() === "" ||
      line.startsWith("private")
    ) {
      return;
    }
    let match;
    let defType;
    if (inGlobals) {
      if (line.includes("endglobals")) {
        inGlobals = false;
        return;
      }
      match = processGlobalDefinition(line);
      defType = "global";
    } else {
      if (line.includes("globals")) {
        inGlobals = true;
        return;
      }
      if (TYPE_DEFINITION.test(line)) {
        match = processTypeDefinition(line);
        defType = "type";
      } else if (NATIVE_DEFINITION.test(line)) {
        match = processNativeDefinition(line);
        defType = "native";
      } else if (FUNCTION_DEFINITION.test(line)) {
        match = processFunctionDefinition(line);
        defType = "function";
      }
    }

    if (!match) return;
    library[match.name] = {
      ...match,
      source: path.basename(filePath),
      // @ts-ignore
      symbol: defType,
    };
  });

  rl.on("close", () => {
    console.log("Finished parsing file.");
    fileStream.close();
    const jsonFile = path.basename(filePath, ".j") + ".json";

    updateJson(jsonFile, library);
  });

  rl.on("error", (err) => {
    console.log(err);
  });
}

// 将mpq中的信息提取到对应的json文件中
function mpqToJson(filePath: string) {
  const sections: {
    [key: string]: any;
  } = {};
  let p = sections;
  let currentSection: string[] = [];

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  console.log("Parsing file...", filePath);

  rl.on("line", (rawLine) => {
    const line = rawLine.trim().replace(/^\s+|\s+$/g, "");
    // 跳过空行和以注释符号开头的行（假设注释符号是;或#）
    if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
      return;
    }
    // 检查是否是节标题（以方括号包围）
    // section生成嵌套路径，其它情况赋值
    if (line.startsWith("[") && line.endsWith("]")) {
      const bracketCount = (line.match(/\[/g) || []).length;
      const sectionName = line
        .slice(bracketCount, -bracketCount)
        .trim()
        .replace(/^\.+/g, "");

      let oldName = currentSection[bracketCount - 1];
      currentSection[bracketCount - 1] = sectionName;
      currentSection.splice(bracketCount);

      p = sections;
      for (let i = 0; i < bracketCount - 1; i++) {
        p = p[currentSection[i]];
      }

      const temp = {};

      if (oldName !== sectionName) {
        p[sectionName] = temp;
      } else {
        if (!Array.isArray(p[sectionName])) {
          p[sectionName] = [p[sectionName]];
        }
        p[sectionName].push(temp);
      }

      p = temp;
    } else if (line.includes("=")) {
      // 解析键值对
      const keyValue = line.split("=");
      const key = keyValue[0].trim();
      const value = keyValue[1].trim().replace(/^"|"$/g, "") || "";
      p[key] = value;
    }
  });

  rl.on("close", () => {
    console.log("Finished parsing file.");
    fileStream.close();

    const baseName = path.basename(filePath, ".txt");
    console.log(filePath);
    const jsonFile = baseName + ".json";

    Object.values(sections).forEach((section) => {
      section["source"] = baseName;
    });
    const jsonString = JSON.stringify(sections, null, 2);
    fs.writeFile(jsonFile, jsonString, "utf8", (err) => {
      if (err) {
        console.error("写入文件失败:", err);
      }
    });
  });

  rl.on("error", (err) => {
    console.log("Error parsing file:", err);
  });
}
*/
