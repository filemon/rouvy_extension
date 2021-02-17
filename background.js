chrome.runtime.onInstalled.addListener(() => {handlePeriodicDownloads('install')});
chrome.runtime.onStartup.addListener(() => {handlePeriodicDownloads('startup')});

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log("Rouvy refresh on alarm " + alarm.name);
    downloadRouvyDetails();
});


function handlePeriodicDownloads(alarm) {
    downloadRouvyDetails();
    chrome.alarms.create(alarm, {periodInMinutes: 30});
}

function downloadRouvyDetails() {
    console.log(new Date());
    console.log("Downloading races");
    fetch('https://api.apify.com/v2/key-value-stores/nFrxbygRB2CnxK7QS/records/official_races?disableRedirect=true').then(r => r.text()).then(result => {
        chrome.storage.local.set({'rouvy_races': result}, function () {
            console.log('local storage updated - races');
        });
    });

    console.log("Downloading career");
    fetch('https://api.apify.com/v2/key-value-stores/nFrxbygRB2CnxK7QS/records/carreer?disableRedirect=true').then(r => r.text()).then(result => {
        chrome.storage.local.set({'rouvy_career': result}, function () {
            console.log('local storage updated - career');
        });
    });

    console.log("Downloading challenges");
    fetch('https://api.apify.com/v2/key-value-stores/nFrxbygRB2CnxK7QS/records/challenges?disableRedirect=true').then(r => r.text()).then(result => {
        chrome.storage.local.set({'rouvy_challenges': result}, function () {
            console.log('local storage updated - challenges');
        });
    });

    console.log("Downloading routes");
    fetch('https://api.apify.com/v2/key-value-stores/nFrxbygRB2CnxK7QS/records/routes?disableRedirect=true').then(r => r.text()).then(result => {
        chrome.storage.local.set({'rouvy_routes': result}, function () {
            console.log('local storage updated - routes');
        });
    });
}