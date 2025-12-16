import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
    MinorVersionInfo,
    VersionData,
} from "../molecules/VersionMapCard";
import Semver from "@/utils/Semver";

type Props = {
    data: VersionData;
    minEpoch: number;
    maxDuration: number;
    currentVersion: Semver;
};

export default function TimelineChart({
    data,
    minEpoch,
    maxDuration,
    currentVersion,
}: Props) {
    const isCurrentVersion = (minor: MinorVersionInfo) => {
        return (
            currentVersion.major === data.majorVersion &&
            currentVersion.minor === minor.minorVersion
        );
    };

    const firstReleasePosition = ((new Date(data.firstReleaseDate).getTime() - minEpoch) / maxDuration) * 100;

    return (
        <div className="h-8 w-full relative">
            <div
                className="absolute text-right leading-6 pr-2 h-auto font-bold whitespace-nowrap z-10"
                style={{
                    left: `${Math.min(firstReleasePosition, 99)}%`,
                    transform: 'translateX(-100%)',
                    maxWidth: '200px',
                }}
            >
                Postgres {data.majorVersion}
            </div>
            {data.minorVersions.map((minor, i) => {
                const releasePosition = ((new Date(minor.releaseDate).getTime() - minEpoch) / maxDuration) * 100;
                const nextRelease = i < data.minorVersions.length - 1 
                    ? data.minorVersions[i + 1].releaseDate 
                    : null;
                const width = nextRelease
                    ? ((new Date(nextRelease).getTime() - new Date(minor.releaseDate).getTime()) / maxDuration) * 100
                    : 2;
                
                return (
                <TooltipProvider key={i}>
                    <Tooltip>
                        <TooltipTrigger
                            data-you-are-here-anchor={
                                isCurrentVersion(minor) ? "true" : undefined
                            }
                            className={`cursor-default absolute text-xs h-auto leading-6 ${isCurrentVersion(minor) ? "shadow-lg bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground/50"} `}
                            style={{
                                left: `${releasePosition}%`,
                                width: `${width}%`,
                            }}
                        >
                            <div className="absolute w-px h-full bg-secondary-foreground/10" />
                            <span className="ml-1">.{minor.minorVersion}</span>
                            {isCurrentVersion(minor) && (
                                <div className="absolute -top-10 block -left-9 text-sm text-primary-foreground bg-primary border border-primary-foreground rounded w-28 px-2 py-1 shadow-xl z-10 before:w-4 before:h-4 before:rotate-45 before:bg-primary before:absolute before:-z-10 before:-bottom-1 before:left-0  before:right-0 before:mx-auto">
                                    You are here.
                                </div>
                            )}
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>
                                {data.majorVersion}.{minor.minorVersion}:{" "}
                                {new Date(minor.releaseDate)
                                    .toISOString()
                                    .substring(0, 10)}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                );
            })}
        </div>
    );
}
