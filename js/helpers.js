var loadJson = (name) => new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", name);
    xhr.send();
    xhr.onload = () => {
        if (xhr.status === 200) {
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