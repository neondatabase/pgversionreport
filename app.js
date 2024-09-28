#!/usr/bin/env node

const { program } = require("commander");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const path = require("path");
const { NodeHtmlMarkdown } = require("node-html-markdown");

const CACHE_DIR = "raw-latest";
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

async function scrapeSpecificVersion(version) {
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

async function fetchPage(url) {
  const response = await axios.get(url);
  return response.data;
}

function extractVersions(html) {
  const $ = cheerio.load(html);
  const versions = [];
  $("ul.release-notes-list li a").each((index, element) => {
    versions.push($(element).text().trim());
  });
  return versions;
}

async function saveToCacheFile(filename, content) {
  const filePath = path.join(CACHE_DIR, filename);
  await fs.writeFile(filePath, content);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processReleaseNotes() {
  try {
    const releaseData = await parseReleaseNotes(CACHE_DIR);

    const processedData = releaseData.map((release) => ({
      version: release.version,
      releaseDate: release.releaseDate,
      categories: categorizeChanges(release.changes),
    }));

    const outputFile = path.join(__dirname, "release_notes.json");
    await fs.writeFile(outputFile, JSON.stringify(processedData, null, 2));
    console.log(`Release notes processed and saved to ${outputFile}`);
  } catch (error) {
    console.error("Error processing release notes:", error);
  }
}

async function parseReleaseNotes(directory) {
  const files = await fs.readdir(directory);
  const releaseData = [];

  for (const file of files) {
    if (path.extname(file) === ".html" && file !== "index.html") {
      const filePath = path.join(directory, file);
      const content = await fs.readFile(filePath, "utf-8");
      const $ = cheerio.load(content);

      const version = $("#release-notes h2")
        .first()
        .text()
        .trim()
        .split(" ")
        .pop();

      const releaseDate = $("p:contains('Release date:')")
        .text()
        .split(":")[1]
        .trim();

      const items = [];

      $(".itemizedlist ul li.listitem").each((index, element) => {
        const text = $(element).html().trim();
        items.push(parseInlineFormatting(text));
      });

      releaseData.push({
        version,
        releaseDate,
        changes: items,
      });
    }
  }

  return releaseData;
}

function parseInlineFormatting(text) {
  return NodeHtmlMarkdown.translate(text);
}

function categorizeChanges(changes) {
  const categories = {
    performance: [],
    security: [],
    features: [],
    other: [],
  };

  const keywords = {
    performance: ["performance", "speed", "faster", "optimization"],
    security: ["security", "vulnerability", "CVE", "exploit"],
    features: ["new feature", "added", "introduced", "now supports"],
  };

  changes.forEach((change) => {
    const lowerChange = change.toLowerCase();
    let categorized = false;

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some((word) => lowerChange.includes(word))) {
        categories[category].push(change);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      categories.other.push(change);
    }
  });

  return categories;
}

async function processReleaseNotes() {
  try {
    const releaseData = await parseReleaseNotes(CACHE_DIR);

    const processedData = releaseData.map((release) => ({
      version: release.version,
      releaseDate: release.releaseDate,
      categories: categorizeChanges(release.changes),
    }));

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

    const summary = {
      versionDates: {},
      bugs: [],
      features: [],
      performanceImprovements: [],
    };

    releaseNotes.forEach((release) => {
      const version = release.version;
      const releaseDate = release.releaseDate;

      // Add version and release date to versionDates
      summary.versionDates[version] = releaseDate;

      // Process security issues (bugs)
      release.categories.security.forEach((item) => {
        const bug = parseBugItem(item, version);
        if (bug) summary.bugs.push(bug);
      });

      // Process features
      release.categories.features.forEach((item) => {
        const feature = parseFeatureItem(item, version);
        if (feature) summary.features.push(feature);
      });

      // Process performance improvements
      release.categories.performance.forEach((item) => {
        const improvement = parsePerformanceItem(item, version);
        if (improvement) summary.performanceImprovements.push(improvement);
      });

      // Process 'other' items as features
      release.categories.other.forEach((item) => {
        const feature = parseFeatureItem(item, version);
        if (feature) summary.features.push(feature);
      });
    });

    const summaryFile = path.join(__dirname, "release_notes_formatted.json");
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`Summary generated and saved to ${summaryFile}`);
  } catch (error) {
    console.error("Error generating summary:", error);
  }
}

function extractContributor(item) {
  // Look for the last set of parentheses that doesn't contain a URL
  const matches = item.match(/[^\]]\(([^()]+)\)(?:\n|$)/);
  if (matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (!match.includes("http") && !match.includes("www.")) {
        return match.trim();
      }
    }
  }
  return null;
}

function extractTitleDescription(item) {
  const titleEnd = item.indexOf("\n");
  // Grab the first line (the title) and remove the contributor in parentheses
  const title = titleEnd > 0 ? item.slice(0, titleEnd).trim().replace(/ \([^\)]+\)$/, '') : item.replace(/ \([^\)]+\)$/, '');
  const description = titleEnd > 0 ? item.slice(titleEnd + 1).trim() : "";
  return { title, description };
}

function parseBugItem(item, version) {
  const { title, description } = extractTitleDescription(item);
  const cveMatch = item.match(/CVE-\d{4}-\d+/);
  const cve = cveMatch ? cveMatch[0] : null;
  const contributor = extractContributor(item);

  return {
    cve,
    title,
    description,
    fixedIn: version,
    contributor,
  };
}

function parseFeatureItem(item, version) {
  const contributor = extractContributor(item);
  const { title, description } = extractTitleDescription(item);

  return {
    title,
    description,
    sinceVersion: version,
    contributor,
  };
}

function parsePerformanceItem(item, version) {
  const contributor = extractContributor(item);
  const { title, description } = extractTitleDescription(item);
  const significant =
    item.toLowerCase().includes("significant") ||
    item.toLowerCase().includes("major");

  return {
    title,
    description,
    sinceVersion: version,
    significant,
    contributor,
  };
}

program.parse(process.argv);
