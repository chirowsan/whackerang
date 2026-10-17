// Shared online constants + safe-name tools (no free-text chat anywhere: only these names and preset emotes).
export const PROTO = 1;
export const MAX_PLAYERS = 4;
export const CODE_LEN = 4; // v4.1: 4 letters (v4.0 used 5; 5-letter codes from old links are still accepted when joining)
export const CODE_MAX = 5;
export const CODE_ALPHA = 'BCDFGHJKLMNPQRSTVWXZ'; // consonants only: cannot spell words, easy to read aloud
export const ID_PREFIX = 'whkr4-', GUEST_PREFIX = 'whkg4-';
export const PAGES_URL = 'https://chirowsan.github.io/whackerang/';
export const DEFAULT_RELAY = 'wss://0.peerjs.com/peerjs?key=peerjs';
export const ICE_DEFAULT = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  // PeerJS project's own free community TURN (public credentials shipped in the PeerJS library). Best effort, no SLA: strict NATs may still fail.
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];
export const rndInt = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
export const makeCode = () => { let s = ''; for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHA[rndInt(CODE_ALPHA.length)]; return s; };
export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_MAX);
export const validCode = (s) => (s.length === CODE_LEN || s.length === CODE_MAX) && /^[A-Z]+$/.test(s);
export const rid = (n = 8) => { let s = ''; const a = 'abcdefghijkmnpqrstuvwxyz23456789'; for (let i = 0; i < n; i++) s += a[rndInt(a.length)]; return s; };
export const shareLink = (code) => `${PAGES_URL}?room=${code}`;

// ---- display names: pick from a kid-safe preset list, or type a short filtered name
export const PRESET_NAMES = ['Zippy Fox', 'Mighty Mango', 'Captain Boom', 'Sneaky Newt', 'Turbo Taco', 'Happy Hippo', 'Lucky Pear', 'Brave Bean', 'Jolly Jelly', 'Fuzzy Comet', 'Nifty Ninja', 'Sunny Otter', 'Cosmic Pup', 'Wacky Wombat', 'Peppy Panda', 'Bouncy Bee', 'Silly Seal', 'Rocket Duck', 'Giggly Gus', 'Cheeky Chick', 'Super Snail', 'Dizzy Dino', 'Funky Frog', 'Chill Penguin', 'Spicy Pepper', 'Wobbly Waffle', 'Zoom Zebra', 'Misty Moth', 'Daring Dove', 'Pixel Pal', 'Lemon Llama', 'Cuddly Crab'];
const BAD = ['fuck', 'fck', 'shit', 'sht', 'bitch', 'btch', 'cunt', 'pussy', 'penis', 'vagina', 'asshole', 'boobs', 'nigg', 'fag', 'retard', 'rape', 'rapist', 'nazi', 'hitler', 'porn', 'jizz', 'slut', 'whore', 'piss', 'bastard', 'wank', 'twat', 'dildo', 'suicide', 'murder', 'terror', 'isis', 'cocaine', 'nude', 'naked', 'horny', 'milf', 'jew', 'paki', 'chink', 'spic', 'dyke', 'idiot', 'stupid', 'dumb', 'loser', 'ugly', 'insta', 'tiktok', 'kik', 'discord', 'whatsapp', 'gmail', 'yahoo', 'http', 'www', 'dick', 'cock', 'sexy', 'sex69', 'cocain', 'fuk', 'fuc', 'biatch', 'nigga', 'niger', 'pedo', 'molest', 'kidnap', 'gun', 'bombing', 'killyou', 'killer', 'dumbass', 'dipshit', 'douche', 'wtf', 'stfu', 'bullshit'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i' };
const squash = (s) => s.toLowerCase().replace(/[0134578@$!9]/g, (c) => LEET[c]).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
export function cleanName(raw) {
  let s = String(raw == null ? '' : raw).normalize('NFKC').replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10).trim();
  if (s.length < 2) return null;
  if (/\d{4,}/.test(s.replace(/ /g, ''))) return null; // looks like a phone number / personal id
  const q = squash(s);
  for (const b of BAD) { const bq = b.replace(/(.)\1+/g, '$1'); if (bq.length >= 3 && q.includes(bq)) return null; }
  return s;
}
export const randomPreset = () => PRESET_NAMES[rndInt(PRESET_NAMES.length)];
// host-side: anything that arrives from the network is re-validated; invalid names are replaced by a safe preset
export const safeName = (raw) => (PRESET_NAMES.includes(raw) ? raw : cleanName(raw) || randomPreset());
export const LOBBY_EMOJI = ['👍', '😂', '😮', '🔥', '🪃', '👋'];
// modes offered online and what each one needs
export const ONLINE_MODES = ['classic', 'team', 'ctf', 'coins', 'ball', 'koth', 'bomb', 'crumble'];
export const TEAM_MODES = ['team', 'ctf', 'ball'];
