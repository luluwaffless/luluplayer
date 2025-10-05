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
    position: 0
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
const play = async (id) => {
    const song = cache.songs[id];
    if (song) {
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
        if (playing.current !== id) {
            playing.current = id;
            playing.audio.src = song.wav;
        };
        switchTab(player);
    };
};
const openList = (id) => {
    const list = cache.lists[id];
    if (list) {
        playing.list = list.id;
        listImg.src = list.img;
        listName.innerHTML = list.name;
        songList.innerHTML = ""
        get("songs").then(response => list.tracks.forEach(id => {
            const song = response[id];
            const a = document.createElement("a");
            a.className = `song`;
            a.innerHTML = `<img src="${song.img}"><div>${song.name}<br><span class="artists">${song.artists.join(", ")}</span></div>`;
            a.href = "#";
            a.id = id;
            a.addEventListener("click", () => play(id));
            songList.appendChild(a);
        }));
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
next.addEventListener("click", () => {
    const duration = playing.audio.duration;
    playing.audio.currentTime = Math.floor(duration);
});
previous.addEventListener("click", () => {
    if (playing.audio.currentTime > 2.5) playing.audio.currentTime = 0;
    else console.log("do this later lol");
});
playpause.addEventListener("click", () => {
    if (playing.audio.paused && playing.audio.currentTime > 0 && !playing.audio.ended) playing.audio.play();
    else playing.audio.pause();
});
time.addEventListener("input", () => {
    playing.audio.pause();
    playing.audio.currentTime = time.value;
});

bottomNext.addEventListener("click", () => {
    const duration = playing.audio.duration;
    playing.audio.currentTime = Math.floor(duration);
});
bottomPrevious.addEventListener("click", () => {
    if (playing.audio.currentTime > 2.5) playing.audio.currentTime = 0;
    else console.log("do this later lol");
});
bottomPlaypause.addEventListener("click", () => {
    if (playing.audio.paused && playing.audio.currentTime > 0 && !playing.audio.ended) playing.audio.play();
    else playing.audio.pause();
});
bottomTime.addEventListener("input", () => {
    playing.audio.pause();
    playing.audio.currentTime = time.value;
});
bottomTime.addEventListener("change", () => playing.audio.play());
loadLists();