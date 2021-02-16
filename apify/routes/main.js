// This is the main Node.js source code file of your actor.
// It is referenced from the "scripts" section of the package.json file,
// so that it can be started by running "npm start".

// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require('apify');


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

Apify.main(async () => {
    // Get input of the actor (here only for demonstration purposes).
    // If you'd like to have your input checked and have Apify display
    // a user interface for it, add INPUT_SCHEMA.json file to your actor.
    // For more information, see https://docs.apify.com/actors/development/input-schema
    const input = await Apify.getInput();
    console.log('Input:');
    console.dir(input);

    if (!input || !input.url) throw new Error('Input must be a JSON object with the "url" field!');
    let rouvy_store = await Apify.openKeyValueStore('rouvy');
    let routes = await rouvy_store.getValue('routes');
    let details = routes[input.url];
    if(details) {
        console.log('Route already scraped, bailing out');
        await Apify.setValue("OUTPUT", details);
        await Apify.pushData(details);
        return details;
    }

    const browser = await Apify.launchPuppeteer();

    console.log(`Opening page ${input.url}...`);
    const page = await browser.newPage();
    await page.goto(input.url);
    let initial_page_info = await page.evaluate(() => {
        let buttons = $('div.records a.button');
        let page_index = 0;
        switch(buttons.length) {
            case 2: page_index = 1; break;
            default: page_index = buttons.length-2;
        }
        let button = buttons[page_index]; //find the average record page
        let record_time = $($($('div.tabcont.records tbody tr').first()).children()[8]).text();
        return {record_time: record_time, button: $(button).text()};
    });

    //have to wait for AJAX after a button click
    const [response] = await Promise.all([
        page.click(`a[href*="page=${initial_page_info.button}"]`),
        page.waitForResponse(response => {
            return response.request().url().startsWith('https://my.rouvy.com');
        })
    ]);

    details = await page.evaluate(async (record_time) => {
        let name = $('h1 > strong').text();
        let author = $("td:contains('Author')").first().next().text();
        let rating = $('div.stars').attr('data-rating');
        let country = $("td:contains('Country')").first().next().text();
        let distance = $("td:contains('Distance')").first().next().text();
        let ascended = $("td:contains('Ascended')").first().next().text();
        let max_grade = $("td:contains('Max grade')").first().next().text();
        let avg_grade = $("td:contains('AVG grade')").first().next().text();
        let AR = $('div.overInfoVT[dataVT="AR route"]').length > 0 ? 1:0;
        let video = $('div.overInfoVT[dataVT="route with video"]').length > 0 ? 1:0;
        let twoK = $('div.overInfoVT[dataVT="video in 2K"]').length > 0 ? 1:0;
        let HD = $('div.overInfoVT[dataVT="Video in High Quality"]').length > 0 ? 1:0;

        let average_time = $($($('div.tabcont.records tbody tr').first()).children()[8]).text();
        return {
            "name": name,
            "author": author,
            "rating": rating,
            "country": country,
            "distance": distance,
            "ascended": ascended,
            "max_grade": max_grade,
            "avg_grade": avg_grade,
            "record_time": record_time,
            "estimated_time": average_time,
            "AR": AR,
            "video": video,
            "video_2K": twoK,
            "HD":HD};
    },initial_page_info.record_time);
    details['ascended'] = feetsToM(details['ascended']);
    details['distance'] = milesToKm(details['distance']);
    console.log(details);
    console.log('Closing Puppeteer...');
    await browser.close();

    rouvy_store = await Apify.openKeyValueStore('rouvy');
    routes = await rouvy_store.getValue('routes');
    if(!routes) {
        routes = {};
    }
    routes[input.url] = details;
    await rouvy_store.setValue('routes', routes);
    await Apify.setValue("OUTPUT", details);
    await Apify.pushData(details);

    console.log('Done.');
});
