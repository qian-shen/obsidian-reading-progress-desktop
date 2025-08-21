import { Fullscreen } from "components/Fullscreen";
import {
	Plugin,
	Platform
} from "obsidian";
import { ReadingProgress } from "components/ReadingProgress";
import { DEFAULT_SETTINGS, ReadingProgressSettings, ReadingProgressSettingTab } from "settings/Settings";
import { ViewType } from "components/ViewType";

export default class ReadingProgressStatusBarPlugin extends Plugin {
	rp: ReadingProgress;
	fs: Fullscreen;
	vt: ViewType;
	st: ReadingProgressSettings;
	async onload() {
		if (!Platform.isDesktopApp) {
			return;
		}

		await this.loadSettings();
		this.addSettingTab(new ReadingProgressSettingTab(this.app, this));

		this.rp = new ReadingProgress(this);
		this.fs = new Fullscreen(this);
		this.vt = new ViewType(this);

		this.rp.initReadingProgress();
		this.fs.initFullscreen();
		this.vt.initViewType();
	}

	// 加载配置的方法
    async loadSettings() {
        this.st = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    // 保存配置的方法
    async saveSettings() {
        await this.saveData(this.st);
    }

	onunload() {
		this.rp.unload();
	}
}
