let cookieString: string = "";
let cookiesFilePath: string = "";

export function setCookieString(v: string){ cookieString = v || ""; }
export function setCookiesFilePath(p: string){ cookiesFilePath = p || ""; }
export function getCookieString(){ return cookieString; }
export function getCookiesFilePath(){ return cookiesFilePath; }
export function getStatus(){ return { hasCookie: !!cookieString, cookieLen: cookieString.length, hasFile: !!cookiesFilePath }; }