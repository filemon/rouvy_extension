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



function remove_route(parent,route_link) {
    let main_url = "https://my.rouvy.com";
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

function enrich_page() {
    $('div.box.route').each(function() {
        let route_link = $($(this).find('a')).attr('href');
        add_remove_button($(this),route_link);
    });
}


//categories are loaded through AJAX - need to monitor dom changes
MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

var observer = new MutationObserver(function(mutations, observer) {
    if($('strong.text-primary:contains("My favorite")').length > 0) {
        enrich_page();
    }
});

observer.observe($('div.oncont.categories')[0], {
    subtree: true,
    attributes: true
});