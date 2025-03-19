export function jassToJson(fileContent: string): object {
  // const fileContent = await fs.promises.readFile(filePath, "utf8");

  let library: {
    [key: string]: any;
  } = {};

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

  const lines = fileContent.split(/[\r\n]+/g);

  let inGlobals = false;
  for (const rawLine of lines) {
    const line: string = clean(rawLine);
    if (
      line.startsWith("//") ||
      line.trim() === "" ||
      line.startsWith("private")
    ) {
      continue;
    }
    let match;
    let symbol;
    if (inGlobals) {
      if (line.includes("endglobals")) {
        inGlobals = false;
        continue;
      }
      match = processGlobalDefinition(line);
      symbol = "global";
    } else {
      if (line.includes("globals")) {
        inGlobals = true;
        continue;
      }
      if (TYPE_DEFINITION.test(line)) {
        match = processTypeDefinition(line);
        symbol = "type";
      } else if (NATIVE_DEFINITION.test(line)) {
        match = processNativeDefinition(line);
        symbol = "native";
      } else if (FUNCTION_DEFINITION.test(line)) {
        match = processFunctionDefinition(line);
        symbol = "function";
      }
    }

    if (!match) continue;
    library[match.name] = match;
    library[match.name]["symbol"] = symbol;
  }

  return library;
}
