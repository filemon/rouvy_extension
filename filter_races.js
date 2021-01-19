const buttonSelector = 'div.moreButton[id="snippet-moreButtonPlanned-component"] > a';

function createButton() {
    let button = document.createElement('button');
    button.type = "button";
    button.className = 'btn btn-info';
    button.onclick = async function () {
        await filterRaces();
    };
    button.style.marginTop = '10px';
    button.innerHTML = 'show official only';
    return button;
}

async function filterRaces() {

    for(let i=0;i<5;i++){
        try {
            console.log('Clicking the "Next" button.');
            await $(buttonSelector)[0].click();
            // Default timeout first time.
            await new Promise(function(resolve) {setTimeout(resolve, 2000)});
            // 2 sec timeout after the first.
        } catch (err) {
            // Ignore the timeout error.
            console.log(`Error: ${err}`);
        }
    }
    $('div.planned div.avatar22 a').not('a[href="/ROUVY"]').closest('tr').remove();
};


$('div.moreButton[id="snippet-moreButtonPlanned-component"]').parent('div')[0].appendChild(createButton());