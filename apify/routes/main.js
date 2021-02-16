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

    const browser = await Apify.launchPuppeteer();

    console.log(`Opening page ${input.url}...`);
    const page = await browser.newPage();
    await page.goto(input.url);
    const details = await page.evaluate(async () => {
        let buttons = $('div.records a.button');
        let page_index = 0;
        let name = $('h1 > strong').text();
        let author = $("td:contains('Author')").first().next().text();
        let rating = $('div.stars').attr('data-rating');
        let country = $("td:contains('Country')").first().next().text();
        let distance = $("td:contains('Distance')").first().next().text();
        let ascended = $("td:contains('Ascended')").first().next().text();
        let max_grade = $("td:contains('Max grade')").first().next().text();
        let avg_grade = $("td:contains('AVG grade')").first().next().text();
        let record_time = $($($('div.tabcont.records tbody tr').first()).children()[8]).text();
        let AR = $('div.overInfoVT[dataVT="AR route"]').length > 0 ? 1:0;
        let video = $('div.overInfoVT[dataVT="route with video"]').length > 0 ? 1:0;
        let twoK = $('div.overInfoVT[dataVT="video in 2K"]').length > 0 ? 1:0;
        switch(buttons.length) {
            case 2: page_index = 1; break;
            default: page_index = buttons.length-2;
        }
        let button = buttons[page_index]; //find the average record page
        $(button).click();
        await new Promise(function(resolve) {setTimeout(resolve, 2000)});
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
            "video_2K": twoK};
    });
    details['ascended'] = feetsToM(details['ascended']);
    details['distance'] = milesToKm(details['distance']);
    console.log(details);
    console.log('Closing Puppeteer...');
    await browser.close();

    const rouvy_store = await Apify.openKeyValueStore('rouvy');
    let routes = await rouvy_store.getValue('routes');
    if(!routes) {
        routes = {};
    }
    routes[input.url] = details;
    await rouvy_store.setValue('routes', routes);
    await Apify.pushData(details);

    console.log('Done.');
});
