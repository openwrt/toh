(function($) {

const TOH_DATA_MIN_URL = 'https://openwrt.github.io/toh/toh/index.html';
const TOH_DATA_FULL_URL = 'https://openwrt.github.io/toh/toh-full/index.html';

const TOH_PROFILES = {
	default: {
		source: 'min'
	},
	full: {
		source: 'full'
	},
	supported_devices: {
		source: 'min',
		dom: 'frt',
		paging: false,
		filterColumns: {
			supportedcurrentrel: 'snapshot|[0-9]+'
		}
	}
};

let resourcesLoaded = false;
let tohTableMin, tohTableFull;

function loadStyle(url) {
	return new Promise(function(acceptFn, rejectFn) {
		let link = document.createElement('link');

		link.onload = acceptFn;
		link.onerror = rejectFn;

		document.querySelector('head').appendChild(link);

		link.rel = 'stylesheet';
		link.href = url;
	});
}

function loadScript(url) {
	return new Promise(function(acceptFn, rejectFn) {
		let script = document.createElement('script');

		script.onload = acceptFn;
		script.onerror = rejectFn;

		document.querySelector('head').appendChild(script);

		script.src = url;
	});
}

function loadResources() {
	if (resourcesLoaded)
		return Promise.resolve();

	return Promise.all([
		loadStyle('https://cdn.datatables.net/1.13.7/css/jquery.dataTables.css'),
		loadScript('https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js'),
		loadStyle('https://cdn.datatables.net/searchpanes/2.2.0/css/searchPanes.dataTables.min.css'),
	]).then(() => resourcesLoaded = true);
}

function loadMinTableData() {
	return Promise.resolve(tohTableMin ??= fetch(TOH_DATA_MIN_URL).then(reply => reply.text()).then(markup => {
		let parse = new DOMParser();
		let html = parse.parseFromString(markup, 'text/html');

		return (tohTableMin = html.querySelector('#devices'));
	}));
}

function loadFullTableData() {
	return Promise.resolve(tohTableFull ??= fetch(TOH_DATA_FULL_URL).then(reply => reply.text()).then(markup => {
		let parse = new DOMParser();
		let html = parse.parseFromString(markup, 'text/html');

		return (tohTableFull = html.querySelector('#devices'));
	}));
}

function initToH() {
	let wrappers = document.querySelectorAll('div.wrap_toh');

	if (!wrappers.length)
		return;

	loadResources().then(wrappers.forEach((wrapper, toh_id) => {
		let profileName = 'default';

		wrapper.classList.forEach(className => {
			let m = className.match(/^wrap_toh_profile_(.+)$/);
			if (m) profileName = m[1];
		});

		let profile = TOH_PROFILES[profileName] ?? TOH_PROFILES.default;

		profile.source ??= 'min';
		profile.filterColumns ??= {};
		profile.hiddenColumns ??= [];

		(profile.source == 'full' ? loadFullTableData() : loadMinTableData()).then(srcTable => {
			$(wrapper).empty().append(srcTable.cloneNode(true));

			let table = $(wrapper).children('table');

			table.attr('id', `toh_${profile.source}_${toh_id}`);
			table.find('a[href^="https://openwrt.org/toh/"]').each((i, a) => {
				let m = a.href.match(/^https:\/\/openwrt\.org\/toh\/([^\/]+)\/([^\/]+)$/);
				if (m) $(a).replaceWith(`<a href="/toh/${m[1]}/${m[2]}" class="wikilink1" title="toh:${m[1]}:${m[2]}">${m[2]}</a>`)
			});

			// Obtain filter presets
			let filterValues = [];
			let hiddenColumns = {};
			let shownColumns = {};
			let selectedColumnsOnly = false;
			let pageLength = 50;

			$(wrapper).find('thead tr th').each(function(i, th) {
				let key = `column_${i}`;

				th.classList.forEach(className => {
					let m = className.match(/^toh_(.+)$/);
					if (m) key = m[1];
				});

				let classNameFilterPrefix = `wrap_toh_filter_${key}_`;
				let classNameHidden = `wrap_toh_hide_${key}`;
				let classNameShown = `wrap_toh_show_${key}`;

				wrapper.classList.forEach(function(className) {
					if (className.indexOf(classNameFilterPrefix) === 0) {
						let val = className.substring(classNameFilterPrefix.length);

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

				if (profile.filterColumns[key])
					filterValues[i] = profile?.filterColumns[key];

				if (profile.hiddenColumns.includes(key))
					hiddenColumns[i] = true;
			});

			// Setup - add a text input to each footer cell
			$(wrapper).find('thead tr')
				.clone(true)
				.addClass('filters')
				.appendTo(table.children('thead'));

			// Init datatable
			let unorderable = [];
			let ordering = [];

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
				let title = th.innerText.trim();

				if (selectedColumnsOnly && !shownColumns[colIdx])
					hiddenColumns[colIdx] = true;

				if (hiddenColumns[colIdx])
					return;

				// Disable sort and filter input for fixed columns
				if (th.classList.contains('toh_edit') || th.classList.contains('toh_page')) {
					$(th).html('&nbsp;');
					unorderable.push(colIdx);
				}
				// Disable filter input for filtered columns
				else if (th.classList.contains('toh_devicepage') || filterValues[colIdx] != null) {
					$(th).html('&nbsp;');
					ordering.push([ colIdx, 'asc' ]);
				}
				// User filters for remaining columns
				else {
					$(th).html('<input style="width:100%" type="text" placeholder="' + title + '" />');
					ordering.push([ colIdx, 'asc' ]);
				}
			});

			table.DataTable({
				dom: profile?.dom ?? 'lfrtip',
				paging: profile?.paging ?? true,
				pageLength: profile?.pageLength ?? 50,
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
					let api = this.api();
					let datatable = this;

					// For each column
					api
						.columns()
						.eq(0)
						.each(function (colIdx) {
							let column = api.column(colIdx);

							if (filterValues[colIdx] != null)
								column.search(filterValues[colIdx], true, false).draw();

							// On every keypress in this input
							let th = table.find('.filters th').eq(colIdx);
							$(th.children('input'), th)
								.off('keyup change')
								.on('keyup change', function (e) {
									e.stopPropagation();
									// Get the search value
									$(this).attr('title', $(this).val());
									let regexr = '({search})'; //$(this).parents('th').find('select').val();
									let cursorPosition = this.selectionStart;
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
	}));
}

initToH();

})(jQuery);
