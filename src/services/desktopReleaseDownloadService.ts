import axios from "axios";
import type { Readable } from "node:stream";

export type DesktopDownloadPlatform = "windows" | "linux";

type ReleaseAsset = { name?: string; browser_download_url?: string };
type LatestRelease = { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: ReleaseAsset[] };
type CachedRelease = { release: LatestRelease; expiresAt: number };

const RELEASE_API_URL = "https://api.github.com/repos/everpeaknp/teamsever-frontend/releases/latest";
const ASSET_NAME: Record<DesktopDownloadPlatform, string> = {
  windows: "TeamsEver-Setup.exe",
  linux: "TeamsEver.AppImage",
};
const CACHE_TTL_MS = 5 * 60_000;
let cachedRelease: CachedRelease | null = null;
let releaseRequest: Promise<LatestRelease> | null = null;

async function getLatestRelease(): Promise<LatestRelease> {
  if (cachedRelease && cachedRelease.expiresAt > Date.now()) return cachedRelease.release;
  if (!releaseRequest) {
    releaseRequest = axios.get<LatestRelease>(RELEASE_API_URL, {
      timeout: 15_000,
      headers: { Accept: "application/vnd.github+json", "User-Agent": "TeamsEver-Desktop-Downloads" },
    }).then(({ data }) => {
      if (!data || data.draft || data.prerelease || !Array.isArray(data.assets)) {
        throw new Error("No published desktop release is available");
      }
      cachedRelease = { release: data, expiresAt: Date.now() + CACHE_TTL_MS };
      return data;
    }).finally(() => {
      releaseRequest = null;
    });
  }
  return releaseRequest;
}

function hasAsset(release: LatestRelease, platform: DesktopDownloadPlatform): boolean {
  return release.assets!.some((asset) => asset.name === ASSET_NAME[platform] &&
    typeof asset.browser_download_url === "string" &&
    asset.browser_download_url.startsWith("https://github.com/everpeaknp/teamsever-frontend/releases/download/"));
}

export async function getDesktopDownloadAvailability() {
  const release = await getLatestRelease();
  return {
    version: typeof release.tag_name === "string" ? release.tag_name.replace(/^desktop-v/, "") : null,
    windows: hasAsset(release, "windows"),
    linux: hasAsset(release, "linux"),
  };
}

export async function openDesktopDownload(platform: DesktopDownloadPlatform): Promise<{ stream: Readable; contentLength: number | null }> {
  const release = await getLatestRelease();
  const asset = release.assets!.find((candidate) => candidate.name === ASSET_NAME[platform] &&
    typeof candidate.browser_download_url === "string" &&
    candidate.browser_download_url.startsWith("https://github.com/everpeaknp/teamsever-frontend/releases/download/"));
  if (!asset?.browser_download_url) throw new Error("The selected desktop installer is not published");

  const upstream = await axios.get<Readable>(asset.browser_download_url, {
    responseType: "stream",
    timeout: 30_000,
    maxRedirects: 5,
    headers: { Accept: "application/octet-stream", "User-Agent": "TeamsEver-Desktop-Downloads" },
  });
  const length = Number(upstream.headers["content-length"]);
  return { stream: upstream.data, contentLength: Number.isSafeInteger(length) && length > 0 ? length : null };
}

export function clearDesktopReleaseCacheForTests(): void {
  cachedRelease = null;
  releaseRequest = null;
}
