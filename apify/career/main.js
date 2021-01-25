const Apify = require('apify');
const site = 'https://my.rouvy.com/filemon/career';

Apify.main(async () => { 

    console.log('Launching Puppeteer...');

    const browser = await Apify.launchPuppeteer();
    const page = await browser.newPage();
    // Store the results to the default dataset.


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

    let carreer = await page.evaluate(async () => {
        let carreer = {'steps': []};
        let steps = $('div.careerStatus div.name');
        steps.each(function() {
            const routeSelector = 'a[href*="/virtual-routes/detail"]';
            let routes = [];
            $(this).parent().find(routeSelector).each(function() {
                routes.push(this.href);
            });
            let step = $(this).text();
            carreer.steps.push({
                [step]: routes
            });
        });
        return carreer;
    });
    const rouvy_store = await Apify.openKeyValueStore('rouvy');
    await rouvy_store.setValue('carreer', carreer);
    await Apify.pushData(carreer);


    console.log('Script finished.');
});