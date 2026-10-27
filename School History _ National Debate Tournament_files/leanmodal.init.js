
function wpfd_frameload() {
    jQuery("#wpfd_loader").hide();
    jQuery("#wpfdmodalframe").css('visibility',"visible");
    jQuery("#wpfdmodalframe").show();
}

jQuery(document).ready(function ($) {
    $('.wpfdlaunch').leanModal({
        top: 20, beforeShow: function () {
            $("#wpfdmodal").css("height", "90%");
            $("#wpfdmodalframe").css('visibility','hidden');
            $("#wpfdmodalframe").hide();
            $("#wpfdmodalframe").attr('src', $("#wpfdmodalframe").data('src'));
            $("#wpfd_loader").show();
        }
    });


    $(document).on("click", '.wpfdlaunch', function (e) {
        // Kill all modal
        $('#wpfdmodal').remove();
        $('body').append('<div id="wpfdmodal"><img src="'+wpfdmodalvars.adminurl+'images/spinner-2x.gif" alt="Loading..." width="32" id="wpfd_loader" /><iframe id="wpfdmodalframe" onload="wpfd_frameload()"  width="100%" height="100%" marginWidth="0" marginHeight="0" frameBorder="0" scrolling="auto" data-src="'+wpfdmodalvars.adminurl+'admin.php?page=wpfd&noheader=1&caninsert=1"></iframe><button id="wpfd-close-modal">x</button></div>');
        $("#wpfdmodal").css("height", "90%");
        $("#wpfdmodalframe").css('visibility', 'hidden');
        $("#wpfdmodalframe").attr('src', $("#wpfdmodalframe").data('src'));
        $("#wpfd_loader").show();

        var modal_id = $(this).attr("href");
        //var modal_height=$(modal_id).outerHeight();
        var modal_width = $(modal_id).outerWidth();
        $("#lean_overlay").css({"display": "block", opacity: 0});
        $("#lean_overlay").fadeTo(200, 0.5);
        $(modal_id).css({"visibility": "visible", "display": "block", "text-align": "center", "position": "fixed", "opacity": 0, "z-index": 100102, "left": 50 + "%", "margin-left": -(modal_width / 2) + "px", "top": "20px"});
        $(modal_id).fadeTo(200, 1);

    });

    $(document).on('click', '#wpfd-close-modal', function (e) {
        $('#lean_overlay', window.parent.document).fadeOut(300);
        $('#wpfdmodal', window.parent.document).fadeOut(300);
        $('#wpfdmodal').remove();
    });

    // When editor is added to parent window
    $(window.parent.document).on("click", '.wpfdlaunch', function (e) {
        // Kill all modal
        $('#wpfdmodal', window.parent.document).remove();
        $('body', window.parent.document).append('<div id="wpfdmodal"><img src="'+wpfdmodalvars.adminurl+'images/spinner-2x.gif" alt="Loading..." width="32" id="wpfd_loader" /><iframe id="wpfdmodalframe" onload="wpfd_frameload()"  width="100%" height="100%" marginWidth="0" marginHeight="0" frameBorder="0" scrolling="auto" data-src="'+wpfdmodalvars.adminurl+'admin.php?page=wpfd&noheader=1&caninsert=1"></iframe><button id="wpfd-close-modal">x</button></div>');
        $("#wpfdmodal", window.parent.document).css("height", "90%");
        $("#wpfdmodalframe", window.parent.document).css('visibility', 'hidden');
        $("#wpfdmodalframe", window.parent.document).attr('src', $("#wpfdmodalframe").data('src'));
        $("#wpfd_loader", window.parent.document).show();

        var modal_id = $(this).attr("href");
        //var modal_height=$(modal_id).outerHeight();
        var modal_width = $(modal_id, window.parent.document).outerWidth();
        $("#lean_overlay",window.parent.document).css({"display": "block", opacity: 0});
        $("#lean_overlay",window.parent.document).fadeTo(200, 0.5);
        $(modal_id,window.parent.document).css({"visibility": "visible", "display": "block", "text-align": "center", "position": "fixed", "opacity": 0, "z-index": 100102, "left": 50 + "%", "margin-left": -(modal_width / 2) + "px", "top": "20px"});
        $(modal_id, window.parent.document).fadeTo(200, 1);

    });

    $(window.parent.document).on('click', '#wpfd-close-modal', function (e) {
        $('#lean_overlay', window.parent.document).fadeOut(300);
        $('#wpfdmodal', window.parent.document).fadeOut(300);
        $('#wpfdmodal').remove();
    });
    return false;
});
