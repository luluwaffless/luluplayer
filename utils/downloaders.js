import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";
import { dirname, normalize } from "path";
import axios from "axios";

const __dirname = dirname(fileURLToPath(import.meta.url)).slice(0, -6);

export const downloadWavYT = (url, id, debug=false) => {
    const path = `data/wav/${id ?? url.split("=")[1]}.wav`;
    const output = normalize(`${__dirname}/${path}`);
    return new Promise((resolve, reject) => {
        const yt = spawn("yt-dlp", ["-f", "bestaudio", "--extract-audio", "--audio-format", "wav", "--audio-quality", "0", "-o", output, url]);
        if (debug) {
            yt.stdout.on("data", (chunk) => console.log(chunk.toString()));
            yt.stderr.on("data", (chunk) => console.error(chunk.toString()));
        };
        yt.on("error", (err) => reject(err));
        yt.on("close", (code) => {
            if (code === 0) resolve(path);
            else reject(new Error(`yt-dlp exited with code ${code}`));
        });
    });
};
export const downloadLrc = async (track_name, artist_name, album_name, duration, id) => {
    try {
        const { data } = await axios.get(`https://lrclib.net/api/get?${new URLSearchParams({ track_name, artist_name, album_name, duration }).toString()}`);
        const path = `data/lrc/${id ?? track_name}.lrc`;
        const output = normalize(`${__dirname}/${path}`);
        if (data.syncedLyrics) writeFileSync(output, data.syncedLyrics);
        else if (data.plainLyrics) writeFileSync(output, data.plainLyrics);
        else if (data.instrumental) writeFileSync(output, "[instrumental]");
        return path;
    } catch (error) {
        throw error;
    };
};
export const downloadImg = async (url, id) => {
    try {
        const path = `data/img/${id ?? url.split("/").pop().split("?")[0]}.png`;
        const output = normalize(`${__dirname}/${path}`);
        const { data } = await axios.get(url, { responseType: "arraybuffer" });
        writeFileSync(output, data);
        return path;
    } catch (error) {
        throw error;
    };
};