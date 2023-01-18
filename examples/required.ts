import CLI from "../mod.ts";

const spec: CLI.Spec = {
  name: "deno",
  subcommands: [
    {
      name: "bench",
      options: [
        {
          name: "--unstable",
          isRequired: true,
        },
      ],
    },
  ],
};

CLI.run(spec);
