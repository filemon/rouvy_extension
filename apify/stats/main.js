/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const {utils: {log}} = Apify;

const site = 'https://my.rouvy.com';
const url = 'https://my.rouvy.com/public-rankings/seasonresults';

async function preventPopup(page) {
    await page.setCookie(...[{
        name: 'popupBanner18',
        value: "true",
        domain: '.rouvy.com',
        url: site
    }]);
}

async function scrapeStats(page, number_of_pages) {

    await scrapeStatsPage(page);
    // scrape all pages for given category
    for (let i = 2; i < number_of_pages + 1; i++) {
        log.info('Scraping page' + i);
        await Promise.all([
            page.click(`a.ajax.button[href*="seasonResultsPaginator-page=${i}"]`),
            page.waitForResponse(response => {
                return response.request().url().startsWith(site);
            })
        ]);
        await scrapeStatsPage(page);
    }
}

async function scrapeStatsPage(page) {
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
    let promises = [];
    stats.forEach(element => {
        promises.push(Apify.pushData(element));
    });
    await Promise.all(promises);
}

Apify.main(async () => {
    const {number_of_stats_pages} = await Apify.getInput();

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
    await scrapeStats(page,Number.parseInt(number_of_stats_pages));
    log.info('Crawl finished.');

});
