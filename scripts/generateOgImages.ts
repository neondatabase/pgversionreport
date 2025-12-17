import releaseData from "@/data/pg_release_data.json";
import sharp, { OverlayOptions } from "sharp";
import { rmSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { sortedVersions } from "@/utils/postgresDates";
import { parseVersion } from "@/components/molecules/Parser";

console.log("Generating OG images for Postgres versions...");

const pgGeneratedFolder = join(
    __dirname,
    "..",
    "public",
    "images",
    "pg_generated",
);

// Delete the folder.
try {
    rmSync(pgGeneratedFolder, { recursive: true });
} catch {
    // Ignore if it doesn't exist.
}

// Create the folder.
mkdirSync(pgGeneratedFolder, { recursive: true });

function sanitize(text: string) {
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function makeTextSvg(title: string, subtitle?: string) {
    let subtitleSvg = "";
    if (subtitle) {
        subtitleSvg = `<text style="font-family: Inter;" x="50%" y="20%" dominant-baseline="middle" text-anchor="middle" font-size="24" fill="white">
        ${sanitize(subtitle)}
    </text>`;
    }

    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
        <style type="text/css">
            @import url('https://fonts.googleapis.com/css2?family=Inter');
        </style>
    </defs>
    <text style="font-family: Inter;" x="50%" y="10%" dominant-baseline="middle" text-anchor="middle" font-size="48" fill="white">
        ${sanitize(title)}
    </text>
${subtitleSvg}
</svg>`);
}

// Generate a smaller card to fit inside the main card.
function generateCard(
    iconSvg: string,
    title: string,
    count: number,
    r: number,
    g: number,
    b: number,
) {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 400 400">
    <defs>
        <style type="text/css">
            @import url('https://fonts.googleapis.com/css2?family=Inter');
        </style>
    </defs>
    <rect x="0" y="0" width="300" height="400" fill="rgb(${r}, ${g}, ${b})"/>
    <g transform="scale(0.3) translate(300, 100)">
        ${iconSvg}
    </g>
    <text style="font-family: Inter;" x="37%" y="60%" dominant-baseline="middle" text-anchor="middle" font-size="48" fill="white">
        ${sanitize(title)}
    </text>
    <text style="font-family: Inter;" x="37%" y="90%" dominant-baseline="middle" text-anchor="middle" font-size="120" fill="white">
        ${count}
    </text>
</svg>`);
}

for (let i = 0; i < sortedVersions.length; i++) {
    // Create a new image.
    const image = sharp({
        create: {
            width: 1200,
            height: 630,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
    });

    // Get this version and release date.
    const [version, releaseDate] = sortedVersions[i];

    // Get the releases after this.
    const versionsAfter = sortedVersions.slice(i + 1);

    // If there are no releases after this, write the latest image.
    if (versionsAfter.length === 0) {
        // Draw a title saying "Postgres X.Y is the latest version" with a tick.
        image
            .composite([
                {
                    input: makeTextSvg(
                        `Postgres ${version.major}.${version.minor} is the latest version`,
                    ),
                },
                {
                    input: Buffer.from(
                        readFileSync(join(__dirname, "assets", "tick.svg")),
                    ),
                    gravity: "center",
                },
            ])
            .toFile(
                join(
                    pgGeneratedFolder,
                    `${version.major}.${version.minor}.png`,
                ),
            );
        continue;
    }

    // Figure out if it is end of life and change the title accordingly.
    const endOfLife = new Date(releaseDate);
    endOfLife.setFullYear(endOfLife.getFullYear() + 5);
    const isEndOfLife = endOfLife <= new Date();
    const title = isEndOfLife
        ? `Postgres ${version.major}.${version.minor} is end of life`
        : `Postgres ${version.major}.${version.minor} is not the latest version`;

    // Figure out the bugs, features, and performance improvements.
    const { bugs, features, security, performance } = parseVersion(
        version,
        releaseData as any,
    );

    // Get the subtitle.
    const chunks: string[] = [];
    if (bugs.length > 0 || security.length > 0) {
        chunks.push(`${bugs.length + security.length} bug fixes`);
    }
    if (features.length > 0) {
        chunks.push(`${features.length} new features`);
    }
    if (performance.length > 0) {
        chunks.push(`${performance.length} performance improvements`);
    }
    const subtitle = `There are ${chunks.join(", ")} in newer versions`;

    // Draw the image.
    const cards: OverlayOptions[] = [];
    const alignment = 34;
    cards.push({
        input: generateCard(
            readFileSync(join(__dirname, "assets", "bug.svg"), "utf-8"),
            "Bug Fixes",
            bugs.length,
            255,
            0,
            0,
        ),
        left: 450 + alignment,
        top: 115,
    });
    cards.push({
        input: generateCard(
            readFileSync(join(__dirname, "assets", "feature.svg"), "utf-8"),
            "Features",
            features.length,
            0,
            128,
            0,
        ),
        left: 150 + alignment,
        top: 115,
    });
    cards.push({
        input: generateCard(
            readFileSync(join(__dirname, "assets", "performance.svg"), "utf-8"),
            "Perf Boosts",
            performance.length,
            // darkened green
            0,
            64,
            0,
        ),
        left: 750 + alignment,
        top: 115,
    });

    image
        .composite([
            {
                input: makeTextSvg(title, subtitle),
            },
            ...cards,
        ])
        .toFile(
            join(pgGeneratedFolder, `${version.major}.${version.minor}.png`),
        );
}
