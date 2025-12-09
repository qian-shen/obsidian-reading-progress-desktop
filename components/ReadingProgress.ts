import ReadingProgressStatusBarPlugin from "main";
import {
	Component,
	MarkdownView,
	View,
	WorkspaceLeaf,
	WorkspaceSplit,
	WorkspaceTabs,
	debounce,
} from "obsidian";

interface ContainerItem {
	container?: HTMLElement;
	observer?: MutationObserver;
	requestUpdate?: () => void;
	enterUpdate?: () => void;
	wheelUpdate?: () => void;
	isActive: boolean;
	isRecode: boolean;
	viewType: string;
}

// 给 WorkspaceTabs 补充 children 类型
type PatchedWorkspaceTabs = WorkspaceTabs & {
	children: WorkspaceLeaf[];
};

// 给 WorkspaceSplit 补充 children 类型
type PatchedWorkspaceSplit = WorkspaceSplit & {
	children: (WorkspaceSplit | WorkspaceTabs | WorkspaceLeaf)[];
};

export class ReadingProgress extends Component {
	plugin: ReadingProgressStatusBarPlugin;
	private progressValue: HTMLElement;
	private scrollingContainer: HTMLElement;
	private scrollContainerChange: boolean;
	private debouncedScrollChange: () => void;
	private containerItemArray: ContainerItem[];
	private viewTypeList: string[] = [
		"markdown",
		"pdf",
		"search",
		"bases",
		"thino_view",
		"excalidraw",
		"canvas",
		"webviewer",
		"smm",
		"empty",
		"release-notes"
	];
	statusBarReadingProgressEl: HTMLElement;
	readingProgress: HTMLElement;
	progressBorder: HTMLElement;

	constructor(plugin: ReadingProgressStatusBarPlugin) {
		super();
		this.plugin = plugin;
		this.statusBarReadingProgressEl = this.plugin.addStatusBarItem();
		this.statusBarReadingProgressEl.addClass("reading-progress-bar");
		this.readingProgress = createDiv({ cls: "reading-progress" });
		this.readingProgress.style.setProperty("--reading-progress-width", this.plugin.st.readingProgressLength + "px");
		this.progressValue = createDiv({ cls: "progress-value" });
		this.progressBorder = createDiv({ cls: "progress-border" });
		this.readingProgress.appendChild(this.progressValue);
		this.statusBarReadingProgressEl.appendChild(this.progressBorder);
		this.statusBarReadingProgressEl.appendChild(this.readingProgress);
		this.containerItemArray = [];
		this.scrollContainerChange = false;
		if (this.plugin.st.enableShineFlow) {
			this.progressValue.addClass("shineFlow");
		}
	}

	onload(): void {
		this.debouncedScrollChange = debounce(() => {
			this.scrollChange();
		}, 100);
		this.plugin.app.workspace.onLayoutReady(this.scrollChange);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"file-open",
				this.debouncedScrollChange
			)
		);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"active-leaf-change",
				this.debouncedScrollChange
			)
		);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("resize", this.debouncedScrollChange)
		);
	}

	getActiveViewContainer = (): ContainerItem[] => {
		const containerItemArray: ContainerItem[] = [];
		const workspaceViews = this.getAllTabViews();
		const getActiveViews = (views: View[]): View[] => {
			let activeViews: View[] = [];
			if (views.length > 0) {
				activeViews = views.filter(
					(view) =>
						view?.containerEl.parentElement?.style.display !==
						"none"
				);
			}
			return activeViews;
		};
		const isActiveView = (view: View): boolean => {
			if (view?.containerEl.parentElement) {
				return view?.containerEl.parentElement?.classList.contains(
					"mod-active"
				);
			} else {
				return false;
			}
		};
		const activeViews = getActiveViews(workspaceViews.views);
		if (activeViews.length > 0) {
			activeViews.forEach((activeView) => {
				const activeViewType = activeView.getViewType();
				const containerItem: ContainerItem = {
					isActive: false,
					viewType: "empty",
					isRecode: true,
				};
				const unknownViewType = () => {
					containerItem.container = activeView.containerEl;
					containerItem.isRecode = false;
					if (this.viewTypeList.contains(activeViewType)) {
						containerItem.viewType = activeViewType;
					} else {
						containerItem.viewType = "empty";
					}
				}
				switch (activeViewType) {
					case "markdown": {
						if (activeView instanceof MarkdownView) {
							const markdownView = activeView;
							if (
								markdownView.getMode() == "source"
							) {
								containerItem.container =
									markdownView.containerEl.querySelector(
										".markdown-source-view .cm-scroller"
									) as HTMLElement;
							} else if (
								markdownView.getMode() == "preview"
							) {
								containerItem.container =
									markdownView.containerEl.querySelector(
										".markdown-preview-view.markdown-rendered"
									) as HTMLElement;
							}
							containerItem.viewType = "markdown";
							break;
						} else {
							unknownViewType();
							break;
						}
					}
					case "pdf": {
						containerItem.container =
							activeView.containerEl.querySelector(
								".pdf-container .pdf-viewer-container"
							) as HTMLElement;
						containerItem.viewType = "pdf";
						break;
					}
					case "search": {
						containerItem.container =
							activeView.containerEl.querySelector(
								".search-result-container"
							) as HTMLElement;
						containerItem.viewType = "search";
						break;
					}
					case "bases": {
						containerItem.container =
							activeView.containerEl.querySelector(
								".bases-view"
							) as HTMLElement;
						containerItem.viewType = "bases";
						break;
					}
					case "thino_view": {
						containerItem.container =
							activeView.containerEl.querySelector(
								".memolist-scrollview"
							) as HTMLElement;
						containerItem.viewType = "thino_view";
						break;
					}
					case "release-notes":
						containerItem.container =
							activeView.containerEl.querySelector(
								".release-notes-view"
							) as HTMLElement;
						containerItem.viewType = "release-notes";
						break;
					default:
						unknownViewType();
						break;
				}
				if (isActiveView(activeView) || !workspaceViews.isSplitMode) {
					containerItem.isActive = true;
					if (containerItem.container) {
						this.scrollingContainer = containerItem.container;
					}
				}
				containerItemArray.push(containerItem);
			});
		}
		return containerItemArray;
	};

	scrollListener = (scrollContainer: ContainerItem) => {
		if (scrollContainer.container) {
			const calcProgress = (
				scrollTop: number,
				clientHeight: number,
				scrollHeight: number
			): number => {
				if (
					(scrollTop === 0 &&
						clientHeight === 0 &&
						scrollHeight === 0) ||
					scrollHeight <= clientHeight
				)
					return 0;
				const percent =
					(scrollTop / (scrollHeight - clientHeight)) * 100;
				return Math.min(100, Math.max(0, Number(percent.toFixed(2))));
			};

			let prev = {
				clientHeight: scrollContainer.container.clientHeight,
				scrollHeight: scrollContainer.container.scrollHeight,
				scrollTop: scrollContainer.container.scrollTop,
			};

			const changeProgress = () => {
				if (scrollContainer.container) {
					const next = {
						clientHeight: scrollContainer.container.clientHeight,
						scrollHeight: scrollContainer.container.scrollHeight,
						scrollTop: scrollContainer.container.scrollTop,
					};
					if (
						prev.clientHeight === next.clientHeight &&
						prev.scrollHeight === next.scrollHeight &&
						prev.scrollTop === next.scrollTop
					)
						return;

					prev = next;
					this.progressValue.style.setProperty("--reading-progress-value", calcProgress(
						next.scrollTop,
						next.clientHeight,
						next.scrollHeight
					).toString() + "%");
				}
			};

			const changeScrollContainer = () => {
				if (this.scrollContainerChange) {
					if (scrollContainer.container) {
						this.scrollContainerChange = false;
						if (
							scrollContainer.container !==
							this.scrollingContainer
						) {
							this.progressValue.removeClass(
								...this.viewTypeList
							);
							this.progressValue.addClass(
								scrollContainer.viewType
							);
							this.plugin.vt.updateViewType(
								scrollContainer.viewType
							);
							this.scrollingContainer =
								scrollContainer.container;
						}
					}
				}
			}

			let ticking = false;
			const requestUpdate = () => {
				if (!ticking) {
					ticking = true;
					requestAnimationFrame(() => {
						ticking = false;
						changeProgress();
					});
				}
			};

			const enterUpdate = () => {
				requestAnimationFrame(() => {
					const calcProgressValue = () => {
						if (scrollContainer.container) {
							this.progressValue.style.setProperty("--reading-progress-value", calcProgress(
								scrollContainer.container.scrollTop,
								scrollContainer.container.clientHeight,
								scrollContainer.container.scrollHeight
							).toString() + "%");
						}
					};
					this.progressValue.removeClass(...this.viewTypeList);
					this.progressValue.addClass(scrollContainer.viewType);
					if (scrollContainer.container) {
						this.scrollingContainer = scrollContainer.container;
					}
					if (scrollContainer.isRecode) {
						calcProgressValue();
					}
					this.scrollContainerChange = true;
					this.plugin.vt.updateViewType(scrollContainer.viewType);
				})

			};

			const wheelUpdate = () => {
				requestAnimationFrame(() => {
					changeScrollContainer();
				});
			};

			if (scrollContainer.isRecode) {
				scrollContainer.requestUpdate = requestUpdate.bind(this);
				scrollContainer.observer = new MutationObserver(requestUpdate);
			}

			scrollContainer.enterUpdate = enterUpdate.bind(this);
			scrollContainer.wheelUpdate = wheelUpdate.bind(this);

			// 确保在浏览器完成布局后执行
			requestAnimationFrame(() => {
				const {
					container,
					enterUpdate,
					wheelUpdate,
					observer,
					requestUpdate,
					isActive,
				} = scrollContainer;
				if (container) {
					if (enterUpdate) {
						if (isActive) {
							enterUpdate();
						}
						container.addEventListener("mouseenter", enterUpdate);
					}
					if (wheelUpdate) {
						container.addEventListener("wheel", wheelUpdate, { passive: true });
					}
					if (observer && requestUpdate) {
						container.addEventListener("scroll", requestUpdate);
						observer.observe(container, {
							childList: true,
							subtree: true,
						});
					}
				}
			});
		}
	};

	getAllTabViews = (): { views: View[]; isSplitMode: boolean } => {
		const views: View[] = [];
		let isSplitMode = false;

		function traverse(split: PatchedWorkspaceSplit) {
			if (!split) {
				return;
			}
			if (
				split.children.length == 1 &&
				split.children[0] instanceof WorkspaceTabs
			) {
				isSplitMode = false;
			} else {
				isSplitMode = true;
			}
			for (const child of split.children) {
				if (child instanceof WorkspaceTabs) {
					// 强制告诉 TS：这个 Tabs 一定有 children
					const tabs = child as PatchedWorkspaceTabs;
					for (const leaf of tabs.children) {
						if (leaf.view) {
							views.push(leaf.view);
						}
					}
				} else if (child instanceof WorkspaceSplit) {
					traverse(child as PatchedWorkspaceSplit);
				}
			}
		}

		traverse(
			this.plugin.app.workspace
				.rootSplit as unknown as PatchedWorkspaceSplit
		);
		return { views, isSplitMode };
	};

	scrollChange = () => {
		this.clearContainerArray();
		this.containerItemArray = [];

		const scrollContainerArray = this.getActiveViewContainer();
		if (scrollContainerArray.length > 0) {
			scrollContainerArray.forEach((scrollContainer) => {
				this.scrollListener(scrollContainer);
				this.containerItemArray.push(scrollContainer);
			});
			this.scrollContainerChange = true;
		} else {
			this.progressValue.removeClass(...this.viewTypeList);
			this.progressValue.addClass("empty")
			this.scrollContainerChange = false;
		}
	};

	toggleReadingProgressShineFlow = (enable: boolean) => {
		if (enable) {
			if (!this.progressValue.classList.contains("shineFlow")) {
				this.progressValue.addClass("shineFlow");
			}
		} else {
			if (this.progressValue.classList.contains("shineFlow")) {
				this.progressValue.removeClass("shineFlow");
			}
		}
	}

	clearContainerArray = () => {
		if (this.containerItemArray.length > 0) {
			this.containerItemArray.forEach((containerItem) => {
				if (containerItem.container) {
					if (containerItem.requestUpdate) {
						containerItem.container.removeEventListener(
							"scroll",
							containerItem.requestUpdate
						);
					}
					if (
						containerItem.enterUpdate &&
						containerItem.wheelUpdate
					) {
						containerItem.container.removeEventListener(
							"mouseenter",
							containerItem.enterUpdate
						);
						containerItem.container.removeEventListener(
							"wheel",
							containerItem.wheelUpdate
						);
					}
				}
				if (containerItem.observer) {
					containerItem.observer.disconnect();
				}
			});
		}
	}

	onunload = () => {
		this.clearContainerArray();
	};
}
