const BOOT_TIME_MS = 10_000;
const GLITCH_MIN_DELAY_MS = 12_000;
const GLITCH_MAX_DELAY_MS = 30_000;
const GLITCH_DURATION_MS = 1800;
const STORAGE_KEYS = {
	waveStrength: "vaporos-wave-strength",
	extraVibes: "vaporos-extra-vibes",
	windowPositions: "vaporos-window-positions",
	buddyIndex: "vaporos-buddy-index",
	startMenuOnBoot: "vaporos-start-menu-on-boot",
	chromaticOn: "vaporos-chromatic-on",
	scanlinesOn: "vaporos-scanlines-on",
	dreamModeOn: "vaporos-dream-mode-on",
	waveDistortionOn: "vaporos-wave-distortion-on"
};

const manifest = window.VAPOR_OS_MANIFEST || {};
const tracksFromManifest = manifest.musicTracks || [
	{ name: "Esprit - george clanton - trip ii the oc", file: "music/Esprit-george-clanton-trip-ii-the-oc.mp3" }
];
const buddiesFromManifest = manifest.buddies || [
	{ name: "Eevee", file: "images/eevee.gif" },
	{ name: "Pouring Ragnarok", file: "images/pouring-ragnarok.gif" }
];

const loadingScreen = document.getElementById("loading-screen");
const desktop = document.getElementById("desktop");
const openButtons = document.querySelectorAll("[data-open]");
const actionButtons = document.querySelectorAll("[data-action]");
const extraVibesButtons = document.querySelectorAll('[data-action="extra-vibes"]');
const closeButtons = document.querySelectorAll("[data-close]");
const taskbarLaunchButtons = document.querySelectorAll(".taskbar-launch");
const uiSfx = document.getElementById("ui-sfx");
const bootSfx = document.getElementById("boot-sfx");
const glitchSfx = document.getElementById("glitch-sfx");
const startButton = document.getElementById("start-button");
const startMenu = document.getElementById("start-menu");
const taskbarClock = document.getElementById("taskbar-clock");
const waveStrengthSlider = document.getElementById("wave-strength-slider");
const chromaticToggle = document.getElementById("chromatic-toggle");
const scanlinesToggle = document.getElementById("scanlines-toggle");
const dreamModeToggle = document.getElementById("dream-mode-toggle");
const waveDistortionToggle = document.getElementById("wave-distortion-toggle");
const startMenuOnBootCheckbox = document.getElementById("start-menu-on-boot");
const powerScreen = document.getElementById("power-screen");
const powerTitle = document.getElementById("power-title");
const powerMessage = document.getElementById("power-message");
const powerOnButton = document.getElementById("power-on");
const powerRestartButton = document.getElementById("power-restart");

let topZ = 20;
let extraVibesEnabled = false;
let glitchTimer = null;
let vibesRampFrameId = null;
let vibesRampStartTime = 0;
let configuredWaveStrength = 8;

const storedWaveStrength = window.localStorage.getItem(STORAGE_KEYS.waveStrength);
const storedExtraVibes = window.localStorage.getItem(STORAGE_KEYS.extraVibes);
const storedWindowPositions = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.windowPositions) || "{}");
const storedBuddyIndex = Number.parseInt(window.localStorage.getItem(STORAGE_KEYS.buddyIndex) || "0", 10);
const storedStartMenuOnBoot = window.localStorage.getItem(STORAGE_KEYS.startMenuOnBoot) === "true";

function readStoredToggle(key, defaultValue = true) {
	const value = window.localStorage.getItem(key);
	if (value === null) {
		return defaultValue;
	}
	return value === "true";
}

const storedChromaticOn = readStoredToggle(STORAGE_KEYS.chromaticOn, true);
const storedScanlinesOn = readStoredToggle(STORAGE_KEYS.scanlinesOn, true);
const storedDreamModeOn = readStoredToggle(STORAGE_KEYS.dreamModeOn, true);
const storedWaveDistortionOn = readStoredToggle(STORAGE_KEYS.waveDistortionOn, true);

function setWaveStrength(value) {
	configuredWaveStrength = Math.max(0, Math.min(100, Number(value)));
	const effectiveStrength = extraVibesEnabled ? configuredWaveStrength : Math.min(configuredWaveStrength, 10);
	const waveX = 1 + effectiveStrength / 10;
	const waveY = 1 + effectiveStrength / 12;
	document.body.style.setProperty("--wave-x", `${waveX}px`);
	document.body.style.setProperty("--wave-y", `${waveY}px`);
	window.localStorage.setItem(STORAGE_KEYS.waveStrength, String(configuredWaveStrength));
}

function setStartMenuOnBoot(enabled) {
	window.localStorage.setItem(STORAGE_KEYS.startMenuOnBoot, String(enabled));
	startMenuOnBootCheckbox.checked = enabled;
}

function setMode(className, storageKey, enabled, checkboxEl) {
	document.body.classList.toggle(className, enabled);
	window.localStorage.setItem(storageKey, String(enabled));
	if (checkboxEl) {
		checkboxEl.checked = enabled;
	}
}

function applyVibesRamp(ramp, rampSoft) {
	document.body.style.setProperty("--vibes-ramp", String(ramp));
	document.body.style.setProperty("--vibes-ramp-soft", String(rampSoft));
}

function stopVibesRamp() {
	if (vibesRampFrameId) {
		window.cancelAnimationFrame(vibesRampFrameId);
		vibesRampFrameId = null;
	}
	applyVibesRamp(0, 0);
}

function tickVibesRamp(now) {
	if (!extraVibesEnabled) {
		stopVibesRamp();
		return;
	}

	const t = (now - vibesRampStartTime) / 1000;
	const ramp = (Math.sin(t * 1.3) + 1) / 2;
	const rampSoft = (Math.sin((t * 0.9) + 1.2) + 1) / 2;
	applyVibesRamp(Number(ramp.toFixed(3)), Number(rampSoft.toFixed(3)));
	vibesRampFrameId = window.requestAnimationFrame(tickVibesRamp);
}

function startVibesRamp() {
	if (vibesRampFrameId) {
		return;
	}
	vibesRampStartTime = performance.now();
	vibesRampFrameId = window.requestAnimationFrame(tickVibesRamp);
}

function playSound(audioEl, filePath) {
	if (!audioEl) {
		return;
	}

	if (filePath) {
		audioEl.src = filePath;
	}
	audioEl.currentTime = 0;
	audioEl.play().catch(() => {});
}

document.addEventListener("click", () => {
	playSound(uiSfx, "SFX/click.mp3");
});

function bringToFront(el) {
	topZ += 1;
	el.style.zIndex = String(topZ);
}

function createDragGhost(targetEl, ghostLeft, ghostTop) {
	const ghost = targetEl.cloneNode(true);
	ghost.classList.add("drag-ghost");
	ghost.removeAttribute("id");
	ghost.style.left = `${ghostLeft}px`;
	ghost.style.top = `${ghostTop}px`;
	ghost.style.width = `${targetEl.offsetWidth}px`;
	ghost.style.height = `${targetEl.offsetHeight}px`;
	ghost.style.transform = getComputedStyle(targetEl).transform;
	document.body.appendChild(ghost);
	window.setTimeout(() => {
		ghost.remove();
	}, 440);
}

function createDragGhostTrail(targetEl, ghostLeft, ghostTop) {
	createDragGhost(targetEl, ghostLeft, ghostTop);

	if (!extraVibesEnabled) {
		return;
	}

	createDragGhost(targetEl, ghostLeft + 4, ghostTop - 3);
	createDragGhost(targetEl, ghostLeft - 6, ghostTop + 2);
}

function openWindow(id) {
	const win = document.getElementById(id);
	if (!win) {
		return;
	}
	win.classList.remove("hidden");
	bringToFront(win);
	updateTaskbarState();
	if (id === "visualizer-window") {
		startVisualizer();
	}
}

function closeWindow(id) {
	const win = document.getElementById(id);
	if (!win) {
		return;
	}
	playSound(uiSfx, "SFX/close.mp3");
	win.classList.add("hidden");
	updateTaskbarState();
	if (id === "visualizer-window") {
		stopVisualizer();
	}
}

function makeDraggable(targetEl, handleEl, {
	minY = 0,
	maxBottomOffset = 0,
	bringFront = false,
	onDrop = null,
	preventMouseDownDefault = true
} = {}) {
	let startX = 0;
	let startY = 0;
	let originalX = 0;
	let originalY = 0;
	let dragging = false;
	let moved = false;
	let lastGhostTime = 0;

	handleEl.addEventListener("mousedown", (event) => {
		dragging = true;
		moved = false;
		document.body.classList.add("dragging-surreality");
		if (bringFront) {
			bringToFront(targetEl);
		}

		const rect = targetEl.getBoundingClientRect();
		originalX = rect.left;
		originalY = rect.top;
		startX = event.clientX;
		startY = event.clientY;
		if (preventMouseDownDefault) {
			event.preventDefault();
		}
	});

	document.addEventListener("mousemove", (event) => {
		if (!dragging) {
			return;
		}

		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		if (!moved && Math.abs(dx) <= 3 && Math.abs(dy) <= 3) {
			return;
		}

		moved = true;
		const maxX = window.innerWidth - targetEl.offsetWidth;
		const maxY = window.innerHeight - maxBottomOffset - targetEl.offsetHeight;
		const nextLeft = Math.max(0, Math.min(maxX, originalX + dx));
		const nextTop = Math.max(minY, Math.min(maxY, originalY + dy));
		const now = performance.now();

		if (moved && now - lastGhostTime > 32) {
			createDragGhostTrail(
				targetEl,
				parseFloat(targetEl.style.left || `${targetEl.getBoundingClientRect().left}`),
				parseFloat(targetEl.style.top || `${targetEl.getBoundingClientRect().top}`)
			);
			lastGhostTime = now;
		}

		targetEl.style.left = `${nextLeft}px`;
		targetEl.style.top = `${nextTop}px`;
	});

	document.addEventListener("mouseup", () => {
		const hadDragged = dragging;
		if (dragging && moved && typeof onDrop === "function") {
			onDrop(targetEl);
		}
		dragging = false;
		moved = false;
		document.body.classList.remove("dragging-surreality");
		if (hadDragged) {
			const rect = targetEl.getBoundingClientRect();
			targetEl.dataset.savedLeft = `${rect.left}`;
			targetEl.dataset.savedTop = `${rect.top}`;
		}
	});
}

function arrangeIconsVertically() {
	const icons = Array.from(document.querySelectorAll(".program-icon"));
	const startX = 16;
	const startY = 24;
	const rowHeight = 102;
	const colWidth = 120;
	const usableHeight = Math.max(220, window.innerHeight - 86);
	const rowsPerColumn = Math.max(1, Math.floor((usableHeight - startY) / rowHeight));

	icons.forEach((icon, index) => {
		const column = Math.floor(index / rowsPerColumn);
		const row = index % rowsPerColumn;
		icon.style.left = `${startX + (column * colWidth)}px`;
		icon.style.top = `${startY + (row * rowHeight)}px`;
	});
}

function saveWindowPosition(windowEl) {
	const left = Number.parseFloat(windowEl.style.left || `${windowEl.getBoundingClientRect().left}`);
	const top = Number.parseFloat(windowEl.style.top || `${windowEl.getBoundingClientRect().top}`);
	const positions = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.windowPositions) || "{}");
	positions[windowEl.id] = { left, top };
	window.localStorage.setItem(STORAGE_KEYS.windowPositions, JSON.stringify(positions));
}

function restoreWindowPosition(windowEl, fallbackLeft, fallbackTop) {
	const savedPosition = storedWindowPositions[windowEl.id];
	windowEl.style.left = `${savedPosition?.left ?? fallbackLeft}px`;
	windowEl.style.top = `${savedPosition?.top ?? fallbackTop}px`;
}

function snapIconToGrid(icon) {
	const gridX = 116;
	const gridY = 102;
	const leftPad = 10;
	const topPad = 12;
	const maxX = window.innerWidth - icon.offsetWidth;
	const maxY = window.innerHeight - 46 - icon.offsetHeight;

	const rawLeft = parseInt(icon.style.left || "0", 10);
	const rawTop = parseInt(icon.style.top || "0", 10);

	const snappedLeft = Math.round((rawLeft - leftPad) / gridX) * gridX + leftPad;
	const snappedTop = Math.round((rawTop - topPad) / gridY) * gridY + topPad;

	icon.style.left = `${Math.max(0, Math.min(maxX, snappedLeft))}px`;
	icon.style.top = `${Math.max(0, Math.min(maxY, snappedTop))}px`;
}

document.querySelectorAll(".window").forEach((windowEl, index) => {
	restoreWindowPosition(windowEl, 170 + index * 44, 90 + index * 30);
	windowEl.addEventListener("mousedown", () => bringToFront(windowEl));
	const handle = windowEl.querySelector(".drag-handle");
	if (handle) {
		makeDraggable(windowEl, handle, {
			minY: 0,
			maxBottomOffset: 46,
			bringFront: true,
			onDrop: saveWindowPosition
		});
	}
});

arrangeIconsVertically();

document.querySelectorAll(".program-icon").forEach((icon) => {
	makeDraggable(icon, icon, {
		minY: 0,
		maxBottomOffset: 46,
		onDrop: snapIconToGrid,
		preventMouseDownDefault: false
	});
});

function updateTaskbarState() {
	taskbarLaunchButtons.forEach((button) => {
		const windowId = button.dataset.open;
		const win = document.getElementById(windowId);
		if (win && !win.classList.contains("hidden")) {
			button.classList.add("active");
		} else {
			button.classList.remove("active");
		}
	});
}

function updateExtraVibesButtons() {
	extraVibesButtons.forEach((button) => {
		const label = extraVibesEnabled ? "✨ EXTRA VIBES: ON" : "✨ EXTRA VIBES: OFF";
		const span = button.querySelector("span");
		if (span) {
			span.textContent = label.replace("✨ ", "");
		} else {
			button.textContent = label;
		}
	});
}

function setExtraVibes(enabled) {
	extraVibesEnabled = enabled;
	window.localStorage.setItem(STORAGE_KEYS.extraVibes, String(enabled));
	if (enabled) {
		document.body.classList.remove("booted", "glitching");
		document.body.classList.add("extra-vibes");
		setWaveStrength(configuredWaveStrength);
		startVibesRamp();
		if (glitchTimer) {
			window.clearTimeout(glitchTimer);
			glitchTimer = null;
		}
	} else {
		document.body.classList.remove("extra-vibes", "glitching");
		document.body.classList.add("booted");
		stopVibesRamp();
		setWaveStrength(configuredWaveStrength);
		scheduleGlitch();
	}
	updateExtraVibesButtons();
}

waveStrengthSlider.addEventListener("input", () => {
	setWaveStrength(waveStrengthSlider.value);
});

const initialWaveStrength = storedWaveStrength ?? waveStrengthSlider.value;
waveStrengthSlider.value = initialWaveStrength;
setWaveStrength(initialWaveStrength);
setStartMenuOnBoot(storedStartMenuOnBoot);
setMode("chromatic-on", STORAGE_KEYS.chromaticOn, storedChromaticOn, chromaticToggle);
setMode("scanlines-on", STORAGE_KEYS.scanlinesOn, storedScanlinesOn, scanlinesToggle);
setMode("dream-mode-on", STORAGE_KEYS.dreamModeOn, storedDreamModeOn, dreamModeToggle);
setMode("wave-distortion-on", STORAGE_KEYS.waveDistortionOn, storedWaveDistortionOn, waveDistortionToggle);

startMenuOnBootCheckbox.addEventListener("change", () => {
	setStartMenuOnBoot(startMenuOnBootCheckbox.checked);
});

chromaticToggle.addEventListener("change", () => {
	setMode("chromatic-on", STORAGE_KEYS.chromaticOn, chromaticToggle.checked, chromaticToggle);
});

scanlinesToggle.addEventListener("change", () => {
	setMode("scanlines-on", STORAGE_KEYS.scanlinesOn, scanlinesToggle.checked, scanlinesToggle);
});

dreamModeToggle.addEventListener("change", () => {
	setMode("dream-mode-on", STORAGE_KEYS.dreamModeOn, dreamModeToggle.checked, dreamModeToggle);
});

waveDistortionToggle.addEventListener("change", () => {
	setMode("wave-distortion-on", STORAGE_KEYS.waveDistortionOn, waveDistortionToggle.checked, waveDistortionToggle);
});

function bootDesktop() {
	powerScreen.classList.add("hidden");
	loadingScreen.classList.add("hidden");
	desktop.classList.remove("hidden");
	document.body.classList.remove("glitching", "extra-vibes");
	extraVibesEnabled = false;
	window.localStorage.setItem(STORAGE_KEYS.extraVibes, "false");
	document.body.classList.add("booted");
	stopVibesRamp();
	setWaveStrength(configuredWaveStrength);
	updateExtraVibesButtons();
	playSound(bootSfx);
	scheduleGlitch();
	updateTaskbarState();
	startMenu.classList.toggle("hidden", window.localStorage.getItem(STORAGE_KEYS.startMenuOnBoot) !== "true");
}

function powerOff(message) {
	desktop.classList.add("hidden");
	startMenu.classList.add("hidden");
	document.body.classList.remove("booted", "extra-vibes", "glitching");
	stopVibesRamp();
	powerTitle.textContent = "VaporOS";
	powerMessage.textContent = message;
	powerScreen.classList.remove("hidden");
	if (glitchTimer) {
		window.clearTimeout(glitchTimer);
		glitchTimer = null;
	}
}

function restartSystem() {
	powerOff("Restarting VaporOS...");
	window.setTimeout(() => {
		loadingScreen.classList.remove("hidden");
		window.setTimeout(bootDesktop, BOOT_TIME_MS);
	}, 1200);
}

openButtons.forEach((button) => {
	button.addEventListener("click", () => {
		openWindow(button.dataset.open);
		startMenu.classList.add("hidden");
	});
});

closeButtons.forEach((button) => {
	button.addEventListener("click", () => {
		closeWindow(button.dataset.close);
	});
});

actionButtons.forEach((button) => {
	if (button.dataset.action === "extra-vibes") {
		button.addEventListener("click", () => {
			setExtraVibes(!extraVibesEnabled);
			startMenu.classList.add("hidden");
		});
	}

	if (button.dataset.action === "shutdown") {
		button.addEventListener("click", () => {
			powerOff("System powered down.");
		});
	}

	if (button.dataset.action === "restart") {
		button.addEventListener("click", () => {
			restartSystem();
		});
	}
});

startButton.addEventListener("click", (event) => {
	event.stopPropagation();
	startMenu.classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
	if (!startMenu.contains(event.target) && event.target !== startButton && !startButton.contains(event.target)) {
		startMenu.classList.add("hidden");
	}
});

function updateClock() {
	const now = new Date();
	const hh = String(now.getHours()).padStart(2, "0");
	const mm = String(now.getMinutes()).padStart(2, "0");
	taskbarClock.textContent = `${hh}:${mm}`;
}
updateClock();
setInterval(updateClock, 1000);

function runGlitch() {
	if (extraVibesEnabled) {
		return;
	}

	document.body.classList.add("glitching");
	playSound(glitchSfx);
	setTimeout(() => {
		document.body.classList.remove("glitching");
		scheduleGlitch();
	}, GLITCH_DURATION_MS);
}

function scheduleGlitch() {
	if (extraVibesEnabled) {
		return;
	}

	if (glitchTimer) {
		window.clearTimeout(glitchTimer);
	}

	const delay = Math.floor(Math.random() * (GLITCH_MAX_DELAY_MS - GLITCH_MIN_DELAY_MS + 1)) + GLITCH_MIN_DELAY_MS;
	glitchTimer = window.setTimeout(runGlitch, delay);
}

setTimeout(() => {
	bootDesktop();
}, BOOT_TIME_MS);

powerOnButton.addEventListener("click", () => {
	loadingScreen.classList.remove("hidden");
	window.setTimeout(bootDesktop, BOOT_TIME_MS);
});

powerRestartButton.addEventListener("click", () => {
	restartSystem();
});

document.addEventListener("pointerdown", () => {
	if (bootSfx && bootSfx.paused && desktop.classList.contains("hidden")) {
		playSound(bootSfx);
	}
}, { once: true });

// Buddy interactions
const buddyImage = document.getElementById("buddy-image");
const buddyName = document.getElementById("buddy-name");
const prevBuddyButton = document.getElementById("prev-buddy");
const nextBuddyButton = document.getElementById("next-buddy");
let buddyIndex = 0;
const buddySounds = [
	"SFX/eevee.mp3",
	"SFX/pouring-ragnarok.mp3"
];

function setBuddy(index) {
	buddyIndex = (index + buddiesFromManifest.length) % buddiesFromManifest.length;
	const buddy = buddiesFromManifest[buddyIndex];
	buddyImage.src = buddy.file;
	buddyName.textContent = `Buddy: ${buddy.name}`;
	window.localStorage.setItem(STORAGE_KEYS.buddyIndex, String(buddyIndex));
}

buddyImage.addEventListener("click", (event) => {
	event.stopPropagation();
	buddyImage.classList.remove("buddy-pop");
	void buddyImage.offsetWidth;
	buddyImage.classList.add("buddy-pop");
	const buddySound = buddySounds[buddyIndex];
	if (buddySound) {
		playSound(uiSfx, buddySound);
	}
});

buddyImage.addEventListener("animationend", () => {
	buddyImage.classList.remove("buddy-pop");
});

prevBuddyButton.addEventListener("click", () => setBuddy(buddyIndex - 1));
nextBuddyButton.addEventListener("click", () => setBuddy(buddyIndex + 1));
setBuddy(Number.isFinite(storedBuddyIndex) ? storedBuddyIndex : 0);

// Music Player
const playlist = tracksFromManifest;
let trackIndex = 0;

const audio = document.getElementById("audio-player");
const songTitle = document.getElementById("song-title");
const playPauseButton = document.getElementById("play-pause");
const prevButton = document.getElementById("prev-track");
const nextButton = document.getElementById("next-track");
const seekBar = document.getElementById("seek-bar");
const volumeSlider = document.getElementById("volume-slider");
const currentTimeText = document.getElementById("current-time");
const durationText = document.getElementById("duration");
const visualizerCanvas = document.getElementById("visualizer-canvas");
const visualizerStatus = document.getElementById("visualizer-status");

let visualizerCtx = null;
let visualizerAudioCtx = null;
let visualizerAnalyser = null;
let visualizerSource = null;
let visualizerFrame = null;

function isVisualizerWindowOpen() {
	const visualizerWindow = document.getElementById("visualizer-window");
	return Boolean(visualizerWindow && !visualizerWindow.classList.contains("hidden"));
}

function ensureVisualizerSetup() {
	if (!visualizerCanvas || visualizerAudioCtx) {
		return;
	}

	visualizerCtx = visualizerCanvas.getContext("2d");

	const Ctx = window.AudioContext || window.webkitAudioContext;
	if (!Ctx) {
		if (visualizerStatus) {
			visualizerStatus.textContent = "Visualizer using fallback animation mode.";
		}
		return;
	}

	visualizerAudioCtx = new Ctx();
	visualizerAnalyser = visualizerAudioCtx.createAnalyser();
	visualizerAnalyser.fftSize = 1024;

	const captureStream = audio.captureStream || audio.mozCaptureStream;
	if (typeof captureStream !== "function") {
		visualizerAnalyser = null;
		if (visualizerStatus) {
			visualizerStatus.textContent = "Visualizer using fallback animation mode.";
		}
		return;
	}

	try {
		const stream = captureStream.call(audio);
		visualizerSource = visualizerAudioCtx.createMediaStreamSource(stream);
		visualizerSource.connect(visualizerAnalyser);
	} catch (_error) {
		visualizerAnalyser = null;
		if (visualizerStatus) {
			visualizerStatus.textContent = "Visualizer using fallback animation mode.";
		}
	}
}

function drawVisualizerFrame() {
	if (!visualizerCtx || !visualizerCanvas) {
		return;
	}

	const width = visualizerCanvas.width;
	const height = visualizerCanvas.height;
	const fallbackBarCount = 72;
	const fallbackBins = new Uint8Array(fallbackBarCount);
	const fallbackWave = new Uint8Array(512);
	let flatFrameCount = 0;

	function paintFallbackData() {
		const t = performance.now() * 0.003;
		const boost = audio.paused ? 0.1 : 0.65;
		for (let i = 0; i < fallbackBins.length; i += 1) {
			const ripple = Math.abs(Math.sin(t + i * 0.19));
			const pulse = Math.abs(Math.sin((t * 1.6) + (audio.currentTime * 2.2) + (i * 0.05)));
			fallbackBins[i] = Math.floor(Math.min(255, (18 + ripple * 110 + pulse * 118) * boost));
		}

		for (let i = 0; i < fallbackWave.length; i += 1) {
			const phase = (i / fallbackWave.length) * (Math.PI * 4);
			const y = Math.sin(phase + (t * 1.8)) * (audio.paused ? 14 : 42);
			fallbackWave[i] = Math.max(0, Math.min(255, Math.floor(128 + y)));
		}
	}

	const render = () => {
		let bins = fallbackBins;
		let wave = fallbackWave;
		let useFallback = !visualizerAnalyser;

		if (!useFallback) {
			bins = new Uint8Array(visualizerAnalyser.frequencyBinCount);
			wave = new Uint8Array(visualizerAnalyser.fftSize);
			visualizerAnalyser.getByteFrequencyData(bins);
			visualizerAnalyser.getByteTimeDomainData(wave);

			let energy = 0;
			for (let i = 0; i < bins.length; i += 16) {
				energy += bins[i];
			}

			if (!audio.paused && energy < 140) {
				flatFrameCount += 1;
			} else {
				flatFrameCount = 0;
			}

			if (flatFrameCount > 8) {
				useFallback = true;
			}
		}

		if (useFallback) {
			paintFallbackData();
			bins = fallbackBins;
			wave = fallbackWave;
		}

		visualizerCtx.clearRect(0, 0, width, height);
		const bgGradient = visualizerCtx.createLinearGradient(0, 0, width, height);
		bgGradient.addColorStop(0, "rgba(18, 10, 38, 0.45)");
		bgGradient.addColorStop(0.5, "rgba(49, 18, 82, 0.35)");
		bgGradient.addColorStop(1, "rgba(10, 31, 56, 0.38)");
		visualizerCtx.fillStyle = bgGradient;
		visualizerCtx.fillRect(0, 0, width, height);

		const barCount = 72;
		const step = Math.max(1, Math.floor(bins.length / barCount));
		const barWidth = width / barCount;
		for (let i = 0; i < barCount; i += 1) {
			const value = bins[Math.min(bins.length - 1, i * step)] / 255;
			const barHeight = value * (height * 0.74);
			const x = i * barWidth;
			const y = height - barHeight;
			const hue = 280 + ((i / barCount) * 90);
			visualizerCtx.fillStyle = `hsl(${hue}, 95%, ${46 + value * 20}%)`;
			visualizerCtx.fillRect(x + 1, y, Math.max(2, barWidth - 3), barHeight);
		}

		visualizerCtx.beginPath();
		visualizerCtx.lineWidth = 2;
		visualizerCtx.strokeStyle = "rgba(110, 245, 255, 0.98)";
		for (let i = 0; i < wave.length; i += 1) {
			const x = (i / (wave.length - 1)) * width;
			const y = (wave[i] / 255) * (height * 0.45) + (height * 0.08);
			if (i === 0) {
				visualizerCtx.moveTo(x, y);
			} else {
				visualizerCtx.lineTo(x, y);
			}
		}
		visualizerCtx.shadowBlur = 10;
		visualizerCtx.shadowColor = "rgba(99, 102, 241, 0.75)";
		visualizerCtx.stroke();
		visualizerCtx.shadowBlur = 0;

		visualizerFrame = window.requestAnimationFrame(render);
	};

	if (!visualizerFrame) {
		render();
	}
}

function startVisualizer() {
	ensureVisualizerSetup();
	if (!visualizerCtx) {
		return;
	}

	if (visualizerAudioCtx && visualizerAudioCtx.state === "suspended") {
		visualizerAudioCtx.resume().catch(() => {});
	}

	if (visualizerStatus) {
		visualizerStatus.textContent = audio.paused ? "Visualizer ready. Press play in Music Player." : "Live audio visualizer active.";
	}
	drawVisualizerFrame();
}

function stopVisualizer() {
	if (visualizerFrame) {
		window.cancelAnimationFrame(visualizerFrame);
		visualizerFrame = null;
	}
}

function formatTime(timeInSeconds) {
	const total = Number.isFinite(timeInSeconds) ? Math.floor(timeInSeconds) : 0;
	const mins = Math.floor(total / 60);
	const secs = String(total % 60).padStart(2, "0");
	return `${mins}:${secs}`;
}

function loadTrack(index, autoplay = false) {
	const track = playlist[index];
	if (!track) {
		songTitle.textContent = "No tracks in manifest.js";
		playPauseButton.textContent = "▶";
		return;
	}

	audio.src = track.file;
	songTitle.textContent = `Now Playing: ${track.name}`;

	if (autoplay) {
		audio.play().then(() => {
			playPauseButton.textContent = "⏸";
		}).catch(() => {
			playPauseButton.textContent = "▶";
		});
	} else {
		playPauseButton.textContent = "▶";
	}
}

function nextTrack(autoplay = true) {
	if (playlist.length === 0) {
		return;
	}
	trackIndex = (trackIndex + 1) % playlist.length;
	loadTrack(trackIndex, autoplay);
}

function prevTrack() {
	if (playlist.length === 0) {
		return;
	}
	trackIndex = (trackIndex - 1 + playlist.length) % playlist.length;
	loadTrack(trackIndex, true);
}

playPauseButton.addEventListener("click", () => {
	if (isVisualizerWindowOpen()) {
		startVisualizer();
	}
	if (!audio.src) {
		loadTrack(trackIndex, true);
		return;
	}

	if (audio.paused) {
		audio.play().then(() => {
			playPauseButton.textContent = "⏸";
			if (visualizerStatus) {
				visualizerStatus.textContent = "Live audio visualizer active.";
			}
		}).catch(() => {
			playPauseButton.textContent = "▶";
		});
	} else {
		audio.pause();
		playPauseButton.textContent = "▶";
		if (visualizerStatus) {
			visualizerStatus.textContent = "Paused.";
		}
	}
});

nextButton.addEventListener("click", () => nextTrack(true));
prevButton.addEventListener("click", prevTrack);

audio.addEventListener("loadedmetadata", () => {
	seekBar.value = "0";
	durationText.textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
	if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
		return;
	}
	seekBar.value = String((audio.currentTime / audio.duration) * 100);
	currentTimeText.textContent = formatTime(audio.currentTime);
});

audio.addEventListener("ended", () => {
	nextTrack(true);
});

audio.addEventListener("play", () => {
	if (isVisualizerWindowOpen()) {
		startVisualizer();
	}
	if (visualizerStatus) {
		visualizerStatus.textContent = "Live audio visualizer active.";
	}
});

audio.addEventListener("pause", () => {
	if (visualizerStatus) {
		visualizerStatus.textContent = "Paused.";
	}
});

seekBar.addEventListener("input", () => {
	if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
		return;
	}
	audio.currentTime = (Number(seekBar.value) / 100) * audio.duration;
});

volumeSlider.addEventListener("input", () => {
	audio.volume = Number(volumeSlider.value);
});

audio.volume = Number(volumeSlider.value);
loadTrack(trackIndex, false);
updateTaskbarState();
updateExtraVibesButtons();

if (window.cursoreffects && typeof window.cursoreffects.ghostCursor === "function") {
	new window.cursoreffects.ghostCursor();
}

// Tabs for games
const tabButtons = document.querySelectorAll(".tab");
const panels = {
	ttt: document.getElementById("ttt-panel"),
	solitaire: document.getElementById("solitaire-panel")
};

tabButtons.forEach((tab) => {
	tab.addEventListener("click", () => {
		tabButtons.forEach((btn) => btn.classList.remove("active"));
		tab.classList.add("active");

		Object.values(panels).forEach((panel) => panel.classList.remove("active"));
		panels[tab.dataset.tab].classList.add("active");
	});
});

// Tic-Tac-Toe
const tttGrid = document.getElementById("ttt-grid");
const tttStatus = document.getElementById("ttt-status");
const tttReset = document.getElementById("ttt-reset");

let tttBoard = Array(9).fill("");
let tttTurn = "X";
let tttOver = false;

const tttWinLines = [
	[0, 1, 2], [3, 4, 5], [6, 7, 8],
	[0, 3, 6], [1, 4, 7], [2, 5, 8],
	[0, 4, 8], [2, 4, 6]
];

function renderTTT() {
	tttGrid.innerHTML = "";
	tttBoard.forEach((value, index) => {
		const cell = document.createElement("button");
		cell.className = "ttt-cell";
		cell.textContent = value;
		cell.addEventListener("click", () => playTTT(index));
		tttGrid.appendChild(cell);
	});
}

function playTTT(index) {
	if (tttOver || tttBoard[index]) {
		return;
	}

	tttBoard[index] = tttTurn;
	const winner = tttWinLines.find(([a, b, c]) => tttBoard[a] && tttBoard[a] === tttBoard[b] && tttBoard[a] === tttBoard[c]);

	if (winner) {
		tttStatus.textContent = `Player ${tttTurn} wins!`;
		tttOver = true;
	} else if (tttBoard.every(Boolean)) {
		tttStatus.textContent = "Draw game!";
		tttOver = true;
	} else {
		tttTurn = tttTurn === "X" ? "O" : "X";
		tttStatus.textContent = `Player ${tttTurn}'s turn`;
	}

	renderTTT();
}

tttReset.addEventListener("click", () => {
	tttBoard = Array(9).fill("");
	tttTurn = "X";
	tttOver = false;
	tttStatus.textContent = "Player X's turn";
	renderTTT();
});

renderTTT();

// Solitaire Lite (up/down stack rules)
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["♠", "♥", "♦", "♣"];

const drawCardButton = document.getElementById("draw-card");
const playWasteButton = document.getElementById("play-waste");
const solitaireReset = document.getElementById("solitaire-reset");
const stockCount = document.getElementById("stock-count");
const wasteCardEl = document.getElementById("waste-card");
const foundationCardEl = document.getElementById("foundation-card");
const solitaireStatus = document.getElementById("solitaire-status");

let stock = [];
let waste = null;
let foundation = null;

function makeDeck() {
	const deck = [];
	for (const suit of suits) {
		for (const rank of ranks) {
			deck.push({ rank, suit, value: ranks.indexOf(rank) });
		}
	}
	for (let i = deck.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
}

function cardLabel(card) {
	return card ? `${card.rank}${card.suit}` : "--";
}

function renderSolitaire() {
	stockCount.textContent = `Cards left: ${stock.length}`;
	wasteCardEl.textContent = cardLabel(waste);
	foundationCardEl.textContent = cardLabel(foundation);
}

function isAdjacentRank(a, b) {
	if (!a || !b) {
		return false;
	}

	const diff = Math.abs(a.value - b.value);
	return diff === 1 || diff === 12;
}

function resetSolitaire() {
	stock = makeDeck();
	waste = null;
	foundation = null;
	solitaireStatus.textContent = "Draw a card, then play matching up/down ranks.";
	renderSolitaire();
}

drawCardButton.addEventListener("click", () => {
	if (stock.length === 0) {
		solitaireStatus.textContent = "No more stock cards. Start a new game.";
		return;
	}

	waste = stock.pop();
	if (!foundation) {
		foundation = waste;
		waste = null;
		solitaireStatus.textContent = "First card placed on stack. Draw again.";
	}
	renderSolitaire();
});

playWasteButton.addEventListener("click", () => {
	if (!waste) {
		solitaireStatus.textContent = "Draw a card first.";
		return;
	}

	if (isAdjacentRank(waste, foundation)) {
		foundation = waste;
		waste = null;
		solitaireStatus.textContent = "Nice move!";
	} else {
		solitaireStatus.textContent = "That rank does not connect. Draw again.";
	}

	if (stock.length === 0 && !waste) {
		solitaireStatus.textContent = "You cleared it. Vapor victory!";
	}
	renderSolitaire();
});

solitaireReset.addEventListener("click", resetSolitaire);
resetSolitaire();

// Photo Viewer
const photoImages = [
	{ src: "images/Bliss_alt.jpg", name: "Bliss Alt" },
	{ src: "images/Bliss_vibes.gif", name: "Bliss Vibes" },
	{ src: "images/vaporwave-disco.gif", name: "Vaporwave Disco" },
	{ src: "images/glitch.gif", name: "Glitch Loop" }
];

let photoIndex = 0;
const photoViewerImage = document.getElementById("photo-viewer-image");
const photoCaption = document.getElementById("photo-caption");
const photoPrev = document.getElementById("photo-prev");
const photoNext = document.getElementById("photo-next");

function renderPhoto() {
	const photo = photoImages[photoIndex];
	photoViewerImage.src = photo.src;
	photoCaption.textContent = photo.name;
}

photoPrev.addEventListener("click", () => {
	photoIndex = (photoIndex - 1 + photoImages.length) % photoImages.length;
	renderPhoto();
});

photoNext.addEventListener("click", () => {
	photoIndex = (photoIndex + 1) % photoImages.length;
	renderPhoto();
});
renderPhoto();

// Paint Lite
const paintCanvas = document.getElementById("paint-canvas");
const paintCtx = paintCanvas.getContext("2d");
const paintColor = document.getElementById("paint-color");
const paintSize = document.getElementById("paint-size");
const paintClear = document.getElementById("paint-clear");

let painting = false;

function canvasPoint(event) {
	const rect = paintCanvas.getBoundingClientRect();
	return {
		x: (event.clientX - rect.left) * (paintCanvas.width / rect.width),
		y: (event.clientY - rect.top) * (paintCanvas.height / rect.height)
	};
}

paintCtx.fillStyle = "#ffffff";
paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
paintCtx.lineCap = "round";
paintCtx.lineJoin = "round";

paintCanvas.addEventListener("pointerdown", (event) => {
	painting = true;
	const { x, y } = canvasPoint(event);
	paintCtx.beginPath();
	paintCtx.moveTo(x, y);
});

paintCanvas.addEventListener("pointermove", (event) => {
	if (!painting) {
		return;
	}
	const { x, y } = canvasPoint(event);
	paintCtx.strokeStyle = paintColor.value;
	paintCtx.lineWidth = Number(paintSize.value);
	paintCtx.lineTo(x, y);
	paintCtx.stroke();
});

document.addEventListener("pointerup", () => {
	painting = false;
});

paintClear.addEventListener("click", () => {
	paintCtx.fillStyle = "#ffffff";
	paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
});

// Chat Client
const chatContact = document.getElementById("chat-contact");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
let pendingChatReplyTimer = null;

function addChatLine(sender, text) {
	const line = document.createElement("p");
	line.textContent = `${sender}: ${text}`;
	chatLog.appendChild(line);
	chatLog.scrollTop = chatLog.scrollHeight;
}

function getBotReply(name) {
	const replies = {
		Eevee: ["vibes detected ✨", "want to listen to synthwave?", "i found a pixel snack."],
		Ragnarok: ["pouring mode engaged.", "the glitch sea is calm.", "hold onto your CRT."],
		VaporBot: ["/me echoes through cyberspace", "signal stable. nostalgia rising.", "loading dreamscape..."]
	};
	const pool = replies[name] || replies.VaporBot;
	return pool[Math.floor(Math.random() * pool.length)];
}

function sendChat() {
	const message = chatInput.value.trim();
	if (!message) {
		return;
	}
	const contact = chatContact.value;
	addChatLine("You", message);
	chatInput.value = "";
	pendingChatReplyTimer = window.setTimeout(() => {
		addChatLine(contact, getBotReply(contact));
		pendingChatReplyTimer = null;
	}, 450);
}

chatContact.addEventListener("change", () => {
	if (pendingChatReplyTimer) {
		window.clearTimeout(pendingChatReplyTimer);
		pendingChatReplyTimer = null;
	}
	chatLog.innerHTML = "";
	addChatLine("System", `Connected to ${chatContact.value}.`);
});

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		sendChat();
	}
});
addChatLine("System", `Connected to ${chatContact.value}.`);

// System Monitor
const monitorCPU = document.getElementById("monitor-cpu");
const monitorRAM = document.getElementById("monitor-ram");
const monitorFlux = document.getElementById("monitor-flux");
const meterCPU = document.getElementById("meter-cpu");
const meterRAM = document.getElementById("meter-ram");
const meterFlux = document.getElementById("meter-flux");

function updateMonitor() {
	const cpu = Math.floor(15 + Math.random() * 70 + (extraVibesEnabled ? 12 : 0));
	const ram = Math.floor(22 + Math.random() * 62 + (extraVibesEnabled ? 10 : 0));
	const flux = Math.floor((Math.random() * 40) + (extraVibesEnabled ? 45 : 8));

	monitorCPU.textContent = `${cpu}%`;
	monitorRAM.textContent = `${ram}%`;
	monitorFlux.textContent = `${flux}%`;
	meterCPU.style.width = `${Math.min(cpu, 100)}%`;
	meterRAM.style.width = `${Math.min(ram, 100)}%`;
	meterFlux.style.width = `${Math.min(flux, 100)}%`;
}

updateMonitor();
setInterval(updateMonitor, 1000);

// Glitch Console
const consoleLog = document.getElementById("console-log");
const consoleInput = document.getElementById("console-input");
const consoleRun = document.getElementById("console-run");

function logConsole(text) {
	const line = document.createElement("p");
	line.textContent = text;
	consoleLog.appendChild(line);
	consoleLog.scrollTop = consoleLog.scrollHeight;
}

function runConsoleCommand() {
	const raw = consoleInput.value.trim();
	if (!raw) {
		return;
	}
	logConsole(`> ${raw}`);
	consoleInput.value = "";
	const cmd = raw.toLowerCase();

	if (cmd === "vibes on") {
		setExtraVibes(true);
		logConsole("EXTRA VIBES enabled.");
		return;
	}
	if (cmd === "vibes off") {
		setExtraVibes(false);
		logConsole("EXTRA VIBES disabled.");
		return;
	}
	if (cmd === "dream on") {
		setMode("dream-mode-on", STORAGE_KEYS.dreamModeOn, true, dreamModeToggle);
		logConsole("Dream mode enabled.");
		return;
	}
	if (cmd === "dream off") {
		setMode("dream-mode-on", STORAGE_KEYS.dreamModeOn, false, dreamModeToggle);
		logConsole("Dream mode disabled.");
		return;
	}
	if (cmd === "glitch now") {
		if (!extraVibesEnabled) {
			runGlitch();
			logConsole("Forced glitch triggered.");
		} else {
			logConsole("Unavailable while EXTRA VIBES is enabled.");
		}
		return;
	}
	if (cmd === "help") {
		logConsole("Commands: vibes on/off | dream on/off | glitch now | screensaver");
		return;
	}
	if (cmd === "screensaver") {
		startScreensaver();
		logConsole("Screensaver launched.");
		return;
	}

	logConsole("Unknown command. Try 'help'.");
}

consoleRun.addEventListener("click", runConsoleCommand);
consoleInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		runConsoleCommand();
	}
});
logConsole("Type 'help' for commands.");

// Retro Browser
const browserFrame = document.getElementById("browser-frame");
const browserUrl = document.getElementById("browser-url");
const browserGo = document.getElementById("browser-go");
const browserBack = document.getElementById("browser-back");
const browserForward = document.getElementById("browser-forward");
const browserHome = document.getElementById("browser-home");
const browserOpenExternal = document.getElementById("browser-open-external");
const browserStatus = document.getElementById("browser-status");

const browserHomeUrl = "https://web.archive.org/web/19981202230410/http://google.stanford.edu/";
const browserHistory = [browserHomeUrl];
let browserHistoryIndex = 0;

function normalizeBrowserURL(value) {
	const trimmed = value.trim();
	if (!trimmed) {
		return browserHomeUrl;
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

function navigateBrowser(url, pushHistory = true) {
	const safeUrl = normalizeBrowserURL(url);
	browserFrame.src = safeUrl;
	browserUrl.value = safeUrl;
	browserStatus.textContent = "If this page blocks embedding, use Open Tab.";

	if (pushHistory) {
		browserHistory.splice(browserHistoryIndex + 1);
		browserHistory.push(safeUrl);
		browserHistoryIndex = browserHistory.length - 1;
	}
}

browserGo.addEventListener("click", () => navigateBrowser(browserUrl.value, true));
browserUrl.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		navigateBrowser(browserUrl.value, true);
	}
});
browserBack.addEventListener("click", () => {
	if (browserHistoryIndex > 0) {
		browserHistoryIndex -= 1;
		navigateBrowser(browserHistory[browserHistoryIndex], false);
	}
});
browserForward.addEventListener("click", () => {
	if (browserHistoryIndex < browserHistory.length - 1) {
		browserHistoryIndex += 1;
		navigateBrowser(browserHistory[browserHistoryIndex], false);
	}
});
browserHome.addEventListener("click", () => navigateBrowser(browserHomeUrl, true));
browserOpenExternal.addEventListener("click", () => {
	window.open(normalizeBrowserURL(browserUrl.value), "_blank", "noopener,noreferrer");
});
	navigateBrowser(browserHomeUrl, false);

// Screensaver
const screensaverOverlay = document.getElementById("screensaver-overlay");
const screensaverLogo = document.getElementById("screensaver-logo");
const startScreensaverButton = document.getElementById("start-screensaver");

let screensaverRunning = false;
let screensaverX = 22;
let screensaverY = 24;
let screensaverDX = 2.4;
let screensaverDY = 2;
let screensaverFrame = null;

function stopScreensaver() {
	if (screensaverFrame) {
		window.cancelAnimationFrame(screensaverFrame);
		screensaverFrame = null;
	}
	screensaverRunning = false;
	screensaverOverlay.classList.add("hidden");
}

function animateScreensaver() {
	if (!screensaverRunning) {
		return;
	}

	const maxX = window.innerWidth - screensaverLogo.offsetWidth;
	const maxY = window.innerHeight - screensaverLogo.offsetHeight;
	screensaverX += screensaverDX;
	screensaverY += screensaverDY;

	if (screensaverX <= 0 || screensaverX >= maxX) {
		screensaverDX *= -1;
	}
	if (screensaverY <= 0 || screensaverY >= maxY) {
		screensaverDY *= -1;
	}

	screensaverLogo.style.left = `${Math.max(0, Math.min(maxX, screensaverX))}px`;
	screensaverLogo.style.top = `${Math.max(0, Math.min(maxY, screensaverY))}px`;
	screensaverFrame = window.requestAnimationFrame(animateScreensaver);
}

function startScreensaver() {
	screensaverRunning = true;
	screensaverOverlay.classList.remove("hidden");
	screensaverX = 22;
	screensaverY = 24;
	animateScreensaver();
}

startScreensaverButton.addEventListener("click", startScreensaver);
screensaverOverlay.addEventListener("click", stopScreensaver);
