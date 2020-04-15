function insertNavigation() {
    const div = document.createElement('div');
    document.currentScript.replaceWith(div);

    function linkListFromObject(description) {
        const links = [];
        for (let [url, label] of Object.entries(description)) {
            links.push(`<a href="${url}">${label}</a>`);
        }
        return `<div>${links.join(' | ')}</div>`;
    }

    div.innerHTML = `${
        linkListFromObject({
            "area51.html": "area51",
        })
    }
    ${
        linkListFromObject({
            "github-access.html": "Github Access example",
            "zone.js.html": "zone.js",
            "2nd-zone.js.html": "2nd-zone.js",
            "dexie.html": "Dexie Promises",
        })
    }`;
}
