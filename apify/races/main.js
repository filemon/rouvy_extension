const Apify = require('apify');
const site = 'https://my.rouvy.com';

function convert(fromStr,toStr, conversionRate, decimalPlaces) {
    let from = Number(fromStr.split(/\s/)[0]);
    console.log('converting ' + from);
    let to = from*conversionRate;
    return `${to.toFixed(decimalPlaces)} ${toStr}`;
}

function milesToKm(miles) {
    return convert(miles,'km',1.6087,2);
}

function feetsToM(feets) {
    return convert(feets,'m',0.3048,0);
}

async function getRaceDetails(url, site) {
    const browser = await Apify.launchPuppeteer({useApifyProxy:true,stealth:true});
    const page = await browser.newPage()
    console.log(`Scanning race details: ${site}${url}`);
    await page.setDefaultNavigationTimeout(0);
    await page.goto(`${site}${url}`);
    page.on('console', consoleObj => console.log(consoleObj.text()));
    let details = {};

    try {
        details = await page.evaluate(async () => {
            let ascended = $("td:contains('Ascended')").next().text();
            let max_grade = $("td:contains('Max grade')").next().text();
            let avg_grade = $("td:contains('AVG grade')").next().text();
            let capacity = $("h3:contains('CAPACITY')").text();
            let route = $('a[href*="/virtual-routes/detail"]').text();
            let link = $('a[href*="/virtual-routes/detail"]').attr('href');
            capacity = capacity.split(" ")[2];
            return {"ascended": ascended,
                'max_grade': max_grade,
                'avg_grade': avg_grade,
                'capacity': capacity,
                'route': route,
                'link': `https://my.rouvy.com${link}`};
        });
    } catch(err) {
        console.log('Error when getting details:' + err);
        details = {"ascended": "",
            "max_grade": "%",
            "avg_grade": "",
            "capacity": "",
            "route": "",
            "link": ""
        };
    }
    await browser.close();
    return details;
}

Apify.main(async () => {

    console.log('Launching Puppeteer...');

    const browser = await Apify.launchPuppeteer({useApifyProxy:true});
    const page = await browser.newPage();
    //   await page.setDefaultNavigationTimeout(0);
    await page.goto(`${site}/onlinerace`);

    page.on('console', consoleObj => console.log(consoleObj.text()));

    console.log('Scanning available races');
    const input =  await Apify.getValue('INPUT');
    const races = await page.evaluate(async (input) => {
        const buttonSelector = 'div.moreButton[id="snippet-moreButtonPlanned-component"] > a';
        const number_of_pages = input["number_of_pages"] || 10;
        for(let i=0;i<number_of_pages;i++){
            try {
                console.log('Clicking the "More" button.');
                await $(buttonSelector).click();
                // Default timeout first time.
                await new Promise(function(resolve) {setTimeout(resolve, 1000)});
                // 2 sec timeout after the first.                 
            } catch (err) {
                // Ignore the timeout error.
                console.log(`Error: ${err}`);
            }
        }
        //let races_elements = $('div.planned a[href="/ROUVY"]').closest('tr'); 
        let races_elements = $('div.planned a').closest('tr');
        let races = {'races':{}};
        $(races_elements).each(function(){
            let date = $($(this).children()[1]).text();
            console.log(date);
            let title = $($(this).children()[2]).text();
            let mileage = $($(this).children()[3]).text();
            let link = $($(this).find('a.btn')).attr('href');
            console.log(link);
            races['races'][link] = {    date: date,
                title: title,
                mileage: mileage,
                link: link
            }
        });

        return races;
    },input);
    browser.close();

    for(var link in races['races']) {
        let details = await getRaceDetails(link,site);
        details['ascended'] = feetsToM(details['ascended']);
        races['races'][link]['details'] = details;
    }
    // await Promise.all(races['races'].map(async (race) => {
    //    let details = await getRaceDetails(race['link'],site);
    //    race['details'] = details;
    // }));
    // Store the results to the default dataset.
    const store = await Apify.openKeyValueStore('rouvy');
    await store.setValue('official_races', races);
    await Apify.pushData(races);
    console.log("Script finnished");
});