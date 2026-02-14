/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "mtg-crucible",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const renderer = new sst.aws.Function("Renderer", {
      handler: "functions/api.handler",
      runtime: "nodejs20.x",
      timeout: "30 seconds",
      memory: "2048 MB",
      architecture: "x86_64",
      url: true,
      copyFiles: [{ from: "assets", to: "assets" }],
      environment: {
        ASSETS_DIR: "assets",
      },
      nodejs: {
        install: ["@napi-rs/canvas", "@napi-rs/canvas-linux-x64-gnu"],
        esbuild: {
          external: ["@napi-rs/canvas"],
        },
      },
    });

    return { url: renderer.url };
  },
});
