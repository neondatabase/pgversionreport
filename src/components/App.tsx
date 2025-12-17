import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Info, Copy } from "lucide-react";
import { ComponentLoader, StaticAsyncLoader } from "@/utils/StaticAsyncLoader";
import { versionRegex } from "@/utils/regexes";

const parserLoader = new StaticAsyncLoader(
    import("./molecules/Parser").then((mod) => mod.default),
);

interface DefaultPreventor {
    preventDefault: () => void;
}

class DataQuery {
    url: URL | null;

    constructor() {
        if (typeof window === "undefined") {
            this.url = null;
            return;
        }
        this.url = new URL(window.location.href);
    }

    get version() {
        return this.url?.searchParams.get("version") || "";
    }

    set version(version: string | null) {
        if (!this.url) {
            return;
        }
        if (version) {
            this.url.searchParams.set("version", version);
        } else {
            this.url.searchParams.delete("version");
        }
        window.history.pushState({ version }, "", this.url.toString());
    }
}

const query = new DataQuery();

const versions: {
    serviceName: string;
    versionString: string;
    version: string;
}[] = [
    {
        serviceName: "CloudSQL (17)",
        versionString:
            "PostgreSQL 17.7 on x86_64-pc-linux-gnu, compiled by Debian clang version 12.0.1, 64-bit",
        version: "17.7",
    },
    {
        serviceName: "Supabase (17)",
        versionString:
            "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit",
        version: "17.6",
    },
    {
        serviceName: "RDS (17)",
        versionString:
            "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 12.4.0, 64-bit",
        version: "17.6",
    },
    {
        serviceName: "Heroku (17)",
        versionString:
            "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by aarch64-unknown-linux-gnu-gcc (GCC) 10.5.0, 64-bit",
        version: "17.6",
    },
    {
        serviceName: "Neon (17)",
        versionString:
            "PostgreSQL 17.7 (178558d) on aarch64-unknown-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit",
        version: "17.7",
    },
    {
        serviceName: "Neon (18)",
        versionString:
            "PostgreSQL 18.1 (f911638) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04) 13.3.0, 64-bit",
        version: "18.1",
    },
];

function MainView() {
    // Defines the components text state.
    const [text, setText] = useState("");
    const { toast } = useToast();

    // Handle the component mounting and the version query.
    useEffect(() => {
        if (query.version) {
            // Set the text to a partial version string. This allows us to DRY the code a bit.
            setText(`PostgreSQL ${query.version}`);
        }

        // On load, replace the state with the current state. I know, this is very weird, but
        // we do this because we want to distinguish hash navigation from the back button.
        window.history.replaceState({ version: query.version }, "");

        // Handle the state change when the user navigates back.
        const ln = (e: PopStateEvent) => {
            // Handle the query hash.
            if (window.location.hash) {
                const hash = window.location.hash.slice(1);
                const el = document.getElementById(hash);
                if (el) {
                    el.scrollIntoView();
                }
            }

            // Handle the state of the version.
            const state = e.state as { version: string };
            if (!state) {
                // This is query hash navigation. State is unaffected.
                return;
            }
            if (state.version) {
                setText(`PostgreSQL ${state.version}`);
                query.version = state.version;
            } else {
                setText("");
            }
        };
        window.addEventListener("popstate", ln);
        return () => {
            window.removeEventListener("popstate", ln);
        };
    }, []);

    // Return the textbox and the parsing result.
    return (
        <div
            className={`flex ${
                text
                    ? "bg-background"
                    : "items-center justify-center min-h-screen"
            }`}
        >
            <div
                className={`${
                    !text ? "max-w-2xl" : "max-w-7xl"
                } mx-auto w-full flex-col space-y-6 justify-center`}
            >
                {!text ? (
                    <>
                        <div className="flex flex-col gap-2 text-center">
                            <h1 className="text-4xl font-extrabold font-title tracking-tight">
                                PG Version Report
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Plug in your Postgres version to see what you're
                                missing out on.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-4 font-mono text-lg">
                            <span className="opacity-50">postgres =&gt;</span>
                            <div
                                className="inline-block border pl-4 pr-12 py-2 rounded-xl relative cursor-pointer group"
                                onClick={(e: DefaultPreventor) => {
                                    navigator.clipboard.writeText(
                                        "SELECT version();",
                                    );
                                    toast({
                                        description: "SQL copied to clipboard!",
                                    });
                                    e.preventDefault();
                                }}
                            >
                                SELECT version();
                                <Copy className="absolute right-2 top-3 rounded text-muted-foreground/75 p-0.5 h-5 w-5 group-hover:bg-muted-foreground/10" />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-2 text-left mt-20">
                        <a
                            href="/"
                            className="text-2xl text-muted-foreground font-extrabold font-title tracking-tight"
                        >
                            PG Version Report
                        </a>
                    </div>
                )}
                <form>
                    <div className="grid w-full items-center gap-4">
                        <div className="flex flex-col space-y-1.5  max-w-3xl">
                            <div className="flex items-center gap-2 ">
                                <Label
                                    htmlFor="name"
                                    className={`${text && "text-muted-foreground"}`}
                                >
                                    Postgres Version String
                                </Label>
                                <Popover>
                                    <PopoverTrigger>
                                        <div className="hover:bg-muted-foreground/10 p-0.5 rounded">
                                            <Info
                                                size={16}
                                                className="opacity-50"
                                            />
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent>
                                        <p className="text-sm">
                                            Run <code>SELECT version();</code>{" "}
                                            in your PostgreSQL database to get
                                            the version string.
                                        </p>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Input
                                className={
                                    text
                                        ? "text-muted-foreground max-w-3xl"
                                        : "shadow-lg text-lg h-12 placeholder:text-muted-foreground/25"
                                }
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    const res = versionRegex.exec(
                                        e.target.value,
                                    );
                                    if (res) {
                                        query.version = res[1];
                                    }
                                }}
                                id="name"
                                placeholder="PostgreSQL 99.9 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 13.3.1 20240522 (Red Hat 13.3.1-1), 64-bit"
                            />
                        </div>
                        {!text && (
                            <div className="flex items-top gap-2 text-sm justify-center pb-32">
                                <span className="opacity-50">Examples:</span>
                                <div className="flex gap-1 flex-wrap">
                                    {versions.map((version) => (
                                        <Button
                                            variant="outline"
                                            size="badge"
                                            onClick={() => {
                                                setText(version.versionString);
                                                query.version = version.version;
                                            }}
                                            key={version.serviceName}
                                        >
                                            {version.serviceName}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </form>
                <div className="relative">
                    {text && (
                        <Button
                            variant="default"
                            onClick={(e: DefaultPreventor) => {
                                navigator.clipboard.writeText(
                                    window.location.href,
                                );
                                toast({
                                    description: "Link copied to clipboard!",
                                });
                                e.preventDefault();
                            }}
                            className="hidden md:block absolute top-4 right-0 max-w-32"
                        >
                            Share Report
                        </Button>
                    )}
                    <Suspense fallback={null}>
                        <ComponentLoader
                            loader={parserLoader}
                            props={{ text }}
                        />
                    </Suspense>
                </div>
                <div
                    className={`${text ? "" : "absolute bottom-0 left-20 right-20"}`}
                >
                    <hr />
                    <p className="text-center text-sm text-muted-foreground pb-12 pt-6">
                        Made with ❤️ by <a href="https://neon.tech">Neon</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <div className="bg-slate-500/10 mx-4">
            <MainView />
            <Toaster />
        </div>
    );
}
