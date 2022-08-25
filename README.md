# Run a Fig spec as a CLI

An experimental JavaScript library (Deno) for building fast command-line tools.
In three points:

- **Speed:** beats [Cliffy Command](https://cliffy.io) and
  [Deno's own std/flags](https://deno.land/std/flags) in benchmarks
- **Discoverable:** once you read the example below, you can figure it out on
  your own
- **Declarative:** define `options`, `args`, and `subcommands` in a simple
  structure

There's
[already a repository of over 400 commands](https://github.com/withfig/autocomplete)
built using this schema. It's proven to be extremely easy to write, read, and
maintain.

---

**This library is an experiment.** It has no type inference, and a very minimal
public API.

Use [Cliffy](https://cliffy.io) if you want to build a production-ready CLI
running in Deno right now. It's great!

---

```ts
import Fig from "https://denopkg.com/SeparateRecords/run-fig/mod.ts";

export const spec: Fig.Spec = {
  name: "printfile",
  description: "Print the contents of a file",

  args: {
    name: "path",
    template: "filepaths",
  },

  options: [
    { name: "--stderr", description: "Print on stderr instead of stdout" },
    Fig.help, // opt-in `--help` option
  ],

  subcommands: [
    Fig.helpCommand, // Add `help` command
  ],

  async action({ args: [path], options }) {
    const text = await Deno.readTextFile(path);
    if (options.has("--stderr")) {
      console.error(text);
    } else {
      console.log(text);
    }
    return 0;
  },
};

Fig.run(spec);
```

```console
$ deno run examples/printfile.ts --help
Print the contents of a file

Usage:
  printfile [flags] <path>

Commands:
  help        Print a help message

Flags:
  --stderr    Print on stderr instead of stdout

Global flags:
  -h, --help  Print a help message
```

<br>

## 🧱 Args, options, subcommands

- **`subcommands`** are the functions you can invoke
- **`args`** are inputs to your program, like function parameters
- **`options`** are _modifiers_ that let you change how it executes

## 📄 The Fig Spec

To make a CLI, you'll make a `Fig.Spec`. The spec is the top-level command. <br>
Subcommands are the same as a spec, but can have more than one name!

```ts
const spec: Fig.Spec = {
  name: "deno",
  options: [
    { name: "--unstable", isPersistent: true },
    Fig.help,
  ],
  subcommands: [
    {
      name: "run",
      args: { name: "command", isVariadic: true },
    },
    {
      name: "doc",
      args: [
        { name: "source" },
        { name: "filter" },
      ],
    }
    Fig.helpCommand,
  ]
}
```

## 🎬 Actions

All commands have an `action` property. When you use a command, it runs the
`action`.

Actions take a bag of properties. These are the most useful, but there are more.

```ts
const spec: Fig.Spec = {
  name: "example",
  action({
    args, // Array of arguments
    options, // Methods to retrieve option data
    error, // Print error message
    help, // Generate help text
  }) {
    // ...
  },
};
```

## 🧪 Test your CLI

Fig includes a test suite you can integrate into your Deno tests.

```ts
import Fig, { testSpec } from "https://denopkg.com/SeparateRecords/run-fig/testing.ts";
import { spec } from "./cli.ts";

Deno.test("CLI spec is valid", testSpec(spec));
```

## 🏃 Keep your CLI fast as it grows

As you import more complex modules and your module graph grows larger, you'll
notice that your program becomes slower to start up over time. This is normal
for any JS runtime, but slow startup is a bad user experience!

Dynamic imports solve this. Keep your CLI entrypoint file _entirely separate_
from everything else using dynamic imports in your actions. Your spec file
should only top-level import the things you're likely to need immediately (such
as spinners, prompts).

```ts
import Fig from "./deps/fig.ts";

const spec: Fig.Spec = {
  // ...
  async action() {
    const logic = await import("./src/logic.ts");
    await logic.run();
  },
};

Fig.run(spec);
```

## ⏳ Future features

There is no timeline for these, but they will be implemented.

- Built-in, first-class Fig completions
- Seamless parser-generator
- Improved type-safety and inference
- Benchmark data
