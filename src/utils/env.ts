/**
 * 运行时配置。
 *
 * 从 /config.json 加载，部署后可直接修改，无需重新构建。
 * API key 仍由代理层注入，这里只存非敏感配置。
 */

/** 作品集 API 配置 — url 和 spec 二选一，baseUrl 必填 */
export type PortfolioApiConfig = {
    baseUrl: string;
} & (
    | { url: string; spec?: never }
    | { url?: never; spec: object }
);

export interface AppConfig {
    provider: 'openai' | 'anthropic';
    model: string;
    summaryModel?: string;
    githubUsername?: string;
    portfolioApi?: PortfolioApiConfig;
}

let cached: AppConfig | null = null;

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

    validateConfig(cached!);
    return cached!;
}

export function getConfig(): AppConfig {
    if (!cached) {
        throw new Error('配置未加载，请先调用 loadConfig()');
    }
    return cached;
}

/**
 * 校验配置。
 * portfolioApi 存在时：
 * - baseUrl 必填
 * - url 和 spec 必须有且仅有一个
 */
function validateConfig(config: AppConfig): void {
    const pa = config.portfolioApi;
    if (!pa) return;

    if (!pa.baseUrl || typeof pa.baseUrl !== 'string') {
        throw new Error('portfolioApi 配置错误：baseUrl 必填');
    }

    const hasUrl = 'url' in pa && !!pa.url;
    const hasSpec = 'spec' in pa && !!pa.spec;

    if (hasUrl && hasSpec) {
        throw new Error('portfolioApi 配置错误：url 和 spec 不能同时填写');
    }
    if (!hasUrl && !hasSpec) {
        throw new Error('portfolioApi 配置错误：url 和 spec 必须填写其中一个');
    }
}
