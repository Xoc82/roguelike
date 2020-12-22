var loadJson = (name) => new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", name);
    xhr.send();
    xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) {
            let data = JSON.parse(xhr.responseText);
            resolve(data);
        } else {
            alert(xhr.responseText);
        }
    };
});

function arrayToDictionaryById(array) {
    return array.reduce((a, x) => { a[x.id] = x; return a }, {});
}

function deleteAllChildren(node) {
    let children = node.children;
    for (let i = children.length - 1; i >= 0; i--) {
        children[i].remove();
    }
}

function getPageOffset(node) {
    let rect = node.getBoundingClientRect();
    let scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return { y: rect.top + scrollTop, x: rect.left + scrollLeft }
}
