let showOfficialseOnly = document.getElementById('showOfficialseOnly');

showOfficialseOnly.onclick = function(element) {
    //let color = element.target.value;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {command: "click"}, function(response) {
            console.log(response.result);
        });
    });
};