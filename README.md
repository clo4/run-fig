# CLI4

> I've written a few other CLI libraries over the years.

Save dev time by using a declarative schema to define your CLI. Save CPU time
because it's _fast_.

This library in three points:

- **Speed:** beats [Cliffy Command](https://cliffy.io) and
  [Deno's own std/flags](https://deno.land/std/flags) in benchmarks
- **Discoverable:** once you read the example below, you can figure it out on
  your own
- **Declarative:** define `options`, `args`, and `subcommands` in a simple
  structure
- **Control:** you get correct behavior by default, but can opt into the builtin
  features that you want as you need them

The format is heavily based on Fig's CLI spec. There's
[already nearly 600 commands](https://github.com/withfig/autocomplete) built
using this schema. It has proven to be extremely easy to write, read, and
maintain.

<br>

---

**This library is an experiment right now.** It has no type inference, and a
very minimal public API.

Use [Cliffy](https://cliffy.io) if you want to build a production-ready CLI
running in Deno right now. It's great!

---

<br>

```ts
import CLI from "https://deno.land/x/cli4@0.1.0/mod.ts";

CLI.run({
  name: "printfile",
  description: "Print the contents of a file",

  args: {
    name: "path",
    template: "filepaths",
  },

  options: [
    { name: "--stderr", description: "Print on stderr instead of stdout" },
    CLI.help, // Opt-in `--help` option
  ],

  subcommands: [
    CLI.helpCommand, // Add a `help` command too!
  ],

  async action({ args: [path], options }) {
    const text = await Deno.readTextFile(path);
    if (options.has("--stderr")) {
      console.error(text);
    } else {
      console.log(text);
    }
    // Returning a status code is optional but recommended.
    // 0 = success, 1 = fail
    return 0;
  },
});
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
