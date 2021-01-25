const Apify = require('apify');
const site = 'https://my.rouvy.com';


async function getChallengeDetails(page,url) {
    console.log(`Scanning challenge details: ${url}`);
    await page.setDefaultNavigationTimeout(0);
    await page.goto(`${url}`);
    let details = {};

    try {
        details = await page.evaluate(async (site) => {
            let details = [];
            const routes = $('h3 a[href*="/virtual-routes"]');
            routes.each(function() {
                details.push(`${site}${$(this).attr('href')}`);
            });
            return details;
        },site);
    } catch(err) {
        console.log('Error when getting details:' + err);
    }
    return details;
}


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
    await page.goto(`${site}/challenges`);

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

    let challenges = await page.evaluate(async (site) => {
        let ret = {"challenges": {}};
        let challenges = $('div.challengeCont.actual').children();
        challenges.each(function() {
            const challengeLink = 'a[href*="/challenges"]';
            let link = $($(this).find(challengeLink));
            let link_addr = site + link.attr('href');
            ret["challenges"][link_addr] = {name: link.text(), link: link_addr, routes:[]};
        });
        return ret;
    },site);

    for(var link in challenges['challenges']) {
        let details = await getChallengeDetails(page,link);
        challenges.challenges[link].routes = details;
    };

    console.log(challenges);
    const rouvy_store = await Apify.openKeyValueStore('rouvy');
    await rouvy_store.setValue('challenges', challenges);
    await Apify.pushData(challenges);


    console.log('Script finished.');
});