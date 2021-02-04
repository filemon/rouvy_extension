function getChallenges() {
    console.log('Getting challenges');
    return new Promise(function(resolve) {
        chrome.storage.local.get(['rouvy_challenges'], function(result) {
            resolve(JSON.parse(result.rouvy_challenges));
        })
    });
}

function add_add_to_favourites_button(parent) {
    if(parent.children('div.btn-success.favouriteButton').length === 0) {
        let div = document.createElement('div');
        div.className = 'btn btn-success favouriteButton';
        let challenge_link = $(parent.find('a')).attr('href');
        div.onclick = async function () {
            await add_routes_to_favourites(`https://my.rouvy.com${challenge_link}`);
        };

        let span = document.createElement('span');
        span.className = 'icon icon-heart-outline';
        const text = document.createTextNode("Add challenge routes to my favourites");
        span.appendChild(text);
        div.appendChild(span);
        parent[0].appendChild(div);
    }
}


async function add_routes_to_favourites(challenge_link) {
   let challenges = await getChallenges();
   let routes = challenges.challenges[challenge_link].routes;
   if(routes) {
       routes.forEach(route_link => {
          add_route_to_favourite(route_link);
       });
   }
}

function add_route_to_favourite(route_link) {
    console.log('Adding to favourites ' + route_link);
    $.ajax({
        url: `${route_link}?do=favouriteButton-add`,
        dataType: "json",
        success: function(data){
            console.log(data);
        }
    });
}

function enrich_page() {
    $('div.challenge.box').each(function() {
        add_add_to_favourites_button($(this));
    });
}

enrich_page();