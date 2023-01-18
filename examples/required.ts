import CLI from "../mod.ts";

CLI.run({
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
});
