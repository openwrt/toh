(function($) {

const TOH_DATA_MIN_URL = 'https://openwrt.github.io/toh/toh/index.html';
const TOH_DATA_FULL_URL = 'https://openwrt.github.io/toh/toh-full/index.html';
const TOH_DATA_JSON_URL = 'https://openwrt.org/toh.json';

let resourcesLoaded, tohTableMin, tohTableFull, tohTableJSON;

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
	]).then(() => resourcesLoaded = true));
}

function tableToData(table) {
	let data = {
		columns: [],
		captions: [],
		entries: []
	};

	table.querySelectorAll('thead > tr > th').forEach((th, i) => {
		let colName;

		th.classList.forEach(className => {
			let m = className.match(/^toh_(.+)$/);
			if (m) colName = m[1];
		})

		switch (colName) {
		case 'edit': colName = 'deviceid'; break;
		case 'page': colName = 'devicepage'; break;
		}

		data.columns.push(colName ?? `column_${i}`);
		data.captions.push(th.innerText ?? '');
	});

	table.querySelectorAll('tbody > tr').forEach(tr => {
		let row = [];

		tr.querySelectorAll('td').forEach((td, i) => {
			switch (data.columns[i]) {
			case 'deviceid':
				row.push(td.querySelector('a[href]')?.href.replace(/^.+\/toh\/hwdata\//, '').replace('/', ':'));
				break;

			case 'devicepage':
				row.push(td.querySelector('a[href]')?.href.replace(/^.+\/toh\//, 'toh:').replace('/', ':'));
				break;

			default:
				const urls = td.querySelectorAll('a[href]');
				if (urls?.length)
					row.push([...urls].map(a => a.href));
				else
					row.push(td.innerText);
				break;
			}
		});

		data.entries.push(row);
	});

	return data;
}

function loadMinTableData() {
	return Promise.resolve(tohTableMin ??= fetch(TOH_DATA_MIN_URL).then(reply => reply.text()).then(markup => {
		let parse = new DOMParser();
		let html = parse.parseFromString(markup, 'text/html');

		return (tohTableMin = tableToData(html.querySelector('#devices')));
	}));
}

function loadFullTableData() {
	return Promise.resolve(tohTableFull ??= fetch(TOH_DATA_FULL_URL).then(reply => reply.text()).then(markup => {
		let parse = new DOMParser();
		let html = parse.parseFromString(markup, 'text/html');

		return (tohTableFull = tableToData(html.querySelector('#devices')));
	}));
}

function formatLink(url, title, internal) {
	let a = document.createElement('a');

	a.href = url;
	a.text = title;

	if (internal) {
		a.title = url.replace(/^https?:\/\/openwrt\.org\/|^\//, '').replace(/\//g, ':');
		a.classList.add('wikilink1');
	}
	else {
		a.rel = 'nofollow';
		a.classList.add('urlextern');
	}

	return a;
}

function formatValue(colName, value) {
	let m;

	switch (colName) {
	case 'oemdevicehomepageurl':
		if ((m = value.match(/^https?:\/\/(?:www\.)?([^\/]+)/)) != null)
			return formatLink(value, m[1]);
		else
			return formatLink(value, value);

	case 'owrt_forum_topic_url':
		if ((m = value.match(/\bviewtopic\.php\?id=(\d+)\b/)) != null)
			return formatLink(value, `Archive thread #${m[1]}`);
		else if ((m = value.match(/\bviewtopic\.php\?pid=(\d+)\b/)) != null)
			return formatLink(value, `Archive post #${m[1]}`);
		else if ((m = value.match(/\/t\/([^\/]{5,})(?:\/\d+\b|\/?$)/)) != null)
			return formatLink(value, `Discourse: ${m[1]}`);
		else
			return formatLink(value, value);

	case 'wikideviurl':
		return formatLink(value, `WikiDevi: ${value.replace(/^.+\//, '')}`);

	case 'firmwareoemstockurl':
		return formatLink(value, 'OEM Firmware');

	case 'firmwareopenwrtinstallurl':
		return formatLink(value, 'Factory image');

	case 'firmwareopenwrtupgradeurl':
		return formatLink(value, 'Sysupgrade image');

	case 'firmwareopenwrtsnapshotinstallurl':
		return formatLink(value, 'Factory snapshot image');

	case 'firmwareopenwrtsnapshotupgradeurl':
		return formatLink(value, 'Factory sysupgrade image');

	case 'deviceid':
		return formatLink(`/toh/hwdata/${value.replace(/:/g, '/')}`, 'Edit', true);

	case 'devicepage':
		return formatLink(`/${value.replace(/:/g, '/')}`, value.replace(/^.+[:\/]/, ''), true);

	case 'target':
		return formatLink(`/docs/techref/targets/${value}`, value, true);

	case 'packagearchitecture':
		return formatLink(`/docs/techref/instructionset/${value}`, value, true);

	case 'supportedsincerel':
	case 'supportedcurrentrel':
		if (value.match(/^(snapshot|[0-9.]+)$/))
			return formatLink(`/releases/${value}`, value, true);
		else
			return document.createTextNode(value ?? '');

	case 'supportedsincecommit':
		if ((m = value.match(/\bh=([0-9a-f]{8,})\b/)) != null || (m = value.match(/^https?:\/\/github\.com\/openwrt\/openwrt\/commit\/([0-9a-f]{8,})\b/)) != null)
			return document.createElement('code').appendChild(formatLink(value, m[1].substring(0, 12))).parentNode;
		else if ((m = value.match(/^https?:\/\/github\.com\/([^\/]+\/[^\/]+)\/commit\/([0-9a-f]{8,})\b/)) != null)
			return formatLink(value, `GitHub: ${m[1]}@${m[2].substring(0, 12)}`);
		else if ((m = value.match(/^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/([0-9]+)\b/)) != null)
			return formatLink(value, `GitHub: PR#${m[1]}`);
		else if ((m = value.match(/^https?:\/\/github\.com\/([^\/]+\/[^\/]+)\b/)) != null)
			return formatLink(value, `GitHub: ${m[1]}`);
		else
			return formatLink(value, value);

	case 'fccid':
		if ((m = value.match(/^https?:\/\/(?:fccid|fcc)\.io\/(.+)$/)) != null)
			return formatLink(value, m[1]);
		else if ((m = value.match(/^https?:\/\//)) != null)
			return formatLink(value, value);
		else
			return document.createTextNode(value ?? '');

	default:
		return document.createTextNode(value ?? '');
	}
}

function formatList(colName, values) {
	let res = document.createDocumentFragment();

	for (let i = 0; i < values.length; i++) {
		if (i > 0)
			res.appendChild(document.createTextNode(', '));

		res.appendChild(formatValue(colName, values[i]));
	}

	return res;
}

function loadJSONTableData() {
	return Promise.resolve(tohTableJSON ??= fetch(TOH_DATA_JSON_URL).then(reply => reply.json()).then(data => {
		return (tohTableJSON = data);
	}));
}

function dataToTable(data, columnOrder, filterColumns, domSetting, rotateTable) {
	let table = document.createElement('table');
	let columnFilter = data.columns.map((k, i) => filterColumns?.[k]).map(f => {
		if (!f)
			return () => true;

		let matcher = (Array.isArray(f) ? f : [ f ]).map(f => [
			new RegExp(f.replace(/^!/, ''), 'i'),
			f.charAt(0) != '!'
		]);

		return value => {
			for (let v of Array.isArray(value) ? value : [ value ?? '' ])
				for (let match of matcher)
					if (match[0].test(v) == match[1])
						return true;

			return false;
		};
	});

	columnOrder ??= data.columns.map((k, i) => i);

	table.style.width = '100%';
	table.classList.add('table', 'table-striped', 'table-sm');
	table.innerHTML = '<thead><tr></tr><tr class="filters"></tr></thead><tbody></tbody>'

	if (rotateTable)
		table.classList.add('rotate');

	columnOrder.forEach(colSrcIdx => {
		let th = document.createElement('th');

		if (data.columns[colSrcIdx] != 'deviceid') {
			th.appendChild(document.createTextNode(data.captions[colSrcIdx]));
			th.title = data.captions[colSrcIdx];
		}

		th.classList.add(`toh_${data.columns[colSrcIdx]}`);

		if (!rotateTable) {
			th.style.maxWidth = 0;
			th.style.minWidth = '3em';
			th.style.whiteSpace = 'nowrap';
			th.style.overflow = 'hidden';
			th.style.textOverflow = 'ellipsis';
		}

		table.firstElementChild.firstElementChild.appendChild(th);

		let filter = document.createElement('th');

		switch (data.columns[colSrcIdx]) {
		case 'deviceid':
		case 'devicepage':
			break;

		default:
			filter.appendChild(document.createElement('input'));
			filter.firstElementChild.type = 'text';
			filter.firstElementChild.placeholder = data.captions[colSrcIdx];
			filter.firstElementChild.style.width = '100%';
			break;
		}

		table.firstElementChild.lastElementChild.appendChild(filter);
	});

	if (domSetting.indexOf('f') === -1)
		table.firstElementChild.removeChild(table.firstElementChild.lastElementChild);

	data.entries.forEach((record, rowIdx) => {
		for (let i = 0; i < record.length; i++)
			if (!columnFilter[i](record[i]))
				return;

		let tr = document.createElement('tr');

		columnOrder.forEach(colSrcIdx => {
			let value = record[colSrcIdx];
			let td = document.createElement('td');

			if (Array.isArray(value))
				td.appendChild(formatList(data.columns[colSrcIdx], value));
			else if (value != null)
				td.appendChild(formatValue(data.columns[colSrcIdx], value));

			tr.appendChild(td);
		});

		table.lastElementChild.appendChild(tr);
	});

	return table;
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

		profile ??= {};
		profile.source ??= 'json';

		let loadSource;
		switch (profile.source) {
		case 'json': loadSource = loadJSONTableData(); break;
		case 'full': loadSource = loadFullTableData(); break;
		default:     loadSource = loadMinTableData(); break;
		}

		loadSource.then(srcData => {
			// Obtain filter presets
			let filterValues = [];
			let hiddenColumns = profile.hiddenColumns ?? [];
			let shownColumns = profile.shownColumns ?? [];
			let filterColumns = profile.filterColumns ?? {};
			let pageLength = 50;

			srcData.columns.forEach((colName, i) => {
				let classNameFilterPrefix = `wrap_toh_filter_${colName}_`;
				let classNameHidden = `wrap_toh_hide_${colName}`;
				let classNameShown = `wrap_toh_show_${colName}`;

				wrapper.classList.forEach(function(className) {
					if (className.indexOf(classNameFilterPrefix) === 0) {
						let val = className.substring(classNameFilterPrefix.length);

						if (filterValues[i])
							filterValues[i] += '|' + val;
						else
							filterValues[i] = val;
					}
					else if (className == classNameHidden) {
						hiddenColumns.push(colName);
					}
					else if (className == classNameShown && !shownColumns.includes(colName)) {
						shownColumns.push(colName);
					}
				});

				let m = location.href.match(new RegExp(`[?&;]toh\\.filter\\.${colName}=([^?&;]+)`));
				if (m) filterColumns[colName] = decodeURIComponent(m[1]);
			});

			if (!shownColumns.length)
				shownColumns = [ ...srcData.columns.filter(k => k != 'deviceid'), 'deviceid' ];

			for (let colName of hiddenColumns)
				shownColumns = shownColumns.filter(k => k != colName);

			const domSetting = profile?.dom ?? 'lfrtip';
			const columnOrder = shownColumns.map(colName => srcData.columns.indexOf(colName));
			const rotateTable = profile?.rotate ?? false;
			let table = $(dataToTable(srcData, columnOrder, filterColumns, domSetting, rotateTable));

			$(wrapper).hide().empty().append(table);
			$(wrapper).find('table').DataTable({
				dom: domSetting,
				paging: profile?.paging ?? true,
				pageLength: profile?.pageLength ?? 50,
				orderCellsTop: true,
				fixedHeader: true,
				order: shownColumns.map((k, i) => [k, i]).filter(e => e[0] != 'deviceid').map(e => [e[1], 'asc']),
				columnDefs: [ { orderable: false, targets: [ shownColumns.indexOf('deviceid') ] } ],
				initComplete: function () {
					let api = this.api();
					let datatable = this;

					// For each column
					api.columns().eq(0).each(colIdx => {
						// On every input in the filter cell
						table.find('.filters th').eq(colIdx).off('input').on('input', e => {
							const v = e.target.value;
							e.stopPropagation();
							api.column(colIdx).search(v != '' ? `(${v.replace(/[/\-\\^$*+?.()|[\]{}]/g, c => {
								switch (c) {
								case '*': return '.*';
								case '?': return '.';
								default:  return `\\${c}`;
								}
							})})` : '', v != '', v == '').draw();
						});
					});
				},
			});

			$(wrapper).show();
		});
	}));
}

initToH();

})(jQuery);
