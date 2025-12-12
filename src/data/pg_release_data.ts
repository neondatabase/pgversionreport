import type z from "zod";
import type { MainSchema } from "@/schema";

export default import("./pg_release_data.json").then(
    (x) => x.default,
) as Promise<z.infer<typeof MainSchema>>;
