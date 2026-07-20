// Schema Repository Loader
// Uses modern JS patterns and avoids direct innerHTML where possible

document.addEventListener("DOMContentLoaded", initSchemaLoader);

// Repository configuration
const config = {
  owner: "typst-community",
  repo: "json-schemas",
  path: "docs",
  fileExtension: ".schema.json",
  baseUrl: "https://typst-community.github.io/json-schemas",
};

// Schema version mapping
const schemaVersions = new Map([
  ["draft-07", "Draft 07"],
  ["draft-06", "Draft 06"],
  ["draft-04", "Draft 04"],
  ["2019-09", "Draft 2019-09"],
  ["2020-12", "Draft 2020-12"],
]);

// Add API response caching at the top
const apiCache = new Map();

/**
 * Initialize the schema loader
 */
async function initSchemaLoader() {
  const schemasContainer = document.getElementById("schemas-container");
  const loader = document.getElementById("loader");

  try {
    const schemaFiles = await fetchSchemaFiles();
    await renderSchemaList(schemaFiles, schemasContainer);
  } catch (error) {
    renderError(error, schemasContainer);
  } finally {
    loader.style.display = "none";
  }
}

/**
 * Convert raw GitHub URL to GitHub Pages URL
 * @param {string} rawUrl - Raw GitHub URL
 * @returns {string} GitHub Pages URL
 */
function getGitHubPagesUrl(rawUrl) {
  // If it's already a GitHub Pages URL, return it as is
  if (rawUrl.includes(`${config.baseUrl}`)) {
    return rawUrl;
  }

  // Extract the file path from the raw URL
  const filePath = rawUrl.split(`/${config.owner}/${config.repo}/main/`)[1];
  if (!filePath) return rawUrl; // If pattern doesn't match, return original URL

  // Construct the GitHub Pages URL
  return `${config.baseUrl}/${filePath}`;
}

/**
 * Fetch schema files from GitHub repository
 * @returns {Promise<Array>} Array of schema files
 */
async function fetchSchemaFiles() {
  const { owner, repo, path, fileExtension } = config;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  if (apiCache.has(apiUrl)) {
    return apiCache.get(apiUrl);
  }

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid response format from GitHub API");
  }

  const schemaFiles = data.filter((file) => file.name.endsWith(fileExtension));
  if (schemaFiles.length === 0) {
    throw new Error(`No schema files found with extension ${fileExtension}`);
  }

  apiCache.set(apiUrl, schemaFiles);
  return schemaFiles;
}

/**
 * Determine the schema version from schema URL
 * @param {string} schemaUrl - Schema URL to analyze
 * @returns {string} Human-readable version
 */
function getSchemaVersion(schemaUrl) {
  if (!schemaUrl) return "Unknown";

  for (const [versionId, versionName] of schemaVersions.entries()) {
    if (schemaUrl.includes(versionId)) {
      return versionName;
    }
  }

  return "Custom";
}

/**
 * Render the list of schemas
 * @param {Array} schemaFiles - List of schema files from GitHub API
 * @param {HTMLElement} container - Container to render into
 */
async function renderSchemaList(schemaFiles, container) {
  container.innerHTML = "";

  const schemaPromises = schemaFiles.map(async (file) => {
    try {
      const schemaData = await fetchSchemaData(file.download_url);
      return { file, schemaData, error: null };
    } catch (error) {
      return { file, schemaData: null, error };
    }
  });

  const results = await Promise.all(schemaPromises);

  // Use DocumentFragment for better DOM performance
  const fragment = document.createDocumentFragment();
  results.forEach(({ file, schemaData, error }) => {
    const row = error
      ? createErrorRow(file.name, error.message)
      : createSchemaRow(file, schemaData);
    fragment.appendChild(row);
  });
  container.appendChild(fragment);
}

const schemaCache = new Map();

/**
 * Fetch and parse an individual schema file
 * @param {string} url - URL to fetch schema from
 * @returns {Promise<Object>} Parsed schema data
 */
async function fetchSchemaData(url) {
  if (schemaCache.has(url)) {
    return schemaCache.get(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch schema: ${response.status}`);
  }

  const data = await response.json();
  schemaCache.set(url, data);
  return data;
}

/**
 * Create a table row for a schema
 * @param {Object} file - File metadata from GitHub API
 * @param {Object} schemaData - Parsed schema data
 * @returns {HTMLTableRowElement} Table row element
 */
function createSchemaRow(file, schemaData) {
  const row = document.createElement("tr");

  // Convert GitHub raw URL to GitHub Pages URL
  const pagesUrl = getGitHubPagesUrl(file.download_url);

  // Schema name cell
  const nameCell = document.createElement("td");
  const nameTitle = document.createElement("strong");
  nameTitle.textContent = schemaData.title || file.name.replace(".schema.json", "");
  const nameDetails = document.createElement("small");
  nameDetails.textContent = file.name;
  nameCell.appendChild(nameTitle);
  nameCell.appendChild(document.createElement("br"));
  nameCell.appendChild(nameDetails);

  // Description cell
  const descriptionCell = document.createElement("td");
  descriptionCell.textContent = schemaData.description || "No description provided";

  // Actions cell
  const actionsCell = document.createElement("td");

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy URL";
  copyButton.style.minWidth = "80px"; // Prevents button jumping
  copyButton.addEventListener("click", () => {
    navigator.clipboard
      .writeText(pagesUrl)
      .then(() => {
        copyButton.textContent = "Copied!";
        setTimeout(() => (copyButton.textContent = "Copy URL"), 1200);
      })
      .catch(() => {
        // Fallback for older browsers
        copyButton.textContent = "Failed";
        setTimeout(() => (copyButton.textContent = "Copy URL"), 1200);
      });
  });

  actionsCell.appendChild(copyButton);
  // Append all cells to the row
  row.appendChild(nameCell);
  row.appendChild(descriptionCell);
  row.appendChild(actionsCell);

  return row;
}

/**
 * Create an error row for display
 * @param {string} fileName - Name of the file with error
 * @param {string} errorMessage - Error message to display
 * @returns {HTMLTableRowElement} Table row element
 */
function createErrorRow(fileName, errorMessage) {
  const row = document.createElement("tr");

  const nameCell = document.createElement("td");
  nameCell.textContent = fileName;

  const errorCell = document.createElement("td");
  errorCell.colSpan = 2;
  errorCell.textContent = `Error loading schema: ${errorMessage}`;

  row.appendChild(nameCell);
  row.appendChild(errorCell);

  return row;
}

/**
 * Render a general error message
 * @param {Error} error - The error object
 * @param {HTMLElement} container - Container to render into
 */
function renderError(error, container) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 3;
  cell.textContent = `Error loading schemas: ${error.message}. Make sure the repository is public and contains schema files.`;
  row.appendChild(cell);
  container.innerHTML = "";
  container.appendChild(row);

  console.error("Error fetching schemas:", error);
}
