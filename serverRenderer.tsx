import ReactDOMServer from "react-dom/server.node";
import App from "./src/components/App";
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "fs";
import { Writable } from "stream";

const piper = ReactDOMServer.renderToPipeableStream(<App />);
class StringWritable extends Writable {
    content = "";
    endCb?: () => void;

    _write(chunk: any, _: string, callback: (error?: Error | null) => void) {
        this.content += chunk.toString();
        callback();
    }

    _final(callback: (error?: Error | null) => void) {
        this.endCb?.();
        callback();
    }
}
const writer = new StringWritable();

writer.endCb = () => {
    const dom = new JSDOM(readFileSync("dist/index.html", "utf-8"));
    dom.window.document.getElementById("app")!.innerHTML = writer.content;
    writeFileSync("dist/index.html", dom.serialize());
    console.log("Server rendered the App content!");
};

piper.pipe(writer);
