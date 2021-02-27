/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const {utils: {log}} = Apify;

const site = 'https://my.rouvy.com';

async function preventPopup(page) {
    await page.setCookie(...[{
        name: 'popupBanner18',
        value: "true",
        domain: '.rouvy.com',
        url: site
    }]);
}

async function scrapeStats(page, number_of_pages) {
    let stats = {};
    stats =  await scrapeStatsPage(stats,page);
    // scrape all pages for given category
    for (let i = 2; i < number_of_pages + 1; i++) {
        log.info('Scraping page' + i);
        await Promise.all([
            page.click(`a.ajax.button[href*="seasonResultsPaginator-page=${i}"]`),
            page.waitForResponse(response => {
                return response.request().url().startsWith(site);
            })
        ]);
        stats = await scrapeStatsPage(stats,page);
    }
    return stats;
}

//add array of jsons to result
function addToResults(result,additions) {
    additions.forEach((element) => {
        result[Object.keys(element)[0]] = element[Object.keys(element)[0]];
//        result[Object.keys(element)[0]].distance = milesToKm(result[Object.keys(element)[0]].distance);
    });
    return result;
}



async function scrapeStatsPage(currentStats,page) {
    let stats = await page.evaluate(() => {
        let users = $('#snippet--seasonResults tr').map(function () {
            let user = $(this).find('a').text();
            let gender = $(this).children('td.gender').text();
            let age = $(this).children('td.age').text();
            let level = $(this).children('td.levellogo').attr('datavt');
            let tss = $(this).children('td.points').text();
            let distance = $(this).children('td.distance').text();
            let hours = $(this).children('td.duration').text();
            return { [user]: {
                        gender: gender,
                        age: age,
                        level: level,
                        tss: tss,
                        distance: distance,
                        hours: hours
                }};
        });
        return users.get();
    });
    return addToResults(currentStats,stats);
}

Apify.main(async () => {
    const {url,number_of_stats_pages} = await Apify.getInput();

    const browser = await Apify.launchPuppeteer();
    const page = await browser.newPage();

    const sessionPool = await Apify.openSessionPool({
        maxPoolSize: 1,
        sessionOptions: {
            maxAgeSecs: 300000, //3 days
            maxUsageCount: 150, // for example when you know that the site blocks after 150 requests.
        },
        persistStateKeyValueStoreId: 'login-sessions',
        persistStateKey: 'SESSION_POOL_STATE'
    });
    // Get random session from the pool
    const session1 = await sessionPool.getSession();
    let stored_cookies = session1.getPuppeteerCookies(site);
    stored_cookies.map(function(e){
        e.url = site;//page.setCookie doesn't set anything if url not present
        e.domain = '.rouvy.com'//page.setCookie doesn't set anything if domain is not full url
    });
    await page.setCookie(...stored_cookies);
    await page.goto(`${site}`);

    page.on('console', consoleObj => console.log(consoleObj.text()));

    const input =  await Apify.getValue('INPUT');

    await page.evaluate(input => {
        if(!$('body.User-dashboard').length) {
            console.log("Logging in");
            $('input[type=\"email\"]').val(input["rouvy_user"]);
            $('input[type=\"password\"]').val(input["rouvy_pass"]);
            $('input[type=\"submit\"]').click();
        } else {
            console.log('Already logged in');
        }
    }, input);
    let page_cookies = await page.cookies();
    await session1.setPuppeteerCookies(page_cookies,site);
    await sessionPool.persistState();
    await new Promise(function(resolve) {setTimeout(resolve, 5000)});


    console.log(`Opening page ${url}...`);

    await preventPopup(page);
    await page.goto(url);
    let stats = await scrapeStats(page,Number.parseInt(number_of_stats_pages));
    await Apify.pushData(stats);
    console.log(stats);
    log.info('Crawl finished.');

});
