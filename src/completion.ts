import { Arg, Generator, Option, Spec, Subcommand } from "./types.ts";
import { makeArray } from "./util.ts";

export const JSON_START = "----- Begin JSON -----\n";
export const JSON_END = "\n----- End JSON -----";

export const completion: Subcommand = {
  name: "completion",
  description: "Generate Fig completions",
  subcommands: [
    {
      name: "fig",
      description: "Generates Fig completions",
      async action() {
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
      async action({ path, args: [lookupPathString, tokensBase64] }) {
        const tokens = JSON.parse(atob(tokensBase64));
        const generator = findGenerator(lookupPathString, path[0]);
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
      console.log("foundArg", foundArg)
      if (!foundArg) {
        throw new Error(`No arg at index ${index} (${lookupPathString})`);
      }
      expect = "g";
      arg = foundArg;
      continue;
    }

    if (letter === "g") {
      const foundGenerator = makeArray(arg?.generators)?.[index];
      console.log("foundGenerator", makeArray)
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
