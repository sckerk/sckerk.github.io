

$(document).ready(function() {  
	sizeitup();

  $('#level-two').on("click", function(e){
    $(this).next('div').toggle();
    e.stopPropagation();
    e.preventDefault();
  });
});
$(window).resize(function() {
	sizeitup();
});
window.onload = function() {
	sizeitup();
};
$(window).scroll(function() {
	sizeitup();
});

function sizeitup() {
	var bodyH = $(window).height();
	if($(window).scrollTop() > $('body').position().top) {
		$('header').removeClass('top');
	}
	else {
		$('header').addClass('top');
	}
};

$('#navicon').click(function() {
	$('header').toggleClass('open');
});