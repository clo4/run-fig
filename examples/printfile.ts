import Fig from "../mod.ts";

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
