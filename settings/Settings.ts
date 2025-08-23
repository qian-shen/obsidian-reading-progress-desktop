import ReadingProgressStatusBarPlugin from "main";
import { App, PluginSettingTab, Setting, SliderComponent } from "obsidian";
import { t } from "translations/helper";

export interface ReadingProgressSettings {
    showFullscreenButton: boolean,
    showViewType: boolean,
    readingProgressLength: number,
    progressBorderLength: number,
    enableShineFlow: boolean
}

export const DEFAULT_SETTINGS: ReadingProgressSettings = {
    showFullscreenButton: true,
    showViewType: true,
    readingProgressLength: 172,
    progressBorderLength: 172,
    enableShineFlow: false
}

export class ReadingProgressSettingTab extends PluginSettingTab {
    plugin: ReadingProgressStatusBarPlugin;
    st: ReadingProgressSettings;
    slider: SliderComponent;

    constructor(app: App, plugin: ReadingProgressStatusBarPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display = () => {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.addClass("reading-progress-desktop-setting");
        
        const readingProgressBackground = containerEl.createEl("div", { cls: "reading-progress-desktop-background" });

        new Setting(containerEl).setName(t("Progress bar")).setHeading();

        new Setting(containerEl)
            .setName(t("Length of progress bar"))
            .setDesc(t("Adjust the length of the progress bar"))
            .addSlider((slider) => {
                this.slider = slider;
                let debounceTimer: NodeJS.Timeout;

                slider
                    .setValue(this.plugin.st.readingProgressLength - 122)
                    .setLimits(1, 100, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        clearTimeout(debounceTimer);
                        const actualValue = this.updateProgressBar(value);

                        this.plugin.st.readingProgressLength = actualValue;
                        this.plugin.st.progressBorderLength = actualValue;
                        await this.plugin.saveSettings();
                    });

                // 实时输入监听，带防抖
                slider.sliderEl.addEventListener("input", (event) => {
                    const target = event.target as HTMLInputElement;
                    const value = parseInt(target.value);

                    // 清除之前的定时器
                    clearTimeout(debounceTimer);

                    // 立即更新UI
                    this.updateProgressBar(value);

                    // 设置防抖，避免过于频繁的保存操作
                    debounceTimer = setTimeout(async () => {
                        const actualValue = value + 122;
                        this.plugin.st.readingProgressLength = actualValue;
                        this.plugin.st.progressBorderLength = actualValue;
                        await this.plugin.saveSettings();
                    }, 300); // 300ms防抖
                });

                slider.sliderEl.addEventListener("mousedown", (e) => {
                    const statusBar = document.querySelector(".app-container .status-bar") as HTMLElement;
                    if (statusBar) {
                        statusBar.addClass("highlight");
                    }
                    if (readingProgressBackground) {
                        readingProgressBackground.addClass("active")
                    }
                    this.plugin.rp.progressBorder.addClass("active");

                    const onMouseUp = () => {
                        // 释放逻辑
                        if (readingProgressBackground) {
                            readingProgressBackground.removeClass("active")
                        }
                        if (readingProgressBackground) {
                            readingProgressBackground.removeClass("active")
                        }
                        this.plugin.rp.progressBorder.removeClass("active");
                        document.removeEventListener("mouseup", onMouseUp);
                    };

                    document.addEventListener("mouseup", onMouseUp);
                });


            }).addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("Restore default length"), { placement: "right" })
                    .onClick(() => this.resetToDefault(this.slider));
            });

        new Setting(containerEl)
            .setName(t("Enable the progress bar flowing light effect"))
            .setDesc(t("Enable the progress bar flowing light animation"))
            .addToggle((toggle) => {
                toggle
                    .setValue(
                        this.plugin.st.enableShineFlow
                    )
                    .onChange(async (value) => {
                        this.plugin.st.enableShineFlow =
                            value;
                        await this.plugin.saveSettings();
                        this.plugin.rp.toggleReadingProgressShineFlow(this.plugin.st.enableShineFlow);
                    });
            });

        // containerEl.createEl("h2", { cls: "reading-progress-desktop-title" }).innerText = t("Components");
        new Setting(containerEl).setName(t("Components")).setHeading();

        new Setting(containerEl)
            .setName(t("Show fullscreen button"))
            .setDesc(t("Display the full screen button in the status bar"))
            .addToggle((toggle) => {
                toggle
                    .setValue(
                        this.plugin.st.showFullscreenButton
                    )
                    .onChange(async (value) => {
                        this.plugin.st.showFullscreenButton =
                            value;
                        await this.plugin.saveSettings();
                        this.plugin.fs.displayChange(this.plugin.st.showFullscreenButton);
                    });
            });

        new Setting(containerEl)
            .setName(t("Show current view type"))
            .setDesc(t("Display the page view type in the status bar"))
            .addToggle((toggle) => {
                toggle
                    .setValue(
                        this.plugin.st.showViewType
                    )
                    .onChange(async (value) => {
                        this.plugin.st.showViewType =
                            value;
                        await this.plugin.saveSettings();
                        this.plugin.vt.displayChange(this.plugin.st.showViewType);
                    });
            });
    }

    updateProgressBar = (value: number) => {
        const actualValue = value + 122;
        if (this.plugin.rp && this.plugin.rp.readingProgress) {
            this.plugin.rp.readingProgress.style.width = actualValue + "px";
        }
        if (this.plugin.rp && this.plugin.rp.progressBorder) {
            this.plugin.rp.progressBorder.style.width = actualValue + "px";
        }
        return actualValue;
    };

    resetToDefault = async (slider: SliderComponent) => {
        const DEFAULT_VALUE = 50;
        slider.setValue(DEFAULT_VALUE);
        const actualValue = this.updateProgressBar(DEFAULT_VALUE);
        this.plugin.st.readingProgressLength = actualValue;
        this.plugin.st.progressBorderLength = actualValue;
        await this.plugin.saveSettings();
    };
}