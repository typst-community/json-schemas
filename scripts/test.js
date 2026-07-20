const { execSync } = require("child_process");
const glob = require("glob");
const path = require("path");
const fs = require("fs");
const YAML = require("yaml");

const schemas = glob.sync("docs/*.schema.json");

let hasErrors = false;

// Convert YAML/TOML to JSON for testing
function convertToJson(filePath) {
  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath, "utf8");

  if (ext === ".json") {
    return JSON.parse(content);
  } else if (ext === ".yaml" || ext === ".yml") {
    return YAML.parse(content);
  } else if (ext === ".toml") {
    const TOML = require("smol-toml");
    return TOML.parse(content);
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

schemas.forEach((schema) => {
  const schemaName = path.basename(schema, ".schema.json");

  console.log(`\nTesting ${schemaName}...`);

  // Test valid examples
  const validFiles = glob.sync(`tests/${schemaName}/valid/*.{json,yaml,yml,toml}`);
  if (validFiles.length > 0) {
    validFiles.forEach((file) => {
      try {
        const data = convertToJson(file);
        const tempFile = `${file}.test.json`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));

        try {
          execSync(`bun ajv test -s ${schema} -d ${tempFile} --valid --spec=draft2020 -c ajv-formats`, {
            stdio: "inherit",
          });
          console.log(`  ✓ ${path.basename(file)}`);
        } finally {
          fs.unlinkSync(tempFile);
        }
      } catch (err) {
        console.error(`  ✗ ${path.basename(file)}: ${err.message}`);
        hasErrors = true;
      }
    });
  }

  // Test invalid examples
  const invalidFiles = glob.sync(`tests/${schemaName}/invalid/*.{json,yaml,yml,toml}`);
  if (invalidFiles.length > 0) {
    invalidFiles.forEach((file) => {
      try {
        const data = convertToJson(file);
        const tempFile = `${file}.test.json`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));

        try {
          execSync(`bun ajv test -s ${schema} -d ${tempFile} --invalid --spec=draft2020 -c ajv-formats`, {
            stdio: "inherit",
          });
          console.log(`  ✓ ${path.basename(file)} (correctly invalid)`);
        } finally {
          fs.unlinkSync(tempFile);
        }
      } catch (err) {
        console.error(`  ✗ ${path.basename(file)}: ${err.message}`);
        hasErrors = true;
      }
    });
  }
});

if (hasErrors) {
  console.error("\n✗ Some tests failed");
  process.exit(1);
} else {
  console.log("\n✓ All tests passed");
}
