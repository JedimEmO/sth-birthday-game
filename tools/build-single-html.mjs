import * as esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await mkdir(dist, { recursive: true });

const result = await esbuild.build({
  entryPoints: [resolve(root, "src/main.ts")],
  bundle: true,
  minify: true,
  sourcemap: false,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  loader: {
    ".png": "dataurl"
  },
  define: {
    "process.env.NODE_ENV": '"production"'
  }
});

const script = result.outputFiles[0]?.text;

if (!script) {
  throw new Error("esbuild did not produce a script");
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <title>Sindre's Waffle Adventure</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #17171d;
      overscroll-behavior: none;
      touch-action: none;
      user-select: none;
    }

    #app {
      width: 100%;
      height: 100%;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>${script}</script>
</body>
</html>
`;

await writeFile(resolve(dist, "index.html"), html, "utf8");
console.log("Built dist/index.html");
