import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import * as toolCache from "@actions/tool-cache";
import * as os from "os";
import { chmodSync } from "fs";
import * as path from "path";

type Platform = "windows" | "macos-darwin" | "linux";

function getPlatform(): Platform {
	let platform = os.platform();
	if (platform === "win32") {
		return "windows"
	} else if (platform === "linux") {
		return "linux"
	} else if (platform === "darwin") {
		return "macos-darwin"
	} else {
		throw new Error(`Unsupported platform ${platform}!`);
	}
}
function fetchFromCache(version: string, platform: string): boolean {
	const cachedPath = toolCache.find("seal", version);
	if (cachedPath) {
		if (platform !== "windows") {
			chmodSync(path.join(cachedPath, "seal"), 0o755);
		}
		core.addPath(cachedPath);
		core.info("Added seal to PATH");
		core.setOutput("cache-hit", true);
		core.setOutput("path", cachedPath);
		core.setOutput("version", version);
		return true;
	}
	return false;
}

async function setup() {
	const REPOSITORY_OWNER = "seal-runtime";
	const REPOSITORY_NAME = "seal";
	try {
		const token = core.getInput("token");
		const version = core.getInput("version", { trimWhitespace: true }) || "latest";
		const shouldCache = core.getBooleanInput("cache") ?? true;
		const platform = getPlatform();
		const architecture = os.arch();
		const fileExtension = platform === "windows" ? "zip" : "tar.gz";
		const fileName = `seal-${version}-${platform}-${architecture}.${fileExtension}`;
		let resolvedVersion: string;
		let downloadUrl: string;
		if (version == "latest") {
			const octokit = getOctokit(token);
			const response = await octokit.rest.repos.getLatestRelease({
				owner: REPOSITORY_OWNER,
				repo: REPOSITORY_NAME
			});
			core.info("Retrieving latest release of seal");
			if (response.status !== 200) {
				throw new Error("Failed to retrieve latest release");
			}
			core.info("Successfully retrieved latest release of seal");
			const release = response.data;
			resolvedVersion = release.tag_name;
			if (fetchFromCache(resolvedVersion, platform)) {
				return;
			}
			const asset = release.assets.find(asset => asset.name.includes(`${platform}-${architecture}`));
			if (!asset) {
				throw new Error(`Unsupported release for platform ${platform} with architecture ${architecture}`);
			}
			downloadUrl = asset.browser_download_url;
		} else {
			resolvedVersion = version;
			downloadUrl = `https://github.com/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/releases/download/${version}/${fileName}`;
		}
		core.info(`Downloading seal from ${downloadUrl}`);
		const file = await toolCache.downloadTool(downloadUrl, undefined, token);
		core.info("Successfully downloaded seal");
		let sealPath = fileExtension === "zip" ?
			await toolCache.extractZip(file) :
			await toolCache.extractTar(file);
		core.info(`Extracted seal: ${sealPath}`);
		if (version.includes("v0.0.5")) {
			sealPath = `${sealPath}/${fileName}`;
		}
		if (platform !== "windows") {
			chmodSync(path.join(sealPath, "seal"), 0o755);
		}
		if (shouldCache) {
			await toolCache.cacheDir(sealPath, "seal", resolvedVersion);
			core.info("Cached seal for future workflows");
		}
		core.addPath(sealPath);
		core.info("Added seal to PATH");
		core.info("Successfully installed seal!");
		core.setOutput("cache-hit", false);
		core.setOutput("path", sealPath);
		core.setOutput("version", resolvedVersion);
	} catch (err) {
		core.setFailed((err as Error).message);
	}
}

setup();
