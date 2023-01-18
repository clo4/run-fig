import CLI from "../mod.ts";

CLI.run({
  name: "deno",
  subcommands: [
    {
      name: "bench",
      flags: [
        {
          name: "--unstable",
          isRequired: true,
        },
      ],
    },
  ],
});
