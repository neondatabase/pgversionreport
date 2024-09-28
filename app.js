#!/usr/bin/env node

const { program } = require("commander");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const path = require("path");

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
  .description("Process cached release notes and generate formatted JSON")
  .action(processReleaseNotes);

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
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processReleaseNotes() {
  try {
    const releaseData = await parseReleaseNotes(CACHE_DIR);

    const processedData = releaseData.map(release => ({
      version: release.version,
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
      const items = [];
      const migrationInfo = [];

      // Extract changes
      $(".itemizedlist ul li").each((index, element) => {
        const text = $(element).text().trim();
        items.push(text);
      });

      // Extract migration information
      $("#RELEASE-" + version.replace(".", "-") + "-MIGRATION")
        .next(".sect2")
        .find("p")
        .each((index, element) => {
          const text = $(element).text().trim();
          migrationInfo.push(text);
        });

      releaseData.push({
        version,
        changes: items,
        migrationInfo: migrationInfo,
      });
    }
  }

  return releaseData;
}

function categorizeChanges(changes, migrationInfo) {
  const categories = {
    performance: [],
    security: [],
    features: [],
    migration: migrationInfo,
    other: [],
  };

  const keywords = {
    performance: ["performance", "speed", "faster", "optimization"],
    security: ["security", "vulnerability", "CVE", "exploit"],
    features: ["new feature", "added", "introduced", "now supports"],
  };

  changes.forEach(change => {
    const lowerChange = change.toLowerCase();
    let categorized = false;

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lowerChange.includes(word))) {
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

function formatReleaseNotes(releaseData) {
  const formattedData = {
    bugs: [],
    features: [],
    performanceImprovements: [],
    contributors: new Set(),
  };

  releaseData.forEach(release => {
    release.categories.security.forEach(item => {
      const cveMatch = item.match(/CVE-\d{4}-\d{4,7}/);
      const contributors = extractContributors(item);
      formattedData.bugs.push({
        cve: cveMatch ? cveMatch[0] : null,
        title: item.split(".")[0],
        description: item,
        fixedIn: release.version,
        contributors: contributors,
      });
      contributors.forEach(contributor =>
        formattedData.contributors.add(contributor)
      );
    });

    release.categories.features.forEach(item => {
      const contributors = extractContributors(item);
      formattedData.features.push({
        title: item.split(".")[0],
        description: item,
        sinceVersion: release.version,
        contributors: contributors,
      });
      contributors.forEach(contributor =>
        formattedData.contributors.add(contributor)
      );
    });

    release.categories.performance.forEach(item => {
      const contributors = extractContributors(item);
      formattedData.performanceImprovements.push({
        title: item.split(".")[0],
        description: item,
        sinceVersion: release.version,
        significant: item.toLowerCase().includes("significant"),
        contributors: contributors,
      });
      contributors.forEach(contributor =>
        formattedData.contributors.add(contributor)
      );
    });

    release.categories.other.forEach(item => {
      const contributors = extractContributors(item);
      contributors.forEach(contributor =>
        formattedData.contributors.add(contributor)
      );
    });
  });

  // Convert Set to Array for JSON serialization
  formattedData.contributors = Array.from(formattedData.contributors);

  return formattedData;
}

function extractContributors(item) {
  // This regex looks for names in parentheses at the end of the item
  const contributorMatch = item.match(/\(([^)]+)\)$/);
  if (contributorMatch) {
    // Split the matched string by commas and trim each name
    return contributorMatch[1].split(",").map(name => name.trim());
  }
  return [];
}

async function processReleaseNotes() {
  try {
    const releaseData = await parseReleaseNotes(CACHE_DIR);

    const processedData = releaseData.map(release => ({
      version: release.version,
      categories: categorizeChanges(release.changes, release.migrationInfo),
    }));

    const formattedData = formatReleaseNotes(processedData);

    const outputFile = path.join(__dirname, "release_notes_formatted.json");
    await fs.writeFile(outputFile, JSON.stringify(formattedData, null, 2));
    console.log(`Formatted release notes processed and saved to ${outputFile}`);
  } catch (error) {
    console.error("Error processing release notes:", error);
  }
}

program.parse(process.argv);
