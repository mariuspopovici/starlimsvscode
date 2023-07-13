export function cleanUrl(url: string) {
    let newUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    if (newUrl.endsWith(".lims")) {
        newUrl = newUrl.slice(0, newUrl.lastIndexOf("/"));
    }
    return newUrl;
}