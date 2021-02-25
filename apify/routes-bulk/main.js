/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const { utils: { log } } = Apify;

const site = 'https://my.rouvy.com';

async function getPageCount(page){
    return await page.evaluate(() => {
        return $('div.oncont div.paginator a.ajax.button').length;
    });
}

async function killPopup(page) {
    log.info('Killing popup');
    await page.evaluate(()=>document.querySelector('a.fontello.close').click());
}

async function scrapeCategory(page, category) {
    await Promise.all([
        page.click(`div.category[data-category="${category}"]`),
        page.waitForResponse(response => {
            return response.request().url().startsWith(site);
        }), //interim
        new Promise(function(resolve) {setTimeout(resolve, 3000)})
    ]);
    await killPopup(page);
    let pageCount = await getPageCount(page);
    log.info("Pages:" + pageCount);
    // scrape all pages for given category
    for(let i=0; i < pageCount; i++) {
        await killPopup(page);
        await Promise.all([
            page.click(`div.oncont div.paginator a.ajax.button[href="/virtual-routes?categoryPaginator-page=${i+2}"]`),
            page.waitForResponse(response => {
                return response.request().url().startsWith(site);
            })
        ]);
        await killPopup(page);
        await scrapeCategoryPage(page);
    }
}

async function scrapeCategoryPage(page) {
    let routes  = await page.evaluate((site) => {
        let routes = $('div.oncont div.box.route a').map(function () {
            return `${site}${this.getAttribute('href')}`;
        }).get(); //get the simple array of route links
        return routes;
    },site);
    log.info(routes);
    //call route detail actor
    if(routes.length > 0) {
        let store = await Apify.openKeyValueStore('rouvy');
        let scraped_routes = await store.getValue('routes') || {"routes": {}};
        for (let i = 0; i < routes.length; i++) {
            let link = routes[i];
            log.info('Going to scrape ' + link);
            if (!scraped_routes[link]) {
                let routes_input = {"url": link, "use_cache": true};
                await Apify.call('filemon/rouvy-routes', routes_input);
            } else {
                log.info('Route already scraped, skipping');
            }
        }
    }
}

Apify.main(async () => {
    const { url } = await Apify.getInput();

    const browser = await Apify.launchPuppeteer();

    console.log(`Opening page ${url}...`);
    const page = await browser.newPage();
    await page.goto(url);
    const categories = await page.evaluate(() => {
        let categories = $('div.oncont div.category').map(function () {
            return this.getAttribute('data-category')}
            ).get(); //get the simple array of categories
        return categories;
    });
    log.info(categories);
    for (let i = 0; i < 4; i++) {
        await scrapeCategory(page,categories[i]);
        await page.goto(url);
    };
    log.info('Crawl finished.');

});
