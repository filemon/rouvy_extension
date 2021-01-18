chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse) {
    const buttonSelector = 'div.moreButton[id="snippet-moreButtonPlanned-component"] > a';
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
    sendResponse('Done');
    $('div.planned div.avatar22 a').not('a[href="/ROUVY"]').closest('tr').remove();
});