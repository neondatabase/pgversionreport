import { program } from "commander";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import { NodeHtmlMarkdown } from "node-html-markdown";

const CACHE_DIR = `${__dirname}/raw-latest`;
const BASE_URL = "https://www.postgresql.org/docs/release/";
const DELAY_MS = 1000;

program.version("1.0.0").description("PostgreSQL Release Notes Processor");

program
  .command("scrape-all")
  .description("Scrape and cache all release notes")
  .action(scrapeAllVersions);

program
  .command("scrape-version <version>")
  .description("Scrape and cache release notes for a specific version")
  .action(scrapeSpecificVersion);

program
  .command("process")
  .description("Process cached release notes and generate JSON")
  .action(processReleaseNotes);

program
  .command("format")
  .description("Generate a formatted JSON from processed release notes")
  .action(generateSummary);

program
  .command("cve")
  .description("Add CVE information to the formatted JSON")
  .action(addCVE);

program
  .command("update-links")
  .description("Update relative links to absolute links in the formatted JSON")
  .action(updateFormattedLinks);

const fetchPage = (url: string) =>
  fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.text();
  });

async function scrapeAllVersions() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });

    console.log("Fetching main release page...");
    const mainPageHtml = await fetchPage(BASE_URL);
    await saveToCacheFile("index.html", mainPageHtml);

    const versions = extractVersions(mainPageHtml);
    console.log(`Found ${versions.length} versions.`);

    for (const version of versions) {
      await scrapeSpecificVersion(version);
      await delay(DELAY_MS);
    }

    console.log("All versions scraped and cached successfully.");
  } catch (error) {
    console.error("Error scraping all versions:", error.message);
  }
}

async function scrapeSpecificVersion(version: string) {
  try {
    const url = `${BASE_URL}${version}/`;
    console.log(`Fetching version ${version}...`);
    const versionHtml = await fetchPage(url);
    await saveToCacheFile(`${version}.html`, versionHtml);
    console.log(`Version ${version} cached successfully.`);
  } catch (error) {
    console.error(`Error scraping version ${version}:`, error.message);
  }
}

function extractVersions(html: string) {
  const $ = cheerio.load(html);
  const versions: string[] = [];
  $("details.release-notes-list li a").each((_, element) => {
    versions.push($(element).text().trim());
  });
  return versions;
}

async function saveToCacheFile(filename: string, content: string) {
  const filePath = path.join(CACHE_DIR, filename);
  await fs.writeFile(filePath, content);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseReleaseNotes(directory: string) {
  const files = await fs.readdir(directory);
  const releaseData = [];

  function processText(text: string, baseUrl: string) {
    return text.replace(/href="([^"]+)"/g, (match, p1) => {
      if (!p1.startsWith('http') && !p1.startsWith('#')) {
        return `href="${baseUrl}${p1}"`;
      }
      return match;
    });
  }

  for (const file of files) {
    if (path.extname(file) === ".html" && file !== "index.html") {
      console.log("Processing", file);
      const filePath = path.join(directory, file);
      const content = await fs.readFile(filePath, "utf-8");
      const $ = cheerio.load(content);

      const version = $("#release-notes h2")
        .first()
        .text()
        .trim()
        .split(" ")
        .pop();

      $("a").each((_, element) => {
        if ($(element).text() === "§") {
          // Remove any a tags with the text equal to '§'
          $(element).remove();
        }
      });

      const baseUrl = `https://www.postgresql.org/docs/${version.split('.')[0]}/`;

      const releaseDate = $("p:contains('Release date:')")
        .text()
        .split(":")[1]
        .trim();

      const changes: string[] = [];

      $(".itemizedlist ul li.listitem").each((index, element) => {
        const processedHtml = processText($(element).html().trim(), baseUrl);
        const markdown = NodeHtmlMarkdown.translate(processedHtml);
        changes.push(markdown);
      });

      releaseData.push({
        version,
        releaseDate,
        changes,
      });
    }
  }

  return releaseData;
}

function categorizeChanges(changes: string[], is_major: boolean = false) {
  const categories: { [key: string]: string[] } = {
    performance: [],
    security: [],
    features: [],
    bugs: [],
  };

  const keywords = {
    security: ["cve"],
    performance: [
      "performance",
      "speed",
      "faster",
      "optimization",
      "improve",
      "reduce",
      "enhance",
      "boost",
      "accelerate",
      "better",
      "efficient",
    ],
    bugs: [
      "fix",
      "issue",
      "crash",
      "overflow",
      "error",
      "bug",
      "problem",
      "flaw",
      "mistake",
      "patch",
      "repair",
      "resolve",
    ],
    features: [
      "new feature",
      "added",
      "introduced",
      "now supports",
      "new option",
      "new parameter",
      "new setting",
      "new command",
      "new function",
      "new syntax",
      "new capability",
      "new behavior",
      "new flag",
      "new directive",
      "new method",
      "new property",
      "new API",
      "new interface",
      "new class",
      "new module",
      "new package",
      "new library",
      "new framework",
      "new tool",
      "new utility",
      "new plugin",
      "new extension",
      "new integration",
      "new support",
      "new compatibility",
      "new standard",
      "new protocol",
      "new format",
      "new language",
      "new technology",
      "new system",
      "new service",
      "new application",
      "new feature",
      "new enhancement",
      "new improvement",
      "new addition",
      "new change",
      "new update",
      "new upgrade",
      "new version",
    ],
  };

  changes.forEach((change) => {
    const lowerChange = change.toLowerCase();
    let categorized = false;

    for (const [category, words] of Object.entries(keywords)) {
      if (!is_major && (category == "features" || category == "performance")) {
        break;
      }
      if (words.some((word) => lowerChange.includes(word))) {
        if (category == "security") {
          console.log(category, change);
        }
        categories[category].push(change);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      categories.bugs.push(change);
    }
  });

  return categories;
}

async function processReleaseNotes() {
  try {
    const releaseData = await parseReleaseNotes(CACHE_DIR);

    const processedData = releaseData.map((release) => {
      console.log(release.version, release.version.endsWith(".0"));
      return {
        version: release.version,
        releaseDate: release.releaseDate,
        categories: categorizeChanges(
          release.changes,
          release.version.endsWith(".0")
        ),
      };
    });

    const outputFile = path.join(__dirname, "release_notes.json");
    await fs.writeFile(outputFile, JSON.stringify(processedData, null, 2));
    console.log(`Release notes processed and saved to ${outputFile}`);
  } catch (error) {
    console.error("Error processing release notes:", error);
  }
}

async function generateSummary() {
  try {
    const releaseNotesPath = path.join(__dirname, "release_notes.json");
    const releaseNotes = JSON.parse(
      await fs.readFile(releaseNotesPath, "utf-8")
    );

    const summary: {
      versionDates: { [key: string]: string };
      bugs: any[];
      features: any[];
      performance: any[];
      security: any[];
    } = {
      versionDates: {},
      bugs: [],
      features: [],
      performance: [],
      security: [],
    };

    releaseNotes.forEach((release: any) => {
      const version = release.version;
      const releaseDate = release.releaseDate;

      // Add version and release date to versionDates
      summary.versionDates[version] = releaseDate;

      // Process security issues
      release.categories.security.forEach((item: string) => {
        const security = parseSecurityItem(item, version);
        if (security) summary.security.push(security);
      });

      // Process features
      release.categories.features.forEach((item: string) => {
        const feature = parseFeatureItem(item, version);
        if (feature) summary.features.push(feature);
      });

      // Process performance improvements
      release.categories.performance.forEach((item: string) => {
        const improvement = parsePerformanceItem(item, version);
        if (improvement) summary.performance.push(improvement);
      });

      // Process 'bug' items
      release.categories.bugs.forEach((item: string) => {
        const bug = parseBugItem(item, version);
        if (bug) summary.bugs.push(bug);
      });
    });

    const summaryFile = path.join(__dirname, "release_notes_formatted.json");
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`Summary generated and saved to ${summaryFile}`);
  } catch (error) {
    console.error("Error generating summary:", error);
  }
}

async function addCVE() {
  try {
    // Read the CVE data from the CSV file
    const CVEAPI = "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=";

    // Read the formatted release notes
    const releaseNotesPath = path.join(
      __dirname,
      "release_notes_formatted.json"
    );
    const releaseNotesFormatted = JSON.parse(
      await fs.readFile(releaseNotesPath, "utf-8")
    );
    // For each CVE in release notes, query the API and save the data
    for (const security of releaseNotesFormatted.security) {

      console.log(`${security.cve}`);
      if (!("metrics" in security)) {
        console.log(`Querying CVE API`);
        await delay(10000);
        const cveDataText = await fetchPage(CVEAPI + security.cve);
        const cveData = JSON.parse(cveDataText);
        if (cveData && cveData.vulnerabilities && cveData.totalResults == 1) {
          console.log(
            `Found ${JSON.stringify(cveData.vulnerabilities[0].cve.metrics)}`
          );
          security.metrics = cveData.vulnerabilities[0].cve.metrics;
          security.severity = security.metrics.cvssMetricV30
            ? security.metrics.cvssMetricV30[0].cvssData.baseSeverity
            : security.metrics.cvssMetricV31
            ? security.metrics.cvssMetricV31[0].cvssData.baseSeverity
            : security.metrics.cvssMetricV2
            ? security.metrics.cvssMetricV2[0].baseSeverity
            : "None";
          security.impactScore = security.metrics.cvssMetricV30
            ? security.metrics.cvssMetricV30[0].impactScore
            : security.metrics.cvssMetricV31
            ? security.metrics.cvssMetricV31[0].impactScore
            : security.metrics.cvssMetricV2
            ? security.metrics.cvssMetricV2[0].impactScore
            : 0;

          // Save the enriched summary
          const summaryFile = path.join(
            __dirname,
            "release_notes_formatted.json"
          );
          await fs.writeFile(
            summaryFile,
            JSON.stringify(releaseNotesFormatted, null, 2)
          );
          console.log(
            `Summary enriched with cve data and saved to ${summaryFile}`
          );
        }
      } else {

        console.log(`Just adding severity and impact score`);
        security.severity = security.metrics.cvssMetricV30
          ? security.metrics.cvssMetricV30[0].cvssData.baseSeverity
          : security.metrics.cvssMetricV31
          ? security.metrics.cvssMetricV31[0].cvssData.baseSeverity
          : security.metrics.cvssMetricV2
          ? security.metrics.cvssMetricV2[0].baseSeverity
          : "None";
        security.impactScore = security.metrics.cvssMetricV30
          ? security.metrics.cvssMetricV30[0].impactScore
          : security.metrics.cvssMetricV31
          ? security.metrics.cvssMetricV31[0].impactScore
          : security.metrics.cvssMetricV2
          ? security.metrics.cvssMetricV2[0].impactScore
          : 0;
      }
      // Save the enriched summary
      const summaryFile = path.join(
        __dirname,
        "release_notes_formatted.json"
      );
      await fs.writeFile(
        summaryFile,
        JSON.stringify(releaseNotesFormatted, null, 2)
      );
      console.log(
        `Summary enriched with cve data and saved to ${summaryFile}`
      );
    }
  } catch (error) {
    console.error("Error adding CVE information:", error);
  }
}

function extractContributors(item: string): string[] {
  // Look for the last set of parentheses that doesn't contain a URL or start with CVE
  const matches = item.match(/[^\]]\(([^()]+)\)(?:\n|$)/);
  if (matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (!match.includes("http") && !match.includes("www.") && !match.includes("CVE-")) {
        return match.trim().split(", ");
      }
    }
  }
  return [];
}

function extractTitleDescription(item: string): { title: string; description: string } {
  const titleEnd = item.indexOf("\n");
  // Grab the first line (the title) and remove the contributors in parentheses
  const title =
    titleEnd > 0
      ? item
          .slice(0, titleEnd)
          .trim()
          .replace(/ \([^\)]+\)$/, "")
      : item.replace(/ \([^\)]+\)$/, "");
  const description = titleEnd > 0 ? item.slice(titleEnd + 1).trim() : "";
  return { title, description };
}

function parseSecurityItem(item: string, version: string) {
  const { title, description } = extractTitleDescription(item);
  const cveMatch = item.match(/CVE-\d{4}-\d+/);
  const cve = cveMatch ? cveMatch[0] : null;
  const contributors = extractContributors(item);

  return {
    cve,
    title,
    description,
    fixedIn: version,
    contributors,
  };
}

function parseBugItem(item: string, version: string) {
  const { title, description } = extractTitleDescription(item);
  const contributors = extractContributors(item);
  const significant =
    item.toLowerCase().includes("significant") ||
    item.toLowerCase().includes("major");

  return {
    title,
    description,
    fixedIn: version,
    significant,
    contributors,
  };
}

function parseFeatureItem(item: string, version: string) {
  const contributors = extractContributors(item);
  const { title, description } = extractTitleDescription(item);
  const significant =
    item.toLowerCase().includes("significant") ||
    item.toLowerCase().includes("major");

  return {
    title,
    description,
    sinceVersion: version,
    significant,
    contributors,
  };
}

function parsePerformanceItem(item: string, version: string) {
  const contributors = extractContributors(item);
  const { title, description } = extractTitleDescription(item);
  const significant =
    item.toLowerCase().includes("significant") ||
    item.toLowerCase().includes("major");

  return {
    title,
    description,
    sinceVersion: version,
    significant,
    contributors,
  };
}

async function updateFormattedLinks() {
  try {
    const filePath = path.join(__dirname, "release_notes_formatted.json");
    const data = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(data);

    const updateLinks = (text: string, version: string) => {
      // Use a default version if not provided
      const effectiveVersion = version || '0';
      const baseUrl = `https://www.postgresql.org/docs/${effectiveVersion.split('.')[0]}/`;
      return text.replace(/\(([^)]+\.html[^)]*)\)/g, (match, p1) => {
        if (!p1.startsWith('http')) {
          return `(${baseUrl}${p1})`;
        }
        return match;
      });
    };
  
    // Kill the links but keep the text using regex groups
    const killLinks = (text: string) => {
      return text.replace(/\(([^)]+\.html[^)]*)\)/g, (match, p1) => {
        return p1 ? '' : match;
      });
    };

    const categories = ['bugs', 'features', 'performance', 'security'];
    categories.forEach(category => {
      if (json[category] && Array.isArray(json[category])) {
        json[category] = json[category].map(item => {
          if (typeof item === 'object') {
            const version = item.fixedIn || item.sinceVersion || '0';
            return {
              ...item,
              title: item.title ? killLinks(item.title) : item.title,
              description: item.description ? updateLinks(item.description, version) : item.description
            };
          }
          return item;
        });
      }
    });

    await fs.writeFile(filePath, JSON.stringify(json, null, 2));
    console.log(`Updated links in ${filePath}`);
  } catch (error) {
    console.error('Error updating links:', error);
  }
}

program.parse(process.argv);
