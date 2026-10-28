// The Sony deck's brain: the <video> that carries the tape, and the 640 x 480 canvas that is its LCD (the video with the deck's
// on-screen display drawn over it). The same canvas is the texture on the little screen on the desk and the screen in the close-up.
// The picture itself is never touched: no grade, no filter, only the OSD text on top.
import { videoSrc, type Tape } from "../../lib/minidv";

export type DeckState = "empty" | "loading" | "stopped" | "playing" | "paused" | "searching";

const W = 640;
const H = 480;

const pad = (n: number, l = 2) => String(Math.floor(n)).padStart(l, "0");
/** h:mm:ss:ff, as the deck counts it (29.97 frames a second) */
const timecode = (t: number) => `${Math.floor(t / 3600)}:${pad((t % 3600) / 60)}:${pad(t % 60)}:${pad((t % 1) * 29.97)}`;

export class DeckScreen {
  readonly video = document.createElement("video");
  private readonly g: CanvasRenderingContext2D;
  state: DeckState = "empty";
  tape: Tape | null = null;
  /** the deck's DISPLAY button: the on-screen text on or off */
  osd = true;
  onChange: () => void = () => {};
  private notice = "";
  private noticeUntil = 0;
  private searchTimer = 0;
  private searchDir = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    this.g = canvas.getContext("2d")!;
    const v = this.video;
    v.preload = "auto";
    v.playsInline = true;
    v.setAttribute("aria-hidden", "true");
    v.volume = 0.8;
    // Kept in the page (not display:none) so the browser keeps decoding it for the canvas.
    Object.assign(v.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none" });
    document.body.appendChild(v);
    v.addEventListener("ended", () => {
      this.state = "stopped";
      this.say("TAPE END", 4);
      this.onChange();
    });
    v.addEventListener("error", () => {
      if (!this.tape) return;
      this.state = "stopped";
      this.say("CANNOT PLAY THIS TAPE", 6);
      this.onChange();
    });
  }

  /** Called inside the click that chose the tape: starts the download and lets the browser know sound is welcome here. */
  prime(tape: Tape) {
    const v = this.video;
    v.src = videoSrc(tape);
    v.load();
    const volume = v.volume;
    v.volume = 0;
    const p = v.play();
    const restore = () => {
      if (this.state !== "playing") v.pause();
      v.volume = volume;
    };
    if (p) p.then(restore, () => (v.volume = volume));
    else restore();
  }

  /** the cassette is in the deck: the screen wakes up on its blue loading screen */
  insert(tape: Tape) {
    this.tape = tape;
    this.state = "loading";
    this.say("LOADING TAPE", 99);
    this.onChange();
  }

  /** loading is over: start from the beginning of the tape */
  async start() {
    this.notice = "";
    const v = this.video;
    v.currentTime = 0;
    try {
      await v.play();
      this.state = "playing";
    } catch {
      this.state = "stopped";
      this.say("PRESS PLAY", 99);
    }
    this.onChange();
  }

  play() {
    if (!this.tape || this.state === "loading") return;
    this.stopSearch();
    this.notice = "";
    void this.video.play().then(() => {
      this.state = "playing";
      this.onChange();
    });
  }

  pause() {
    if (!this.tape || this.state === "loading") return;
    this.stopSearch();
    this.video.pause();
    this.state = "paused";
    this.onChange();
  }

  toggle() {
    if (this.state === "playing") this.pause();
    else this.play();
  }

  stop() {
    if (!this.tape || this.state === "loading") return;
    this.stopSearch();
    this.video.pause();
    this.video.currentTime = 0;
    this.state = "stopped";
    this.notice = "";
    this.onChange();
  }

  /** a tap jumps; holding REW / FF searches, with the picture, the way the deck does */
  skip(seconds: number) {
    if (!this.tape || this.state === "loading") return;
    const v = this.video;
    v.currentTime = Math.max(0, Math.min((v.duration || Infinity) - 0.5, v.currentTime + seconds));
    if (this.state === "stopped") {
      this.state = "paused";
      this.onChange();
    }
  }

  search(dir: -1 | 1) {
    if (!this.tape || this.state === "loading") return;
    this.stopSearch();
    this.searchDir = dir;
    this.state = "searching";
    this.video.pause();
    this.onChange();
    this.searchTimer = window.setInterval(() => this.skip(dir * 4), 110);
  }

  endSearch() {
    if (this.state !== "searching") return;
    this.stopSearch();
    void this.video.play().then(() => {
      this.state = "playing";
      this.onChange();
    });
  }

  private stopSearch() {
    if (this.searchTimer) window.clearInterval(this.searchTimer);
    this.searchTimer = 0;
    this.searchDir = 0;
  }

  /** the tape comes out: the picture goes, the file is let go of */
  eject() {
    this.stopSearch();
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.tape = null;
    this.state = "empty";
    this.notice = "";
    this.onChange();
  }

  volume(delta: number) {
    const v = this.video;
    v.volume = Math.max(0, Math.min(1, Math.round((v.volume + delta) * 10) / 10));
    this.say(`VOLUME ${Math.round(v.volume * 10)}`, 1.6);
  }

  toggleOsd() {
    this.osd = !this.osd;
  }

  say(text: string, seconds: number) {
    this.notice = text;
    this.noticeUntil = performance.now() + seconds * 1000;
  }

  get currentTime() {
    return this.video.currentTime || 0;
  }

  get duration() {
    return Number.isFinite(this.video.duration) ? this.video.duration : (this.tape?.seconds ?? 0);
  }

  /** one frame of the LCD */
  draw(now: number) {
    const g = this.g;
    const v = this.video;
    if (this.state === "empty") {
      g.fillStyle = "#050607";
      g.fillRect(0, 0, W, H);
      return;
    }
    const live = (this.state === "playing" || this.state === "paused" || this.state === "searching") && v.readyState >= 2;
    if (live) {
      g.drawImage(v, 0, 0, W, H);
    } else {
      // the deck's own blue screen
      const blue = g.createLinearGradient(0, 0, 0, H);
      blue.addColorStop(0, "#1d3fcf");
      blue.addColorStop(1, "#1431a8");
      g.fillStyle = blue;
      g.fillRect(0, 0, W, H);
    }

    const text = (s: string, x: number, y: number, size: number, align: CanvasTextAlign = "left") => {
      g.font = `700 ${size}px "Inter Variable", "Inter", system-ui, sans-serif`;
      g.textAlign = align;
      g.textBaseline = "alphabetic";
      g.lineJoin = "round";
      g.lineWidth = Math.max(3, size / 7);
      g.strokeStyle = "rgba(0,0,0,0.85)";
      g.strokeText(s, x, y);
      g.fillStyle = "#fff";
      g.fillText(s, x, y);
    };

    const buffering = this.state === "playing" && (v.readyState < 3 || v.seeking);
    const mode = { loading: "", stopped: "■ STOP", playing: "▶ PLAY", paused: "❚❚ PAUSE", searching: this.searchDir < 0 ? "◀◀ REW" : "▶▶ FF", empty: "" }[this.state];
    if (this.osd || !live) {
      if (mode && !(this.state === "paused" && Math.floor(now / 600) % 2)) text(mode, 28, 56, 32);
      if (live) {
        text("SP", W - 28, 56, 26, "right");
        text(timecode(this.currentTime), 28, H - 32, 30);
      }
      if (buffering && Math.floor(now / 400) % 2) text("◌", W - 28, H - 32, 34, "right");
    }
    if (this.notice && (this.noticeUntil > now || this.noticeUntil === 0)) {
      text(this.notice, W / 2, H / 2 + 12, 36, "center");
    } else if (this.state === "stopped" && !this.notice) {
      text("TAPE STOPPED", W / 2, H / 2 + 12, 30, "center");
    }
  }
}
