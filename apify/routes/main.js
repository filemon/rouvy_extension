// This is the main Node.js source code file of your actor.
// It is referenced from the "scripts" section of the package.json file,
// so that it can be started by running "npm start".

// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require('apify');

const { utils: { log } } = Apify;

const site = 'https://my.rouvy.com';

function convert(fromStr,toStr, conversionRate, decimalPlaces) {
    let from = Number(fromStr.split(/\s/)[0]);
    log.info('converting ' + from);
    let to = from*conversionRate;
    return `${to.toFixed(decimalPlaces)} ${toStr}`;
}

function milesToKm(miles) {
    return convert(miles,'km',1.6087,2);
}

function feetsToM(feets) {
    return convert(feets,'m',0.3048,0);
}

async function preventPopup(page) {
    await page.setCookie(...[{
        name: 'popupBanner18',
        value: "true",
        domain: '.rouvy.com',
        url: site
    }]);
}

Apify.main(async () => {
    const input = await Apify.getInput();
    log.info('Input:');
    console.dir(input);

    if (!input || !input.url) throw new Error('Input must be a JSON object with the "url" field!');
    let rouvy_store = await Apify.openKeyValueStore('rouvy');
    let routes = await rouvy_store.getValue('routes');
    let details = routes[input.url];
    let get_new_estimates = input.get_new_estimate; //force getting estimates

    if(details && !!!details.estimated_time) { // also get estimates by default where missing
        log.info('estimates not set');
        get_new_estimates = true;
    }

    if(details && input.use_cache && !get_new_estimates) {
        log.info('Route already scraped and use_cache is true, bailing out');
        await Apify.setValue("OUTPUT", details);
        await Apify.pushData(details);
        return details;
    }

    const browser = await Apify.launchPuppeteer();

    log.info(`Opening page ${input.url}...`);
    const page = await browser.newPage();
    await preventPopup(page);
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

    if(initial_page_info.button) { //we have more pages
        //have to wait for AJAX after a button click
        const [response] = await Promise.all([
            page.click(`a[href*="page=${initial_page_info.button}"]`),
            page.waitForResponse(response => {
                return response.request().url().startsWith(site);
            })
        ]);

    }

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

        let average_time = $($($('div.tabcont.records tbody tr').last()).children()[8]).text();
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
    log.info('Closing Puppeteer...');
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

    log.info('Done.');
});
