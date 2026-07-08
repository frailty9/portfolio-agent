/**
 * 运行时配置。
 *
 * 从 /config.json 加载，部署后可直接修改，无需重新构建。
 * API key 仍由代理层注入，这里只存非敏感配置。
 */

export interface AppConfig {
  provider: 'openai' | 'anthropic'
  model: string
  summaryModel?: string
  githubUsername?: string
}

let cached: AppConfig | null = null

const DEFAULTS: AppConfig = {
    provider: 'anthropic',
    model: '',
    summaryModel: '',
    githubUsername: '',
};

export async function loadConfig(): Promise<AppConfig> {
    if (cached) return cached;

    try {
        const res = await fetch('/config.json');
        if (res.ok) {
            const data = await res.json();
            cached = { ...DEFAULTS, ...data };
        } else {
            cached = { ...DEFAULTS };
        }
    } catch {
        cached = { ...DEFAULTS };
    }

    return cached;
}

export function getConfig(): AppConfig {
    if (!cached) {
        throw new Error('配置未加载，请先调用 loadConfig()');
    }
    return cached;
}
