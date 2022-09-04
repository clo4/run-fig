import Fig from "../mod.ts";

const warning = (msg: string) =>
  console.warn("%cwarning:", "color: orange", msg);
const error = (msg: string) => console.warn("%cerror:", "color: red", msg);

const spec: Fig.Spec = {
  name: "deps_lint",
  description: "Lint dependencies",
  // Both flags are required because the folders must be provided,
  // but the order is both unimportant and hard to remember. Instead,
  // it's easier to provide both as flags.
  options: [
    {
      name: "--deps",
      args: { name: "folder", template: "folders" },
      isRequired: true,
    },
    {
      name: "--src",
      args: { name: "folder", template: "folders" },
      isRequired: true,
    },
  ],
  action({ args: [depsFolderPath] }) {
    // TODO: read every file in src, save only import statements, extract
    // the file paths
    for (const entry of Deno.readDirSync(depsFolderPath)) {
      if (!entry.isFile) {
        error("expected only files, not folders");
        continue;
      }
    }
  },
};

Fig.run(spec);
