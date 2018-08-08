export default function loadTemplates(url)
{
    return new Promise(function(resolve, reject)
    {
        var templates = {};

        jQuery.ajax({ url: url })
        .done(function(data, textStatus, jqXHR)
        {
            jQuery('<div>').append(data).children().each(function()
            {
                templates[jQuery(this).prop('id')] = jQuery(this).get();
            });
            resolve(templates);
        })
        .fail(function(jqXHR, textStatus, errorThrown)
        {
            reject(errorThrown);
        });
    });
}