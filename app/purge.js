import { PurgeCSS } from "purgecss";
import fs from "fs";

(async () => {
  const purgeCSSResults = await new PurgeCSS().purge({
    content: ["src/**/*.tsx", "src/**/*.ts", "index.html"],
    css: ["src/index.css"],
  });

  if (purgeCSSResults[0] && purgeCSSResults[0].css) {
    fs.writeFileSync("src/index.cleaned.css", purgeCSSResults[0].css);
    console.log("Safely purged CSS!");
  } else {
    console.error("PurgeCSS failed to return CSS");
  }
})();
