import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from "url";
import YTMUSIC from 'ytmusic-api';
import { dirname } from "path";
import express from 'express';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));
export class ImportFromSpotify {
    constructor(id, secret, refresh, rl) {
        this.rl = rl;
        this.id = id;
        this.appAuth = `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
        this.client = { refresh: refresh, access: null };
        this._resolveToken = null;
        this.tokenPromise = new Promise((resolve) => this._resolveToken = resolve);
        this.ytapi = new YTMUSIC();
        this.next = null;
        this.server = null;
        this.queries = JSON.parse(readFileSync(`${__dirname}/queries.json`, 'utf-8'));
    };
    _setToken = t => {
        this.client.access = t;
        if (t === null) this.tokenPromise = new Promise((resolve) => this._resolveToken = resolve);
        else if (this._resolveToken) {
            this._resolveToken(t);
            this._resolveToken = null;
        };
    };
    init = () => new Promise(async resolve => {
        await this.ytapi.initialize();
        this.server = express()
            .use(express.json())
            .get('/', (_, res) => res.redirect(`https://accounts.spotify.com/authorize?${new URLSearchParams({
                response_type: 'code', client_id: this.id, scope: 'playlist-read-private playlist-read-collaborative', redirect_uri: "http://localhost:8000/callback"
            }).toString()}`))
            .get('/callback', async (req, res) => {
                const code = req.query.code;
                try {
                    const authResponse = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
                        code: code, redirect_uri: "http://localhost:8000/callback", grant_type: 'authorization_code'
                    }).toString(), { headers: { 'Authorization': this.appAuth, 'Content-Type': 'application/x-www-form-urlencoded' } });
                    this.client.refresh = authResponse.data.refresh_token;
                    const file = JSON.parse(readFileSync(`${__dirname}/credentials.json`, 'utf-8'));
                    file.spotify.refresh = this.client.refresh;
                    writeFileSync(`${__dirname}/credentials.json`, JSON.stringify(file));
                    this._setToken(authResponse.data.access_token);
                    res.sendStatus(200);
                    this.server.close();
                    this.server = null;
                } catch (error) {
                    console.error(error);
                    res.sendStatus(500);
                };
            })
            .listen(8000, () => resolve(`http://localhost:8000`));
    });
    _refreshAccessToken = async () => {
        if (!this.client.refresh) throw new Error("No refresh token available");
        try {
            const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
                grant_type: 'refresh_token', refresh_token: this.client.refresh,
            }).toString(), { headers: { 'Authorization': this.appAuth, 'Content-Type': 'application/x-www-form-urlencoded' } });
            this.client.access = response.data.access_token;
        } catch (error) {
            console.error('Failed to refresh token:', error);
            this.client.refresh = null;
            this.client.access = null;
            throw error;
        };
    };
    processPlaylist = async playlist => {
        if (!this.client.access && !this.client.refresh) {
            console.log("Not logged in, please visit http://localhost:8000 to authenticate");
            await this.tokenPromise;
            console.log("Authenticated!");
        };
        try {
            const playlistData = await axios.get(`https://api.spotify.com/v1/playlists/${playlist}`, { headers: { 'Authorization': 'Bearer ' + this.client.access } });
            const tracks = playlistData.data.tracks.total;
            const requests = Math.ceil(tracks / 100);
            console.log(`Playlist "${playlistData.data.name}" by ${playlistData.data.owner.display_name} with ${tracks} track${tracks === 1 ? '' : 's'} (${requests} request${requests === 1 ? '' : 's'}) retrieved successfully!`);
            const playlistInfo = { id: randomUUID(), name: playlistData.data.name, img: playlistData.data.images[0].url, type: "playlist", tracks: [] };
            let nextUrl = this.next || `https://api.spotify.com/v1/playlists/${playlist}/tracks`;
            while (nextUrl) {
                const playlistTracks = await axios.get(nextUrl, { headers: { 'Authorization': 'Bearer ' + this.client.access } });
                for (const item of playlistTracks.data.items) playlistInfo.tracks.push({
                    id: randomUUID(),
                    name: item.track.name,
                    artists: item.track.artists.map(a => a.name),
                    album: item.track.album.name,
                    img: item.track.album.images[0].url,
                    duration: Math.floor(item.track.duration_ms / 1000),
                    explicit: item.track.explicit
                });
                nextUrl = playlistTracks.data.next;
                this.next = nextUrl;
            };
            return playlistInfo;
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`Access token expired, refreshing...`);
                await this._refreshAccessToken();
                return await this.processPlaylist(playlist);
            } else console.error(`Error processing playlist:`, error);
        };
    };
    processAlbum = async album => {
        if (!this.client.access && !this.client.refresh) {
            console.log("Not logged in, please visit http://localhost:8000 to authenticate");
            await this.tokenPromise;
            console.log("Authenticated!");
        };
        try {
            const albumData = await axios.get(`https://api.spotify.com/v1/albums/${album}`, { headers: { 'Authorization': 'Bearer ' + this.client.access } });
            const tracks = albumData.data.tracks.total;
            const requests = Math.ceil(tracks / 100);
            console.log(`Album "${albumData.data.name}" with ${tracks} track${tracks === 1 ? '' : 's'} (${requests} request${requests === 1 ? '' : 's'}) retrieved successfully!`);
            const albumInfo = { id: randomUUID(), name: albumData.data.name, img: albumData.data.images[0].url, type: "album", tracks: [] };
            let nextUrl = this.next || `https://api.spotify.com/v1/albums/${album}/tracks`;
            while (nextUrl) {
                const albumTracks = await axios.get(nextUrl, { headers: { 'Authorization': 'Bearer ' + this.client.access } });
                for (const item of albumTracks.data.items) albumInfo.tracks.push({
                    id: randomUUID(),
                    name: item.name,
                    artists: item.artists.map(a => a.name),
                    album: albumData.data.name,
                    img: albumData.data.images[0].url,
                    duration: Math.floor(item.duration_ms / 1000),
                    explicit: item.explicit
                });
                nextUrl = albumTracks.data.next;
                this.next = nextUrl;
            };
            return albumInfo;
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`Access token expired, refreshing...`);
                await this._refreshAccessToken();
                return await this.processAlbum(album);
            } else console.error(`Error processing album:`, error);
        };
    };
    processTrack = async track => {
        if (!this.client.access && !this.client.refresh) {
            console.log("Not logged in, please visit http://localhost:8000 to authenticate");
            await this.tokenPromise;
            console.log("Authenticated!");
        };
        try {
            const trackData = await axios.get(`https://api.spotify.com/v1/tracks/${track}`, { headers: { 'Authorization': 'Bearer ' + this.client.access } });
            console.log(`Track "${trackData.data.name}" by ${trackData.data.artists.map(a => a.name).join(', ')} retrieved successfully!`);
            return {
                tracks: [{
                    id: randomUUID(),
                    name: trackData.data.name,
                    artists: trackData.data.artists.map(a => a.name),
                    album: trackData.data.album.name,
                    img: trackData.data.album.images[0].url,
                    duration: Math.floor(trackData.data.duration_ms / 1000),
                    explicit: trackData.data.explicit
                }]
            };
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`Access token expired, refreshing...`);
                await this._refreshAccessToken();
                return await this.processTrack(track);
            } else console.error(`Error processing track:`, error);
        };
    };
    searchTracks = async list => {
        for (let i = 0; i < list.tracks.length; i++) {
            const track = list.tracks[i];
            console.log(`Searching YouTube Music for: ${track.name} - ${track.artists[0]} (${track.album}) [${track.duration}s]`);
            const adapt = (str) => str.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{L}\p{N} ]/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
            const ytid = await (async () => {
                const searchQuery = `${track.name} - ${track.artists[0]} (${track.album})`;
                if (this.queries[searchQuery]) return this.queries[searchQuery];
                const results = await this.ytapi.searchSongs(searchQuery);
                for (let i = 0; i < results.length; i++) {
                    if (results[i].score === undefined) results[i].score = 0;
                    if (results[i].explicit === track.explicit) results[i].score += 0.5;
                    if (adapt(results[i].name) === adapt(track.name)) results[i].score += 1;
                    if (adapt(results[i].album.name) === adapt(track.album)) results[i].score += 2;
                    if (adapt(results[i].artist.name) === adapt(track.artists[0])) results[i].score += 3;
                    if (results[i].duration === track.duration) results[i].score += 4;
                };
                results.sort((a, b) => b.score - a.score);
                if (adapt(results[0].name) === adapt(track.name) && adapt(results[0].artist.name) === adapt(track.artists[0]) && adapt(results[0].album.name) === adapt(track.album) && Math.abs(results[0].duration - track.duration) <= 1) {
                    this.queries[searchQuery] = results[0].videoId;
                    writeFileSync(`${__dirname}/queries.json`, JSON.stringify(this.queries));
                    return results[0].videoId;
                } else {
                    console.log(`No exact match found for ${searchQuery}. Review the alternatives:\n${results.map((result, index) => `${index + 1}. ${result.name} - ${result.artist.name} (${result.album.name})\n    https://www.youtube.com/watch?v=${result.videoId}`).join('\n')}\n`);
                    const choice = await this.rl.question(`Enter your choice, a video ID if not listed, or press ENTER to choose the first: `);
                    const selectedResult = results[Number(choice) - 1] || results[0];
                    const videoId = choice && isNaN(choice) ? choice : selectedResult.videoId;
                    this.queries[searchQuery] = videoId;
                    writeFileSync(`${__dirname}/queries.json`, JSON.stringify(this.queries));
                    return videoId;
                };
            })();
            list.tracks[i].ytid = ytid;
        };
        return list;
    };
};