const main_url = "https://my.rouvy.com";

function getRoutes() {
    console.log('Getting routes');
    return new Promise(function(resolve) {
        chrome.storage.local.get(['rouvy_routes'], function(result) {
            resolve(JSON.parse(result.rouvy_routes));
        })
    });
}


function add_remove_button(parent,route_link) {
    if(parent.children('div.btn-danger.favouriteButton').length === 0) {
        let div = document.createElement('div');
        div.className = 'btn btn-danger favouriteButton';
        div.onclick = async function () {
            await remove_route(parent, route_link);
        };

        let span = document.createElement('span');
        span.className = 'icon icon-heart-outline';
        const text = document.createTextNode("Remove from my favourites");
        span.appendChild(text);
        div.appendChild(span);
        parent[0].appendChild(div);
    }
}

function add_estimated_time(parent, time) {
    const label_string = 'Estimated time (2 W/kg)';
    if(parent.find(`td:contains(${label_string})`).length === 0) {
        let tr = document.createElement('tr');
        let td_label = document.createElement('td');
        td_label.className = 'label';
        const label = document.createTextNode(label_string);
        td_label.appendChild(label);
        let td_value = document.createElement('td');
        const value = document.createTextNode(time);
        td_value.appendChild(value);
        tr.appendChild(td_label);
        tr.appendChild(td_value);
        parent[0].appendChild(tr);
    }
}

function remove_route(parent,route_link) {
    $.ajax({
        url: `${main_url}${route_link}?do=favouriteButton-remove`,
        dataType: "json",
        headers: {'X-Alt-Referer': main_url },
        success: function(data){
            console.log(data);
        }
    });
    parent.closest('div.box.route').remove();
}

function find_route_link(parent) {
    return $(parent.find('a')).attr('href');
}

function enrich_favourites() {
    $('div.box.route').each(function() {
        let route_link = find_route_link($(this));
        add_remove_button($(this),route_link);
    });
}

function enrich_routes(routes) {
    $('div.box.route').each(function() {
        let tbody_description = $(this).find('tbody');
        let route_link = find_route_link($(this)).replace('virtualni-trasy','virtual-routes').replace('virtuelle-strecken','virtual-routes');
        const route = routes[`${main_url}${route_link}`];
        let time = "unknown";
        if(route) {
            time = route.estimated_time;
        }
        add_estimated_time(tbody_description, time);
    });
}

//categories are loaded through AJAX - need to monitor dom changes
MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

var observer = new MutationObserver(async function(mutations, observer) {
    if($('strong.text-primary:contains("My favorite"),strong.text-primary:contains("Moje oblíbené")').length > 0) {
        enrich_favourites();
    }
    const routes = await getRoutes();
    enrich_routes(routes);
});

observer.observe($('div.oncont.categories')[0], {
    subtree: true,
    attributes: true
});