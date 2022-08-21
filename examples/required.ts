import Fig from "../mod.ts";

const spec: Fig.Spec = {
  name: "deno",
  subcommands: [
    {
      name: "bench",
      options: [
        {
          name: "--unstable",
          isRequired: true,
        }
      ]
    }
  ]
}

Fig.run(spec)
