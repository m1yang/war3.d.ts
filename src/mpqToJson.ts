export function mpqNewUiToJson(fileContent: string): object {
  const sections: {
    [key: string]: any;
  } = {};
  let p = sections;
  let currentSection: string[] = [];

  const lines = fileContent.split(/[\r\n]+/g);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    // 跳过空行和以注释符号开头的行（假设注释符号是;或#）
    if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
      continue;
    }
    // const regStr = `^(?:\\[){${n}}(?:[^\\[\\]]+)(?:\\]){${n}}$`
    // console.log(line, line.trim().startsWith("["));

    // 检查是否是节标题（以方括号包围）
    if (line.startsWith("[") && line.endsWith("]")) {
      const bracketCount = (line.match(/\[/g) || []).length;
      const sectionName = line
        .trim()
        .slice(bracketCount, -bracketCount)
        .replace(/^\.+/g, "");

      const oldName = currentSection[bracketCount - 1];
      currentSection[bracketCount - 1] = sectionName;
      currentSection.splice(bracketCount);

      p = sections;
      for (let i = 0; i < bracketCount - 1; i++) {
        p = p[currentSection[i]];
      }

      const temp = {};
      if (oldName !== sectionName) {
        p[sectionName] = temp;
      } else if (!Array.isArray(p[sectionName])) {
        p[sectionName] = [p[sectionName]];
      }
      if (Array.isArray(p[sectionName])) {
        p[sectionName].push(temp);
      }
      p = temp;
    } else if (line.includes("=")) {
      // 解析键值对
      const [key, value] = line.split("=").map((s) => s.trim());
      //   const trimmedValue = value.replace(/^"|"$/g, "") || "";
      const trimmedValue = value.replace(/^"|"$|\\"/g, "") || "";
      p[key] = trimmedValue;
    }
  }

  return sections;
}

export function mpqNewDefToJson(fileContent: string): object {
  const sections: {
    [key: string]: any;
  } = {};
  let currentSection = "";

  const lines = fileContent.split(/[\r\n]+/g);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1);
      sections[currentSection] = {};
    } else if (line.includes("=")) {
      const [key, value = ""] = line.split("=");
      const trimValue = value.replace(/^"|"$/g, "").replace(/"/g, "'").trim();
      parseDefine(sections, currentSection, key, trimValue);
    }
  }
  return sections;
}

export function mpqEditToJson(fileContent: string): object {
  const sections: {
    [key: string]: any;
  } = {};
  // let currentSection = "";

  const lines = fileContent.split(/[\r\n]+/g);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.match(/^\s*[;#\/\/]/)) {
      continue;
    }
    if (line.includes("=")) {
      const [key, value = ""] = line.split("=");
      let trimmedValue = value.replace(/~/g, "$").replace(/"/g, "'") || "";
      // sections[currentSection][key] = trimmedValue;
      sections[key] = JSON.stringify(trimmedValue)
        .replace(/\\u[0-9a-fA-F]{4}/g, "")
        .replace(/^"|"$/g, "");
    }
  }
  return sections;
}
export function mpqStringToJson(fileContent: string): object {
  const sections: {
    [key: string]: any;
  } = {};
  let currentSection = "";

  const lines = fileContent.split(/[\r\n]+/g);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1);
      sections[currentSection] = {};
    } else if (line.includes("=")) {
      const [key, value = ""] = line.split("=");
      const trimmedValue =
        value.replace(/^"|"$/g, "").replace(/~/g, "$").replace(/"/g, "'") || "";
      if (key.endsWith("Hint")) {
        sections[currentSection][key.replace("Hint", "")]["comment"] =
          trimmedValue;
      } else if (key in sections[currentSection]) {
        sections[currentSection][key]["description"] = trimmedValue;
      } else {
        sections[currentSection][key] = {};
        sections[currentSection][key]["title"] = trimmedValue;
      }
    }
  }
  return sections;
}
export function mpqDataToJson(fileContent: string): object {
  const sections: {
    [key: string]: any;
  } = {};
  let currentSection = "";

  const lines = fileContent.split(/[\r\n]+/g);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1);
      sections[currentSection] = {};
    } else if (line.includes("=")) {
      const [key, value = ""] = line.split("=");

      if (key.startsWith("//")) {
        continue;
      }
      // 先根据section来区分是ui组还是define组
      switch (currentSection) {
        case "TriggerEvents":
        case "TriggerConditions":
        case "TriggerActions":
        case "TriggerCalls":
          parseUI(sections, currentSection, key, value);
          break;
        default:
          const trimValue = value
            .replace(/^"|"$/g, "")
            .replace(/"/g, "'")
            .trim();
          parseDefine(sections, currentSection, key, trimValue);
          break;
      }
    }
  }
  return sections;
}

const parseUI = (
  sections: object,
  name: string,
  rawKey: string,
  value: string
) => {
  const keyReg: RegExp = new RegExp("^_(?<key>[\\w_]+)(?<suffix>_\\w+)");
  const keyMatch = rawKey.match(keyReg);
  const key = keyMatch?.groups?.key || rawKey;
  const suffix = keyMatch?.groups?.suffix || "";
  if (sections[name][key] === undefined) {
    sections[name][key] = {};
  }
  const uiTable = sections[name][key];
  switch (suffix) {
    case "": {
      const tempValue = value.split(",");

      if (name === "TriggerCalls") {
        uiTable["use_in_event"] = tempValue[1];
        uiTable["returns"] = tempValue[2];
        tempValue.splice(0, 2);
      }
      tempValue.splice(0, 1);
      if (tempValue.length === 0) {
        break;
      }

      uiTable["arg"] = tempValue.map((v) => ({
        type: v,
      }));
      break;
    }
    case "_Defaults": {
      if (!uiTable["arg"]) {
        break;
      }
      const tempValue = value.split(",");

      tempValue.forEach((v, index) => {
        if (v !== "" && v !== "_") {
          uiTable["arg"][index]["default"] = v;
        }
      });
      break;
    }
    case "_Limits": {
      const tempValue = value.split(",");
      tempValue.splice(0, 2);
      tempValue.forEach((v, index) => {
        if (v !== "_") {
          if (index % 2 === 0) {
            uiTable["arg"][index]["max"] = v;
          } else {
            uiTable["arg"][index]["min"] = v;
          }
        }
      });
      break;
    }
    case "_Category":
      uiTable["category"] = value;
      break;
    case "_ScriptName":
      uiTable["script"] = value;
      break;
    case "_UseWithAI":
    case "_AIDefaults":
    default:
      break;
  }
};

const parseDefine = (
  sections: object,
  name: string,
  key: string,
  value: string
): any => {
  const tempValue = value.split(",").map((v) => v.trim());
  //   const tempValue = value.split(",").map((v) =>
  //     v
  //       .replace(/^["'`]|["'`]$/g, "")
  //       .trim()
  //       .replace(/\\\\/g, "\\")
  //   );
  let temp = {};
  // 根据section的不同，拆分value
  switch (name) {
    case "TriggerCategories":
      temp = {
        display: tempValue[0],
        icon: tempValue[1],
      };
      break;
    case "TriggerTypes":
      temp = {
        // TFT-only (1) or RoC and TFT (0)
        version: tempValue[0],
        // can be a global variable
        global: tempValue[1],
        // can be used with comparison operators
        comparison: tempValue[2],
        // string to display in the editor
        display: tempValue[3],
        // base type, used only for custom types
        baseType: tempValue[4] || "",
      };
      break;
    case "TriggerTypeDefaults":
      temp = {
        default: tempValue[0],
        display: tempValue[1],
      };
      break;
    case "TriggerParams":
      temp = {
        version: tempValue[0],
        // variable type
        type: tempValue[1],
        // used in script
        code: tempValue[2],
        display: tempValue[3],
      };
      break;
    case "AIFunctionStrings":
    case "DefaultTriggerCategories":
    case "DefaultTriggers":
      temp = value;
      break;
    default:
      break;
  }
  sections[name][key] = temp;
};

function readFile(fileContent: string, callback: Function): object {
  const sections: {
    [key: string]: any;
  } = {};
  let currentSection = "";

  const lines = fileContent.split(/[\r\n]+/g);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.match(/^\s*[;#\/\/]/)) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1);
      sections[currentSection] = {};
    } else if (line.includes("=")) {
      const [key, value = ""] = line.split("=");
      callback(currentSection, key, value);
    }
  }
  return sections;
}
