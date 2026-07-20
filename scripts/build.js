import fs from "fs";
import path from "path";
import YAML from "yaml";

const schemas = ["hayagriva", "typst"];
const schemasDir = path.join(__dirname, "..", "schemas");
const docsDir = path.join(__dirname, "..", "docs");

schemas.forEach((schema) => {
  const yamlPath = path.join(schemasDir, `${schema}.yaml`);
  const jsonPath = path.join(docsDir, `${schema}.schema.json`);

  try {
    const yamlContent = fs.readFileSync(yamlPath, "utf-8");
    const jsonContent = YAML.parse(yamlContent);

    fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2) + "\n");
    console.log("Converted", yamlPath, "to", jsonPath);
  } catch (err) {
    console.error("Error processing", schema, ":", err);
    process.exit(1);
  }
});
