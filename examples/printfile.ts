import CLI from "../mod.ts";

CLI.run({
  name: "printfile",
  description: "Print the contents of a file",

  args: {
    name: "path",
  },

  options: [
    { name: "--stderr", description: "Print on stderr instead of stdout" },
    CLI.help, // opt-in `--help` option
  ],

  subcommands: [
    CLI.helpCommand, // Add `help` command
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
});
