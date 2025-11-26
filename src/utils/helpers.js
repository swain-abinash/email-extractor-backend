import * as cheerio from "cheerio";

export const extractEmails = (html) => {
    if (!html) return [];
    const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
    return [...new Set(html.match(regex) || [])];
};

export const normalizeUrl = (url) => {
    if (!url) return null;
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    if (u.endsWith("/")) u = u.slice(0, -1);
    return u;
};

export const joinPath = (base, path) => {
    try {
        return new URL(path, base).href;
    } catch {
        return null;
    }
};

export const extractLinks = (base, html) => {
    try {
        const $ = cheerio.load(html);
        const origin = new URL(base).origin;
        const links = new Set();
        $("a[href]").each((_, el) => {
            let href = $(el).attr("href");
            if (!href) return;
            href = href.trim();
            if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
            try {
                const full = new URL(href, base).href.split("#")[0];
                if (full.startsWith(origin)) links.add(full);
            } catch { }
        });
        return [...links];
    } catch {
        return [];
    }
};

export const toSerializable = (obj) => {
    return JSON.parse(
        JSON.stringify(obj, (_, value) =>
            typeof value === "bigint" ? Number(value) : value
        )
    );
};
