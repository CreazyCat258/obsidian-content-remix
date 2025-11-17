import { App, Editor, ItemView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

// Platform configuration interface
interface PlatformConfig {
    id: string;
    name: string;
    enabled: boolean;
    // Add platform-specific settings here
}

// Plugin settings interface
interface ContentRemixSettings {
    platforms: PlatformConfig[];
    defaultPlatform: string;
    autoFormat: boolean;
    // AI settings
    aiEnabled: boolean;
    aiApiKey: string;
    aiModel: string;
    aiEndpoint: string;
}

// Default settings
const DEFAULT_SETTINGS: ContentRemixSettings = {
    platforms: [
        { id: 'xiaohongshu', name: '小红书', enabled: true },
        { id: 'jike', name: '即刻', enabled: true },
        { id: 'x', name: 'X (Twitter)', enabled: true },
        { id: 'wechat', name: '微信公众号', enabled: false }
    ],
    defaultPlatform: 'xiaohongshu',
    autoFormat: true,
    // AI settings defaults
    aiEnabled: false,
    aiApiKey: '',
    aiModel: 'gpt-3.5-turbo',
    aiEndpoint: 'https://api.openai.com/v1/chat/completions'
};

export default class ContentRemixPlugin extends Plugin {
    settings: ContentRemixSettings;

    async onload() {
        await this.loadSettings();

        // Register the new view type
        this.registerView(
            CONTENT_REMIX_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => new ContentRemixView(leaf, this)
        );

        // Add ribbon icon
        const ribbonIconEl = this.addRibbonIcon('paper-plane', '内容分发助手', () => {
            this.openDistributionView();
        });
        ribbonIconEl.addClass('content-remix-ribbon');

        // Add status bar item
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('内容分发助手已就绪');

        // Add commands
        this.addCommand({
            id: 'content-remix-open-distribution-view',
            name: '打开内容分发界面',
            callback: () => {
                this.openDistributionView();
            }
        });

        this.addCommand({
            id: 'content-remix-distribute-selection',
            name: '分发选中内容',
            editorCallback: (editor: Editor) => {
                const selectedText = editor.getSelection();
                if (selectedText) {
                    new Notice('准备分发选中内容...');
                    this.openDistributionView(selectedText);
                } else {
                    new Notice('请先选中要分发的内容');
                }
            }
        });

        // Add settings tab
        this.addSettingTab(new ContentRemixSettingTab(this.app, this));
    }

    // Method to open the distribution view
    openDistributionView(prefilledContent?: string): void {
        // Try to find an existing view
        const existingLeaf = this.app.workspace.getLeavesOfType(CONTENT_REMIX_VIEW_TYPE)[0];

        if (existingLeaf) {
            // Activate the existing view
            this.app.workspace.revealLeaf(existingLeaf);
        } else {
            // Create a new leaf and open the view
            this.app.workspace.getRightLeaf(false)?.setViewState({
                type: CONTENT_REMIX_VIEW_TYPE,
            });
        }
    }

    onunload() {
        new Notice('内容分发助手已卸载');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Content transformation methods
    transformContent(content: string, platform: string): string {
        let transformed = content;

        // Apply platform-specific formatting
        switch (platform) {
            case 'xiaohongshu':
                transformed = this.formatForXiaohongshu(transformed);
                break;
            case 'jike':
                transformed = this.formatForJike(transformed);
                break;
            case 'x':
                transformed = this.formatForX(transformed);
                break;
            case 'wechat':
                transformed = this.formatForWeChat(transformed);
                break;
        }

        return transformed;
    }

    // AI-powered content transformation
    async transformContentAI(content: string, platform: string): Promise<string> {
        if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
            // Fall back to traditional transformation if AI is not enabled
            return this.transformContent(content, platform);
        }

        try {
            // Get platform-specific prompt
            const prompt = this.getPlatformAIPrompt(content, platform);

            // Make API call
            const response = await fetch(this.settings.aiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.aiApiKey}`
                },
                body: JSON.stringify({
                    model: this.settings.aiModel,
                    messages: [
                        { role: 'system', content: '你是一位专业的内容创作者，擅长将内容转化为不同平台风格。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`AI API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('AI content transformation failed:', error);
            // Fall back to traditional transformation on error
            return this.transformContent(content, platform);
        }
    }

    // Get platform-specific AI prompt
    private getPlatformAIPrompt(content: string, platform: string): string {
        const platformNames: Record<string, string> = {
            'xiaohongshu': '小红书',
            'jike': '即刻',
            'x': 'X (Twitter)',
            'wechat': '微信公众号'
        };

        const platformName = platformNames[platform] || platform;

        // Platform-specific prompt templates with type assertion
        const prompts: Record<string, string> = {
            'xiaohongshu': `将以下内容改写为符合小红书平台风格的内容：
要求：
1. 使用活泼友好的语气，加入适当的emoji
2. 结构清晰，段落分明
3. 加入相关的话题标签
4. 内容要吸引眼球，适合年轻人阅读

原始内容：
${content}`,

            'jike': `将以下内容改写为符合即刻平台风格的内容：
要求：
1. 语言简洁有力，充满活力
2. 保持内容的核心信息
3. 加入相关的话题标签
4. 适合手机端快速阅读

原始内容：
${content}`,

            'x': `将以下内容改写为符合X (Twitter)平台风格的内容：
要求：
1. 简洁明了，控制在280字符以内
2. 使用英文撰写
3. 加入相关的话题标签
4. 语言生动，具有传播性

原始内容：
${content}`,

            'wechat': `将以下内容改写为符合微信公众号平台风格的内容：
要求：
1. 结构完整，层次分明
2. 语言正式且易懂
3. 保持专业度
4. 适合长篇阅读

原始内容：
${content}`
        };

        return prompts[platform as keyof typeof prompts] || `将以下内容改写为适合${platformName}平台风格的内容：\n\n${content}`;
    }

    // Platform-specific formatting
    private formatForXiaohongshu(content: string): string {
        // Xiaohongshu style: emoji-rich, conversational, with hashtags
        // 1. Add catchy title with emojis
        // 2. Make content more conversational
        // 3. Add relevant hashtags at the end

        // Remove existing markdown headings and convert to natural language
        let transformed = content.replace(/^#+\s*/gm, '');

        // Split into paragraphs and make them more conversational
        const paragraphs = transformed.split('\n\n');
        const conversationalParas = paragraphs.map(para => {
            // Add emoji at the beginning of important paragraphs
            if (para.length > 50) {
                return `✨ ${para}`;
            }
            return para;
        });

        // Join back with double newlines
        transformed = conversationalParas.join('\n\n');

        // Add trending hashtags relevant to the content
        return `✨ 实用工具分享｜内容分发助手插件体验\n\n${transformed}\n\n#Obsidian插件 #内容分发 #效率工具 #小红书创作`;
    }

    private formatForJike(content: string): string {
        // Jike style: concise, energetic, with topic tags
        let transformed = content.replace(/^#+\s*/gm, '').trim();

        // Keep only the most important points
        const lines = transformed.split('\n').filter(line => line.trim());
        transformed = lines.slice(0, 5).join('\n');

        // Truncate to fit Jike's display style
        if (transformed.length > 200) {
            transformed = transformed.substring(0, 197) + '...';
        }

        return `🚀 发现一个超实用的Obsidian插件！\n\n${transformed}\n\n#Obsidian #内容分发`;
    }

    private formatForX(content: string): string {
        // X style: concise, with emojis and relevant hashtags
        let transformed = content.replace(/^#+\s*/gm, '').trim();

        // Truncate for character limit (280) including hashtags
        const maxContentLength = 240;
        if (transformed.length > maxContentLength) {
            transformed = transformed.substring(0, maxContentLength) + '...';
        }

        // Add relevant hashtags
        return `💡 New Obsidian plugin for content distribution! ${transformed}\n\n#Obsidian #ContentDistribution #Productivity`;
    }

    private formatForWeChat(content: string): string {
        // WeChat style: formal, structured, with clear headings
        let transformed = content;

        // Ensure proper markdown structure with headings
        if (!transformed.startsWith('#')) {
            transformed = `# Obsidian内容分发助手插件介绍\n\n${transformed}`;
        }

        // Add introduction and conclusion
        transformed += `\n\n## 总结\n\n这款插件能够帮助你快速将Obsidian笔记转化为适合不同平台的内容，提升内容分发效率。`;

        // Add relevant tags
        return transformed;
    }
}

// Define view type constant
const CONTENT_REMIX_VIEW_TYPE = 'content-remix-view';

// Define view icon
const CONTENT_REMIX_VIEW_ICON = 'paper-plane';

// Content Distribution Tab View
class ContentRemixView extends ItemView {
    private plugin: ContentRemixPlugin;
    private selectedPlatform: string;
    private content: string;

    constructor(leaf: WorkspaceLeaf, plugin: ContentRemixPlugin, prefilledContent?: string) {
        super(leaf);
        this.plugin = plugin;
        this.selectedPlatform = plugin.settings.defaultPlatform;
        this.content = prefilledContent || '';
    }

    getViewType(): string {
        return CONTENT_REMIX_VIEW_TYPE;
    }

    getDisplayText(): string {
        return '内容分发助手';
    }

    getIcon(): string {
        return CONTENT_REMIX_VIEW_ICON;
    }

    async onOpen() {
        const { contentEl } = this;

        // Content input area
        const contentContainer = contentEl.createDiv({ cls: 'content-remix-content-container' });
        contentContainer.createEl('h3', { text: '内容' });

        const textarea = contentContainer.createEl('textarea', {
            cls: 'content-remix-textarea',
            value: this.content || this.getCurrentNoteContent(),
            attr: {
                rows: 10,
                placeholder: '输入或编辑要分发的内容...'
            }
        });
        textarea.style.width = '100%';
        textarea.style.marginBottom = '1rem';

        // Platform selection
        const platformContainer = contentEl.createDiv({ cls: 'content-remix-platform-container' });
        platformContainer.createEl('h3', { text: '选择平台' });

        const platformSelect = platformContainer.createEl('select', {
            cls: 'content-remix-platform-select'
        });

        this.plugin.settings.platforms.forEach(platform => {
            if (platform.enabled) {
                const option = platformSelect.createEl('option', {
                    text: platform.name,
                    value: platform.id
                });
                if (platform.id === this.selectedPlatform) {
                    option.selected = true;
                }
            }
        });

        // Preview area
        const previewContainer = contentEl.createDiv({ cls: 'content-remix-preview-container' });
        previewContainer.createEl('h3', { text: '预览' });

        const previewContent = previewContainer.createEl('div', {
            cls: 'content-remix-preview-content',
            text: this.getPreviewContent(textarea.value)
        });

        // Update preview when content or platform changes
        textarea.addEventListener('input', () => {
            this.content = textarea.value;
            previewContent.textContent = this.getPreviewContent(textarea.value);
        });

        platformSelect.addEventListener('change', () => {
            this.selectedPlatform = platformSelect.value;
            previewContent.textContent = this.getPreviewContent(textarea.value);
        });

        // Action buttons
        const buttonContainer = contentEl.createDiv({ cls: 'content-remix-button-container' });

        const copyButton = buttonContainer.createEl('button', {
            cls: 'mod-cta',
            text: '复制到剪贴板'
        });
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(this.getPreviewContent(textarea.value)).then(() => {
                new Notice('内容已复制到剪贴板');
            });
        });

        const aiGenerateButton = buttonContainer.createEl('button', {
            cls: 'mod-primary',
            text: 'AI生成'
        });
        aiGenerateButton.addEventListener('click', async () => {
            if (!textarea.value.trim()) return;

            // Show loading state
            const originalText = aiGenerateButton.textContent;
            aiGenerateButton.textContent = '生成中...';
            aiGenerateButton.disabled = true;

            try {
                // Get AI-generated content
                const aiContent = await this.plugin.transformContentAI(textarea.value, this.selectedPlatform);

                // Update preview
                previewContent.textContent = aiContent;
                new Notice('AI内容生成完成');
            } catch (error) {
                console.error('AI generation failed:', error);
                new Notice('AI生成失败，请重试');
            } finally {
                // Restore button state
                aiGenerateButton.textContent = originalText;
                aiGenerateButton.disabled = false;
            }
        });

        const distributeButton = buttonContainer.createEl('button', {
            cls: 'mod-primary',
            text: '分发内容'
        });
        distributeButton.addEventListener('click', () => {
            this.distributeContent(textarea.value);
        });
    }

    private getCurrentNoteContent(): string {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
            return markdownView.editor.getValue();
        }
        return '';
    }

    private getPreviewContent(content: string): string {
        if (!content) return '预览将显示格式化后的内容...';
        return this.plugin.transformContent(content, this.selectedPlatform);
    }

    private async distributeContent(content: string) {
        // For AI-enabled platforms, use AI-generated content
        let formattedContent;

        if (this.plugin.settings.aiEnabled) {
            // Show loading state in button
            const distributeButton = this.containerEl.querySelector('.content-remix-button-container button:nth-child(3)') as HTMLButtonElement;
            const originalText = distributeButton.textContent;
            distributeButton.textContent = '分发中...';
            distributeButton.disabled = true;

            try {
                formattedContent = await this.plugin.transformContentAI(content, this.selectedPlatform);
            } catch (error) {
                console.error('AI distribution failed:', error);
                formattedContent = this.plugin.transformContent(content, this.selectedPlatform);
            } finally {
                // Restore button state
                if (distributeButton) {
                    distributeButton.textContent = originalText;
                    distributeButton.disabled = false;
                }
            }
        } else {
            formattedContent = this.plugin.transformContent(content, this.selectedPlatform);
        }

        // Copy to clipboard as default distribution method
        navigator.clipboard.writeText(formattedContent).then(() => {
            new Notice(`已为${this.selectedPlatform}格式化内容并复制到剪贴板`);
        }).catch(err => {
            console.error('复制失败:', err);
            new Notice('分发失败，请重试');
        });
    }

    async onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Deprecated Modal (kept for backward compatibility if needed)
class DistributionModal extends Modal {
    private plugin: ContentRemixPlugin;
    private prefilledContent?: string;

    constructor(app: App, plugin: ContentRemixPlugin, prefilledContent?: string) {
        super(app);
        this.plugin = plugin;
        this.prefilledContent = prefilledContent;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText('内容分发助手已迁移');
        contentEl.createEl('p', { text: '内容分发助手现已在Tab页中打开，点击左侧图标或使用命令打开。' });

        const openButton = contentEl.createEl('button', {
            cls: 'mod-primary',
            text: '立即打开Tab页'
        });
        openButton.style.marginTop = '1rem';
        openButton.addEventListener('click', () => {
            this.plugin.openDistributionView(this.prefilledContent);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class ContentRemixSettingTab extends PluginSettingTab {
    plugin: ContentRemixPlugin;

    constructor(app: App, plugin: ContentRemixPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: '内容分发助手设置'});

        // Default platform
        new Setting(containerEl)
            .setName('默认平台')
            .setDesc('选择默认分发平台')
            .addDropdown(dropdown => {
                this.plugin.settings.platforms.forEach(platform => {
                    dropdown.addOption(platform.id, platform.name);
                });
                dropdown.setValue(this.plugin.settings.defaultPlatform);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultPlatform = value;
                    await this.plugin.saveSettings();
                });
            });

        // Auto format
        new Setting(containerEl)
            .setName('自动格式化')
            .setDesc('自动根据平台格式化为适合的内容')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.autoFormat);
                toggle.onChange(async (value) => {
                    this.plugin.settings.autoFormat = value;
                    await this.plugin.saveSettings();
                });
            });

        // AI settings section
        containerEl.createEl('h3', { text: 'AI智能转换' });

        // Enable AI
        new Setting(containerEl)
            .setName('启用AI转换')
            .setDesc('使用AI智能生成平台风格内容')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.aiEnabled);
                toggle.onChange(async (value) => {
                    this.plugin.settings.aiEnabled = value;
                    await this.plugin.saveSettings();
                    // Show/hide AI settings based on toggle
                    this.display();
                });
            });

        if (this.plugin.settings.aiEnabled) {
            // AI API Key
            new Setting(containerEl)
                .setName('AI API Key')
                .setDesc('输入OpenAI API密钥')
                .addText(text => {
                    text
                        .setPlaceholder('sk-...')
                        .setValue(this.plugin.settings.aiApiKey)
                        .onChange(async (value) => {
                            this.plugin.settings.aiApiKey = value;
                            await this.plugin.saveSettings();
                        });
                });

            // AI Model
            new Setting(containerEl)
                .setName('AI模型')
                .setDesc('选择AI模型')
                .addDropdown(dropdown => {
                    dropdown
                        .addOption('gpt-3.5-turbo', 'gpt-3.5-turbo')
                        .addOption('gpt-4', 'gpt-4')
                        .addOption('gpt-4-turbo', 'gpt-4-turbo')
                        .setValue(this.plugin.settings.aiModel)
                        .onChange(async (value) => {
                            this.plugin.settings.aiModel = value;
                            await this.plugin.saveSettings();
                        });
                });

            // AI Endpoint
            new Setting(containerEl)
                .setName('AI API地址')
                .setDesc('输入AI API端点地址')
                .addText(text => {
                    text
                        .setPlaceholder('https://api.openai.com/v1/chat/completions')
                        .setValue(this.plugin.settings.aiEndpoint)
                        .onChange(async (value) => {
                            this.plugin.settings.aiEndpoint = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        // Platform settings
        containerEl.createEl('h3', {text: '平台配置'});

        this.plugin.settings.platforms.forEach((platform, index) => {
            const platformSetting = new Setting(containerEl)
                .setName(platform.name)
                .setDesc(platform.id)
                .addToggle(toggle => {
                    toggle.setValue(platform.enabled);
                    toggle.onChange(async (value) => {
                        this.plugin.settings.platforms[index].enabled = value;
                        await this.plugin.saveSettings();
                    });
                });

            // Add platform-specific settings here in the future
            platformSetting.infoEl.hide();
        });
    }
}
