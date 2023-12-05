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
			supportedcurrentrel: '!^(EOL|-|)$'
		}
	}
};

let resourcesLoaded, tohTableMin, tohTableFull;

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
	return Promise.resolve(resourcesLoaded ??= Promise.all([
		loadStyle('https://cdn.datatables.net/1.13.7/css/jquery.dataTables.css'),
		loadScript('https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js'),
		loadStyle('https://cdn.datatables.net/searchpanes/2.2.0/css/searchPanes.dataTables.min.css'),
	]).then(() => {
		$.fn.dataTable.ext.search.push(
			function (settings, searchData, index, rowData, counter) {
				let filterValues = $(settings.nTable).data('presetFilter');

				for (let colIdx in filterValues) {
					let colValue = searchData[+colIdx];
					let searchPatterns = Array.isArray(filterValues[colIdx]) ? filterValues[colIdx] : [ filterValues[colIdx] ];

					for (let i = 0; i < searchPatterns.length; i++) {
						let searchPattern = searchPatterns[i];
						let expectMatch = true;

						if (searchPattern.charAt(0) == '!') {
							searchPattern = searchPattern.substring(1);
							expectMatch = false;
						}

						if ((new RegExp(searchPattern).test(colValue)) != expectMatch)
							return false;
					}
				}

				return true;
			}
		);

		resourcesLoaded = true;
	}));
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
	let wrappers = [...document.querySelectorAll('div.wrap_toh')];

	const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT,
		node => node.data.match(/^\s*ToH:\s*\{/s) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);

	for (let comment = iter.nextNode(); comment != null; comment = iter.nextNode()) {
		let wrapper = document.createElement('div');
		wrapper.classList.add('toh');
		wrapper.setAttribute('data-settings', comment.data.replace(/^\s*ToH:/s, '').trim());
		wrapper.innerHTML = 'Loading data...';
		wrappers.push(wrapper);
		$(comment).replaceWith(wrapper);
	}

	if (!wrappers.length)
		return;

	loadResources().then(() => wrappers.forEach((wrapper, toh_id) => {
		let profileName = 'default';

		wrapper.classList.forEach(className => {
			let m = className.match(/^wrap_toh_profile_(.+)$/);
			if (m) profileName = m[1];
		});

		let profile;
		try { profile = JSON.parse(wrapper.getAttribute('data-settings')); }
		catch(e) { console.error('Error parsing ToH settings: ' + e); }

		profile ??= TOH_PROFILES[profileName] ?? TOH_PROFILES.default;
		profile.source ??= 'min';
		profile.filterColumns ??= {};
		profile.hiddenColumns ??= [];

		(profile.source == 'full' ? loadFullTableData() : loadMinTableData()).then(srcTable => {
			let table = $(srcTable.cloneNode(true));

			$(wrapper).empty().append(table);

			table.attr('id', `toh_${profile.source}_${toh_id}`);
			table.find('a[href^="https://openwrt.org/toh/"]').each((i, a) => {
				let m = a.href.match(/^https:\/\/openwrt\.org\/toh\/([^\/]+)\/([^\/]+)$/);
				if (m) $(a).replaceWith(`<a href="/toh/${m[1]}/${m[2]}" class="wikilink1" title="toh:${m[1]}:${m[2]}">${m[2]}</a>`)
			});
			table.find('td').each((i, td) => {
				if (td.childNodes.length == 1 && td.firstChild.nodeType == 3)
					td.firstChild.data = td.firstChild.data.replace(/,/g, ', ');
			});

			// Obtain filter presets
			let filterValues = [];
			let hiddenColumns = {};
			let shownColumns = {};
			let selectedColumnsOnly = false;
			let pageLength = 50;

			table.find('thead tr th').each(function(i, th) {
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

				let m = location.href.match(new RegExp(`[?&;]toh\\.filter\\.${key}=([^?&;]+)`));
				if (m) filterValues[i] = m[1];
			});

			// Setup - add a text input to each footer cell
			table.find('thead tr')
				.clone(true)
				.addClass('filters')
				.appendTo(table.children('thead'));

			// Init datatable
			let unorderable = [];
			let ordering = [];

			// Tweak title styles
			table.find('tr th').each(function(colIdx, th) {
				th.style.maxWidth = 0;
				th.style.minWidth = '3em';
				th.style.whiteSpace = 'nowrap';
				th.style.overflow = 'hidden';
				th.style.textOverflow = 'ellipsis';
				th.title = th.innerText;
			});

			table.data('presetFilter', filterValues);

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
				// Disable filter input for device page
				else if (th.classList.contains('toh_devicepage')) {
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
