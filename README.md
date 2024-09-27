# PostgreSQL Release Notes Processor

This command-line tool scrapes, processes, and analyzes PostgreSQL release notes.

It can fetch release notes from the official PostgreSQL website, cache them locally, and generate a structured JSON file categorizing the changes in each release.

## Features

- Scrape release notes for all PostgreSQL versions
- Scrape release notes for a specific PostgreSQL version
- Process cached release notes and categorize changes
- Generate a JSON file with structured release notes data

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js
- npm

## Installation

1. Clone this repository or download the source code.
2. Navigate to the project directory.
3. Install the required dependencies:

```bash
npm install
```

## Usage

The tool provides several commands:

### Scrape All Versions

Scraping is essentially just downloading the HTML files for each version of PostgreSQL. This is done to avoid making multiple requests to the PostgreSQL website when processing the release notes each time.

> [!NOTE]
> This has already been done for all versions up to starting from 1 to 17. The raw data is stored in the `raw-all` directory.

To scrape and cache release notes for all PostgreSQL versions:

```bash
node app.js scrape-all
```

### Scrape Specific Version

To scrape and cache release notes for a specific PostgreSQL version:

```bash
node app.js scrape-version <version>
```

Replace `<version>` with the desired PostgreSQL version (e.g., 16.4).

### Process Release Notes

To process the cached release notes and generate a JSON file:

```bash
node app.js process
```

This command will create a `release_notes.json` file in the project directory.

## Output

The `release_notes.json` file contains structured data for each PostgreSQL release, including:

- Version number
- Categorized changes:
  - Performance improvements
  - Security updates
  - New features
  - Other changes

> [!NOTE]
> We can add more categories as needed and update the processing logic accordingly. As the change log files are cached, we can easily reprocess the data to include new categories as needed.

## Configuration

You can modify the following constants in `app.js` to customize the tool's behavior:

- `CACHE_DIR`: Directory to store cached HTML files (default: 'raw-latest')
- `BASE_URL`: Base URL for PostgreSQL release notes (default: 'https://www.postgresql.org/docs/release/')
- `DELAY_MS`: Delay between requests in milliseconds (default: 1000). This is to avoid overwhelming the PostgreSQL website with requests when scraping multiple versions.
