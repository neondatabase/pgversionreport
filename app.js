#!/usr/bin/env node

const { program } = require('commander');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const CACHE_DIR = 'raw';
const BASE_URL = 'https://www.postgresql.org/docs/release/';
const DELAY_MS = 1000;

program
  .version('1.0.0')
  .description('PostgreSQL Release Notes Raw Scraper');

program
  .command('scrape-all')
  .description('Scrape and cache all release notes')
  .action(scrapeAllVersions);

program
  .command('scrape-version <version>')
  .description('Scrape and cache release notes for a specific version')
  .action(scrapeSpecificVersion);

async function scrapeAllVersions() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    
    console.log('Fetching main release page...');
    const mainPageHtml = await fetchPage(BASE_URL);
    await saveToCacheFile('index.html', mainPageHtml);
    
    const versions = extractVersions(mainPageHtml);
    console.log(`Found ${versions.length} versions.`);
    
    for (const version of versions) {
      await scrapeSpecificVersion(version);
      await delay(DELAY_MS);
    }
    
    console.log('All versions scraped and cached successfully.');
  } catch (error) {
    console.error('Error scraping all versions:', error.message);
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
  $('ul.release-notes-list li a').each((index, element) => {
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

program.parse(process.argv);
