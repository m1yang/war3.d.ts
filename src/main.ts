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
console.log("Generating json");

function mergeJson(jsonFile: string, content: object) {
  let jsonObj: object = {};

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
  // jsonObj = {
  //   TriggerCategories: { ...content["TriggerCategories"] },
  //   TriggerTypes: { ...content["TriggerTypes"], ...jsonObj["TriggerTypes"] },
  //   TriggerParams: {
  //     ...content["TriggerParams"],
  //     ...jsonObj["TriggerParams"],
  //   },
  // };

  jsonObj = mergeObjects(content, jsonObj);

  const jsonString = JSON.stringify(jsonObj, null, 2);
  // 写入修改后的JSON字符串到文件
  fs.writeFile(jsonFile, jsonString, "utf8", (writeErr) => {
    if (writeErr) {
      console.error("写入文件失败:", writeErr);
    }
  });
}

function mergeObjects(obj1: object, obj2: object) {
  const merged = { ...obj1 }; // 复制对象obj1

  for (const key in obj2) {
    if (obj2.hasOwnProperty(key) && obj1.hasOwnProperty(key)) {
      merged[key] = { ...obj1[key], ...obj2[key] }; // 合并嵌套对象
    }
  }

  return merged;
}

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
  const mqpOldDzApiFn = async () => {
    const basePath = path.resolve(we, "share/mpq/dzapi/ui");
    const stringFile = path.resolve(basePath, "TriggerStrings.txt");
    const dataFile = path.resolve(basePath, "TriggerData.txt");

    const stringJson = await fs.promises.readFile(stringFile, "utf8");
    const dataJson = await fs.promises.readFile(dataFile, "utf8");

    const dataObj = mpqDataToJson(dataJson);
    const stringObj = mpqStringToJson(stringJson);

    const uiMap = {
      TriggerEvents: "event",
      TriggerActions: "action",
      TriggerCalls: "call",
    };

    for (const key in uiMap) {
      if (dataObj.hasOwnProperty(key)) {
        const newObj = mergeObjects(
          stringObj[key.replace("s", "Strings")],
          dataObj[key]
        );
        mergeJson(`${outputDir}/mpq/dzapi2/${uiMap[key]}.json`, newObj);
      } else {
        mergeJson(`${outputDir}/mpq/dzapi2/define.json`, dataObj[key]);
      }
    }
  };

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

  const fnList = [
    dzapiFn,
    japiFn,
    nativeFn,
    mpqUIFn,
    mpqDefineFn,
    mqpOldDzApiFn,
  ];

  // const fnList = [mpqWeFn];

  for (const fn of fnList) {
    await fn();
  }
}

const we: string = process.env.ydwe as string;
processFiles(we).catch(console.error);

// console.log("Generating definitions");

console.timeEnd("build");
