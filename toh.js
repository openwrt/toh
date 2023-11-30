(function($) {

function loadStyle(url) {
	return new Promise(function(acceptFn, rejectFn) {
		var link = document.createElement('link');

		link.onload = acceptFn;
		link.onerror = rejectFn;

		document.querySelector('head').appendChild(link);

		link.rel = 'stylesheet';
		link.href = url;
	});
}

function loadScript(url) {
	return new Promise(function(acceptFn, rejectFn) {
		var script = document.createElement('script');

		script.onload = acceptFn;
		script.onerror = rejectFn;

		document.querySelector('head').appendChild(script);

		script.src = url;
	});
}


const TOH_DATA_MIN_URL = 'https://openwrt.github.io/toh/toh/index.html';
const TOH_DATA_FULL_URL = 'https://openwrt.github.io/toh/toh-full/index.html';

function initToH(full) {
	Promise.all([
		loadStyle('https://cdn.datatables.net/1.13.7/css/jquery.dataTables.css'),
		loadScript('https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js'),
		loadStyle('https://cdn.datatables.net/searchpanes/2.2.0/css/searchPanes.dataTables.min.css'),
	]).then(function() {
		return fetch(full ? TOH_DATA_FULL_URL : TOH_DATA_MIN_URL);
	}).then(function(toh_reply) {
		return toh_reply.text();
	}).then(function(toh_table) {
		var parse = new DOMParser();
		var html = parse.parseFromString(toh_table, 'text/html');

		document.querySelectorAll(full ? 'div.wrap_toh_full' : 'div.wrap_toh').forEach(function(wrapper, toh_id) {
			$(wrapper).empty().append(html.querySelector('#devices').cloneNode(true));

			var table = $(wrapper).children('table');

			table.attr('id', `toh_${full ? 'full' : 'min'}_${toh_id}`);

			// Obtain filter presets
			var filterValues = [];
			var hiddenColumns = {};
			var shownColumns = {};
			var selectedColumnsOnly = false;

			$(wrapper).find('thead tr th').each(function(i, th) {
				var key = th.innerText.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_');
				var classNameFilterPrefix = `wrap_toh_filter_${key}_`;
				var classNameHidden = `wrap_toh_hide_${key}`;
				var classNameShown = `wrap_toh_show_${key}`;

				wrapper.classList.forEach(function(className) {
					if (className.indexOf(classNameFilterPrefix) === 0) {
						var val = className.substring(classNameFilterPrefix.length);

						if (filterValues[i])
							filterValues[i] += '|' + val;
						else
							filterValues[i] = val;
					}
					else if (className == classNameHidden) {
						hiddenColumns[i] = true;
					}
					else if (className == classNameShown) {
						shownColumns[i] = true;
						selectedColumnsOnly = true;
					}
				});
			});

			// Setup - add a text input to each footer cell
			$(wrapper).find('thead tr')
				.clone(true)
				.addClass('filters')
				.appendTo(table.children('thead'));

			// Init datatable
			var unorderable = [];
			var ordering = [];

			// Tweak title styles
			table.find('tr th').each(function(colIdx, th) {
				th.style.maxWidth = 0;
				th.style.whiteSpace = 'nowrap';
				th.style.overflow = 'hidden';
				th.style.textOverflow = 'ellipsis';
				th.title = th.innerText;
			});

			// Prepare filter inputs
			table.find('.filters th').each(function(colIdx, th) {
				var title = th.innerText.trim();

				if (selectedColumnsOnly && !shownColumns[colIdx])
					hiddenColumns[colIdx] = true;

				if (hiddenColumns[colIdx])
					return;

				// Disable sort and filter input for fixed columns
				if (title == 'OEM Device Homepage' || title == 'Device Page' || title == '' || filterValues[colIdx] != null) {
					$(th).html('&nbsp;');
					unorderable.push(colIdx);
				}
				// User filters for remaining columns
				else {
					$(th).html('<input style="width:100%" type="text" placeholder="' + title + '" />');
					ordering.push([ colIdx, 'asc' ]);
				}
			});

			table.DataTable({
				pageLength: 50,
				orderCellsTop: true,
				fixedHeader: true,
				order: ordering,
				columnDefs: [
					{ orderable: false, targets: unorderable },
					...Object.keys(hiddenColumns).map(colIdx => ({
						visible: false,
						searchable: false,
						target: +colIdx
					}))
				],
				initComplete: function () {
					var api = this.api();
					var datatable = this;

					// For each column
					api
						.columns()
						.eq(0)
						.each(function (colIdx) {
							var column = api.column(colIdx);

							if (filterValues[colIdx] != null)
								column.search(filterValues[colIdx], true, false).draw();

							// On every keypress in this input
							var th = table.find('.filters th').eq(colIdx);
							$(th.children('input'), th)
								.off('keyup change')
								.on('keyup change', function (e) {
									e.stopPropagation();
									// Get the search value
									$(this).attr('title', $(this).val());
									var regexr = '({search})'; //$(this).parents('th').find('select').val();
									var cursorPosition = this.selectionStart;
									// Search the column for that value
									api
										.column(colIdx)
										.search(
											(this.value != "") ? regexr.replace('{search}', '((('+this.value+')))') : "",
											this.value != "",
											this.value == "")
										.draw();

									$(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
								});
						});
				},
			});
		});
	});
}

if (document.querySelector('div.wrap_toh'))
	initToH(false);

if (document.querySelector('div.wrap_toh_full'))
	initToH(true);

})(jQuery);
