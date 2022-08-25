import { build, emptyDir } from "https://deno.land/x/dnt@0.30.0/mod.ts";
import { version } from "../mod.ts";

const dist = "./dist";

await emptyDir(dist);

await build({
  entryPoints: ["./mod.ts"],
  outDir: dist,
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  typeCheck: false,
  package: {
    // package.json properties
    name: "run-fig",
    version: version,
    description: "Run a Fig spec as a CLI",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/username/repo.git",
    },
    bugs: {
      url: "https://github.com/username/repo/issues",
    },
  },
});

// post build steps
Deno.copyFileSync("LICENSE", `${dist}/LICENSE`);
Deno.copyFileSync("README.md", `${dist}/README.md`);
