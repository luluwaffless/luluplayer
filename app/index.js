// elements
const $ = (el) => document.getElementById(el);
const title = $("title");
const lists = $("lists");
const songs = $("songs");
const player = $("player");
const listImg = $("listImg");
const listName = $("listName");
const songList = $("songList");
const songImg = $("songImg");
const songName = $("songName");
const songArtists = $("songArtists");
const timeDisplay = $("timeDisplay");
const time = $("time");
const previous = $("previous");
const playpause = $("playpause");
const next = $("next");
const lyrics = $("lyrics");
const bottom = $("bottom");
const bottomImg = $("bottomImg");
const bottomSongName = $("bottomSongName");
const bottomSongArtists = $("bottomSongArtists");
const bottomTimeDisplay = $("bottomTimeDisplay");
const bottomTime = $("bottomTime");
const bottomPrevious = $("bottomPrevious");
const bottomPlaypause = $("bottomPlaypause");
const bottomNext = $("bottomNext");
const bottomLyric = $("bottomLyric");

const playing = {
    list: null,
    current: null,
    audio: new Audio(),
    queue: [],
    lrc: [],
    position: 0,
    repeat: 0 // 0 = no repeat, 1 = repeat list, 2 = repeat current
};
const cache = {};

let tab = lists;
const switchTab = (t) => {
    tab.style.display = "none";
    tab = t;
    tab.style.display = tab === lists ? "flex" : "block";
    bottom.style.display = playing.current ? (tab === player ? "none" : "flex") : "none";
};
const get = (json) => fetch(`data/${json}.json`).then(r => r.json().then(response => {
    cache[json] = response;
    return response;
}));
const getText = (url) => fetch(url).then(r => r.text().then(response => {
    cache[url] = response;
    return response;
}));
const toMSS = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const play = async (songId, listId) => {
    const song = cache.songs[songId];
    if (song) {
        const previousList = playing.list;
        playing.list = listId;
        const lrcText = await getText(song.lrc);
        const lrc = lrcText.split('\n');
        playing.lrc = [];
        const elements = [];
        for (let i = 0; i < lrc.length; i++) {
            const match = lrc[i].trim().match(/\[(\d+):(\d+\.\d+)\](.*)/);
            if (match) {
                const timestamp = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
                const lyric = match[3].trim() || "♪";
                playing.lrc.push({ lyric, timestamp });

                const a = document.createElement("a");
                a.className = "lyric";
                a.id = `lyric${i}`;
                a.href = "#";
                a.innerText = lyric;
                a.onclick = (e) => {
                    e.preventDefault();
                    playing.audio.currentTime = timestamp;
                };
                elements.push(a);
            };
        };
        lyrics.innerHTML = "";
        elements.forEach(el => lyrics.appendChild(el));

        title.innerHTML = `${song.name} - ${song.artists.join(", ")}`
        songName.innerHTML = song.name;
        bottomSongName.innerHTML = song.name;
        songArtists.innerHTML = song.artists.join(", ");
        bottomSongArtists.innerHTML = song.artists.join(", ");
        songImg.src = song.img;
        bottomImg.src = song.img;
        if ((previousList && playing.current !== songId && previousList === listId) || (previousList && playing.current === songId && previousList !== listId) || (playing.current !== songId)) {
            playing.current = songId;
            playing.audio.src = song.wav;
        };
        switchTab(player);
    };
};
const openList = (listId) => {
    const list = cache.lists[listId];
    if (list) {
        listImg.src = list.img;
        listName.innerHTML = list.name;
        songList.innerHTML = ""
        get("songs").then(response => {
            for (let i = 0; i < list.tracks.length; i++) {
                const songId = list.tracks[i];
                const song = response[songId];
                const a = document.createElement("a");
                a.className = `song`;
                a.innerHTML = `<img src="${song.img}"><div>${song.name}<br><span class="artists">${song.artists.join(", ")}</span></div>`;
                a.href = "#";
                a.id = songId;
                a.addEventListener("click", () => {
                    playing.position = i;
                    playing.queue = list.tracks;
                    play(songId, listId);
                });
                songList.appendChild(a);
            };
        });
        switchTab(songs);
    };
};
const loadLists = () => get("lists").then(response => {
    lists.innerHTML = "";
    for (const list of Object.values(response)) {
        const a = document.createElement("a");
        a.className = `list`;
        a.innerHTML = `<img src=${list.img}><br>${list.name}`;
        a.href = "#";
        a.id = list.id;
        a.addEventListener("click", () => openList(list.id));
        lists.appendChild(a)
    };
});

// audio events
playing.audio.addEventListener("canplaythrough", () => {
    const str = `0:00 / ${toMSS(playing.audio.duration)}`;
    time.max = playing.audio.duration;
    bottomTime.max = playing.audio.duration;
    timeDisplay.innerHTML = str;
    bottomTimeDisplay.innerHTML = str;
    playing.audio.play();
});
playing.audio.addEventListener("timeupdate", () => {
    const str = `${toMSS(playing.audio.currentTime)} / ${toMSS(playing.audio.duration)}`;
    time.value = playing.audio.currentTime;
    bottomTime.value = playing.audio.currentTime;
    timeDisplay.innerHTML = str;
    bottomTimeDisplay.innerHTML = str;
    for (let i = 0; i < playing.lrc.length; i++) {
        const lrc = playing.lrc[i];
        const nextLyricTimestamp = playing.lrc[i + 1] ? playing.lrc[i + 1].timestamp : playing.audio.duration;
        const el = $(`lyric${i}`);
        if (playing.audio.currentTime > lrc.timestamp && playing.audio.currentTime < nextLyricTimestamp) {
            bottomLyric.innerHTML = lrc.lyric;
            el.className = "currentLyric";
            el.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        } else if (playing.audio.currentTime < lrc.timestamp) el.className = "lyric";
        else el.className = "pastLyric";
    };
});
playing.audio.addEventListener("ended", () => {
    const nextTrack = playing.queue[playing.position + 1];
    if (nextTrack) {
        playing.position += 1;
        play(nextTrack, playing.list);
    } else {
        // repeat list still needs to be added later, for now it just ends
        if (playing.repeat === 2) play(playing.current, playing.list);
        else if (playing.repeat === 1 && playing.list) play(playing.queue[0], playing.list);
        else {
            if (tab === player) switchTab(songs);
            playing.position = 0;
            playing.queue = [];
            playing.list = null;
            playing.current = null;
            playing.lrc = null;
            playing.audio.src = null;
        };
    };
});

// audio controls
const nextFunc = () => {
    const duration = playing.audio.duration;
    playing.audio.currentTime = Math.floor(duration);
};
const previousFunc = () => {
    if (playing.audio.currentTime > 2.5) playing.audio.currentTime = 0;
    else {
        const previousTrack = playing.queue[playing.position - 1];
        if (previousTrack) {
            playing.position -= 1;
            play(previousTrack, playing.list);
        };
    };
};
const playpauseFunc = () => {
    if (playing.audio.paused && playing.audio.currentTime > 0 && !playing.audio.ended) playing.audio.play();
    else playing.audio.pause();
};
const timeFunc = () => {
    playing.audio.pause();
    playing.audio.currentTime = time.value;
};

next.addEventListener("click", nextFunc);
previous.addEventListener("click", previousFunc);
playpause.addEventListener("click", playpauseFunc);
time.addEventListener("input", timeFunc);
bottomNext.addEventListener("click", nextFunc);
bottomPrevious.addEventListener("click", previousFunc);
bottomPlaypause.addEventListener("click", playpauseFunc);
bottomTime.addEventListener("input", timeFunc);