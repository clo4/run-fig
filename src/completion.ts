import { Arg, Generator, Option, Spec, Subcommand } from "./types.ts";
import { isArray, makeArray } from "./util.ts";

export const JSON_START = "----- Begin JSON -----\n";
export const JSON_END = "\n----- End JSON -----";

export const completion: Subcommand = {
  name: "completion",
  description: "Generate Fig completions",
  subcommands: [
    {
      name: "fig",
      description: "Generates Fig completions",
      action({ path: [root] }) {
        const text = generateObjectCode(root, { path: [] });
        console.log(`const spec = ${text}; export default spec`);
      },
    },
    {
      name: "run-generator",
      description: "Runs a generator",
      args: [
        {
          name: "lookup-path",
          description: `The lookup path of the generator`,
        },
        {
          name: "tokens",
          description: "Base-64 encoding of a JSON array of strings",
        },
      ],
      async action({ path: [root], args: [lookupPathString, tokensBase64] }) {
        const tokens = JSON.parse(atob(tokensBase64));
        const generator = findGenerator(lookupPathString, root);
        if (!generator.custom) {
          throw new Error("No `custom` property on generator");
        }
        const suggestions = await generator.custom(tokens);
        const json = JSON.stringify(suggestions, null, 2);
        console.log(`${JSON_START}${json}${JSON_END}`);
      },
    },
  ],
};

export function findGenerator(lookupPathString: string, root: Spec): Generator {
  const parts = lookupPathString.split(",");
  let expect: "soa" | "a" | "g" = "soa";
  let cmd: Subcommand = root;
  let option: Option | null = null;
  let arg: Arg | null = null;
  let generator;
  for (const part of parts) {
    const [letter, numberString] = part.split(":");

    if (!letter || letter.length !== 1) {
      throw new Error(`Expected a single letter, found ${letter}`);
    }

    const index = Number(numberString);
    if (
      !numberString || !Number.isFinite(index) || !Number.isInteger(index) ||
      index < 0
    ) {
      throw new Error(`Expected an integer, found ${numberString}`);
    }

    if (!expect.includes(letter)) {
      throw new Error(`Expected ${expect}, found ${letter}`);
    }

    if (letter === "s") {
      const foundCommand = cmd.subcommands?.[index];
      if (!foundCommand) {
        throw new Error(
          `No subcommand at index ${index} (${lookupPathString})`,
        );
      }
      cmd = foundCommand;
      continue;
    }

    if (letter === "o") {
      const foundOption = cmd.options?.[index];
      if (!foundOption) {
        throw new Error(`No option at index ${index} (${lookupPathString})`);
      }
      option = foundOption;
      expect = "a";
      continue;
    }

    if (letter === "a") {
      const foundArg = makeArray((option || cmd).args)?.[index];
      console.log("foundArg", foundArg);
      if (!foundArg) {
        throw new Error(`No arg at index ${index} (${lookupPathString})`);
      }
      expect = "g";
      arg = foundArg;
      continue;
    }

    if (letter === "g") {
      const foundGenerator = makeArray(arg?.generators)?.[index];
      console.log("foundGenerator", makeArray);
      if (!foundGenerator) {
        throw new Error(`No generator at index ${index} (${lookupPathString})`);
      }
      generator = foundGenerator;
      break;
    }
  }
  if (!generator) {
    throw new Error(
      `Expected a generator, but found nothing (${lookupPathString})`,
    );
  }
  return generator;
}

function kv(key: string, value: unknown): string {
  return `${key}:${value}`;
}

function objectify(arr: string[]): string {
  return `{${arr.join(",")}}`;
}

function arrayify(arr: string[]): string {
  return `[${arr.join(",")}]`;
}

function kvObject(object: Record<string, unknown>): string {
  const keyValues = Object.entries(object).map(([key, value]) =>
    kv(key, JSON.stringify(value))
  );
  return objectify(keyValues);
}

function combineObjectKeyValuePairs(
  parts: [key: string, literalValue: string][],
) {
  return objectify(parts.map(([key, value]) => kv(key, value)));
}

function generateObjectCode(inputObject: Subcommand | Arg | Option, init: {
  path: string[];
}): string {
  const objectParts: [key: string, value: string][] = [];
  for (const [objectKey, objectValue] of Object.entries(inputObject)) {
    if (objectKey === "action") {
      continue;
    }
    if (objectKey === "subcommands") {
      const subcommandStrings = (objectValue as Subcommand[])
        .map((subcommand, index) =>
          generateObjectCode(subcommand, {
            path: [...init.path, `s:${index}`],
          })
        );
      objectParts.push([objectKey, arrayify(subcommandStrings)]);
      continue;
    }
    if (objectKey === "options") {
      const optionStrings = (objectValue as Option[])
        .map((option, index) =>
          generateObjectCode(option, {
            path: [...init.path, `o:${index}`],
          })
        );
      objectParts.push([objectKey, arrayify(optionStrings)]);
      continue;
    }
    if (objectKey === "args") {
      if (isArray(objectValue)) {
        const argStrings = (objectValue as Arg[])
          .map((arg, index) =>
            generateObjectCode(arg, {
              path: [...init.path, `a:${index}`],
            })
          );
        objectParts.push([objectKey, arrayify(argStrings)]);
      } else {
        const argString = generateObjectCode(objectValue as Arg, {
          path: [...init.path, `a:0`],
        });
        objectParts.push([objectKey, argString]);
      }
      continue;
    }
    if (objectKey === "generators") {
      if (isArray(objectValue)) {
        const generatorStrings = (objectValue as Generator[])
          .map((arg, index) =>
            generateObjectCode(arg, {
              path: [...init.path, `g:${index}`],
            })
          );
        objectParts.push([objectKey, arrayify(generatorStrings)]);
      } else {
        const generatorString = generateObjectCode(objectValue as Generator, {
          path: [...init.path, `g:0`],
        });
        objectParts.push([objectKey, generatorString]);
      }
      continue;
    }
    if (objectKey === "custom") {
      const lookupPath = init.path.join(",");
      // deno-fmt-ignore
      const fn = `
async (tokens, executeShellCommand) => {
  const tokensJson = JSON.stringify(tokens.slice(1));
  const tokensB64 = btoa(tokensJson);
  const out = await executeShellCommand(
    \`${Deno.execPath()} run --quiet --no-prompt --unstable --no-check --allow-all '${Deno.mainModule}' completion run-generator ${lookupPath} '\${tokensB64}'\`,
  );
  const begin = out.indexOf(${JSON.stringify(JSON_START)});
  const end = out.lastIndexOf(${JSON.stringify(JSON_END)});
  const beginLogText = out.slice(0, begin);
  const endLogText = out.slice(end + ${JSON.stringify(JSON_START.length)});
  if (beginLogText) console.log(beginLogText);
  if (endLogText) console.log(endLogText);
  const jsonOut = out.slice(begin + ${JSON.stringify(JSON_END.length)}, end + 1).trim();
  return JSON.parse(jsonOut);
}`.trim();
      objectParts.push([objectKey, fn]);
      continue;
    }
    if (objectKey === "parserDirectives") {
      objectParts.push([objectKey, kvObject(objectValue)]);
      continue;
    }
    // default behavior, just the key and json-stringify the value
    objectParts.push([objectKey, JSON.stringify(objectValue)]);
  }
  return combineObjectKeyValuePairs(objectParts);
}
