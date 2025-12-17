import { join } from "path";
import releaseNotesFormatted from "../scraper/release_notes_formatted.json" assert { type: "json" };
import { writeFile, writeFileSync } from "fs";

console.log("Splitting release notes into multiple files...");

const root = join(__dirname, "..", "src", "data");

writeFileSync(
    join(root, "pg_release_data.json"),
    JSON.stringify(releaseNotesFormatted, null, 4),
);

const versionDates = { ...releaseNotesFormatted.versionDates };
for (const [version, date] of Object.entries(versionDates)) {
    try {
        // YYYY-MM-DD format
        const d = new Date(date as string);
        if (isNaN(d.getTime())) {
            throw new Error("Invalid date");
        }
    } catch {
        console.warn(`Invalid date for version ${version}: ${date}`);
        // @ts-expect-error
        delete versionDates[version];
    }
}

writeFileSync(
    join(root, "version_dates.json"),
    JSON.stringify(versionDates, null, 4),
);
