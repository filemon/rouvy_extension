/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const {utils: {log}} = Apify;

const site = 'https://my.rouvy.com';

async function getPageCount(page) {
    return await page.evaluate(() => {
        return Number.parseInt($('div.oncont div.paginator a.ajax.button').last().text());
    });
}

async function preventPopup(page) {
    await page.setCookie(...[{
        name: 'popupBanner18',
        value: "true",
        domain: '.rouvy.com',
        url: site
    }]);
}

async function scrapeCategory(page, category) {
    await Promise.all([
        page.click(`div.category[data-category="${category}"]`),
        page.waitForResponse(response => {
            return response.request().url().startsWith(site);
        }), //interim
        new Promise(function (resolve) {
            setTimeout(resolve, 5000)
        })
    ]);
    let lastPage = await getPageCount(page);
    log.info(`Category: ${category}, pages: ${lastPage} `);
    // scrape all pages for given category
    for (let i = 2; i < lastPage + 1; i++) {
        log.info(i);
        await Promise.all([
            page.click(`div.oncont div.paginator a.ajax.button[href="/virtual-routes?categoryPaginator-page=${i}"]`),
            page.waitForResponse(response => {
                return response.request().url().startsWith(site);
            })
        ]);
        await scrapeCategoryPage(page);
    }
}

async function scrapeCategoryPage(page) {
    let routes = await page.evaluate((site) => {
        let routes = $('div.oncont div.box.route a').map(function () {
            return `${site}${this.getAttribute('href')}`;
        }).get(); //get the simple array of route links
        return routes;
    }, site);
    log.info(routes);
    //call route detail actor
    if (routes.length > 0) {
        let store = await Apify.openKeyValueStore('rouvy');
        let scraped_routes = await store.getValue('routes') || {"routes": {}};
        for (let i = 0; i < routes.length; i++) {
            let link = routes[i];
            log.info('Going to scrape ' + link);
            if (!scraped_routes[link]) {
                let routes_input = {"url": link, "use_cache": true};
                try {
                    await Apify.call('filemon/rouvy-routes', routes_input);
                } catch (error) {
                    log.info("Routes scraper call failed, never mind");
                }
                ;
            } else {
                log.info('Route already scraped, skipping');
            }
        }
    }
}

Apify.main(async () => {
    const {url} = await Apify.getInput();

    const browser = await Apify.launchPuppeteer();

    console.log(`Opening page ${url}...`);
    const page = await browser.newPage();
    await preventPopup(page);
    await page.goto(url);
    const categories = await page.evaluate(() => {
        let categories = $('div.oncont div.category').map(function () {
                return this.getAttribute('data-category')
            }
        ).get(); //get the simple array of categories
        return categories;
    });
    log.info(categories);
    for (let i = 0; i < categories.length; i++) {
        await scrapeCategory(page, categories[i]);
        await page.goto(url);
    }
    log.info('Crawl finished.');

});
