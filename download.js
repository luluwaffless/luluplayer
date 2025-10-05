import { downloadWavYT, downloadImg, downloadLrc } from "./utils/downloaders.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const rl = createInterface({ input: process.stdin, output: process.stdout });
const importers = {
    "open.spotify.com": async pathname => {
        const [type, id] = pathname.split('/').slice(-2);
        if (!['playlist', 'album', 'track'].includes(type)) {
            console.error("Type not supported, currently supported: playlist, album, track");
            return null;
        };
        const { ImportFromSpotify } = await import("./utils/spotify.js");
        const [client, secret, refresh] = await (async () => {
            if (existsSync(`${__dirname}/utils/credentials.json`)) {
                const file = JSON.parse(readFileSync(`${__dirname}/utils/credentials.json`, 'utf-8'));
                if (file.spotify) return [file.spotify.client, file.spotify.secret, file.spotify.refresh];
                else {
                    const client = await rl.question("Spotify Client ID: ");
                    const secret = await rl.question("Spotify Client Secret: ");
                    file.spotify = { client, secret };
                    writeFileSync(`${__dirname}/utils/credentials.json`, JSON.stringify(file));
                    return [client, secret, null];
                };
            } else {
                const client = await rl.question("Spotify Client ID: ");
                const secret = await rl.question("Spotify Client Secret: ");
                writeFileSync(`${__dirname}/utils/credentials.json`, JSON.stringify({ spotify: { client, secret } }));
                return [client, secret, null];
            };
        })();
        const spotify = new ImportFromSpotify(client, secret, refresh, rl);
        await spotify.init();
        const processed = type === "track" ? [await spotify.processTrack(id)] : await (type === "album" ? spotify.processAlbum(id) : spotify.processPlaylist(id));
        const list = await spotify.searchTracks(processed);
        return list;
    }
};

(async () => {
    try {
        const { hostname, pathname } = new URL(process.argv.slice(2)[0]);
        if (!Object.keys(importers).includes(hostname)) {
            console.error("Not supported, currently supported:\n" + Object.keys(importers).map(h => `- ${h}`).join("\n"));
            process.exit(0);
        } else {
            const list = await importers[hostname](pathname);
            if (list) {
                console.log("Retrieved list successfully! Downloading...");
                const songs = JSON.parse(readFileSync(`${__dirname}/data/songs.json`, 'utf-8'));
                if (list.type) {
                    const lists = JSON.parse(readFileSync(`${__dirname}/data/lists.json`, 'utf-8'));
                    const img = await downloadImg(list.img, list.id)
                    lists[list.id] = { id: list.id, name: list.name, img: img, type: list.type, tracks: [] };
                    let current = 0;
                    for (const track of list.tracks) {
                        const tryDownload = async (a = 1, max = 3) => {
                            try {
                                const response = await downloadWavYT(`https://www.youtube.com/watch?v=${track.ytid}`, track.id);
                                return response;
                            } catch (error) {
                                if (a < max) {
                                    console.log(`Download attempt ${a} failed, retrying... (${max - a} attempts remaining)`);
                                    const response = await tryDownload(a + 1, max);
                                    return response;
                                } else throw error;
                            };
                        };
                        try {
                            const found = Object.values(songs).find(song => song.ytid === track.ytid);
                            if (found) {
                                console.log(`${track.name} - ${track.artists[0]} (${track.album}) is already downloaded as ${found.id}, skipping.`);
                                lists[list.id].tracks.push(found.id);
                                current += 1;
                                continue;
                            };
                            console.log(`Downloading ${track.name} - ${track.artists[0]} (${track.album})...`);
                            track.img = img;
                            const wav = await tryDownload();
                            track.wav = wav;
                            const lrc = await downloadLrc(track.name, track.artists[0], track.album, track.duration, track.id);
                            track.lrc = lrc;
                            lists[list.id].tracks.push(track.id);
                            songs[track.id] = track;
                            current += 1;
                            console.log(`Success! ${Math.floor((current / list.tracks.length) * 1000) / 10}% done. (${current}/${list.tracks.length})`)
                        } catch (error) {
                            console.error(`Error while downloading ${track.name} - ${track.artists[0]} (${track.album}):`, error);
                            current += 1;
                        };
                    };
                    writeFileSync(`${__dirname}/data/lists.json`, JSON.stringify(lists));
                    writeFileSync(`${__dirname}/data/songs.json`, JSON.stringify(songs));
                } else {
                    for (const track of list.tracks) {
                        try {
                            const found = Object.values(songs).find(song => song.ytid === track.ytid);
                            if (found) {
                                console.log(`${track.name} - ${track.artists[0]} (${track.album}) is already downloaded as ${found.id}, skipping.`);
                                continue;
                            };
                            track.img = img;
                            const wav = await downloadWavYT(`https://www.youtube.com/watch?v=${track.ytid}`, track.id);
                            track.wav = wav;
                            const lrc = await downloadLrc(track.name, track.artists[0], track.album, track.duration, track.id);
                            track.lrc = lrc;
                            songs[track.id] = track;
                        } catch (error) {
                            console.error(`Error while downloading ${track.name} - ${track.artists[0]} (${track.album}):`, error);
                        };
                    };
                    writeFileSync(`${__dirname}/data/songs.json`, JSON.stringify(songs));
                };
                console.log("Finished downloading!")
                process.exit(0);
            } else process.exit(0);
        };
    } catch (error) {
        console.error("An error occured:", error);
        process.exit(0);
    };
})();